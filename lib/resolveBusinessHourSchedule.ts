import type { SupabaseClient } from "@supabase/supabase-js";

const VALIDITY_RANK: Record<string, number> = {
  custom: 4,
  monthly: 3,
  annual: 2,
  indeterminate: 1
};

export type ScheduleRow = {
  id: string;
  validity_type: string;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
};

/** Escolhe a agenda cuja vigencia contem dateIso (YYYY-MM-DD). Desempate: tipo mais especifico, depois mais recente. */
export async function resolveScheduleIdForDate(
  supabase: SupabaseClient,
  businessId: string,
  dateIso: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("business_hour_schedules")
    .select("id, validity_type, valid_from, valid_to, created_at")
    .eq("business_id", businessId);

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.length) return null;

  return resolveScheduleIdFromList(data as ScheduleRow[], dateIso);
}

export function resolveScheduleIdFromList(
  schedules: ScheduleRow[],
  dateIso: string
): string | null {
  if (!schedules.length) return null;
  const matching = schedules.filter(
    (s) => dateIso >= s.valid_from && (!s.valid_to || dateIso <= s.valid_to)
  );
  if (!matching.length) return null;
  matching.sort((a, b) => {
    const dr =
      (VALIDITY_RANK[b.validity_type] ?? 0) - (VALIDITY_RANK[a.validity_type] ?? 0);
    if (dr !== 0) return dr;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return matching[0].id;
}
