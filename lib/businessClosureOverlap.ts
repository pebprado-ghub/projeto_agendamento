import type { SupabaseClient } from "@supabase/supabase-js";

/** Verifica se o intervalo do agendamento intercepta algum bloqueio operacional cadastrado. */
export async function appointmentOverlapsBusinessClosure(
  supabase: SupabaseClient,
  businessId: string,
  startsAt: Date,
  endsAt: Date
): Promise<{ ok: true; blocked: boolean } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("business_closure_periods")
    .select("id")
    .eq("business_id", businessId)
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString())
    .limit(1);

  if (error) {
    return { ok: false, error: "Falha ao validar bloqueios operacionais." };
  }
  return { ok: true, blocked: (data?.length ?? 0) > 0 };
}
