import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type UpdateBusinessInput = {
  name: string;
  timezone: string;
  calendarMode?: "internal" | "google";
  cnpj?: string;
  legalName?: string;
  tradeName?: string;
  addressLine?: string;
  addressNumber?: string;
  addressComplement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  whatsappNumber?: string;
  bookingBufferBeforeMinutes?: number;
  bookingBufferAfterMinutes?: number;
  bookingMinNoticeMinutes?: number;
  bookingMaxDaysAhead?: number;
  bookingDailyLimit?: number | null;
  bookingRescheduleCutoffMinutes?: number;
  bookingCancelCutoffMinutes?: number;
  bookingSlotCapacity?: number;
  waitlistEnabled?: boolean;
  reminder24hEnabled?: boolean;
  reminder2hEnabled?: boolean;
  reminder30mEnabled?: boolean;
  attendanceConfirmationRequired?: boolean;
  attendanceConfirmationDeadlineMinutes?: number;
  autoReleaseUnconfirmed?: boolean;
  postVisitThankYouEnabled?: boolean;
  postVisitCouponEnabled?: boolean;
  remarketingEnabled?: boolean;
  remarketingInactiveDays?: number;
  birthdayCampaignEnabled?: boolean;
  autoReturnEnabled?: boolean;
  autoReturnDays?: number;
  oneClickRescheduleEnabled?: boolean;
  checkinQrEnabled?: boolean;
  autoFeedbackEnabled?: boolean;
  googleReviewsEnabled?: boolean;
  googleReviewsUrl?: string;
  subscriptionPlanCode?: "free" | "pro" | "enterprise";
  subscriptionStatus?: "active" | "trialing" | "past_due" | "cancelled";
  monthlyAppointmentLimit?: number | null;
  professionalLimit?: number | null;
  automationsEnabled?: boolean;
  multiUnitEnabled?: boolean;
  billingPeriodStart?: string | null;
  billingPeriodEnd?: string | null;
  cnaeCode?: string;
  cnaeDescription?: string;
};

type Params = {
  params: {
    businessId: string;
  };
};

function normalizeDigits(value?: string) {
  return (value || "").replace(/\D/g, "");
}

function isValidEmail(value?: string) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function triggerOnboardingWebhook(payload: Record<string, unknown>) {
  const url = process.env.N8N_ONBOARDING_WEBHOOK_URL;
  if (!url) return;
  const secret = process.env.N8N_ONBOARDING_SECRET || "";
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "x-onboarding-secret": secret } : {})
      },
      body: JSON.stringify(payload)
    });
  } catch {
    // Nao bloqueia operacao principal.
  }
}

const BUSINESS_SELECT =
  "id, name, slug, timezone, calendar_mode, whatsapp_number, cnpj, legal_name, trade_name, cnae_code, cnae_description, address_line, address_number, address_complement, neighborhood, city, state, postal_code, contact_name, contact_phone, contact_email, booking_buffer_before_minutes, booking_buffer_after_minutes, booking_min_notice_minutes, booking_max_days_ahead, booking_daily_limit, booking_reschedule_cutoff_minutes, booking_cancel_cutoff_minutes, booking_slot_capacity, waitlist_enabled, reminder_24h_enabled, reminder_2h_enabled, reminder_30m_enabled, attendance_confirmation_required, attendance_confirmation_deadline_minutes, auto_release_unconfirmed, post_visit_thank_you_enabled, post_visit_coupon_enabled, remarketing_enabled, remarketing_inactive_days, birthday_campaign_enabled, auto_return_enabled, auto_return_days, one_click_reschedule_enabled, checkin_qr_enabled, auto_feedback_enabled, google_reviews_enabled, google_reviews_url, subscription_plan_code, subscription_status, monthly_appointment_limit, professional_limit, automations_enabled, multi_unit_enabled, billing_period_start, billing_period_end, created_at";

