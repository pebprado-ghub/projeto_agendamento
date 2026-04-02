import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CreateBusinessInput = {
  name: string;
  businessType: string;
  timezone: string;
  greetingTemplate: string;
  confirmationTemplate: string;
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

type SanitizedBusinessInput = {
  name: string;
  timezone: string;
  calendarMode: "internal" | "google";
  cnpj: string | null;
  legalName: string | null;
  tradeName: string | null;
  addressLine: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  whatsappNumber: string | null;
  bookingBufferBeforeMinutes: number;
  bookingBufferAfterMinutes: number;
  bookingMinNoticeMinutes: number;
  bookingMaxDaysAhead: number;
  bookingDailyLimit: number | null;
  bookingRescheduleCutoffMinutes: number;
  bookingCancelCutoffMinutes: number;
  bookingSlotCapacity: number;
  waitlistEnabled: boolean;
  reminder24hEnabled: boolean;
  reminder2hEnabled: boolean;
  reminder30mEnabled: boolean;
  attendanceConfirmationRequired: boolean;
  attendanceConfirmationDeadlineMinutes: number;
  autoReleaseUnconfirmed: boolean;
  postVisitThankYouEnabled: boolean;
  postVisitCouponEnabled: boolean;
  remarketingEnabled: boolean;
  remarketingInactiveDays: number;
  birthdayCampaignEnabled: boolean;
  autoReturnEnabled: boolean;
  autoReturnDays: number;
  oneClickRescheduleEnabled: boolean;
  checkinQrEnabled: boolean;
  autoFeedbackEnabled: boolean;
  googleReviewsEnabled: boolean;
  googleReviewsUrl: string | null;
  subscriptionPlanCode: "free" | "pro" | "enterprise";
  subscriptionStatus: "active" | "trialing" | "past_due" | "cancelled";
  monthlyAppointmentLimit: number | null;
  professionalLimit: number | null;
  automationsEnabled: boolean;
  multiUnitEnabled: boolean;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  cnaeCode: string | null;
  cnaeDescription: string | null;
};

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function inferTimezoneFromPhone(value?: string) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length < 4) return null;
  const ddi = digits.slice(0, 2);
  const ddd = digits.slice(2, 4);
  if (ddi !== "55") return null;

  const map: Record<string, string> = {
    "68": "America/Rio_Branco",
    "69": "America/Porto_Velho",
    "92": "America/Manaus",
    "97": "America/Manaus",
    "95": "America/Boa_Vista",
    "65": "America/Cuiaba",
    "66": "America/Cuiaba",
    "67": "America/Campo_Grande"
  };

  return map[ddd] || "America/Sao_Paulo";
}

function normalizeDigits(value?: string) {
  return (value || "").replace(/\D/g, "");
}

