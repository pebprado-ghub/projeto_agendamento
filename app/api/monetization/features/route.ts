import { NextRequest, NextResponse } from "next/server";
import { ADMIN_PLAN_FEATURE_GROUPS, type AdminPlanFeatureId } from "@/lib/adminPlanFeatures";
import { resolvePlanFeatures } from "@/lib/planAccess";
import { SUBSCRIPTION_TIER_CATALOG, type SubscriptionTierCode } from "@/lib/subscriptionTiers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function asTierCode(raw: string): SubscriptionTierCode {
  if (raw === "pro" || raw === "enterprise") return raw;
  return "free";
}

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "Parametro businessId e obrigatorio." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { planCode, features } = await resolvePlanFeatures(supabase, businessId);
    const tierCode = asTierCode(planCode);
    const tier = SUBSCRIPTION_TIER_CATALOG[tierCode] ?? SUBSCRIPTION_TIER_CATALOG.free;

    const enabledCount = Object.values(features).filter(Boolean).length;
    const groups = ADMIN_PLAN_FEATURE_GROUPS.map((group) => ({
      id: group.id,
      title: group.title,
      items: group.items.map((item) => ({
        id: item.id,
        label: item.label,
        description: item.description,
        enabled: features[item.id] === true
      }))
    }));

    return NextResponse.json({
      data: {
        businessId,
        planCode,
        tier: {
          code: tier.code,
          commercialName: tier.commercialName,
          badge: tier.badge,
          tagline: tier.tagline
        },
        features,
        enabledCount,
        totalCount: Object.keys(features).length,
        groups
      }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export type ResolvedBusinessPlanFeatures = {
  planCode: string;
  features: Record<AdminPlanFeatureId, boolean>;
};
