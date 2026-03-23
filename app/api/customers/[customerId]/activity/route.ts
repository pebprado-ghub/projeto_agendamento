import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePhoneDigits } from "@/lib/phone";
import { discountCentsFromPoints } from "@/lib/loyalty";

type Params = { params: { customerId: string } };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const customerId = params.customerId;
    const businessId = request.nextUrl.searchParams.get("businessId");
    if (!customerId || !businessId) {
      return NextResponse.json(
        { error: "customerId e businessId sao obrigatorios." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: customer, error: cErr } = await supabase
      .from("customers")
      .select("id, phone_normalized")
      .eq("id", customerId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (cErr || !customer) {
      return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 });
    }

    const { data: byId } = await supabase
      .from("appointments")
      .select(
        "id, service_id, customer_name, customer_phone, starts_at, ends_at, status, notes, customer_id"
      )
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .order("starts_at", { ascending: false })
      .limit(100);

    const { data: orphan } = await supabase
      .from("appointments")
      .select(
        "id, service_id, customer_name, customer_phone, starts_at, ends_at, status, notes, customer_id"
      )
      .eq("business_id", businessId)
      .is("customer_id", null)
      .order("starts_at", { ascending: false })
      .limit(200);

    const phone = customer.phone_normalized;
    const orphanMatch = (orphan || []).filter(
      (a) => normalizePhoneDigits(a.customer_phone || "") === phone
    );

    type ApptRow = NonNullable<typeof byId>[number];
    const mergedMap = new Map<string, ApptRow>();
    for (const a of [...(byId || []), ...orphanMatch]) {
      mergedMap.set(a.id, a);
    }
    const appointments = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
    );
    const completedAppointments = appointments.filter((a) => a.status === "completed");
    const noShowCount = appointments.filter((a) => a.status === "no_show").length;
    if (completedAppointments.length >= 10) {
      await supabase.from("customer_badges").upsert(
        {
          business_id: businessId,
          customer_id: customerId,
          badge_code: "maratonista",
          badge_name: "Maratonista",
          metadata: { rule: "10 agendamentos concluidos" }
        },
        { onConflict: "business_id,customer_id,badge_code" }
      );
    }
    if (appointments.length > 0 && noShowCount === 0) {
      await supabase.from("customer_badges").upsert(
        {
          business_id: businessId,
          customer_id: customerId,
          badge_code: "cliente_pontual",
          badge_name: "Cliente Pontual",
          metadata: { rule: "nenhum no-show no historico" }
        },
        { onConflict: "business_id,customer_id,badge_code" }
      );
    }

    const { data: payments } = await supabase
      .from("customer_payments")
      .select(
        "id, appointment_id, amount_cents, currency, payment_method, status, paid_at, notes, created_at"
      )
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .order("paid_at", { ascending: false })
      .limit(100);

    const { data: contracts } = await supabase
      .from("customer_plan_contracts")
      .select(
        "id, offer_plan_id, status, starts_at, ends_at, sessions_total, sessions_used, next_billing_at, notes, created_at"
      )
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(100);

    const offerIds = Array.from(
      new Set((contracts || []).map((item) => item.offer_plan_id).filter(Boolean))
    );
    const { data: offers } =
      offerIds.length > 0
        ? await supabase
            .from("offer_plans")
            .select("id, name, offer_type")
            .eq("business_id", businessId)
            .in("id", offerIds)
        : { data: [] as Array<{ id: string; name: string; offer_type: string }> };
    const offerById = new Map((offers || []).map((o) => [o.id, o]));

    const contractIds = Array.from(new Set((contracts || []).map((item) => item.id)));
    const { data: usages } =
      contractIds.length > 0
        ? await supabase
            .from("customer_plan_usages")
            .select(
              "id, customer_plan_contract_id, appointment_id, used_sessions, used_at, notes, created_at"
            )
            .eq("business_id", businessId)
            .in("customer_plan_contract_id", contractIds)
            .order("used_at", { ascending: false })
            .limit(300)
        : { data: [] as Array<Record<string, unknown>> };
    const usagesByContract = new Map<string, Array<Record<string, unknown>>>();
    for (const row of usages || []) {
      const key = String(row.customer_plan_contract_id || "");
      if (!usagesByContract.has(key)) usagesByContract.set(key, []);
      usagesByContract.get(key)?.push(row as Record<string, unknown>);
    }

    const paid = (payments || []).filter((p) => p.status === "paid");
    const totalPaidCents = paid.reduce((s, p) => s + (p.amount_cents || 0), 0);
    const uniqueServicesCount = new Set(
      appointments.map((item) => item.service_id).filter(Boolean)
    ).size;
    const { data: loyalty } = await supabase
      .from("customer_loyalty")
      .select("points_balance, lifetime_points, total_redeemed_points, level_code")
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .maybeSingle();
    const { data: badges } = await supabase
      .from("customer_badges")
      .select("id, badge_code, badge_name, achieved_at, metadata")
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .order("achieved_at", { ascending: false })
      .limit(30);
    const { data: referrals } = await supabase
      .from("customer_referrals")
      .select(
        "id, referred_customer_id, referral_code, status, reward_referrer_cents, reward_referred_cents, converted_at, created_at"
      )
      .eq("business_id", businessId)
      .eq("referrer_customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      appointments,
      payments: payments || [],
      contracts: (contracts || []).map((item) => ({
        ...item,
        offer_name: offerById.get(item.offer_plan_id)?.name || "Plano/pacote",
        offer_type: offerById.get(item.offer_plan_id)?.offer_type || "package",
        usages: usagesByContract.get(item.id) || []
      })),
      stats: {
        visitCount: appointments.length,
        totalPaidCents,
        lifetimeValueCents: totalPaidCents,
        uniqueServicesCount
      },
      loyalty: {
        pointsBalance: Number(loyalty?.points_balance || 0),
        lifetimePoints: Number(loyalty?.lifetime_points || 0),
        totalRedeemedPoints: Number(loyalty?.total_redeemed_points || 0),
        levelCode: String(loyalty?.level_code || "bronze"),
        availableDiscountCents: discountCentsFromPoints(Number(loyalty?.points_balance || 0))
      },
      badges: badges || [],
      referrals: referrals || []
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
