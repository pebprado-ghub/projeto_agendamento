export type BusinessHourValidityType = "indeterminate" | "monthly" | "annual" | "custom";

export function isBusinessHourValidityType(value: string): value is BusinessHourValidityType {
  return (
    value === "indeterminate" ||
    value === "monthly" ||
    value === "annual" ||
    value === "custom"
  );
}

/** YYYY-MM-DD no fuso informado (referência: instante atual). */
export function getTodayYmdInTimezone(timezone: string, instant = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(instant);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}

/** Calcula valid_from / valid_to conforme o tipo. custom* em YYYY-MM-DD. */
export function computeValidityRange(params: {
  type: BusinessHourValidityType;
  timezone: string;
  customValidFrom?: string | null;
  customValidTo?: string | null;
}): { valid_from: string; valid_to: string | null } {
  const { type, timezone, customValidFrom, customValidTo } = params;
  const today = getTodayYmdInTimezone(timezone);
  const [yS, mS, dS] = today.split("-").map(Number);

  if (type === "indeterminate") {
    return { valid_from: today, valid_to: null };
  }

  if (type === "monthly") {
    const valid_from = `${yS}-${pad2(mS)}-01`;
    const dim = daysInMonth(yS, mS);
    const valid_to = `${yS}-${pad2(mS)}-${pad2(dim)}`;
    return { valid_from, valid_to };
  }

  if (type === "annual") {
    return {
      valid_from: `${yS}-01-01`,
      valid_to: `${yS}-12-31`
    };
  }

  const from = (customValidFrom || "").trim();
  const to = (customValidTo || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("Datas personalizadas invalidas (use YYYY-MM-DD).");
  }
  if (from > to) {
    throw new Error("Data inicial da vigencia deve ser anterior ou igual a data final.");
  }
  return { valid_from: from, valid_to: to };
}

/** Ontem no fuso (YYYY-MM-DD), para encerrar vigencias indeterminadas anteriores. */
export function getYesterdayYmdInTimezone(timezone: string, instant = new Date()): string {
  const t = new Date(instant.getTime() - 24 * 60 * 60 * 1000);
  return getTodayYmdInTimezone(timezone, t);
}
