import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type RunBillingBody = {
  businessId: string;
  contractId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RunBillingBody;
    if (!body.businessId) {
      return NextResponse.json({ error: "businessId e obrigatorio." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("customer_plan_contracts")
      .select(
        "id, business_id, customer_id, offer_plan_id, status, next_billing_at, starts_at, notes"
      )
      .eq("business_id", body.businessId)
      .eq("status", "active");

    if (body.contractId) {
      query = query.eq("id", body.contractId);
    }

    const { data: contracts } = await query.limit(500);
    const offerIds = Array.from(
      new Set((contracts || []).map((item) => item.offer_plan_id).filter(Boolean))
    );
    const { data: offers } =
      offerIds.length > 0
        ? await supabase
            .from("offer_plans")
            .select("id, name, offer_type, price_cents, billing_cycle_days, is_active")
            .eq("business_id", body.businessId)
            .in("id", offerIds)
        : { data: [] as Array<Record<string, unknown>> };
    const offerById = new Map((offers || []).map((o) => [String(o.id), o]));
    const now = new Date();
    const createdPayments: Array<{ contractId: string; paymentId: string }> = [];

    for (const contract of contracts || []) {
      const offer = offerById.get(contract.offer_plan_id);
      if (!offer) continue;
      if (offer.offer_type !== "subscription") continue;
      if (!offer.is_active) continue;
      const cycleDays = Math.max(1, Number(offer.billing_cycle_days || 30));
      const currentDue = new Date(contract.next_billing_at || contract.starts_at);
      if (Number.isNaN(currentDue.getTime())) continue;
      if (currentDue > now) continue;

      const reference = `sub:${contract.id}:${currentDue.toISOString().slice(0, 10)}`;
      const { data: existing } = await supabase
        .from("customer_payments")
        .select("id")
        .eq("business_id", body.businessId)
        .eq("customer_id", contract.customer_id)
        .eq("external_reference", reference)
        .maybeSingle();
      if (existing?.id) continue;

      const { data: payment } = await supabase
        .from("customer_payments")
        .insert({
          business_id: body.businessId,
          customer_id: contract.customer_id,
          amount_cents: Number(offer.price_cents || 0),
          currency: "BRL",
          payment_method: "pix",
          status: "pending",
          paid_at: now.toISOString(),
          due_at: currentDue.toISOString(),
          payment_provider: "internal",
          paid_online: false,
          external_reference: reference,
          notes: `Cobranca recorrente: ${offer.name}`
        })
        .select("id")
        .single();
      if (payment?.id) {
        createdPayments.push({ contractId: contract.id, paymentId: payment.id });
      }

      const nextDue = new Date(currentDue.getTime() + cycleDays * 24 * 60 * 60_000);
      await supabase
        .from("customer_plan_contracts")
        .update({ next_billing_at: nextDue.toISOString() })
        .eq("id", contract.id);
    }

    return NextResponse.json({
      message: "Execucao de cobranca concluida.",
      createdCount: createdPayments.length,
      createdPayments
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
