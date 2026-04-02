/** Fuso IANA do navegador (ex.: America/Sao_Paulo), para cadastro sem campo manual. */
export function getBrowserIanaTimezone(): string {
  if (typeof Intl === "undefined" || typeof Intl.DateTimeFormat === "undefined") {
    return "America/Sao_Paulo";
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && typeof tz === "string" && tz.length > 0) return tz;
  } catch {
    /* ignore */
  }
  return "America/Sao_Paulo";
}
