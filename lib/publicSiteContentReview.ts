export type ContentReviewSeverity = "error" | "warning" | "info";

export type ContentReviewIssue = {
  id: string;
  severity: ContentReviewSeverity;
  field: string;
  message: string;
};

export type PublicSiteReviewInput = {
  headline: string;
  subheadline: string;
  aboutText: string;
  heroImageUrl: string | null;
  galleryUrls: string[];
  ctaLabel: string;
  showPrices: boolean;
  services: Array<{
    name: string;
    description: string | null;
    imageUrls: string[];
    priceCents: number | null;
  }>;
};

const PLACEHOLDER_RE =
  /\b(lorem ipsum|ipsum dolor|texto de exemplo|preencher|placeholder|xxx+|asdf|qwerty|teste123|foo bar)\b/i;

const COMMON_TYPOS: Array<{ re: RegExp; hint: string }> = [
  { re: /\bvoce\b/i, hint: 'Possível falta de acento em "você".' },
  { re: /\bnao\b/i, hint: 'Possível falta de acento em "não".' },
  { re: /\bhorario\b/i, hint: 'Possível falta de acento em "horário".' },
  { re: /\bservico\b/i, hint: 'Possível falta de acento em "serviço".' },
  { re: /\bservicos\b/i, hint: 'Possível falta de acento em "serviços".' },
  { re: /\batencao\b/i, hint: 'Possível falta de acento em "atenção".' },
  { re: /\bdisponivel\b/i, hint: 'Possível falta de acento em "disponível".' },
  { re: /\bpreco\b/i, hint: 'Possível falta de acento em "preço".' },
  { re: /\bprecos\b/i, hint: 'Possível falta de acento em "preços".' },
  { re: /\bagende\s+ja\b/i, hint: 'Possível falta de acento em "já".' }
];

function push(
  issues: ContentReviewIssue[],
  id: string,
  severity: ContentReviewSeverity,
  field: string,
  message: string
) {
  issues.push({ id, severity, field, message });
}

function scanTextTypos(text: string, field: string, prefix: string, issues: ContentReviewIssue[]) {
  if (!text.trim()) return;
  for (const item of COMMON_TYPOS) {
    if (item.re.test(text)) {
      push(issues, `${prefix}-typo-${item.re.source}`, "warning", field, item.hint);
    }
  }
  if (PLACEHOLDER_RE.test(text)) {
    push(
      issues,
      `${prefix}-placeholder`,
      "error",
      field,
      "Parece texto de exemplo/placeholder. Substitua por conteúdo real."
    );
  }
  if (/\s{2,}/.test(text)) {
    push(issues, `${prefix}-spaces`, "info", field, "Há espaços duplos; revise a formatação.");
  }
  if (/[!]{3,}|[?]{3,}/.test(text)) {
    push(issues, `${prefix}-punct`, "warning", field, "Pontuação excessiva (!!! / ???).");
  }
  if (text === text.toUpperCase() && text.replace(/\s/g, "").length >= 24) {
    push(
      issues,
      `${prefix}-allcaps`,
      "warning",
      field,
      "Texto quase todo em maiúsculas — pode parecer gritaria ou spam."
    );
  }
}

function looksLikeImageUrl(url: string) {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol);
  } catch {
    return false;
  }
}

/** Revisão heurística de conteúdo para o modo teste do site público (beta). */
export function reviewPublicSiteContent(input: PublicSiteReviewInput): ContentReviewIssue[] {
  const issues: ContentReviewIssue[] = [];
  const headline = (input.headline || "").trim();
  const subheadline = (input.subheadline || "").trim();
  const about = (input.aboutText || "").trim();
  const cta = (input.ctaLabel || "").trim();

  if (!headline) {
    push(issues, "headline-empty", "error", "headline", "Título (headline) está vazio.");
  } else if (headline.length < 8) {
    push(issues, "headline-short", "warning", "headline", "Título muito curto (menos de 8 caracteres).");
  } else if (headline.length > 120) {
    push(issues, "headline-long", "warning", "headline", "Título longo demais para o hero (mais de 120 caracteres).");
  }
  scanTextTypos(headline, "headline", "headline", issues);

  if (!subheadline) {
    push(
      issues,
      "subheadline-empty",
      "warning",
      "subheadline",
      "Subtítulo vazio — uma frase de apoio ajuda no marketing."
    );
  } else if (subheadline.length < 12) {
    push(issues, "subheadline-short", "info", "subheadline", "Subtítulo bem curto.");
  }
  scanTextTypos(subheadline, "subheadline", "subheadline", issues);

  if (!about) {
    push(
      issues,
      "about-empty",
      "warning",
      "aboutText",
      "Texto “Sobre” vazio — a vitrine fica só com serviços."
    );
  } else if (about.length < 40) {
    push(issues, "about-short", "warning", "aboutText", "Texto “Sobre” muito curto para marketing.");
  }
  scanTextTypos(about, "aboutText", "about", issues);

  if (!cta) {
    push(issues, "cta-empty", "error", "ctaLabel", "Texto do botão (CTA) está vazio.");
  } else if (cta.length > 40) {
    push(issues, "cta-long", "warning", "ctaLabel", "CTA longo demais para um botão.");
  }

  if (!input.heroImageUrl) {
    push(
      issues,
      "hero-missing",
      "warning",
      "heroImageUrl",
      "Sem imagem de capa (hero). A página usa só o gradiente verde."
    );
  } else if (!looksLikeImageUrl(input.heroImageUrl)) {
    push(issues, "hero-url", "error", "heroImageUrl", "URL da capa inválida (use http/https).");
  }

  const gallery = input.galleryUrls || [];
  gallery.forEach((url, i) => {
    if (!looksLikeImageUrl(url)) {
      push(
        issues,
        `gallery-url-${i}`,
        "error",
        "galleryUrls",
        `Imagem da galeria #${i + 1} com URL inválida.`
      );
    }
  });
  if (gallery.length === 0) {
    push(issues, "gallery-empty", "info", "galleryUrls", "Galeria vazia (opcional na beta).");
  }

  const services = input.services || [];
  if (services.length === 0) {
    push(
      issues,
      "services-empty",
      "error",
      "services",
      "Nenhum serviço ativo no catálogo — a vitrine fica sem oferta."
    );
  } else {
    let withoutDesc = 0;
    let withoutImage = 0;
    let withoutPrice = 0;
    for (const s of services) {
      if (!(s.description || "").trim()) withoutDesc += 1;
      if (!(s.imageUrls && s.imageUrls.length)) withoutImage += 1;
      if (s.priceCents == null) withoutPrice += 1;
      if (!s.name?.trim()) {
        push(issues, "service-nameless", "error", "services", "Há serviço sem nome.");
      }
    }
    if (withoutDesc > 0) {
      push(
        issues,
        "services-desc",
        "warning",
        "services",
        `${withoutDesc} serviço(s) sem descrição.`
      );
    }
    if (withoutImage > 0) {
      push(
        issues,
        "services-img",
        "info",
        "services",
        `${withoutImage} serviço(s) sem foto (só ícone/cor).`
      );
    }
    if (input.showPrices && withoutPrice === services.length) {
      push(
        issues,
        "prices-all-missing",
        "warning",
        "showPrices",
        "“Mostrar preços” está ativo, mas nenhum serviço tem preço cadastrado."
      );
    }
  }

  const rank = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => rank[a.severity] - rank[b.severity] || a.field.localeCompare(b.field));
  return issues;
}

export function summarizeContentReview(issues: ContentReviewIssue[]) {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;
  return { errors, warnings, infos, total: issues.length };
}
