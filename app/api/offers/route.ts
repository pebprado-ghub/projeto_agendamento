import { NextRequest, NextResponse } from "next/server";
import { assertPlanFeature } from "@/lib/planAccess";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type OfferBody = {
  businessId: string;
  serviceId?: string | null;
  name: string;
  offerType: "package" | "subscription";
  description?: string;
  priceCents: number;
  sessionsIncluded?: number | null;
  billingCycleDays?: number | null;
  isActive?: boolean;
};

const SELECT_FIELDS =
  "id, business_id, service_id, name, offer_type, description, price_cents, sessions_included, billing_cycle_days, is_active, created_at, updated_at";

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "Parametro businessId e obrigatorio." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("offer_plans")
      .select(SELECT_FIELDS)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      return NextResponse.json({ error: "Falha ao listar planos/ofertas." }, { status: 500 });
    }
    return NextResponse.json({ data: data || [] });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as OfferBody;
    if (!body.businessId || !body.name?.trim()) {
      return NextResponse.json({ error: "businessId e name sao obrigatorios." }, { status: 400 });
    }
    const offerType = body.offerType === "subscription" ? "subscription" : "package";
    const priceCents = Math.max(0, Math.round(Number(body.priceCents) || 0));
    const sessionsIncluded =
      body.sessionsIncluded == null ? null : Math.max(1, Math.floor(Number(body.sessionsIncluded)));
    const billingCycleDays =
      body.billingCycleDays == null ? null : Math.max(1, Math.floor(Number(body.billingCycleDays)));

    const supabase = getSupabaseAdmin();

    const gate = await assertPlanFeature(supabase, body.businessId, "offers_loyalty");
    if (!gate.ok) return gate.response;

    const { data, error } = await supabase
      .from("offer_plans")
      .insert({
        business_id: body.businessId,
        service_id: body.serviceId || null,
        name: body.name.trim(),
        offer_type: offerType,
        description: body.description?.trim() || null,
        price_cents: priceCents,
        sessions_included: sessionsIncluded,
        billing_cycle_days: billingCycleDays,
        is_active: body.isActive !== false
      })
      .select(SELECT_FIELDS)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Falha ao criar oferta/plano." }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
