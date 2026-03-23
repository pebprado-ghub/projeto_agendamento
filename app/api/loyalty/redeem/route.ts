import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { discountCentsFromPoints, levelFromLifetimePoints } from "@/lib/loyalty";

type RedeemBody = {
  businessId: string;
  customerId: string;
  points: number;
  notes?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RedeemBody;
    if (!body.businessId || !body.customerId) {
      return NextResponse.json(
        { error: "businessId e customerId sao obrigatorios." },
        { status: 400 }
      );
    }
    const points = Math.max(0, Math.floor(Number(body.points) || 0));
    if (points < 100) {
      return NextResponse.json(
        { error: "Resgate minimo de 100 pontos." },
        { status: 400 }
      );
    }
    const normalizedPoints = Math.floor(points / 100) * 100;
    const supabase = getSupabaseAdmin();
    const { data: loyalty } = await supabase
      .from("customer_loyalty")
      .select("points_balance, lifetime_points, total_redeemed_points")
      .eq("business_id", body.businessId)
      .eq("customer_id", body.customerId)
      .maybeSingle();
    const balance = Number(loyalty?.points_balance || 0);
    if (balance < normalizedPoints) {
      return NextResponse.json({ error: "Saldo de pontos insuficiente." }, { status: 409 });
    }
    const lifetime = Number(loyalty?.lifetime_points || 0);
    const redeemedTotal = Number(loyalty?.total_redeemed_points || 0);
    const nextBalance = balance - normalizedPoints;
    await supabase.from("customer_loyalty").upsert(
      {
        customer_id: body.customerId,
        business_id: body.businessId,
        points_balance: nextBalance,
        lifetime_points: lifetime,
        total_redeemed_points: redeemedTotal + normalizedPoints,
        level_code: levelFromLifetimePoints(lifetime)
      },
      { onConflict: "customer_id" }
    );
    await supabase.from("loyalty_points_ledger").insert({
      business_id: body.businessId,
      customer_id: body.customerId,
      reason: "redeem_discount",
      points_delta: -normalizedPoints,
      metadata: {
        discountCents: discountCentsFromPoints(normalizedPoints),
        notes: body.notes?.trim() || null
      }
    });
    return NextResponse.json({
      data: {
        redeemedPoints: normalizedPoints,
        discountCents: discountCentsFromPoints(normalizedPoints),
        remainingPoints: nextBalance
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
