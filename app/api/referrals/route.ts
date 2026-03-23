import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ReferralBody = {
  businessId: string;
  referrerCustomerId: string;
  referredCustomerId: string;
  referralCode?: string;
  markAsConverted?: boolean;
};

function defaultReferralCode(referrerCustomerId: string) {
  return `INDICA-${referrerCustomerId.slice(0, 8).toUpperCase()}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReferralBody;
    if (!body.businessId || !body.referrerCustomerId || !body.referredCustomerId) {
      return NextResponse.json(
        {
          error:
            "businessId, referrerCustomerId e referredCustomerId sao obrigatorios."
        },
        { status: 400 }
      );
    }
    if (body.referrerCustomerId === body.referredCustomerId) {
      return NextResponse.json(
        { error: "Cliente nao pode indicar a si mesmo." },
        { status: 400 }
      );
    }
    const supabase = getSupabaseAdmin();
    const status = body.markAsConverted ? "rewarded" : "registered";
    const convertedAt = body.markAsConverted ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from("customer_referrals")
      .upsert(
        {
          business_id: body.businessId,
          referrer_customer_id: body.referrerCustomerId,
          referred_customer_id: body.referredCustomerId,
          referral_code:
            body.referralCode?.trim() || defaultReferralCode(body.referrerCustomerId),
          status,
          reward_referrer_cents: 2000,
          reward_referred_cents: 2000,
          converted_at: convertedAt
        },
        { onConflict: "business_id,referrer_customer_id,referred_customer_id" }
      )
      .select(
        "id, business_id, referrer_customer_id, referred_customer_id, referral_code, status, reward_referrer_cents, reward_referred_cents, converted_at, created_at"
      )
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Falha ao registrar indicacao." }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
