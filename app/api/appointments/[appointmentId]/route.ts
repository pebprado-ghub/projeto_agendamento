import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { notifyNextWaitlistForWindow } from "@/lib/waitlist";

type Params = {
  params: {
    appointmentId: string;
  };
};

type QuickActionInput = {
  action: "confirm" | "cancel" | "shift" | "checkin" | "complete";
  shiftMinutes?: number;
  notifyTemplate?: string;
};

function formatDateTimeLabel(iso: string) {
  const date = new Date(iso);
  return {
    date: date.toLocaleDateString("pt-BR"),
    time: date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    })
  };
}

function normalizePhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

function applyMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function toIso(value: Date) {
  return value.toISOString();
}

async function suggestRebookingSlots(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  businessId: string;
  durationMinutes: number;
  fromIso: string;
  maxItems?: number;
}) {
  const maxItems = Math.max(1, params.maxItems || 5);
  const startBase = new Date(params.fromIso);
  const suggestions: Array<{ startsAt: string; endsAt: string }> = [];
  for (let i = 1; i <= 21 && suggestions.length < maxItems; i += 1) {
    const candidateStart = new Date(startBase.getTime() + i * 24 * 60 * 60 * 1000);
    const candidateEnd = applyMinutes(candidateStart, params.durationMinutes);
    const { data: conflict } = await params.supabase
      .from("appointments")
      .select("id")
      .eq("business_id", params.businessId)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", candidateEnd.toISOString())
      .gt("ends_at", candidateStart.toISOString())
      .limit(1);
    if (!conflict || conflict.length === 0) {
      suggestions.push({
        startsAt: candidateStart.toISOString(),
        endsAt: candidateEnd.toISOString()
      });
    }
  }
  return suggestions;
}

function buildNotificationMessage(
  template: string,
  values: {
    customerName: string;
    startsAt: string;
    endsAt: string;
    status: string;
    shiftMinutes: number;
  }
) {
  const startLabel = formatDateTimeLabel(values.startsAt);
  const endLabel = formatDateTimeLabel(values.endsAt);
  return template
    .replaceAll("{{cliente}}", values.customerName)
    .replaceAll("{{data}}", startLabel.date)
    .replaceAll("{{inicio}}", startLabel.time)
    .replaceAll("{{fim}}", endLabel.time)
    .replaceAll("{{status}}", values.status)
    .replaceAll("{{minutos}}", String(values.shiftMinutes));
}

