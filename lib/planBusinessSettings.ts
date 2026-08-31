import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminPlanFeatureId } from "@/lib/adminPlanFeatures";
import { featureLabel } from "@/lib/subscriptionTiers";
import { resolvePlanFeatures } from "@/lib/planAccess";

export type BusinessAutomationSettings = {
  calendarMode: "internal" | "google";
  waitlistEnabled: boolean;
  reminder24hEnabled: boolean;
  reminder2hEnabled: boolean;
  reminder30mEnabled: boolean;
  attendanceConfirmationRequired: boolean;
  autoReleaseUnconfirmed: boolean;
  postVisitThankYouEnabled: boolean;
  postVisitCouponEnabled: boolean;
  remarketingEnabled: boolean;
  birthdayCampaignEnabled: boolean;
  autoReturnEnabled: boolean;
  oneClickRescheduleEnabled: boolean;
  checkinQrEnabled: boolean;
  autoFeedbackEnabled: boolean;
  googleReviewsEnabled: boolean;
  automationsEnabled: boolean;
  multiUnitEnabled: boolean;
};

export type BusinessAutomationInput = {
  calendarMode?: "internal" | "google";
  waitlistEnabled?: boolean;
  reminder24hEnabled?: boolean;
  reminder2hEnabled?: boolean;
  reminder30mEnabled?: boolean;
  attendanceConfirmationRequired?: boolean;
  autoReleaseUnconfirmed?: boolean;
  postVisitThankYouEnabled?: boolean;
  postVisitCouponEnabled?: boolean;
  remarketingEnabled?: boolean;
  birthdayCampaignEnabled?: boolean;
  autoReturnEnabled?: boolean;
  oneClickRescheduleEnabled?: boolean;
  checkinQrEnabled?: boolean;
  autoFeedbackEnabled?: boolean;
  googleReviewsEnabled?: boolean;
  automationsEnabled?: boolean;
  multiUnitEnabled?: boolean;
};

type FeatureRule = {
  feature: AdminPlanFeatureId;
  isActive: (settings: BusinessAutomationSettings) => boolean;
  bodyRequestsEnable: (body: BusinessAutomationInput) => boolean;
};

const AUTOMATION_FEATURE_RULES: FeatureRule[] = [
  {
    feature: "google_calendar",
    isActive: (s) => s.calendarMode === "google",
    bodyRequestsEnable: (b) => b.calendarMode === "google"
  },
  {
    feature: "waitlist",
    isActive: (s) => s.waitlistEnabled,
    bodyRequestsEnable: (b) => b.waitlistEnabled === true
  },
  {
    feature: "reminders",
    isActive: (s) => s.reminder24hEnabled || s.reminder2hEnabled || s.reminder30mEnabled,
    bodyRequestsEnable: (b) =>
      b.reminder24hEnabled === true || b.reminder2hEnabled === true || b.reminder30mEnabled === true
  },
  {
    feature: "attendance_confirmation",
    isActive: (s) => s.attendanceConfirmationRequired || s.autoReleaseUnconfirmed,
    bodyRequestsEnable: (b) =>
      b.attendanceConfirmationRequired === true || b.autoReleaseUnconfirmed === true
  },
  {
    feature: "post_visit_feedback",
    isActive: (s) =>
      s.postVisitThankYouEnabled || s.postVisitCouponEnabled || s.autoFeedbackEnabled,
    bodyRequestsEnable: (b) =>
      b.postVisitThankYouEnabled === true ||
      b.postVisitCouponEnabled === true ||
      b.autoFeedbackEnabled === true
  },
  {
    feature: "remarketing_campaigns",
    isActive: (s) => s.remarketingEnabled,
    bodyRequestsEnable: (b) => b.remarketingEnabled === true
  },
  {
    feature: "birthday_campaign",
    isActive: (s) => s.birthdayCampaignEnabled,
    bodyRequestsEnable: (b) => b.birthdayCampaignEnabled === true
  },
  {
    feature: "auto_return",
    isActive: (s) => s.autoReturnEnabled,
    bodyRequestsEnable: (b) => b.autoReturnEnabled === true
  },
  {
    feature: "one_click_reschedule",
    isActive: (s) => s.oneClickRescheduleEnabled,
    bodyRequestsEnable: (b) => b.oneClickRescheduleEnabled === true
  },
  {
    feature: "checkin_qr",
    isActive: (s) => s.checkinQrEnabled,
    bodyRequestsEnable: (b) => b.checkinQrEnabled === true
  },
  {
    feature: "google_reviews",
    isActive: (s) => s.googleReviewsEnabled,
    bodyRequestsEnable: (b) => b.googleReviewsEnabled === true
  },
  {
    feature: "automations_n8n",
    isActive: (s) => s.automationsEnabled,
    bodyRequestsEnable: (b) => b.automationsEnabled === true
  },
  {
    feature: "multi_unit",
    isActive: (s) => s.multiUnitEnabled,
    bodyRequestsEnable: (b) => b.multiUnitEnabled === true
  }
];

