/**
 * Texto salvo como UTF-8 mas lido como Latin-1 vira mojibake (ex.: "NegÃ³cio" em vez de "Negócio").
 * Reinterpreta os code units como bytes UTF-8 quando há padrão típico de erro.
 */
export function repairUtf8MisinterpretedAsLatin1(value: string | null | undefined): string {
  if (value == null || value === "") return value ?? "";
  if (!/[ÃÂÄÅ]/.test(value)) return value;
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 0xff;
  const repaired = new TextDecoder("utf-8").decode(bytes);
  if (repaired.includes("\uFFFD")) return value;
  return repaired;
}
