import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type AdminPlanFeatureId,
  emptyFeatureMap,
  tierFeaturePreset
} from "@/lib/adminPlanFeatures";

export type PlanAccessOk = { ok: true };
export type PlanAccessDenied = { ok: false; response: NextResponse };
export type PlanAccessResult = PlanAccessOk | PlanAccessDenied;

type PlanRow = {
  code?: string;
  feature_flags?: Record<string, boolean> | null;
  allows_automations?: boolean | null;
  allows_multi_unit?: boolean | null;
};

function asPresetCode(raw: string | null | undefined): "free" | "pro" | "enterprise" {
  if (raw === "pro" || raw === "enterprise") return raw;
  return "free";
}

function mergeFeatureFlags(
  presetCode: "free" | "pro" | "enterprise",
  flags: Record<string, unknown> | null | undefined,
  extras?: { allowsAutomations?: boolean; allowsMultiUnit?: boolean }
): Record<AdminPlanFeatureId, boolean> {
  const hasStoredFlags =
    flags != null && typeof flags === "object" && Object.keys(flags).length > 0;
  const map = hasStoredFlags ? emptyFeatureMap() : { ...tierFeaturePreset(presetCode) };

  if (flags && typeof flags === "object") {
    for (const key of Object.keys(map) as AdminPlanFeatureId[]) {
      if (typeof flags[key] === "boolean") {
        map[key] = flags[key];
      }
    }
  }
  if (extras?.allowsAutomations) map.automations_n8n = true;
  if (extras?.allowsMultiUnit) map.multi_unit = true;
  return map;
}

export async function resolvePlanFeatures(
  supabase: SupabaseClient,
  businessId: string
): Promise<{
  planCode: string;
  features: Record<AdminPlanFeatureId, boolean>;
}> {
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("subscription_plan_code")
    .eq("id", businessId)
    .maybeSingle();

  if (businessError || !business) {
    return { planCode: "free", features: emptyFeatureMap() };
  }

  const rawCode = String(business.subscription_plan_code || "free");
  const presetCode = asPresetCode(rawCode);

  let planResult = await supabase
    .from("subscription_plans")
    .select("code, feature_flags, allows_automations, allows_multi_unit")
    .eq("code", rawCode)
    .maybeSingle();

  if (planResult.error && /feature_flags/i.test(String(planResult.error.message || ""))) {
    planResult = await supabase
      .from("subscription_plans")
      .select("code, allows_automations, allows_multi_unit")
      .eq("code", rawCode)
      .maybeSingle();
  }

  const plan = (planResult.data || null) as PlanRow | null;

  return {
    planCode: rawCode,
    features: mergeFeatureFlags(presetCode, plan?.feature_flags, {
      allowsAutomations: plan?.allows_automations === true,
      allowsMultiUnit: plan?.allows_multi_unit === true
    })
  };
}

export async function hasPlanFeature(
  supabase: SupabaseClient,
  businessId: string,
  feature: AdminPlanFeatureId
): Promise<boolean> {
  const { features } = await resolvePlanFeatures(supabase, businessId);
  return features[feature] === true;
}

export async function assertPlanFeature(
  supabase: SupabaseClient,
  businessId: string,
  feature: AdminPlanFeatureId
): Promise<PlanAccessResult> {
  const allowed = await hasPlanFeature(supabase, businessId, feature);
  if (allowed) return { ok: true };
  return {
    ok: false,
    response: NextResponse.json(
      {
        error: "Esta funcionalidade nao esta incluida no plano atual.",
        code: "PLAN_FEATURE_REQUIRED",
        feature
      },
      { status: 403 }
    )
  };
}
