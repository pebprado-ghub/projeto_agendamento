import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end };
}

function hasPromoHint(note: string | null | undefined) {
  if (!note) return false;
  return /(promo|promoc|cupom|desconto)/i.test(note);
}

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    const month = request.nextUrl.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    if (!businessId) {
      return NextResponse.json({ error: "Parametro businessId e obrigatorio." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Parametro month invalido (use YYYY-MM)." }, { status: 400 });
    }

    const { start, end } = monthBounds(month);
    const supabase = getSupabaseAdmin();

    const [{ data: payments }, { data: ledger }, { data: contracts }, { data: offers }] =
      await Promise.all([
        supabase
          .from("customer_payments")
          .select("amount_cents, notes")
          .eq("business_id", businessId)
          .eq("status", "paid")
          .gte("paid_at", start.toISOString())
          .lte("paid_at", end.toISOString())
          .limit(10000),
        supabase
          .from("loyalty_points_ledger")
          .select("reason, metadata")
          .eq("business_id", businessId)
          .eq("reason", "redeem_discount")
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString())
          .limit(10000),
        supabase
          .from("customer_plan_contracts")
          .select("offer_plan_id, status, created_at")
          .eq("business_id", businessId)
          .limit(10000),
        supabase
          .from("offer_plans")
          .select("id, name, offer_type")
          .eq("business_id", businessId)
          .limit(2000)
      ]);

    const totalPaidCents = (payments || []).reduce(
      (sum, item) => sum + Number(item.amount_cents || 0),
      0
    );
    const paidCount = (payments || []).length;
    const averageTicketCents = paidCount > 0 ? Math.round(totalPaidCents / paidCount) : 0;

    const promoPayments = (payments || []).filter((item) => hasPromoHint(item.notes));
    const promoPaymentsCount = promoPayments.length;
    const promoRevenueCents = promoPayments.reduce(
      (sum, item) => sum + Number(item.amount_cents || 0),
      0
    );

    const totalDiscountRedeemedCents = (ledger || []).reduce((sum, item) => {
      const metadata = (item.metadata || {}) as { discountCents?: number };
      return sum + Number(metadata.discountCents || 0);
    }, 0);

    const offerById = new Map(
      (offers || []).map((offer) => [
        offer.id,
        { name: offer.name || "Plano/pacote", type: offer.offer_type || "package" }
      ])
    );

    let activePackageContracts = 0;
    let activeSubscriptionContracts = 0;
    const contractsStartedInMonthByOffer = new Map<string, number>();

    for (const contract of contracts || []) {
      const offer = offerById.get(contract.offer_plan_id);
      if (!offer) continue;

      if (contract.status === "active") {
        if (offer.type === "subscription") activeSubscriptionContracts += 1;
        else activePackageContracts += 1;
      }

      const createdAt = contract.created_at || "";
      if (createdAt >= start.toISOString() && createdAt <= end.toISOString()) {
        contractsStartedInMonthByOffer.set(
          contract.offer_plan_id,
          (contractsStartedInMonthByOffer.get(contract.offer_plan_id) || 0) + 1
        );
      }
    }

    const topLoyaltyOffers = Array.from(contractsStartedInMonthByOffer.entries())
      .map(([offerId, count]) => {
        const offer = offerById.get(offerId);
        return {
          offerId,
          offerName: offer?.name || "Plano/pacote",
          offerType: offer?.type || "package",
          startedCount: count
        };
      })
      .sort((a, b) => b.startedCount - a.startedCount)
      .slice(0, 10);

    return NextResponse.json({
      data: {
        month,
        totalPaidCents,
        paidCount,
        averageTicketCents,
        totalDiscountRedeemedCents,
        promoPaymentsCount,
        promoRevenueCents,
        activePackageContracts,
        activeSubscriptionContracts,
        topLoyaltyOffers
      }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
