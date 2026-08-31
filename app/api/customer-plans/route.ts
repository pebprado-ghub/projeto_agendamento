import { NextRequest, NextResponse } from "next/server";
import { assertPlanFeature } from "@/lib/planAccess";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CreateCustomerPlanBody = {
  businessId: string;
  customerId: string;
  offerPlanId: string;
  startsAt?: string;
  endsAt?: string | null;
  sessionsTotal?: number | null;
  notes?: string | null;
};

const SELECT_FIELDS =
  "id, business_id, customer_id, offer_plan_id, status, starts_at, ends_at, sessions_total, sessions_used, next_billing_at, notes, created_at";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCustomerPlanBody;
    if (!body.businessId || !body.customerId || !body.offerPlanId) {
      return NextResponse.json(
        { error: "businessId, customerId e offerPlanId sao obrigatorios." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    const gate = await assertPlanFeature(supabase, body.businessId, "offers_loyalty");
    if (!gate.ok) return gate.response;

    const [{ data: customer }, { data: offer }] = await Promise.all([
      supabase
        .from("customers")
        .select("id")
        .eq("id", body.customerId)
        .eq("business_id", body.businessId)
        .maybeSingle(),
      supabase
        .from("offer_plans")
        .select("id, offer_type, sessions_included, billing_cycle_days, is_active")
        .eq("id", body.offerPlanId)
        .eq("business_id", body.businessId)
        .maybeSingle()
    ]);

    if (!customer) {
      return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 });
    }
    if (!offer || !offer.is_active) {
      return NextResponse.json({ error: "Plano/pacote nao encontrado ou inativo." }, { status: 404 });
    }

    const startsAt = body.startsAt ? new Date(body.startsAt) : new Date();
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "startsAt invalido." }, { status: 400 });
    }
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (body.endsAt && (!endsAt || Number.isNaN(endsAt.getTime()))) {
      return NextResponse.json({ error: "endsAt invalido." }, { status: 400 });
    }

    const defaultSessions =
      offer.offer_type === "package" ? Number(offer.sessions_included || 0) : null;
    const sessionsTotal =
      body.sessionsTotal == null
        ? defaultSessions
        : Math.max(0, Math.floor(Number(body.sessionsTotal) || 0));
    const nextBillingAt =
      offer.offer_type === "subscription" && offer.billing_cycle_days
        ? new Date(startsAt.getTime() + Number(offer.billing_cycle_days) * 24 * 60 * 60_000)
        : null;

    const { data, error } = await supabase
      .from("customer_plan_contracts")
      .insert({
        business_id: body.businessId,
        customer_id: body.customerId,
        offer_plan_id: body.offerPlanId,
        status: "active",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt ? endsAt.toISOString() : null,
        sessions_total: sessionsTotal,
        sessions_used: 0,
        next_billing_at: nextBillingAt ? nextBillingAt.toISOString() : null,
        notes: body.notes?.trim() || null
      })
      .select(SELECT_FIELDS)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Falha ao criar contrato do cliente." }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
