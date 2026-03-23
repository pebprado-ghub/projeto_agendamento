import { getBrHolidaysForYears } from "@/lib/holidaysBr";
import { getWeekdayFromDateInTimezone } from "@/lib/weekdayTimezone";

const HOLIDAY_WEEKDAY = 7;

/**
 * Qual linha de `business_hours` usar (0–6 = dia civil, 7 = regra "Feriados").
 * Em datas de feriado, usa weekday 7 salvo se a data estiver em `liberatedDates`
 * (calendário: não observar feriado → horário do dia da semana).
 */
export function resolveScheduleWeekday(params: {
  dateIso: string;
  timezone: string;
  uf?: string | null;
  city?: string | null;
  /** Datas (YYYY-MM-DD) liberadas: ignoram regra de feriado e usam o horário do dia da semana. */
  liberatedHolidayDates: Set<string>;
}): number {
  const { dateIso, timezone, uf, city, liberatedHolidayDates } = params;
  const civilWeekday = getWeekdayFromDateInTimezone(dateIso, timezone);
  if (liberatedHolidayDates.has(dateIso)) {
    return civilWeekday;
  }
  const year = parseInt(dateIso.slice(0, 4), 10);
  if (!Number.isFinite(year)) return civilWeekday;
  const holidayMap = getBrHolidaysForYears([year], uf || null, city || null);
  const isHoliday = Boolean(holidayMap[dateIso]?.length);
  if (isHoliday) {
    return HOLIDAY_WEEKDAY;
  }
  return civilWeekday;
}

export const SCHEDULE_HOLIDAY_WEEKDAY = HOLIDAY_WEEKDAY;