function clampFlag(enabled: boolean, feature: AdminPlanFeatureId, features: Record<AdminPlanFeatureId, boolean>) {
  if (!enabled) return false;
  return features[feature] === true;
}

export function clampBusinessAutomationSettings(
  settings: BusinessAutomationSettings,
  features: Record<AdminPlanFeatureId, boolean>
): BusinessAutomationSettings {
  const calendarMode =
    settings.calendarMode === "google" && features.google_calendar
      ? "google"
      : "internal";

  return {
    calendarMode,
    waitlistEnabled: clampFlag(settings.waitlistEnabled, "waitlist", features),
    reminder24hEnabled: clampFlag(settings.reminder24hEnabled, "reminders", features),
    reminder2hEnabled: clampFlag(settings.reminder2hEnabled, "reminders", features),
    reminder30mEnabled: clampFlag(settings.reminder30mEnabled, "reminders", features),
    attendanceConfirmationRequired: clampFlag(
      settings.attendanceConfirmationRequired,
      "attendance_confirmation",
      features
    ),
    autoReleaseUnconfirmed: clampFlag(
      settings.autoReleaseUnconfirmed,
      "attendance_confirmation",
      features
    ),
    postVisitThankYouEnabled: clampFlag(
      settings.postVisitThankYouEnabled,
      "post_visit_feedback",
      features
    ),
    postVisitCouponEnabled: clampFlag(
      settings.postVisitCouponEnabled,
      "post_visit_feedback",
      features
    ),
    remarketingEnabled: clampFlag(settings.remarketingEnabled, "remarketing_campaigns", features),
    birthdayCampaignEnabled: clampFlag(
      settings.birthdayCampaignEnabled,
      "birthday_campaign",
      features
    ),
    autoReturnEnabled: clampFlag(settings.autoReturnEnabled, "auto_return", features),
    oneClickRescheduleEnabled: clampFlag(
      settings.oneClickRescheduleEnabled,
      "one_click_reschedule",
      features
    ),
    checkinQrEnabled: clampFlag(settings.checkinQrEnabled, "checkin_qr", features),
    autoFeedbackEnabled: clampFlag(settings.autoFeedbackEnabled, "post_visit_feedback", features),
    googleReviewsEnabled: clampFlag(settings.googleReviewsEnabled, "google_reviews", features),
    automationsEnabled: clampFlag(settings.automationsEnabled, "automations_n8n", features),
    multiUnitEnabled: clampFlag(settings.multiUnitEnabled, "multi_unit", features)
  };
}

export function findUnauthorizedAutomationEnables(
  features: Record<AdminPlanFeatureId, boolean>,
  body: BusinessAutomationInput
): AdminPlanFeatureId[] {
  const blocked = new Set<AdminPlanFeatureId>();
  for (const rule of AUTOMATION_FEATURE_RULES) {
    if (features[rule.feature] === true) continue;
    if (rule.bodyRequestsEnable(body)) {
      blocked.add(rule.feature);
    }
  }
  return [...blocked];
}

export function planFeatureRequiredResponse(feature: AdminPlanFeatureId) {
  return NextResponse.json(
    {
      error: `Recurso "${featureLabel(feature)}" nao esta incluido no plano atual.`,
      code: "PLAN_FEATURE_REQUIRED",
      feature
    },
    { status: 403 }
  );
}

export async function enforceBusinessAutomationPlan(
  supabase: SupabaseClient,
  businessId: string,
  body: BusinessAutomationInput,
  settings: BusinessAutomationSettings
): Promise<
  | { ok: true; settings: BusinessAutomationSettings }
  | { ok: false; response: NextResponse }
> {
  const { features } = await resolvePlanFeatures(supabase, businessId);
  const violations = findUnauthorizedAutomationEnables(features, body);
  if (violations.length > 0) {
    return { ok: false, response: planFeatureRequiredResponse(violations[0]) };
  }
  return {
    ok: true,
    settings: clampBusinessAutomationSettings(settings, features)
  };
}

export async function enforceServiceAutomationPatch(
  supabase: SupabaseClient,
  businessId: string,
  body: BusinessAutomationInput
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { features } = await resolvePlanFeatures(supabase, businessId);

  for (const rule of AUTOMATION_FEATURE_RULES) {
    if (features[rule.feature] === true) continue;
    if (rule.bodyRequestsEnable(body)) {
      return { ok: false, response: planFeatureRequiredResponse(rule.feature) };
    }
  }

  return { ok: true };
}
