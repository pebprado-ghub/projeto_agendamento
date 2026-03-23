/** Dia da semana 0=dom ... 6=sáb no fuso informado (mesma regra da API availability). */
export function getWeekdayFromDateInTimezone(dateIso: string, timezone: string): number {
  const date = new Date(`${dateIso}T12:00:00Z`);
  const weekdayShort = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short"
  }).format(date);

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return map[weekdayShort] ?? 0;
}
