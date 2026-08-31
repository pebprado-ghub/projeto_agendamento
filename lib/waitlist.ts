import { hasPlanFeature } from "@/lib/planAccess";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendWhatsappTextMessage } from "@/lib/whatsappSendText";

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export async function notifyNextWaitlistForWindow(params: {
  businessId: string;
  /** Serviço do horário liberado; fila e capacidade consideram o mesmo serviço quando informado. */
  serviceId?: string | null;
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
  if (!business) return;

  let waitlistOk = business.waitlist_enabled !== false;
  let capacity = Math.max(1, Number(business.booking_slot_capacity || 1));

  if (params.serviceId) {
    const { data: svc } = await supabase
      .from("services")
      .select("waitlist_enabled, booking_slot_capacity")
      .eq("id", params.serviceId)
      .eq("business_id", params.businessId)
      .maybeSingle();
    if (svc) {
      waitlistOk = svc.waitlist_enabled !== false;
      capacity = Math.max(1, Number(svc.booking_slot_capacity || 1));
    }
  }

  if (!waitlistOk) return;
  if (!(await hasPlanFeature(supabase, params.businessId, "waitlist"))) return;

  const { data: appointments } = await supabase
    .from("appointments")
    .select("starts_at, ends_at, service_id")
    .eq("business_id", params.businessId)
    .in("status", ["pending", "confirmed"])
    .lt("starts_at", windowEnd.toISOString())
    .gt("ends_at", windowStart.toISOString())
    .limit(100);

  const occupied = (appointments || []).filter((item) => {
    const rawOverlap = overlaps(
      windowStart,
      windowEnd,
      new Date(item.starts_at),
      new Date(item.ends_at)
    );
    if (!rawOverlap) return false;
    if (!params.serviceId) return true;
    return (item.service_id as string | null) === params.serviceId;
  }).length;
  if (occupied >= capacity) return;

  const { data: waitlistItems } = await supabase
    .from("appointment_waitlist")
    .select(
      "id, service_id, customer_name, customer_phone, requested_start_at, requested_end_at, created_at, status"
    )
    .eq("business_id", params.businessId)
    .eq("status", "waiting")
    .order("created_at", { ascending: true })
    .limit(50);

  const target = (waitlistItems || []).find((item) => {
    if (
      params.serviceId &&
      item.service_id &&
      item.service_id !== params.serviceId
    ) {
      return false;
    }
    if (params.serviceId && !item.service_id) {
      return false;
    }
    if (!params.serviceId && item.service_id) {
      return false;
    }
    return overlaps(
      windowStart,
      windowEnd,
      new Date(item.requested_start_at),
      new Date(item.requested_end_at)
    );
  });
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
