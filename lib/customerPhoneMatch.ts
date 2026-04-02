/** Compara telefone salvo no agendamento com o `from` do WhatsApp (apenas dígitos). */
export function customerPhonesMatch(storedPhone: string, inboundDigits: string) {
  const a = String(storedPhone || "").replace(/\D/g, "");
  const b = String(inboundDigits || "").replace(/\D/g, "");
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 8 && b.length >= 8) {
    const ta = a.slice(-11);
    const tb = b.slice(-11);
    if (ta === tb) return true;
  }
  return a.endsWith(b) || b.endsWith(a);
}
