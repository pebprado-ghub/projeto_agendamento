import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CreateRequestBody = {
  businessId?: string;
  currentPlanCode?: "free" | "pro" | "enterprise";
  requestedPlanCode?: "free" | "pro" | "enterprise";
  note?: string | null;
};

const ALLOWED_PLAN_CODES = ["free", "pro", "enterprise"] as const;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || "30")));
    const status = (url.searchParams.get("status") || "").trim();
    const businessId = (url.searchParams.get("businessId") || "").trim();

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("subscription_change_requests")
      .select(
        "id, business_id, current_plan_code, requested_plan_code, requested_by_role, status, note, created_at, businesses(name, slug)"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) query = query.eq("status", status);
    if (businessId) query = query.eq("business_id", businessId);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: "Falha ao listar solicitações de plano." }, { status: 500 });
    }

    const normalized = (data || []).map((item) => ({
      id: item.id,
      businessId: item.business_id,
      businessName:
        Array.isArray(item.businesses) && item.businesses[0]?.name
          ? item.businesses[0].name
          : "Empresa",
      businessSlug:
        Array.isArray(item.businesses) && item.businesses[0]?.slug ? item.businesses[0].slug : "",
      currentPlanCode: item.current_plan_code,
      requestedPlanCode: item.requested_plan_code,
      requestedByRole: item.requested_by_role,
      status: item.status,
      note: item.note,
      createdAt: item.created_at,
    }));

    return NextResponse.json({ data: normalized });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateRequestBody;
    const businessId = body.businessId?.trim() || "";
    const currentPlanCode = body.currentPlanCode || "free";
    const requestedPlanCode = body.requestedPlanCode || "";
    const note = body.note?.trim() || null;

    if (!businessId) {
      return NextResponse.json({ error: "businessId é obrigatório." }, { status: 400 });
    }
    if (!ALLOWED_PLAN_CODES.includes(currentPlanCode)) {
      return NextResponse.json({ error: "Plano atual inválido." }, { status: 400 });
    }
    if (!ALLOWED_PLAN_CODES.includes(requestedPlanCode as (typeof ALLOWED_PLAN_CODES)[number])) {
      return NextResponse.json({ error: "Plano solicitado inválido." }, { status: 400 });
    }
    if (currentPlanCode === requestedPlanCode) {
      return NextResponse.json(
        { error: "Selecione um plano diferente do plano atual." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: activePending } = await supabase
      .from("subscription_change_requests")
      .select("id")
      .eq("business_id", businessId)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (activePending) {
      return NextResponse.json(
        { error: "Já existe uma solicitação pendente para esta empresa." },
        { status: 409 }
      );
    }

    const { error } = await supabase.from("subscription_change_requests").insert({
      business_id: businessId,
      current_plan_code: currentPlanCode,
      requested_plan_code: requestedPlanCode,
      requested_by_role: "owner",
      status: "pending",
      note
    });

    if (error) {
      return NextResponse.json({ error: "Falha ao registrar solicitação." }, { status: 500 });
    }

    return NextResponse.json({
      message: "Solicitação enviada para confirmação do desenvolvedor."
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
