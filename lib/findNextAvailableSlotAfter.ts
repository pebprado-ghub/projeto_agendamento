import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeAvailableSlotsForDate,
  toIsoDateInTimezone
} from "@/lib/computeAvailableSlotsForDate";

function addCalendarDaysYyyyMmDd(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const u = new Date(Date.UTC(y, m - 1, d + days));
  return u.toISOString().slice(0, 10);
}

/**
 * Primeiro slot livre em ou após `afterUtc`, usando as mesmas regras da API de disponibilidade.
 */
export async function findNextAvailableSlotAfter(
  supabase: SupabaseClient,
  params: {
    businessId: string;
    serviceId: string | null;
    afterUtc: Date;
    maxDayScans?: number;
  }
): Promise<{
  slotStart: Date;
  slotEnd: Date;
  slotIsoForCompat: string;
  durationMinutes: number;
  timezone: string;
} | null> {
  const maxDayScans = Math.min(60, Math.max(1, params.maxDayScans ?? 45));

  const { data: business } = await supabase
    .from("businesses")
    .select("timezone")
    .eq("id", params.businessId)
    .single();

  const timezone = business?.timezone || "America/Sao_Paulo";
  const startLocalDate = toIsoDateInTimezone(params.afterUtc, timezone);

  for (let dayOffset = 0; dayOffset < maxDayScans; dayOffset++) {
    const dateStr = addCalendarDaysYyyyMmDd(startLocalDate, dayOffset);
    const result = await computeAvailableSlotsForDate(supabase, {
      businessId: params.businessId,
      date: dateStr,
      serviceId: params.serviceId || undefined,
      timezone
    });

    if (result.ruleBlockReason === "daily_limit_reached") continue;

    const sorted = [...result.availableSlots].sort();
    for (const slotIso of sorted) {
      const instant = new Date(`${slotIso}Z`);
      if (instant.getTime() >= params.afterUtc.getTime()) {
        const slotEnd = new Date(
          instant.getTime() + result.durationMinutes * 60_000
        );
        return {
          slotStart: instant,
          slotEnd,
          slotIsoForCompat: slotIso,
          durationMinutes: result.durationMinutes,
          timezone
        };
      }
    }
  }

  return null;
}
