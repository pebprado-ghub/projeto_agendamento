/** Datas YYYY-MM-DD. valid_to null = vigência aberta ao futuro. */

export const YMD_MAX = "9999-12-31";

export function ymdPrev(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function ymdNext(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function effectiveEndYmd(validTo: string | null): string {
  return validTo ?? YMD_MAX;
}

export function rangesOverlap(
  aFrom: string,
  aTo: string | null,
  bFrom: string,
  bTo: string | null
): boolean {
  const aEnd = effectiveEndYmd(aTo);
  const bEnd = effectiveEndYmd(bTo);
  return aFrom <= bEnd && bFrom <= aEnd;
}

export type ScheduleRangeRow = {
  id: string;
  validity_type: string;
  valid_from: string;
  valid_to: string | null;
};

function minYmd(a: string, b: string): string {
  return a <= b ? a : b;
}

function maxYmd(a: string, b: string): string {
  return a >= b ? a : b;
}

function rangesTouchOrOverlapMerge(
  aFrom: string,
  aTo: string | null,
  bFrom: string,
  bTo: string | null
): boolean {
  if (rangesOverlap(aFrom, aTo, bFrom, bTo)) return true;
  const aEnd = effectiveEndYmd(aTo);
  if (aTo !== null && bFrom === ymdNext(aEnd)) return true;
  return false;
}

/** Intervalos ordenados e fundidos (sobreposição ou um dia contíguo) para detecção de lacunas. */
export function mergeScheduleCoverage(
  rows: ScheduleRangeRow[]
): Array<{ from: string; to: string | null }> {
  if (!rows.length) return [];
  const sorted = [...rows].sort((x, y) => x.valid_from.localeCompare(y.valid_from));
  const out: Array<{ from: string; to: string | null }> = [];
  for (const r of sorted) {
    const from = r.valid_from;
    const to = r.valid_to;
    if (!out.length) {
      out.push({ from, to });
      continue;
    }
    const last = out[out.length - 1];
    if (rangesTouchOrOverlapMerge(last.from, last.to, from, to)) {
      last.from = minYmd(last.from, from);
      if (last.to === null || to === null) {
        last.to = null;
      } else {
        last.to = maxYmd(last.to, to);
      }
    } else {
      out.push({ from, to });
    }
  }
  return out;
}

/** Lacunas estritamente entre dois períodos cobertos (não antes do primeiro nem depois do último aberto). */
export function findScheduleGaps(merged: Array<{ from: string; to: string | null }>): Array<{
  from: string;
  to: string;
}> {
  const gaps: Array<{ from: string; to: string }> = [];
  for (let i = 0; i < merged.length - 1; i++) {
    const a = merged[i];
    const b = merged[i + 1];
    if (a.to === null) continue;
    const dayAfterA = ymdNext(a.to);
    if (dayAfterA < b.from) {
      gaps.push({ from: dayAfterA, to: ymdPrev(b.from) });
    }
  }
  return gaps;
}

export function listOverlappingSchedules(
  schedules: ScheduleRangeRow[],
  newFrom: string,
  newTo: string | null,
  excludeId: string | null
): ScheduleRangeRow[] {
  return schedules.filter(
    (s) => s.id !== excludeId && rangesOverlap(newFrom, newTo, s.valid_from, s.valid_to)
  );
}

export type OverlapSummary = {
  id: string;
  validityType: string;
  validFrom: string;
  validTo: string | null;
};

export function summarizeOverlaps(rows: ScheduleRangeRow[]): OverlapSummary[] {
  return rows.map((r) => ({
    id: r.id,
    validityType: r.validity_type,
    validFrom: r.valid_from,
    validTo: r.valid_to
  }));
}
