import type { SupabaseClient } from "@supabase/supabase-js";
import {
  effectiveEndYmd,
  rangesOverlap,
  type ScheduleRangeRow,
  ymdNext,
  ymdPrev
} from "@/lib/businessHourScheduleRanges";

async function deleteScheduleCascade(supabase: SupabaseClient, scheduleId: string) {
  const { error } = await supabase.from("business_hour_schedules").delete().eq("id", scheduleId);
  if (error) throw new Error(error.message);
}

async function fetchScheduleHoursRows(supabase: SupabaseClient, scheduleId: string) {
  const { data, error } = await supabase
    .from("business_hours")
    .select("weekday, start_time, end_time, lunch_start_time, lunch_end_time, is_active, sort_order")
    .eq("schedule_id", scheduleId);
  if (error) throw new Error(error.message);
  return data || [];
}

async function insertScheduleClone(
  supabase: SupabaseClient,
  businessId: string,
  validityType: string,
  validFrom: string,
  validTo: string | null,
  hourTemplate: Array<{
    weekday: number;
    start_time: string;
    end_time: string;
    lunch_start_time: string | null;
    lunch_end_time: string | null;
    is_active: boolean;
    sort_order: number;
  }>
) {
  const { data: ins, error: insErr } = await supabase
    .from("business_hour_schedules")
    .insert({
      business_id: businessId,
      validity_type: validityType,
      valid_from: validFrom,
      valid_to: validTo
    })
    .select("id")
    .single();

  if (insErr || !ins) throw new Error(insErr?.message || "Falha ao clonar agenda.");

  const scheduleId = ins.id as string;
  if (!hourTemplate.length) return;

  const rows = hourTemplate.map((h) => ({
    business_id: businessId,
    schedule_id: scheduleId,
    weekday: h.weekday,
    start_time: h.start_time,
    end_time: h.end_time,
    lunch_start_time: h.lunch_start_time,
    lunch_end_time: h.lunch_end_time,
    is_active: h.is_active,
    sort_order: h.sort_order
  }));

  const { error: hErr } = await supabase.from("business_hours").insert(rows);
  if (hErr) throw new Error(hErr.message);
}

/**
 * Ajusta ou remove agendas existentes para dar lugar a [newFrom, newTo].
 * Não altera a linha excludeScheduleId (a agenda que está sendo criada/editada no mesmo request).
 */
export async function applyScheduleOverlapResolution(
  supabase: SupabaseClient,
  businessId: string,
  newFrom: string,
  newTo: string | null,
  excludeScheduleId: string | null
): Promise<{ updated: number; deleted: number; cloned: number }> {
  const { data: all, error } = await supabase
    .from("business_hour_schedules")
    .select("id, validity_type, valid_from, valid_to")
    .eq("business_id", businessId);

  if (error) throw new Error(error.message);

  const schedules = (all || []) as ScheduleRangeRow[];
  const victims = schedules.filter(
    (s) =>
      s.id !== excludeScheduleId && rangesOverlap(newFrom, newTo, s.valid_from, s.valid_to)
  );

  let updated = 0;
  let deleted = 0;
  let cloned = 0;

  for (const O of victims) {
    const hourRows = await fetchScheduleHoursRows(supabase, O.id);
    const origFrom = O.valid_from;
    const origTo = O.valid_to;
    const origEnd = effectiveEndYmd(origTo);

    if (origFrom < newFrom) {
      const leftEnd = minYmdStr(origEnd, ymdPrev(newFrom));
      if (leftEnd >= origFrom) {
        const { error: uErr } = await supabase
          .from("business_hour_schedules")
          .update({ valid_to: leftEnd, updated_at: new Date().toISOString() })
          .eq("id", O.id);
        if (uErr) throw new Error(uErr.message);
        updated++;
      } else {
        await deleteScheduleCascade(supabase, O.id);
        deleted++;
      }

      if (newTo !== null && origEnd > newTo) {
        const tailFrom = ymdNext(newTo);
        if (tailFrom <= origEnd) {
          await insertScheduleClone(
            supabase,
            businessId,
            O.validity_type,
            tailFrom,
            origTo,
            hourRows
          );
          cloned++;
        }
      }
    } else {
      if (newTo === null) {
        await deleteScheduleCascade(supabase, O.id);
        deleted++;
      } else {
        const nEnd = effectiveEndYmd(newTo);
        if (origEnd <= nEnd) {
          await deleteScheduleCascade(supabase, O.id);
          deleted++;
        } else {
          const tailFrom = ymdNext(newTo);
          if (tailFrom <= origEnd) {
            const { error: u2 } = await supabase
              .from("business_hour_schedules")
              .update({
                valid_from: tailFrom,
                valid_to: origTo,
                updated_at: new Date().toISOString()
              })
              .eq("id", O.id);
            if (u2) throw new Error(u2.message);
            updated++;
          } else {
            await deleteScheduleCascade(supabase, O.id);
            deleted++;
          }
        }
      }
    }
  }

  return { updated, deleted, cloned };
}

function minYmdStr(a: string, b: string): string {
  return a <= b ? a : b;
}
