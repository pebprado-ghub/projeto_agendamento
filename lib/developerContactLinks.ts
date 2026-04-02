/** Atalhos de contato (WhatsApp / e-mail) usados no painel do desenvolvedor. */

export function digitsOnly(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
}

export function buildWhatsAppUrlFromBusinessNumber(raw: string | null | undefined): string | null {
  let d = digitsOnly(raw || "");
  if (d.length < 10) return null;
  if (!d.startsWith("55") && (d.length === 10 || d.length === 11)) d = `55${d}`;
  return `https://wa.me/${d}`;
}

export function buildMailtoForBusiness(
  email: string | null | undefined,
  subject: string,
  body?: string
): string | null {
  const e = String(email || "").trim();
  if (!e.includes("@")) return null;
  let href = `mailto:${e}?subject=${encodeURIComponent(subject)}`;
  if (body) href += `&body=${encodeURIComponent(body)}`;
  return href;
}
