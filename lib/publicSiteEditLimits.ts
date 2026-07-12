/** Limites de alteração do site público (evita “bagunça” na vitrine). */

/** ~1 alteração por semana; evita volatilidade na vitrine. */
export const PUBLIC_SITE_MAX_EDITS_PER_MONTH = 4;
/** Intervalo mínimo entre uma alteração salva e a próxima (~1 semana). */
export const PUBLIC_SITE_EDIT_BUFFER_MS = 7 * 24 * 60 * 60 * 1000;
export const PUBLIC_SITE_EDIT_BUFFER_HOURS = PUBLIC_SITE_EDIT_BUFFER_MS / (60 * 60 * 1000);
export const PUBLIC_SITE_EDIT_BUFFER_DAYS = PUBLIC_SITE_EDIT_BUFFER_MS / (24 * 60 * 60 * 1000);

export function publicSiteEditBufferLabel(): string {
  if (PUBLIC_SITE_EDIT_BUFFER_DAYS >= 1 && PUBLIC_SITE_EDIT_BUFFER_DAYS === Math.floor(PUBLIC_SITE_EDIT_BUFFER_DAYS)) {
    return `${PUBLIC_SITE_EDIT_BUFFER_DAYS} ${PUBLIC_SITE_EDIT_BUFFER_DAYS === 1 ? "dia" : "dias"}`;
  }
  return `${PUBLIC_SITE_EDIT_BUFFER_HOURS}h`;
}

/** Mês civil em America/Sao_Paulo (YYYY-MM). */
export function publicSiteEditMonthKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

export type PublicSiteEditQuotaRow = {
  last_edit_at?: string | null;
  edit_count?: number | null;
  edit_count_month?: string | null;
};

export type PublicSiteEditLimits = {
  maxPerMonth: number;
  usedThisMonth: number;
  remainingThisMonth: number;
  bufferHours: number;
  bufferLabel: string;
  lastEditAt: string | null;
  nextEditAt: string | null;
  canEdit: boolean;
  blockedReason: string | null;
};

function usedInCurrentMonth(row: PublicSiteEditQuotaRow | null | undefined, monthKey: string): number {
  if (!row) return 0;
  if ((row.edit_count_month || "") !== monthKey) return 0;
  return Math.max(0, Number(row.edit_count) || 0);
}

export function buildPublicSiteEditLimits(
  row: PublicSiteEditQuotaRow | null | undefined,
  now = new Date()
): PublicSiteEditLimits {
  const monthKey = publicSiteEditMonthKey(now);
  const usedThisMonth = usedInCurrentMonth(row, monthKey);
  const remainingThisMonth = Math.max(0, PUBLIC_SITE_MAX_EDITS_PER_MONTH - usedThisMonth);
  const lastEditAt = row?.last_edit_at || null;

  let nextEditAt: string | null = null;
  let bufferBlocked = false;
  if (lastEditAt) {
    const lastMs = new Date(lastEditAt).getTime();
    if (Number.isFinite(lastMs)) {
      const unlockMs = lastMs + PUBLIC_SITE_EDIT_BUFFER_MS;
      if (unlockMs > now.getTime()) {
        bufferBlocked = true;
        nextEditAt = new Date(unlockMs).toISOString();
      }
    }
  }

  const monthBlocked = remainingThisMonth <= 0;
  let blockedReason: string | null = null;
  if (bufferBlocked && nextEditAt) {
    blockedReason = `Aguarde o intervalo de ${publicSiteEditBufferLabel()} entre alterações. Próxima liberação: ${formatNextEditLabel(nextEditAt)}.`;
  } else if (monthBlocked) {
    blockedReason = `Limite de ${PUBLIC_SITE_MAX_EDITS_PER_MONTH} alterações neste mês atingido. Novas edições liberam no próximo mês.`;
  }

  return {
    maxPerMonth: PUBLIC_SITE_MAX_EDITS_PER_MONTH,
    usedThisMonth,
    remainingThisMonth,
    bufferHours: PUBLIC_SITE_EDIT_BUFFER_HOURS,
    bufferLabel: publicSiteEditBufferLabel(),
    lastEditAt,
    nextEditAt,
    canEdit: !bufferBlocked && !monthBlocked,
    blockedReason
  };
}

export function formatNextEditLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

/** Conteúdo relevante para saber se a gravação conta como alteração. */
export function publicSiteContentFingerprint(row: {
  is_published?: boolean;
  headline?: string;
  subheadline?: string;
  about_text?: string;
  hero_image_url?: string | null;
  gallery_urls?: string[] | null;
  cta_label?: string;
  show_prices?: boolean;
}): string {
  const gallery = Array.isArray(row.gallery_urls) ? [...row.gallery_urls].map(String).sort() : [];
  return JSON.stringify({
    is_published: Boolean(row.is_published),
    headline: row.headline || "",
    subheadline: row.subheadline || "",
    about_text: row.about_text || "",
    hero_image_url: row.hero_image_url || null,
    gallery_urls: gallery,
    cta_label: row.cta_label || "Agendar",
    show_prices: row.show_prices !== false
  });
}

export function nextEditQuotaFields(
  row: PublicSiteEditQuotaRow | null | undefined,
  now = new Date()
): { last_edit_at: string; edit_count: number; edit_count_month: string } {
  const monthKey = publicSiteEditMonthKey(now);
  const prevUsed = usedInCurrentMonth(row, monthKey);
  return {
    last_edit_at: now.toISOString(),
    edit_count: prevUsed + 1,
    edit_count_month: monthKey
  };
}
