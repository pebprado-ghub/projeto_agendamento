import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { findNextAvailableSlotAfter } from "@/lib/findNextAvailableSlotAfter";
import { sendWhatsappTextMessage } from "@/lib/whatsappSendText";
import { CLOSURE_RESCHEDULE_CONVERSATION_STATE } from "@/lib/whatsappRescheduleReply";

const TEMPLATE_CODE = "WA_CLOSURE_RESCHEDULE_OUTREACH";

const DEFAULT_TEMPLATE = `Olá {{cliente}},

{{empresa}} precisa reagendar seu atendimento em razão de uma pausa na agenda.

*Horário que está agendado hoje:* {{horarioAtual}}

*Sugestão de novo horário (próxima vaga livre na agenda):*
{{sugestao}}

*Confirmação automática:* responda *SIM* (por texto) para gravar automaticamente o horário sugerido acima na agenda.

Referência técnica (início / fim): {{sugestaoInicioIso}} · {{sugestaoFimIso}}

Se preferir outro horário, responda aqui ou fale com a recepção.`;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function formatRangePt(isoStart: string, isoEnd: string) {
  const a = new Date(isoStart);
  const b = new Date(isoEnd);
  const d = a.toLocaleDateString("pt-BR");
  const t0 = a.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const t1 = b.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${d}, ${t0}–${t1}`;
}

function formatSuggestionPt(
  slotStart: Date,
  slotEnd: Date,
  tz: string
): { line: string } {
  const line = `${slotStart.toLocaleString("pt-BR", {
    timeZone: tz,
    dateStyle: "short",
    timeStyle: "short"
  })} até ${slotEnd.toLocaleTimeString("pt-BR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit"
  })}`;
  return { line };
}

function applyTemplate(template: string, vars: Record<string, string>) {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      businessId?: string;
      appointmentIds?: string[];
      afterIso?: string;
    };

    const businessId = (body.businessId || "").trim();
    const ids = Array.isArray(body.appointmentIds) ? body.appointmentIds : [];
    const afterIso = (body.afterIso || "").trim();

    if (!businessId) {
      return NextResponse.json({ error: "businessId e obrigatorio." }, { status: 400 });
    }
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Informe ao menos um appointmentId." },
        { status: 400 }
      );
    }
    if (ids.length > 40) {
      return NextResponse.json(
        { error: "No maximo 40 agendamentos por envio." },
        { status: 400 }
      );
    }
    if (!afterIso) {
      return NextResponse.json(
        { error: "afterIso e obrigatorio (fim do bloqueio ou instante a partir do qual sugerir horario)." },
        { status: 400 }
      );
    }

    const afterUtc = new Date(afterIso);
    if (Number.isNaN(afterUtc.getTime())) {
      return NextResponse.json({ error: "afterIso invalido." }, { status: 400 });
    }

    for (const id of ids) {
      if (!isUuid(id)) {
        return NextResponse.json(
          { error: `appointmentId invalido: ${id}` },
          { status: 400 }
        );
      }
    }

    const supabase = getSupabaseAdmin();

    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, one_click_reschedule_enabled")
      .eq("id", businessId)
      .single();

    if (!business) {
      return NextResponse.json({ error: "Empresa nao encontrada." }, { status: 404 });
    }

    const businessOneClick = business.one_click_reschedule_enabled !== false;

    const { data: apptRows } = await supabase
      .from("appointments")
      .select(
        "id, business_id, service_id, customer_name, customer_phone, starts_at, ends_at, status"
      )
      .eq("business_id", businessId)
      .in("id", ids);

    const byId = new Map((apptRows || []).map((r) => [r.id as string, r]));
    const svcIds = [
      ...new Set(
        (apptRows || [])
          .map((r) => r.service_id as string | null)
          .filter((x): x is string => Boolean(x))
      )
    ];
    let oneClickByService = new Map<string, boolean>();
    if (svcIds.length > 0) {
      const { data: svcs } = await supabase
        .from("services")
        .select("id, one_click_reschedule_enabled")
        .eq("business_id", businessId)
        .in("id", svcIds);
      oneClickByService = new Map(
        (svcs || []).map((s) => [
          s.id as string,
          s.one_click_reschedule_enabled !== false
        ])
      );
    }

    const { data: templateRow } = await supabase
      .from("message_templates")
      .select("content")
      .eq("business_id", businessId)
      .eq("code", TEMPLATE_CODE)
      .eq("is_active", true)
      .maybeSingle();

    const template = (templateRow?.content || DEFAULT_TEMPLATE).trim() || DEFAULT_TEMPLATE;

    const results: Array<{
      appointmentId: string;
      sent: boolean;
      reason?: string;
      suggestion?: string;
    }> = [];

    for (const appointmentId of ids) {
      const row = byId.get(appointmentId);

      if (!row) {
        results.push({
          appointmentId,
          sent: false,
          reason: "Agendamento nao encontrado."
        });
        continue;
      }

      if (!["pending", "confirmed"].includes(String(row.status))) {
        results.push({
          appointmentId,
          sent: false,
          reason: "Status nao elegivel (apenas pendente ou confirmado)."
        });
        continue;
      }

      let oneClickOk = businessOneClick;
      const sid = row.service_id as string | null;
      if (sid && oneClickByService.has(sid)) {
        oneClickOk = oneClickByService.get(sid)!;
      }
      if (!oneClickOk) {
        results.push({
          appointmentId,
          sent: false,
          reason: "Reagendamento assistido por WhatsApp desabilitado para este servico."
        });
        continue;
      }

      const phone = String(row.customer_phone || "").replace(/[^\d]/g, "");
      if (phone.length < 10) {
        results.push({
          appointmentId,
          sent: false,
          reason: "Telefone do cliente invalido."
        });
        continue;
      }

      const anchor = new Date(
        Math.max(afterUtc.getTime(), new Date(row.ends_at as string).getTime())
      );

      const next = await findNextAvailableSlotAfter(supabase, {
        businessId,
        serviceId: (row.service_id as string | null) ?? null,
        afterUtc: anchor,
        maxDayScans: 45
      });

      if (!next) {
        results.push({
          appointmentId,
          sent: false,
          reason: "Nenhum horario livre encontrado no periodo consultado."
        });
        continue;
      }

      const { line: sugestao } = formatSuggestionPt(
        next.slotStart,
        next.slotEnd,
        next.timezone
      );

      const cliente = String(row.customer_name || "Cliente").trim() || "Cliente";
      const horarioAtual = formatRangePt(
        row.starts_at as string,
        row.ends_at as string
      );

      const sugestaoInicioIso = next.slotStart.toISOString();
      const sugestaoFimIso = next.slotEnd.toISOString();

      const text = applyTemplate(template, {
        cliente,
        empresa: String(business.name || "Estabelecimento"),
        horarioAtual,
        sugestao,
        sugestaoInicioIso,
        sugestaoFimIso
      });

      const wa = await sendWhatsappTextMessage(phone, text);
      if (!wa.sent) {
        results.push({
          appointmentId,
          sent: false,
          reason: wa.reason,
          suggestion: sugestao
        });
        continue;
      }

      const { error: stateErr } = await supabase.from("conversation_state").upsert(
        {
          business_id: businessId,
          customer_phone: phone,
          state: CLOSURE_RESCHEDULE_CONVERSATION_STATE,
          context: {
            kind: "closure_reschedule",
            appointmentId,
            suggestedStartsAt: sugestaoInicioIso,
            suggestedEndsAt: sugestaoFimIso,
            previousStartsAt: row.starts_at as string,
            previousEndsAt: row.ends_at as string
          }
        },
        { onConflict: "business_id,customer_phone" }
      );

      if (stateErr) {
        results.push({
          appointmentId,
          sent: true,
          reason: "Mensagem enviada, mas nao foi possivel salvar estado para confirmacao automatica.",
          suggestion: sugestao
        });
        continue;
      }

      results.push({
        appointmentId,
        sent: true,
        suggestion: sugestao
      });
    }

    const sentCount = results.filter((r) => r.sent).length;
    return NextResponse.json({
      message: `Enviado(s): ${sentCount} de ${results.length}.`,
      results
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
