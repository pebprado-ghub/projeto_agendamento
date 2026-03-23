import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = { params: { contractId: string } };
type PatchBody = {
  businessId: string;
  action: "pause" | "reactivate" | "cancel";
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const contractId = params.contractId;
    const body = (await request.json()) as PatchBody;
    if (!contractId || !body.businessId || !body.action) {
      return NextResponse.json(
        { error: "contractId, businessId e action sao obrigatorios." },
        { status: 400 }
      );
    }

    const statusMap: Record<PatchBody["action"], "paused" | "active" | "cancelled"> = {
      pause: "paused",
      reactivate: "active",
      cancel: "cancelled"
    };
    const nextStatus = statusMap[body.action];
    const supabase = getSupabaseAdmin();
    const patch: Record<string, string | null> = { status: nextStatus };
    if (body.action === "cancel") {
      patch.ends_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("customer_plan_contracts")
      .update(patch)
      .eq("id", contractId)
      .eq("business_id", body.businessId)
      .select(
        "id, business_id, customer_id, offer_plan_id, status, starts_at, ends_at, sessions_total, sessions_used, next_billing_at, notes, created_at"
      )
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Falha ao atualizar contrato." }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
