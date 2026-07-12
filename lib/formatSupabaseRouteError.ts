/** Mensagens mais claras para falhas de rede/DNS ao falar com o Supabase. */
export function formatSupabaseRouteError(error: unknown): string {
  const err = error as Error & { cause?: { code?: string; message?: string } };
  const message = err?.message || String(error);
  const causeCode = err?.cause?.code || "";
  const causeMsg = err?.cause?.message || "";
  const blob = `${message} ${causeCode} ${causeMsg}`.toLowerCase();

  if (
    blob.includes("enotfound") ||
    blob.includes("eai_again") ||
    blob.includes("getaddrinfo") ||
    (blob.includes("fetch failed") && (blob.includes("enotfound") || causeCode === "ENOTFOUND"))
  ) {
    return (
      "Não foi possível alcançar o Supabase (DNS/rede). " +
      "Verifique internet, VPN/firewall e se o projeto em NEXT_PUBLIC_SUPABASE_URL ainda existe e está ativo."
    );
  }

  if (
    blob.includes("fetch failed") ||
    blob.includes("econnrefused") ||
    blob.includes("etimedout") ||
    blob.includes("network")
  ) {
    return (
      "Falha de conexão com o Supabase. " +
      "Confira NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e a conectividade de rede."
    );
  }

  return message || "Erro interno no servidor.";
}
