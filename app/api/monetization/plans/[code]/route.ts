import { NextRequest, NextResponse } from "next/server";
import { emptyFeatureMap, type AdminPlanFeatureId } from "@/lib/adminPlanFeatures";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: {
    code: string;
  };
};

type PatchPlanBody = {
  name?: string;
  monthly_price_cents?: number;
  monthly_appointment_limit?: number | null;
  professional_limit?: number | null;
  allows_automations?: boolean;
  allows_multi_unit?: boolean;
  is_active?: boolean;
  feature_flags?: Record<string, boolean> | null;
};

function normalizeFeatureFlags(input: Record<string, boolean> | null | undefined) {
  if (!input || typeof input !== "object") return null;
  const base = emptyFeatureMap();
  for (const key of Object.keys(base) as AdminPlanFeatureId[]) {
    if (typeof input[key] === "boolean") {
      base[key] = input[key];
    }
  }
  return base;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const code = params.code?.trim();
    if (!code) {
      return NextResponse.json({ error: "Codigo do plano invalido." }, { status: 400 });
    }

    const body = (await request.json()) as PatchPlanBody;
    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json({ error: "Nome do plano e obrigatorio." }, { status: 400 });
      }
      updates.name = name;
    }

    if (body.monthly_price_cents != null) {
      const price = Number(body.monthly_price_cents);
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: "Preco invalido." }, { status: 400 });
      }
      updates.monthly_price_cents = Math.round(price);
    }

    if (body.monthly_appointment_limit !== undefined) {
      updates.monthly_appointment_limit =
        body.monthly_appointment_limit == null
          ? null
          : Math.max(1, Math.floor(Number(body.monthly_appointment_limit)));
    }

    if (body.professional_limit !== undefined) {
      updates.professional_limit =
        body.professional_limit == null
          ? null
          : Math.max(1, Math.floor(Number(body.professional_limit)));
    }

    if (typeof body.allows_automations === "boolean") {
      updates.allows_automations = body.allows_automations;
    }
    if (typeof body.allows_multi_unit === "boolean") {
      updates.allows_multi_unit = body.allows_multi_unit;
    }
    if (typeof body.is_active === "boolean") {
      updates.is_active = body.is_active;
    }

    if (body.feature_flags !== undefined) {
      updates.feature_flags = normalizeFeatureFlags(body.feature_flags);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const supabase = getSupabaseAdmin();
    let result = await supabase
      .from("subscription_plans")
      .update(updates)
      .eq("code", code)
      .select("*")
      .maybeSingle();

    if (result.error && /feature_flags/i.test(String(result.error.message || ""))) {
      const { feature_flags: _ignored, ...fallback } = updates;
      result = await supabase
        .from("subscription_plans")
        .update(fallback)
        .eq("code", code)
        .select("*")
        .maybeSingle();
    }

    if (result.error) {
      return NextResponse.json({ error: "Falha ao atualizar plano." }, { status: 500 });
    }
    if (!result.data) {
      return NextResponse.json({ error: "Plano nao encontrado." }, { status: 404 });
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
