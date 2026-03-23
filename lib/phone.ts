/** Telefone apenas com dígitos (Brasil e genérico). */
export function normalizePhoneDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}