async function sendWhatsappTextMessage(to: string, body: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return { sent: false, reason: "Credenciais do WhatsApp nao configuradas." };
  }

  const response = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body }
      })
    }
  );

  if (!response.ok) {
    return { sent: false, reason: "Falha ao enviar notificacao pelo WhatsApp." };
  }

  return { sent: true as const };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const appointmentId = params.appointmentId;
    if (!appointmentId) {
      return NextResponse.json(
        { error: "appointmentId e obrigatorio." },
        { status: 400 }
      );
    }

    const body = (await request.json()) as QuickActionInput;
    if (!body.action) {
      return NextResponse.json({ error: "action e obrigatorio." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: current, error: currentError } = await supabase
      .from("appointments")
      .select(
        "id, customer_name, customer_phone, starts_at, ends_at, status, business_id"
      )
      .eq("id", appointmentId)
      .single();

    if (currentError || !current) {
      return NextResponse.json(
        { error: "Agendamento nao encontrado." },
        { status: 404 }
      );
    }

    const { data: businessRules } = await supabase
      .from("businesses")
      .select(
        "booking_reschedule_cutoff_minutes, booking_cancel_cutoff_minutes, booking_buffer_before_minutes, booking_buffer_after_minutes"
      )
      .eq("id", current.business_id)
      .single();

    const startsAtDate = new Date(current.starts_at);
    const diffMinutes = Math.floor((startsAtDate.getTime() - Date.now()) / 60_000);
    const rescheduleCutoff = Math.max(
      0,
      Number(businessRules?.booking_reschedule_cutoff_minutes || 0)
    );
    const cancelCutoff = Math.max(
      0,
      Number(businessRules?.booking_cancel_cutoff_minutes || 0)
    );
    const bufferBefore = Math.max(
      0,
      Number(businessRules?.booking_buffer_before_minutes || 0)
    );
    const bufferAfter = Math.max(0, Number(businessRules?.booking_buffer_after_minutes || 0));

    const patch: Record<string, string> = {};
    let shiftMinutes = 0;
    const vacatedWindow = {
      start: current.starts_at,
      end: current.ends_at
    };

    if (body.action === "confirm") {
      patch.status = "confirmed";
    } else if (body.action === "checkin") {
      patch.status = "confirmed";
      patch.checked_in_at = new Date().toISOString();
    } else if (body.action === "complete") {
      patch.status = "completed";
      patch.completed_at = new Date().toISOString();
    } else if (body.action === "cancel") {
      if (cancelCutoff > 0 && diffMinutes < cancelCutoff) {
        return NextResponse.json(
          {
            error: `Cancelamento permitido ate ${cancelCutoff} minuto(s) antes do inicio.`
          },
          { status: 400 }
        );
      }
      patch.status = "cancelled";
    } else if (body.action === "shift") {
      if (rescheduleCutoff > 0 && diffMinutes < rescheduleCutoff) {
        return NextResponse.json(
          {
            error: `Reagendamento permitido ate ${rescheduleCutoff} minuto(s) antes do inicio.`
          },
          { status: 400 }
        );
      }
      shiftMinutes = Number(body.shiftMinutes || 0);
      if (!Number.isInteger(shiftMinutes) || shiftMinutes === 0) {
        return NextResponse.json(
          { error: "shiftMinutes deve ser inteiro diferente de zero." },
          { status: 400 }
        );
      }
      const currentStart = new Date(current.starts_at);
      const currentEnd = new Date(current.ends_at);
      patch.starts_at = new Date(
        currentStart.getTime() + shiftMinutes * 60_000
      ).toISOString();
      patch.ends_at = new Date(
        currentEnd.getTime() + shiftMinutes * 60_000
      ).toISOString();

      const shiftedStart = new Date(patch.starts_at);
      const shiftedEnd = new Date(patch.ends_at);
      const shiftedStartWithBuffer = applyMinutes(shiftedStart, -bufferBefore);
      const shiftedEndWithBuffer = applyMinutes(shiftedEnd, bufferAfter);
      const { data: overlappingAppointments, error: overlapError } = await supabase
        .from("appointments")
        .select("id, starts_at, ends_at")
        .eq("business_id", current.business_id)
        .in("status", ["pending", "confirmed"])
        .neq("id", appointmentId)
        .lt("starts_at", shiftedEndWithBuffer.toISOString())
        .gt("ends_at", shiftedStartWithBuffer.toISOString())
        .limit(50);

      if (overlapError) {
        return NextResponse.json(
          { error: "Falha ao validar conflitos de agenda." },
          { status: 500 }
        );
      }

      const hasConflict = (overlappingAppointments || []).some((item) => {
        const existingStart = applyMinutes(
          new Date(item.starts_at),
          -bufferBefore
        ).getTime();
        const existingEnd = applyMinutes(new Date(item.ends_at), bufferAfter).getTime();
        return (
          shiftedStartWithBuffer.getTime() < existingEnd &&
          shiftedEndWithBuffer.getTime() > existingStart
        );
      });

      if (hasConflict) {
        const durationMinutes = Math.max(
          1,
          Math.round((shiftedEnd.getTime() - shiftedStart.getTime()) / 60_000)
        );
        const nextStartAt = (overlappingAppointments || []).reduce((latest, item) => {
          const blockedUntil = applyMinutes(
            new Date(item.ends_at),
            bufferAfter + bufferBefore
          ).getTime();
          return Math.max(latest, blockedUntil);
        }, shiftedStart.getTime());
        const nextEndAt = applyMinutes(new Date(nextStartAt), durationMinutes);
        return NextResponse.json(
          {
            error:
              "Reagendamento indisponivel considerando tempo de preparacao/limpeza entre agendamentos.",
            conflict: {
              reason: "buffer_overlap",
              suggestedStartAt: toIso(new Date(nextStartAt)),
              suggestedEndAt: toIso(nextEndAt)
            }
          },
          { status: 409 }
        );
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("appointments")
      .update(patch)
      .eq("id", appointmentId)
      .select(
        "id, customer_name, customer_phone, starts_at, ends_at, status, business_id"
      )
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: "Falha ao atualizar agendamento." },
        { status: 500 }
      );
    }

    if (body.action === "cancel" || body.action === "shift") {
      await notifyNextWaitlistForWindow({
        businessId: current.business_id,
        windowStartIso: vacatedWindow.start,
        windowEndIso: vacatedWindow.end
      });
    }
    const durationMinutes = Math.max(
      1,
      Math.round(
        (new Date(current.ends_at).getTime() - new Date(current.starts_at).getTime()) / 60_000
      )
    );
    const suggestedSlots =
      body.action === "cancel" && body.action !== "shift"
        ? await suggestRebookingSlots({
            supabase,
            businessId: current.business_id,
            durationMinutes,
            fromIso: current.starts_at
          })
        : [];

    let notifyResult:
      | { sent: true }
      | { sent: false; reason: string }
      | { sent: false; reason: string } = {
      sent: false,
      reason: "Template de notificacao nao informado."
    };

    if (body.notifyTemplate) {
      const text = buildNotificationMessage(body.notifyTemplate, {
        customerName: updated.customer_name || "Cliente",
        startsAt: updated.starts_at,
        endsAt: updated.ends_at,
        status: updated.status,
        shiftMinutes
      });
      notifyResult = await sendWhatsappTextMessage(
        normalizePhone(updated.customer_phone),
        text
      );
    }

    return NextResponse.json({
      message: "Agendamento atualizado com sucesso.",
      data: updated,
      notification: notifyResult,
      suggestedSlots
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
