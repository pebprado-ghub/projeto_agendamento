import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buffersFromBusiness,
  buffersFromServiceOrBusiness,
  type BufferPair
} from "@/lib/bookingBuffers";
import { appointmentOverlapsBusinessClosure } from "@/lib/businessClosureOverlap";
import { customerPhonesMatch } from "@/lib/customerPhoneMatch";
import { notifyNextWaitlistForWindow } from "@/lib/waitlist";

function applyMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export type ApplySlotResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Aplica novo horário ao agendamento após o cliente aceitar por WhatsApp.
 * Não aplica cutoff de reagendamento (o cliente está aceitando proposta explícita).
 */
export async function applyAppointmentProposedSlot(
  supabase: SupabaseClient,
  params: {
    appointmentId: string;
    customerPhoneDigits: string;
    newStartsAt: Date;
    newEndsAt: Date;
  }
): Promise<ApplySlotResult> {
  if (params.newEndsAt <= params.newStartsAt) {
    return { ok: false, reason: "Intervalo invalido." };
  }

  const { data: row, error: fetchErr } = await supabase
    .from("appointments")
    .select("id, business_id, service_id, customer_phone, starts_at, ends_at, status")
    .eq("id", params.appointmentId)
    .single();

  if (fetchErr || !row) {
    return { ok: false, reason: "Agendamento nao encontrado." };
  }

  if (!["pending", "confirmed"].includes(String(row.status))) {
    return { ok: false, reason: "Agendamento nao pode mais ser alterado." };
  }

  if (!customerPhonesMatch(String(row.customer_phone), params.customerPhoneDigits)) {
    return { ok: false, reason: "Telefone nao confere com o agendamento." };
  }

  const { data: businessRules } = await supabase
    .from("businesses")
    .select("booking_buffer_before_minutes, booking_buffer_after_minutes")
    .eq("id", row.business_id)
    .single();

  const businessBuf = buffersFromBusiness(businessRules || {});
  let newPair: BufferPair = businessBuf;
  const sid = row.service_id as string | null;
  if (sid) {
    const { data: svc } = await supabase
      .from("services")
      .select("booking_buffer_before_minutes, booking_buffer_after_minutes")
      .eq("id", sid)
      .eq("business_id", row.business_id)
      .maybeSingle();
    if (svc) newPair = buffersFromServiceOrBusiness(svc, businessBuf);
  }

  const vacatedWindow = { start: row.starts_at as string, end: row.ends_at as string };

  const shiftedStart = params.newStartsAt;
  const shiftedEnd = params.newEndsAt;
  const shiftedStartWithBuffer = applyMinutes(shiftedStart, -newPair.before);
  const shiftedEndWithBuffer = applyMinutes(shiftedEnd, newPair.after);

  const { data: overlappingAppointments, error: overlapError } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, service_id")
    .eq("business_id", row.business_id)
    .in("status", ["pending", "confirmed"])
    .neq("id", params.appointmentId)
    .lt("starts_at", shiftedEndWithBuffer.toISOString())
    .gt("ends_at", shiftedStartWithBuffer.toISOString())
    .limit(50);

  if (overlapError) {
    return { ok: false, reason: "Falha ao validar conflitos." };
  }

  const overlapIds = [
    ...new Set(
      (overlappingAppointments || [])
        .map((o) => o.service_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  ];
  const loadIds = [...new Set([...overlapIds, sid].filter(Boolean))] as string[];
  let bufferByServiceId = new Map<string, BufferPair>();
  if (loadIds.length > 0) {
    const { data: svcRows } = await supabase
      .from("services")
      .select("id, booking_buffer_before_minutes, booking_buffer_after_minutes")
      .eq("business_id", row.business_id)
      .in("id", loadIds);
    bufferByServiceId = new Map(
      (svcRows || []).map((s) => [
        s.id as string,
        buffersFromServiceOrBusiness(
          {
            booking_buffer_before_minutes: Number(s.booking_buffer_before_minutes || 0),
            booking_buffer_after_minutes: Number(s.booking_buffer_after_minutes || 0)
          },
          businessBuf
        )
      ])
    );
  }

  const pairFor = (appointServiceId: string | null): BufferPair =>
    appointServiceId && bufferByServiceId.has(appointServiceId)
      ? bufferByServiceId.get(appointServiceId)!
      : businessBuf;

  const hasConflict = (overlappingAppointments || []).some((item) => {
    const p = pairFor(item.service_id as string | null);
    const existingStart = applyMinutes(new Date(item.starts_at), -p.before).getTime();
    const existingEnd = applyMinutes(new Date(item.ends_at), p.after).getTime();
    return (
      shiftedStartWithBuffer.getTime() < existingEnd &&
      shiftedEndWithBuffer.getTime() > existingStart
    );
  });

  if (hasConflict) {
    return {
      ok: false,
      reason: "O horario sugerido deixou de estar disponivel. Escolha outro pela recepcao."
    };
  }

  const closureCheck = await appointmentOverlapsBusinessClosure(
    supabase,
    row.business_id,
    shiftedStart,
    shiftedEnd
  );
  if (!closureCheck.ok) {
    return { ok: false, reason: closureCheck.error };
  }
  if (closureCheck.blocked) {
    return {
      ok: false,
      reason: "Esse horario coincide com bloqueio da agenda. Fale com a recepcao."
    };
  }

  const { error: updateError } = await supabase
    .from("appointments")
    .update({
      starts_at: shiftedStart.toISOString(),
      ends_at: shiftedEnd.toISOString()
    })
    .eq("id", params.appointmentId);

  if (updateError) {
    return { ok: false, reason: "Falha ao atualizar agendamento." };
  }

  await notifyNextWaitlistForWindow({
    businessId: row.business_id,
    serviceId: sid,
    windowStartIso: vacatedWindow.start,
    windowEndIso: vacatedWindow.end
  });

  return { ok: true };
}
