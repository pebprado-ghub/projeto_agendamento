import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CreateRequestBody = {
  businessId?: string;
  currentPlanCode?: "free" | "pro" | "enterprise";
  requestedPlanCode?: "free" | "pro" | "enterprise";
  note?: string | null;
};

const ALLOWED_PLAN_CODES = ["free", "pro", "enterprise"] as const;

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
        { error: "Já existe uma solicitação pendente para este negócio." },
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
