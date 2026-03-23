/**
 * Papéis de sessão (cookie `session_role`):
 * - `developer`: mantém a ferramenta (multi-negócio, cadastros globais).
 * - `owner`: empresário/autônomo que usa o painel do negócio.
 *
 * Legado (cookies antigos): `admin` → developer, `client` → owner.
 */
export type SessionRole = "developer" | "owner";

export function normalizeSessionRole(raw: string | undefined): SessionRole | null {
  if (raw === "developer" || raw === "owner") {
    return raw;
  }
  if (raw === "admin") {
    return "developer";
  }
  if (raw === "client") {
    return "owner";
  }
  return null;
}

export function isAuthenticatedRole(raw: string | undefined): boolean {
  return normalizeSessionRole(raw) !== null;
}
