import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { applyAppointmentProposedSlot } from "@/lib/applyAppointmentProposedSlot";
import { customerPhonesMatch } from "@/lib/customerPhoneMatch";
import { resolveBusinessIdFromWhatsappDisplay } from "@/lib/resolveBusinessIdFromWhatsappDisplay";
import { sendWhatsappTextMessage } from "@/lib/whatsappSendText";
import {
  CLOSURE_RESCHEDULE_CONVERSATION_STATE,
  type ClosureRescheduleContext,
  isAffirmativeRescheduleReply
} from "@/lib/whatsappRescheduleReply";

type WhatsAppInboundPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        messages?: Array<{
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
};

/**
 * Verificação do webhook (Meta / WhatsApp Cloud API).
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const verify = (process.env.WHATSAPP_VERIFY_TOKEN || "").trim();

  if (mode === "subscribe" && token && verify && token === verify && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as WhatsAppInboundPayload;
    const value = payload.entry?.[0]?.changes?.[0]?.value;
    const msg = value?.messages?.[0];

    if (!msg || msg.type !== "text" || !msg.text?.body) {
      return NextResponse.json({ received: true });
    }

    const fromDigits = String(msg.from || "").replace(/\D/g, "");
    const body = msg.text.body;
    const displayPhone = value?.metadata?.display_phone_number;

    if (!fromDigits) {
      return NextResponse.json({ received: true });
    }

    const supabase = getSupabaseAdmin();
    const businessId = await resolveBusinessIdFromWhatsappDisplay(supabase, displayPhone);

    if (!businessId) {
      return NextResponse.json({ received: true });
    }

    const { data: convRows } = await supabase
      .from("conversation_state")
      .select("id, customer_phone, state, context")
      .eq("business_id", businessId);

    const conv = convRows?.find(
      (r) =>
        r.state === CLOSURE_RESCHEDULE_CONVERSATION_STATE &&
        customerPhonesMatch(String(r.customer_phone), fromDigits)
    );

    if (!conv) {
      return NextResponse.json({ received: true });
    }

    if (!isAffirmativeRescheduleReply(body)) {
      return NextResponse.json({ received: true });
    }

    const ctx = conv.context as ClosureRescheduleContext | null;
    if (
      !ctx ||
      ctx.kind !== "closure_reschedule" ||
      !ctx.appointmentId ||
      !ctx.suggestedStartsAt ||
      !ctx.suggestedEndsAt
    ) {
      await supabase
        .from("conversation_state")
        .upsert(
          {
            business_id: businessId,
            customer_phone: String(conv.customer_phone),
            state: "start",
            context: {}
          },
          { onConflict: "business_id,customer_phone" }
        );
      return NextResponse.json({ received: true });
    }

    const newStart = new Date(ctx.suggestedStartsAt);
    const newEnd = new Date(ctx.suggestedEndsAt);
    if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
      return NextResponse.json({ received: true });
    }

    const applied = await applyAppointmentProposedSlot(supabase, {
      appointmentId: ctx.appointmentId,
      customerPhoneDigits: fromDigits,
      newStartsAt: newStart,
      newEndsAt: newEnd
    });

    await supabase
      .from("conversation_state")
      .upsert(
        {
          business_id: businessId,
          customer_phone: String(conv.customer_phone),
          state: "start",
          context: {}
        },
        { onConflict: "business_id,customer_phone" }
      );

    if (applied.ok) {
      const { data: biz } = await supabase
        .from("businesses")
        .select("timezone")
        .eq("id", businessId)
        .single();
      const tz = biz?.timezone || "America/Sao_Paulo";
      const label = newStart.toLocaleString("pt-BR", {
        timeZone: tz,
        dateStyle: "short",
        timeStyle: "short"
      });
      const endShort = newEnd.toLocaleTimeString("pt-BR", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit"
      });
      await sendWhatsappTextMessage(
        fromDigits,
        `Pronto! Seu horário foi reagendado para ${label} (até ${endShort}). Qualquer dúvida, fale conosco.`
      );
    } else {
      await sendWhatsappTextMessage(
        fromDigits,
        `Não foi possível confirmar o reagendamento automaticamente: ${applied.reason} Por favor, fale com a recepção.`
      );
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: true });
  }
}
