import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { levelFromLifetimePoints, pointsFromPayment } from "@/lib/loyalty";

type CreatePaymentBody = {
  businessId: string;
  customerId: string;
  appointmentId?: string | null;
  amountCents: number;
  currency?: string;
  paymentMethod: string;
  status?: string;
  paidAt?: string;
  dueAt?: string;
  paymentProvider?: string;
  paymentLink?: string;
  externalReference?: string;
  paidOnline?: boolean;
  notes?: string | null;
};

const SELECT_FIELDS =
  "id, business_id, customer_id, appointment_id, amount_cents, currency, payment_method, status, paid_at, due_at, payment_provider, payment_link, external_reference, paid_online, notes, created_at";

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    const customerId = request.nextUrl.searchParams.get("customerId");
    if (!businessId) {
      return NextResponse.json(
        { error: "Parametro businessId e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("customer_payments")
      .select(SELECT_FIELDS)
      .eq("business_id", businessId)
      .order("paid_at", { ascending: false })
      .limit(200);

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json(
        { error: "Falha ao listar pagamentos." },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreatePaymentBody;
    if (!body.businessId || !body.customerId) {
      return NextResponse.json(
        { error: "businessId e customerId sao obrigatorios." },
        { status: 400 }
      );
    }

    const amount = Number(body.amountCents);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json(
        { error: "amountCents deve ser um numero >= 0." },
        { status: 400 }
      );
    }

    const methods = ["cash", "pix", "boleto", "credit_card", "debit_card", "transfer", "other"];
    if (!methods.includes(body.paymentMethod)) {
      return NextResponse.json({ error: "Metodo de pagamento invalido." }, { status: 400 });
    }

    const status = body.status || "paid";
    const statuses = ["pending", "paid", "refunded", "cancelled"];
    if (!statuses.includes(status)) {
      return NextResponse.json({ error: "Status invalido." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: cust } = await supabase
      .from("customers")
      .select("id")
      .eq("id", body.customerId)
      .eq("business_id", body.businessId)
      .maybeSingle();

    if (!cust) {
      return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 });
    }

    if (body.appointmentId) {
      const { data: ap } = await supabase
        .from("appointments")
        .select("id")
        .eq("id", body.appointmentId)
        .eq("business_id", body.businessId)
        .maybeSingle();
      if (!ap) {
        return NextResponse.json(
          { error: "Agendamento nao encontrado para este negocio." },
          { status: 404 }
        );
      }
    }

    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
      return NextResponse.json({ error: "paidAt invalido." }, { status: 400 });
    }

    const dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (body.dueAt && (!dueAt || Number.isNaN(dueAt.getTime()))) {
      return NextResponse.json({ error: "dueAt invalido." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("customer_payments")
      .insert({
        business_id: body.businessId,
        customer_id: body.customerId,
        appointment_id: body.appointmentId || null,
        amount_cents: Math.round(amount),
        currency: body.currency || "BRL",
        payment_method: body.paymentMethod,
        status,
        paid_at: paidAt.toISOString(),
        due_at: dueAt ? dueAt.toISOString() : null,
        payment_provider: body.paymentProvider?.trim() || null,
        payment_link: body.paymentLink?.trim() || null,
        external_reference: body.externalReference?.trim() || null,
        paid_online: Boolean(body.paidOnline),
        notes: body.notes?.trim() || null
      })
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Falha ao registrar pagamento." },
        { status: 500 }
      );
    }

    if (status === "paid") {
      const earnedPoints = pointsFromPayment(Math.round(amount));
      if (earnedPoints > 0 && data?.id) {
        const { data: currentLoyalty } = await supabase
          .from("customer_loyalty")
          .select("points_balance, lifetime_points, total_redeemed_points")
          .eq("customer_id", body.customerId)
          .eq("business_id", body.businessId)
          .maybeSingle();
        const nextBalance = Math.max(
          0,
          Number(currentLoyalty?.points_balance || 0) + earnedPoints
        );
        const nextLifetime = Math.max(
          0,
          Number(currentLoyalty?.lifetime_points || 0) + earnedPoints
        );
        const nextRedeemed = Math.max(
          0,
          Number(currentLoyalty?.total_redeemed_points || 0)
        );
        const nextLevel = levelFromLifetimePoints(nextLifetime);
        await supabase.from("customer_loyalty").upsert(
          {
            customer_id: body.customerId,
            business_id: body.businessId,
            points_balance: nextBalance,
            lifetime_points: nextLifetime,
            total_redeemed_points: nextRedeemed,
            level_code: nextLevel
          },
          { onConflict: "customer_id" }
        );
        await supabase.from("loyalty_points_ledger").insert({
          business_id: body.businessId,
          customer_id: body.customerId,
          payment_id: data.id,
          reason: "payment",
          points_delta: earnedPoints,
          metadata: { amountCents: Math.round(amount) }
        });
      }
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
