import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CampaignEventBody = {
  businessId: string;
  customerId?: string | null;
  campaignCode: string;
  campaignType: "remarketing" | "new_customer" | "birthday" | "other";
  channel?: string;
  eventType: "sent" | "opened" | "clicked" | "replied" | "converted";
  happenedAt?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CampaignEventBody;
    if (!body.businessId || !body.campaignCode || !body.campaignType || !body.eventType) {
      return NextResponse.json(
        { error: "businessId, campaignCode, campaignType e eventType sao obrigatorios." },
        { status: 400 }
      );
    }

    const happenedAt = body.happenedAt ? new Date(body.happenedAt) : new Date();
    if (Number.isNaN(happenedAt.getTime())) {
      return NextResponse.json({ error: "happenedAt invalido." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("campaign_events")
      .insert({
        business_id: body.businessId,
        customer_id: body.customerId || null,
        campaign_code: body.campaignCode.trim(),
        campaign_type: body.campaignType,
        channel: body.channel?.trim() || "whatsapp",
        event_type: body.eventType,
        happened_at: happenedAt.toISOString(),
        metadata: body.metadata || {}
      })
      .select(
        "id, business_id, customer_id, campaign_code, campaign_type, channel, event_type, happened_at, metadata"
      )
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Falha ao registrar evento de campanha." }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
