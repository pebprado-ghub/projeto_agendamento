/** CEP brasileiro: 00000-000 */
export function maskCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatMaskedFromDigits(
  value: string | null | undefined,
  formatter: (input: string) => string
) {
  if (!value) return "";
  return formatter(value);
}
