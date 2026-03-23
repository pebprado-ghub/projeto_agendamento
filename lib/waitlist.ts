import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

async function sendWhatsappTextMessage(to: string, body: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return { sent: false as const, reason: "Credenciais do WhatsApp nao configuradas." };
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
        to: to.replace(/[^\d]/g, ""),
        type: "text",
        text: { body }
      })
    }
  );
  if (!response.ok) {
    return { sent: false as const, reason: "Falha ao enviar notificacao pelo WhatsApp." };
  }
  return { sent: true as const };
}

export async function notifyNextWaitlistForWindow(params: {
  businessId: string;
  windowStartIso: string;
  windowEndIso: string;
}) {
  const supabase = getSupabaseAdmin();
  const windowStart = new Date(params.windowStartIso);
  const windowEnd = new Date(params.windowEndIso);
  if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime())) return;

  const { data: business } = await supabase
    .from("businesses")
    .select("name, waitlist_enabled, booking_slot_capacity")
    .eq("id", params.businessId)
    .single();
  if (!business || business.waitlist_enabled === false) return;
  const capacity = Math.max(1, Number(business.booking_slot_capacity || 1));

  const { data: appointments } = await supabase
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("business_id", params.businessId)
    .in("status", ["pending", "confirmed"])
    .lt("starts_at", windowEnd.toISOString())
    .gt("ends_at", windowStart.toISOString())
    .limit(100);
  const occupied = (appointments || []).filter((item) =>
    overlaps(windowStart, windowEnd, new Date(item.starts_at), new Date(item.ends_at))
  ).length;
  if (occupied >= capacity) return;

  const { data: waitlistItems } = await supabase
    .from("appointment_waitlist")
    .select(
      "id, customer_name, customer_phone, requested_start_at, requested_end_at, created_at, status"
    )
    .eq("business_id", params.businessId)
    .eq("status", "waiting")
    .order("created_at", { ascending: true })
    .limit(50);

  const target = (waitlistItems || []).find((item) =>
    overlaps(
      windowStart,
      windowEnd,
      new Date(item.requested_start_at),
      new Date(item.requested_end_at)
    )
  );
  if (!target) return;

  const startsAt = new Date(target.requested_start_at);
  const dateLabel = startsAt.toLocaleDateString("pt-BR");
  const timeLabel = startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const message =
    `Boa noticia! Surgiu vaga na agenda de ${business.name} para ${dateLabel} as ${timeLabel}. ` +
    "Responda esta mensagem para confirmar seu agendamento.";

  const notify = await sendWhatsappTextMessage(target.customer_phone, message);
  if (!notify.sent) return;

  await supabase
    .from("appointment_waitlist")
    .update({ status: "notified", notified_at: new Date().toISOString() })
    .eq("id", target.id);
}
