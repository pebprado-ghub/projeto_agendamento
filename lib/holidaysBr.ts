import Holidays from "date-holidays";

const HOLIDAY_TYPES: Array<"public" | "bank" | "optional"> = ["public", "bank", "optional"];

const HOLIDAY_OPTS = {
  languages: ["pt" as const],
  types: HOLIDAY_TYPES
};

/** Remove acentos e normaliza para comparação de cidade. */
export function normalizeCityKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Regiões (date-holidays) com feriados municipais no BR.yaml.
 * Chave: `uf:cidade normalizada` → código da região.
 */
const CITY_TO_REGION: Record<string, string> = {
  "sp:sao paulo": "SP",
  "mg:belo horizonte": "BH",
  "pe:recife": "RE",
  "pr:curitiba": "CU",
  "rj:rio de janeiro": "RJ"
};

export function resolveBrHolidayRegion(
  ufRaw: string | null | undefined,
  cityRaw: string | null | undefined
): string | undefined {
  const uf = (ufRaw || "").trim().toUpperCase();
  if (uf.length !== 2) return undefined;
  const city = normalizeCityKey(cityRaw || "");
  if (!city) return undefined;
  const key = `${uf.toLowerCase()}:${city}`;
  return CITY_TO_REGION[key];
}

export type HolidayEntry = { date: string; name: string; type: string };

function createHolidaysInstance(uf?: string | null, region?: string | null): Holidays {
  if (uf && region) {
    return new Holidays("BR", uf, region, HOLIDAY_OPTS);
  }
  if (uf) {
    return new Holidays("BR", uf, HOLIDAY_OPTS);
  }
  return new Holidays("BR", HOLIDAY_OPTS);
}

/**
 * Feriados nacionais + estaduais (UF) + municipais (quando cidade bate com região conhecida).
 * Datas YYYY-MM-DD (calendário alinhado ao restante do app).
 */
export function getBrHolidaysForYear(
  year: number,
  uf?: string | null,
  city?: string | null
): HolidayEntry[] {
  const region = resolveBrHolidayRegion(uf, city);
  const hd = createHolidaysInstance(uf, region);
  return hd.getHolidays(year, "pt").map((h) => ({
    date: h.date.slice(0, 10),
    name: h.name,
    type: h.type
  }));
}

/** Agrupa por data; nomes únicos. */
export function mergeHolidaysByDate(entries: HolidayEntry[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const e of entries) {
    if (!map[e.date]) map[e.date] = [];
    if (!map[e.date].includes(e.name)) {
      map[e.date].push(e.name);
    }
  }
  return map;
}

export function getBrHolidaysForYears(
  years: number[],
  uf?: string | null,
  city?: string | null
): Record<string, string[]> {
  const all: HolidayEntry[] = [];
  for (const y of years) {
    all.push(...getBrHolidaysForYear(y, uf, city));
  }
  return mergeHolidaysByDate(all);
}
