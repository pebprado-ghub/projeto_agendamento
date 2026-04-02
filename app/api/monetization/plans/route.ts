import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("monthly_price_cents", { ascending: true });
    if (error) {
      return NextResponse.json({ error: "Falha ao listar planos." }, { status: 500 });
    }
    return NextResponse.json({ data: data || [] });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

type CreatePlanBody = {
  code?: string;
  name?: string;
  monthly_price_cents?: number;
  monthly_appointment_limit?: number | null;
  professional_limit?: number | null;
  allows_automations?: boolean;
  allows_multi_unit?: boolean;
  is_active?: boolean;
  feature_flags?: Record<string, boolean> | null;
};

function normalizePlanCode(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreatePlanBody;
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Informe o nome do plano." }, { status: 400 });
    }

    const price = Number(body.monthly_price_cents ?? 0);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Preço inválido." }, { status: 400 });
    }

    const codeSource = String(body.code || name);
    const code = normalizePlanCode(codeSource);
    if (!code) {
      return NextResponse.json({ error: "Código do plano inválido." }, { status: 400 });
    }

    const payload = {
      code,
      name,
      monthly_price_cents: Math.round(price),
      monthly_appointment_limit:
        body.monthly_appointment_limit == null ? null : Number(body.monthly_appointment_limit),
      professional_limit: body.professional_limit == null ? null : Number(body.professional_limit),
      allows_automations: body.allows_automations === true,
      allows_multi_unit: body.allows_multi_unit === true,
      is_active: body.is_active !== false,
      feature_flags: body.feature_flags || null,
    };

    const supabase = getSupabaseAdmin();
    let insertResult = await supabase.from("subscription_plans").insert(payload).select("*").single();

    if (insertResult.error && /feature_flags/i.test(insertResult.error.message || "")) {
      // Compatibilidade com bancos ainda sem coluna feature_flags.
      const { feature_flags: _ignored, ...fallbackPayload } = payload;
      insertResult = await supabase
        .from("subscription_plans")
        .insert(fallbackPayload)
        .select("*")
        .single();
    }

    if (insertResult.error) {
      const msg = String(insertResult.error.message || "");
      if (/duplicate key|unique/i.test(msg)) {
        return NextResponse.json({ error: "Já existe um plano com este código." }, { status: 409 });
      }
      return NextResponse.json({ error: "Falha ao criar plano." }, { status: 500 });
    }

    return NextResponse.json({ data: insertResult.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
