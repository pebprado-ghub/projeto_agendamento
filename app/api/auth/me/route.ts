import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeSessionRole } from "@/lib/authRoles";

/**
 * Empresa fixa para o login `owner` (administrador da empresa):
 * 1) `OWNER_BUSINESS_ID` ou `CLIENT_BUSINESS_ID` (legado) no .env se houver várias empresas;
 * 2) Se não houver env e existir **exatamente um** registro em `businesses`, usa esse UUID.
 */
async function resolveOwnerBusinessId(): Promise<string | null> {
  const fromEnv = (
    process.env.OWNER_BUSINESS_ID ||
    process.env.CLIENT_BUSINESS_ID ||
    ""
  ).trim();
  if (fromEnv) {
    return fromEnv;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("businesses")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(2);

  if (error || !data?.length) {
    return null;
  }

  if (data.length === 1) {
    return data[0].id;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const raw = request.cookies.get("session_role")?.value;
  const role = normalizeSessionRole(raw);
  if (!role) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const businessId = role === "owner" ? await resolveOwnerBusinessId() : null;

  return NextResponse.json({ role, businessId });
}