function isValidEmail(value?: string) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sanitizeAndValidate(body: CreateBusinessInput): {
  ok: true;
  data: SanitizedBusinessInput;
} | {
  ok: false;
  error: string;
} {
  const name = body.name?.trim() || "";
  if (!name) return { ok: false, error: "Nome da empresa e obrigatorio." };

  const cnpjDigits = normalizeDigits(body.cnpj);
  if (cnpjDigits && cnpjDigits.length !== 14) {
    return { ok: false, error: "CNPJ deve ter 14 digitos." };
  }

  const cepDigits = normalizeDigits(body.postalCode);
  if (cepDigits && cepDigits.length !== 8) {
    return { ok: false, error: "CEP deve ter 8 digitos." };
  }

  const phoneDigits = normalizeDigits(body.contactPhone);
  if (phoneDigits && phoneDigits.length < 12) {
    return { ok: false, error: "Telefone de contato invalido." };
  }

  const whatsappDigits = normalizeDigits(body.whatsappNumber);
  if (whatsappDigits && whatsappDigits.length < 12) {
    return { ok: false, error: "WhatsApp invalido. Use DDI + DDD + numero." };
  }

  const contactEmail = body.contactEmail?.trim() || "";
  if (!isValidEmail(contactEmail)) {
    return { ok: false, error: "E-mail de contato invalido." };
  }

  const inferredTimezone = inferTimezoneFromPhone(body.contactPhone);
  const timezone = inferredTimezone || body.timezone?.trim() || "America/Sao_Paulo";
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
  const autoReturnDays = Math.min(120, Math.max(7, Math.floor(Number(body.autoReturnDays ?? 30))));
  const oneClickRescheduleEnabled = body.oneClickRescheduleEnabled !== false;
  const checkinQrEnabled = body.checkinQrEnabled !== false;
  const autoFeedbackEnabled = body.autoFeedbackEnabled === true;
  const googleReviewsEnabled = body.googleReviewsEnabled === true;
  const googleReviewsUrl = body.googleReviewsUrl?.trim() || null;
  const subscriptionPlanCode = body.subscriptionPlanCode || "free";
  const subscriptionStatus = body.subscriptionStatus || "active";
  const planDefaults = resolvePlanDefaults(subscriptionPlanCode);
  const monthlyAppointmentLimit =
    body.monthlyAppointmentLimit == null
      ? planDefaults.monthlyAppointmentLimit
      : Math.max(1, Math.floor(Number(body.monthlyAppointmentLimit)));
  const professionalLimit =
    body.professionalLimit == null
      ? planDefaults.professionalLimit
      : Math.max(1, Math.floor(Number(body.professionalLimit)));
  const automationsEnabled =
    typeof body.automationsEnabled === "boolean"
      ? body.automationsEnabled
      : planDefaults.automationsEnabled;
  const multiUnitEnabled =
    typeof body.multiUnitEnabled === "boolean"
      ? body.multiUnitEnabled
      : planDefaults.multiUnitEnabled;
  const billingPeriodStart = body.billingPeriodStart || null;
  const billingPeriodEnd = body.billingPeriodEnd || null;

  return {
    ok: true,
    data: {
      name,
      timezone,
      calendarMode,
      cnpj: cnpjDigits || null,
      legalName: body.legalName?.trim() || null,
      tradeName: body.tradeName?.trim() || null,
      addressLine: body.addressLine?.trim() || null,
      addressNumber: body.addressNumber?.trim() || null,
      addressComplement: body.addressComplement?.trim() || null,
      neighborhood: body.neighborhood?.trim() || null,
      city: body.city?.trim() || null,
      state: body.state?.trim() || null,
      postalCode: cepDigits || null,
      contactName: body.contactName?.trim() || null,
      contactPhone: phoneDigits || null,
      contactEmail: contactEmail || null,
      whatsappNumber: whatsappDigits || null,
      bookingBufferBeforeMinutes,
      bookingBufferAfterMinutes,
      bookingMinNoticeMinutes,
      bookingMaxDaysAhead,
      bookingDailyLimit,
      bookingRescheduleCutoffMinutes,
      bookingCancelCutoffMinutes,
      bookingSlotCapacity,
      waitlistEnabled,
      reminder24hEnabled,
      reminder2hEnabled,
      reminder30mEnabled,
      attendanceConfirmationRequired,
      attendanceConfirmationDeadlineMinutes,
      autoReleaseUnconfirmed,
      postVisitThankYouEnabled,
      postVisitCouponEnabled,
      remarketingEnabled,
      remarketingInactiveDays,
      birthdayCampaignEnabled,
      autoReturnEnabled,
      autoReturnDays,
      oneClickRescheduleEnabled,
      checkinQrEnabled,
      autoFeedbackEnabled,
      googleReviewsEnabled,
      googleReviewsUrl,
      subscriptionPlanCode,
      subscriptionStatus,
      monthlyAppointmentLimit,
      professionalLimit,
      automationsEnabled,
      multiUnitEnabled,
      billingPeriodStart,
      billingPeriodEnd,
      cnaeCode: body.cnaeCode?.trim() || null,
      cnaeDescription: body.cnaeDescription?.trim() || null
    }
  };
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
    // Nao bloqueia o fluxo principal se o webhook falhar.
  }
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("businesses")
      // Usa `*` para evitar quebra quando o banco local estiver em migração parcial.
      .select("*")
      .order("name", { ascending: true })
      .limit(10_000);

    if (error) {
      return NextResponse.json(
        { error: `Falha ao listar empresas: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateBusinessInput;

    const parsed = sanitizeAndValidate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const sanitized = parsed.data;
    const baseSlug = slugify(body.name);
    const slug = `${baseSlug || "empresa"}-${Date.now().toString().slice(-6)}`;

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .insert({
        name: sanitized.name,
        slug,
        timezone: sanitized.timezone,
        calendar_mode: sanitized.calendarMode,
        cnpj: sanitized.cnpj,
        legal_name: sanitized.legalName,
        trade_name: sanitized.tradeName,
        address_line: sanitized.addressLine,
        address_number: sanitized.addressNumber,
        address_complement: sanitized.addressComplement,
        neighborhood: sanitized.neighborhood,
        city: sanitized.city,
        state: sanitized.state,
        postal_code: sanitized.postalCode,
        contact_name: sanitized.contactName,
        contact_phone: sanitized.contactPhone,
        contact_email: sanitized.contactEmail,
        cnae_code: sanitized.cnaeCode,
        cnae_description: sanitized.cnaeDescription,
        whatsapp_number: sanitized.whatsappNumber,
        booking_buffer_before_minutes: sanitized.bookingBufferBeforeMinutes,
        booking_buffer_after_minutes: sanitized.bookingBufferAfterMinutes,
        booking_min_notice_minutes: sanitized.bookingMinNoticeMinutes,
        booking_max_days_ahead: sanitized.bookingMaxDaysAhead,
        booking_daily_limit: sanitized.bookingDailyLimit,
        booking_reschedule_cutoff_minutes: sanitized.bookingRescheduleCutoffMinutes,
        booking_cancel_cutoff_minutes: sanitized.bookingCancelCutoffMinutes,
        booking_slot_capacity: sanitized.bookingSlotCapacity,
        waitlist_enabled: sanitized.waitlistEnabled,
        reminder_24h_enabled: sanitized.reminder24hEnabled,
        reminder_2h_enabled: sanitized.reminder2hEnabled,
        reminder_30m_enabled: sanitized.reminder30mEnabled,
        attendance_confirmation_required: sanitized.attendanceConfirmationRequired,
        attendance_confirmation_deadline_minutes:
          sanitized.attendanceConfirmationDeadlineMinutes,
        auto_release_unconfirmed: sanitized.autoReleaseUnconfirmed,
        post_visit_thank_you_enabled: sanitized.postVisitThankYouEnabled,
        post_visit_coupon_enabled: sanitized.postVisitCouponEnabled,
        remarketing_enabled: sanitized.remarketingEnabled,
        remarketing_inactive_days: sanitized.remarketingInactiveDays,
        birthday_campaign_enabled: sanitized.birthdayCampaignEnabled
        ,
        auto_return_enabled: sanitized.autoReturnEnabled,
        auto_return_days: sanitized.autoReturnDays,
        one_click_reschedule_enabled: sanitized.oneClickRescheduleEnabled,
        checkin_qr_enabled: sanitized.checkinQrEnabled,
        auto_feedback_enabled: sanitized.autoFeedbackEnabled,
        google_reviews_enabled: sanitized.googleReviewsEnabled,
        google_reviews_url: sanitized.googleReviewsUrl,
        subscription_plan_code: sanitized.subscriptionPlanCode,
        subscription_status: sanitized.subscriptionStatus,
        monthly_appointment_limit: sanitized.monthlyAppointmentLimit,
        professional_limit: sanitized.professionalLimit,
        automations_enabled: sanitized.automationsEnabled,
        multi_unit_enabled: sanitized.multiUnitEnabled,
        billing_period_start: sanitized.billingPeriodStart,
        billing_period_end: sanitized.billingPeriodEnd
      })
      .select(
        "id, name, slug, timezone, calendar_mode, whatsapp_number, cnpj, legal_name, trade_name, cnae_code, cnae_description, contact_name, contact_phone, contact_email, city, state, booking_buffer_before_minutes, booking_buffer_after_minutes, booking_min_notice_minutes, booking_max_days_ahead, booking_daily_limit, booking_reschedule_cutoff_minutes, booking_cancel_cutoff_minutes, booking_slot_capacity, waitlist_enabled, reminder_24h_enabled, reminder_2h_enabled, reminder_30m_enabled, attendance_confirmation_required, attendance_confirmation_deadline_minutes, auto_release_unconfirmed, post_visit_thank_you_enabled, post_visit_coupon_enabled, remarketing_enabled, remarketing_inactive_days, birthday_campaign_enabled, auto_return_enabled, auto_return_days, one_click_reschedule_enabled, checkin_qr_enabled, auto_feedback_enabled, google_reviews_enabled, google_reviews_url, subscription_plan_code, subscription_status, monthly_appointment_limit, professional_limit, automations_enabled, multi_unit_enabled, billing_period_start, billing_period_end"
      )
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: "Nao foi possivel criar a empresa." },
        { status: 500 }
      );
    }

    const templates = [
      {
        business_id: business.id,
        code: "GREETING",
        content:
          body.greetingTemplate?.trim() ||
          "Ola! Digite 1 para agendar, 2 para reagendar, 3 para cancelar."
      },
      {
        business_id: business.id,
        code: "APPOINTMENT_CONFIRMATION",
        content:
          body.confirmationTemplate?.trim() ||
          "Seu agendamento foi confirmado com sucesso."
      },
      {
        business_id: business.id,
        code: "APPOINTMENT_CANCELLED",
        content:
          "Ola, {{cliente}}. Seu agendamento foi cancelado. Se desejar, responda esta mensagem para reagendar."
      },
      {
        business_id: business.id,
        code: "APPOINTMENT_SHIFT_EARLIER_SHORT",
        content:
          "Ola, {{cliente}}. Seu horario foi adiantado em {{minutos}} minutos. Novo horario: {{data}} {{inicio}} ate {{fim}}."
      },
      {
        business_id: business.id,
        code: "APPOINTMENT_SHIFT_EARLIER_LONG",
        content:
          "Ola, {{cliente}}. Precisamos adiantar seu atendimento em {{minutos}} minutos por ajuste operacional. Novo horario: {{data}} {{inicio}} ate {{fim}}."
      },
      {
        business_id: business.id,
        code: "APPOINTMENT_SHIFT_LATER_SHORT",
        content:
          "Ola, {{cliente}}. Seu horario foi atrasado em {{minutos}} minutos. Novo horario: {{data}} {{inicio}} ate {{fim}}."
      },
      {
        business_id: business.id,
        code: "APPOINTMENT_SHIFT_LATER_LONG",
        content:
          "Ola, {{cliente}}. Precisamos atrasar seu atendimento em {{minutos}} minutos por ajuste operacional. Novo horario: {{data}} {{inicio}} ate {{fim}}."
      },
      {
        business_id: business.id,
        code: "APPOINTMENT_SHIFT_THRESHOLD_MINUTES",
        content: "15"
      },
      {
        business_id: business.id,
        code: "WA_SERVICE_MENU_PROMPT",
        content: "Escolha um servico:"
      },
      {
        business_id: business.id,
        code: "WA_SLOT_MENU_PROMPT",
        content: "Horarios disponiveis. Escolha um horario:"
      },
      {
        business_id: business.id,
        code: "WA_SERVICE_OPTION_TITLE_TEMPLATE",
        content: "{{servico}}"
      },
      {
        business_id: business.id,
        code: "WA_SLOT_OPTION_TITLE_TEMPLATE",
        content: "{{hora}}"
      },
      {
        business_id: business.id,
        code: "WA_SERVICE_OPTION_DESCRIPTION_TEMPLATE",
        content: "{{duracao}} min"
      },
      {
        business_id: business.id,
        code: "WA_SLOT_OPTION_DESCRIPTION_TEMPLATE",
        content: "{{data}}"
      },
      {
        business_id: business.id,
        code: "BUSINESS_TYPE",
        content: body.businessType?.trim() || "Nao informado"
      },
      {
        business_id: business.id,
        code: "APPOINTMENT_REMINDER_24H",
        content: "Lembrete: seu agendamento e amanha, {{data}} as {{inicio}}."
      },
      {
        business_id: business.id,
        code: "APPOINTMENT_REMINDER_2H",
        content: "Lembrete: seu atendimento e hoje as {{inicio}}."
      },
      {
        business_id: business.id,
        code: "APPOINTMENT_REMINDER_30M",
        content: "Faltam 30 minutos para seu atendimento ({{inicio}}). Esta a caminho?"
      },
      {
        business_id: business.id,
        code: "APPOINTMENT_CONFIRM_ATTENDANCE_24H",
        content: "Confirme sua presenca para o atendimento de {{data}} {{inicio}} respondendo SIM."
      },
      {
        business_id: business.id,
        code: "APPOINTMENT_AUTO_RELEASE_UNCONFIRMED",
        content:
          "Seu horario de {{data}} {{inicio}} foi liberado por falta de confirmacao. Responda para reagendar."
      },
      {
        business_id: business.id,
        code: "POST_APPOINTMENT_THANK_YOU_REVIEW",
        content:
          "Obrigado pela visita, {{cliente}}! Sua avaliacao e muito importante para nos."
      },
      {
        business_id: business.id,
        code: "POST_APPOINTMENT_NEXT_VISIT_COUPON",
        content:
          "Temos um cupom especial para sua proxima visita: {{cupom}}. Valido ate {{validade}}."
      },
      {
        business_id: business.id,
        code: "REMARKETING_INACTIVE_30D",
        content:
          "Oi, {{cliente}}! Faz 30 dias desde sua ultima visita. Que tal agendar um novo horario?"
      },
      {
        business_id: business.id,
        code: "REMARKETING_SPECIAL_PROMO",
        content:
          "Promocao especial para voce, {{cliente}}! Responda para conhecer as condicoes e agendar."
      },
      {
        business_id: business.id,
        code: "BIRTHDAY_MESSAGE",
        content:
          "Feliz aniversario, {{cliente}}! Preparamos um desconto/brinde especial para voce."
      },
      {
        business_id: business.id,
        code: "AUTO_RETURN_PROMPT",
        content:
          "Gostaria de agendar seu retorno para daqui a {{dias}} dias? Toque para confirmar em 1 clique."
      },
      {
        business_id: business.id,
        code: "POST_APPOINTMENT_FEEDBACK_STARS",
        content:
          "Oi {{cliente}}! Como foi seu atendimento? Responda com uma nota: ⭐⭐⭐⭐⭐"
      }
    ];

    const { error: templateError } = await supabase
      .from("message_templates")
      .insert(templates);

    if (templateError) {
      return NextResponse.json(
        {
          error:
            "Empresa criada, mas houve falha ao salvar templates de mensagem."
        },
        { status: 500 }
      );
    }

    await triggerOnboardingWebhook({
      event: "business_created",
      business
    });

    return NextResponse.json(
      { message: "Empresa criada com sucesso.", business },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