function resolvePlanDefaults(planCode: "free" | "pro" | "enterprise") {
  if (planCode === "pro") {
    return {
      monthlyAppointmentLimit: null,
      professionalLimit: null,
      automationsEnabled: true,
      multiUnitEnabled: false
    };
  }
  if (planCode === "enterprise") {
    return {
      monthlyAppointmentLimit: null,
      professionalLimit: null,
      automationsEnabled: true,
      multiUnitEnabled: true
    };
  }
  return {
    monthlyAppointmentLimit: 50,
    professionalLimit: 1,
    automationsEnabled: false,
    multiUnitEnabled: false
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const businessId = params.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "businessId e obrigatorio." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("businesses")
      .select(BUSINESS_SELECT)
      .eq("id", businessId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Falha ao carregar negocio." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Negocio nao encontrado." }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const businessId = params.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "businessId e obrigatorio." }, { status: 400 });
    }

    const body = (await request.json()) as UpdateBusinessInput;
    const name = body.name?.trim() || "";
    if (!name) {
      return NextResponse.json({ error: "Nome do negocio e obrigatorio." }, { status: 400 });
    }

    const cnpjDigits = normalizeDigits(body.cnpj);
    if (cnpjDigits && cnpjDigits.length !== 14) {
      return NextResponse.json({ error: "CNPJ deve ter 14 digitos." }, { status: 400 });
    }

    const cepDigits = normalizeDigits(body.postalCode);
    if (cepDigits && cepDigits.length !== 8) {
      return NextResponse.json({ error: "CEP deve ter 8 digitos." }, { status: 400 });
    }

    const phoneDigits = normalizeDigits(body.contactPhone);
    if (phoneDigits && phoneDigits.length < 12) {
      return NextResponse.json({ error: "Telefone de contato invalido." }, { status: 400 });
    }

  const whatsappDigits = normalizeDigits(body.whatsappNumber);
  if (whatsappDigits && whatsappDigits.length < 12) {
    return NextResponse.json(
      { error: "WhatsApp invalido. Use DDI + DDD + numero." },
      { status: 400 }
    );
  }

    const contactEmail = body.contactEmail?.trim() || "";
    if (!isValidEmail(contactEmail)) {
      return NextResponse.json({ error: "E-mail de contato invalido." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: currentBusiness } = await supabase
      .from("businesses")
      .select(
        "subscription_plan_code, subscription_status, monthly_appointment_limit, professional_limit, automations_enabled, multi_unit_enabled, billing_period_start, billing_period_end"
      )
      .eq("id", businessId)
      .maybeSingle();

    const calendarMode = body.calendarMode === "google" ? "google" : "internal";
    const bookingBufferBeforeMinutes = Math.max(
      0,
      Number(body.bookingBufferBeforeMinutes ?? 0)
    );
    const bookingBufferAfterMinutes = Math.max(
      0,
      Number(body.bookingBufferAfterMinutes ?? 0)
    );
    const bookingMinNoticeMinutes = Math.max(
      0,
      Number(body.bookingMinNoticeMinutes ?? 0)
    );
    const bookingMaxDaysAhead = Math.max(1, Number(body.bookingMaxDaysAhead ?? 60));
    const bookingDailyLimitRaw = Number(body.bookingDailyLimit ?? 0);
    const bookingDailyLimit =
      Number.isFinite(bookingDailyLimitRaw) && bookingDailyLimitRaw > 0
        ? Math.floor(bookingDailyLimitRaw)
        : null;
    const bookingRescheduleCutoffMinutes = Math.max(
      0,
      Number(body.bookingRescheduleCutoffMinutes ?? 0)
    );
    const bookingCancelCutoffMinutes = Math.max(
      0,
      Number(body.bookingCancelCutoffMinutes ?? 0)
    );
    const bookingSlotCapacity = Math.min(
      50,
      Math.max(1, Math.floor(Number(body.bookingSlotCapacity ?? 1)))
    );
    const waitlistEnabled = body.waitlistEnabled !== false;
    const reminder24hEnabled = body.reminder24hEnabled !== false;
    const reminder2hEnabled = body.reminder2hEnabled !== false;
    const reminder30mEnabled = body.reminder30mEnabled !== false;
    const attendanceConfirmationRequired = body.attendanceConfirmationRequired !== false;
    const attendanceConfirmationDeadlineMinutes = Math.min(
      10080,
      Math.max(60, Math.floor(Number(body.attendanceConfirmationDeadlineMinutes ?? 1440)))
    );
    const autoReleaseUnconfirmed = body.autoReleaseUnconfirmed !== false;
    const postVisitThankYouEnabled = body.postVisitThankYouEnabled !== false;
    const postVisitCouponEnabled = body.postVisitCouponEnabled !== false;
    const remarketingEnabled = body.remarketingEnabled !== false;
    const remarketingInactiveDays = Math.min(
      365,
      Math.max(7, Math.floor(Number(body.remarketingInactiveDays ?? 30)))
    );
    const birthdayCampaignEnabled = body.birthdayCampaignEnabled !== false;
    const autoReturnEnabled = body.autoReturnEnabled !== false;
    const autoReturnDays = Math.min(
      120,
      Math.max(7, Math.floor(Number(body.autoReturnDays ?? 30)))
    );
    const oneClickRescheduleEnabled = body.oneClickRescheduleEnabled !== false;
    const checkinQrEnabled = body.checkinQrEnabled !== false;
    const autoFeedbackEnabled = body.autoFeedbackEnabled === true;
    const googleReviewsEnabled = body.googleReviewsEnabled === true;
    const googleReviewsUrl = body.googleReviewsUrl?.trim() || null;
    const subscriptionPlanCode =
      body.subscriptionPlanCode ||
      (currentBusiness?.subscription_plan_code as "free" | "pro" | "enterprise" | undefined) ||
      "free";
    const subscriptionStatus =
      body.subscriptionStatus ||
      (currentBusiness?.subscription_status as
        | "active"
        | "trialing"
        | "past_due"
        | "cancelled"
        | undefined) ||
      "active";
    const planDefaults = resolvePlanDefaults(subscriptionPlanCode);
    const monthlyAppointmentLimit =
      body.monthlyAppointmentLimit == null
        ? currentBusiness?.monthly_appointment_limit ?? planDefaults.monthlyAppointmentLimit
        : Math.max(1, Math.floor(Number(body.monthlyAppointmentLimit)));
    const professionalLimit =
      body.professionalLimit == null
        ? currentBusiness?.professional_limit ?? planDefaults.professionalLimit
        : Math.max(1, Math.floor(Number(body.professionalLimit)));
    const automationsEnabled =
      typeof body.automationsEnabled === "boolean"
        ? body.automationsEnabled
        : currentBusiness?.automations_enabled ?? planDefaults.automationsEnabled;
    const multiUnitEnabled =
      typeof body.multiUnitEnabled === "boolean"
        ? body.multiUnitEnabled
        : currentBusiness?.multi_unit_enabled ?? planDefaults.multiUnitEnabled;
    const billingPeriodStart = body.billingPeriodStart ?? currentBusiness?.billing_period_start ?? null;
    const billingPeriodEnd = body.billingPeriodEnd ?? currentBusiness?.billing_period_end ?? null;
    const { data, error } = await supabase
      .from("businesses")
      .update({
        name,
        timezone: body.timezone?.trim() || "America/Sao_Paulo",
        calendar_mode: calendarMode,
        cnpj: cnpjDigits || null,
        legal_name: body.legalName?.trim() || null,
        trade_name: body.tradeName?.trim() || null,
        address_line: body.addressLine?.trim() || null,
        address_number: body.addressNumber?.trim() || null,
        address_complement: body.addressComplement?.trim() || null,
        neighborhood: body.neighborhood?.trim() || null,
        city: body.city?.trim() || null,
        state: body.state?.trim() || null,
        postal_code: cepDigits || null,
        contact_name: body.contactName?.trim() || null,
        contact_phone: phoneDigits || null,
        contact_email: contactEmail || null,
        cnae_code: body.cnaeCode?.trim() || null,
        cnae_description: body.cnaeDescription?.trim() || null,
        whatsapp_number: whatsappDigits || null,
        booking_buffer_before_minutes: bookingBufferBeforeMinutes,
        booking_buffer_after_minutes: bookingBufferAfterMinutes,
        booking_min_notice_minutes: bookingMinNoticeMinutes,
        booking_max_days_ahead: bookingMaxDaysAhead,
        booking_daily_limit: bookingDailyLimit,
        booking_reschedule_cutoff_minutes: bookingRescheduleCutoffMinutes,
        booking_cancel_cutoff_minutes: bookingCancelCutoffMinutes,
        booking_slot_capacity: bookingSlotCapacity,
        waitlist_enabled: waitlistEnabled,
        reminder_24h_enabled: reminder24hEnabled,
        reminder_2h_enabled: reminder2hEnabled,
        reminder_30m_enabled: reminder30mEnabled,
        attendance_confirmation_required: attendanceConfirmationRequired,
        attendance_confirmation_deadline_minutes: attendanceConfirmationDeadlineMinutes,
        auto_release_unconfirmed: autoReleaseUnconfirmed,
        post_visit_thank_you_enabled: postVisitThankYouEnabled,
        post_visit_coupon_enabled: postVisitCouponEnabled,
        remarketing_enabled: remarketingEnabled,
        remarketing_inactive_days: remarketingInactiveDays,
        birthday_campaign_enabled: birthdayCampaignEnabled,
        auto_return_enabled: autoReturnEnabled,
        auto_return_days: autoReturnDays,
        one_click_reschedule_enabled: oneClickRescheduleEnabled,
        checkin_qr_enabled: checkinQrEnabled,
        auto_feedback_enabled: autoFeedbackEnabled,
        google_reviews_enabled: googleReviewsEnabled,
        google_reviews_url: googleReviewsUrl,
        subscription_plan_code: subscriptionPlanCode,
        subscription_status: subscriptionStatus,
        monthly_appointment_limit: monthlyAppointmentLimit,
        professional_limit: professionalLimit,
        automations_enabled: automationsEnabled,
        multi_unit_enabled: multiUnitEnabled,
        billing_period_start: billingPeriodStart,
        billing_period_end: billingPeriodEnd
      })
      .eq("id", businessId)
      .select(BUSINESS_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ error: "Falha ao atualizar cadastro." }, { status: 500 });
    }

    await triggerOnboardingWebhook({
      event: "business_updated",
      business: data
    });

    return NextResponse.json({ message: "Cadastro atualizado com sucesso.", business: data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
