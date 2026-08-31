import { NextRequest, NextResponse } from "next/server";
import { enforceServiceAutomationPatch } from "@/lib/planBusinessSettings";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CreateServiceInput = {
  businessId: string;
  name: string;
  durationMinutes: number;
  priceCents?: number | null;
  category?: string | null;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  isActive?: boolean;
  displayOrder?: number | null;
  imageUrls?: string[] | null;
  bookingBufferBeforeMinutes?: number;
  bookingBufferAfterMinutes?: number;
  bookingMinNoticeMinutes?: number;
  bookingMaxDaysAhead?: number;
  bookingDailyLimit?: number | null;
  bookingSlotCapacity?: number;
  waitlistEnabled?: boolean;
  reminder24hEnabled?: boolean;
  reminder2hEnabled?: boolean;
  reminder30mEnabled?: boolean;
  attendanceConfirmationRequired?: boolean;
  attendanceConfirmationDeadlineMinutes?: number;
  autoReleaseUnconfirmed?: boolean;
  bookingRescheduleCutoffMinutes?: number;
  bookingCancelCutoffMinutes?: number;
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
};

const SERVICE_SELECT =
  "id, business_id, name, category, description, icon, color, image_urls, display_order, duration_minutes, price_cents, is_active, booking_buffer_before_minutes, booking_buffer_after_minutes, booking_min_notice_minutes, booking_max_days_ahead, booking_daily_limit, booking_slot_capacity, waitlist_enabled, reminder_24h_enabled, reminder_2h_enabled, reminder_30m_enabled, attendance_confirmation_required, attendance_confirmation_deadline_minutes, auto_release_unconfirmed, booking_reschedule_cutoff_minutes, booking_cancel_cutoff_minutes, post_visit_thank_you_enabled, post_visit_coupon_enabled, remarketing_enabled, remarketing_inactive_days, birthday_campaign_enabled, auto_return_enabled, auto_return_days, one_click_reschedule_enabled, checkin_qr_enabled, auto_feedback_enabled";

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");

    if (!businessId) {
      return NextResponse.json(
        { error: "Parametro businessId e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("services")
      .select(SERVICE_SELECT)
      .eq("business_id", businessId)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Falha ao listar servicos." },
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
    const body = (await request.json()) as CreateServiceInput;

    if (!body.businessId || !body.name?.trim()) {
      return NextResponse.json(
        { error: "businessId e nome do servico sao obrigatorios." },
        { status: 400 }
      );
    }

    if (!body.durationMinutes || body.durationMinutes <= 0) {
      return NextResponse.json(
        { error: "durationMinutes deve ser maior que zero." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const row: Record<string, unknown> = {
      business_id: body.businessId,
      name: body.name.trim(),
      duration_minutes: body.durationMinutes,
      price_cents: body.priceCents ?? null,
      category: body.category?.trim() || null,
      description: body.description?.trim() || null,
      icon: body.icon?.trim() || "✂️",
      color: body.color?.trim() || "#3B82F6",
      image_urls: Array.isArray(body.imageUrls) ? body.imageUrls.slice(0, 5) : [],
      is_active: typeof body.isActive === "boolean" ? body.isActive : true,
      display_order:
        typeof body.displayOrder === "number" ? Math.max(0, body.displayOrder) : null
    };

    if (typeof body.bookingBufferBeforeMinutes === "number") {
      row.booking_buffer_before_minutes = Math.max(0, Math.floor(body.bookingBufferBeforeMinutes));
    }
    if (typeof body.bookingBufferAfterMinutes === "number") {
      row.booking_buffer_after_minutes = Math.max(0, Math.floor(body.bookingBufferAfterMinutes));
    }
    if (typeof body.bookingMinNoticeMinutes === "number") {
      row.booking_min_notice_minutes = Math.max(0, Math.floor(body.bookingMinNoticeMinutes));
    }
    if (typeof body.bookingMaxDaysAhead === "number") {
      row.booking_max_days_ahead = Math.max(1, Math.floor(body.bookingMaxDaysAhead));
    }
    if (body.bookingDailyLimit === null || typeof body.bookingDailyLimit === "number") {
      row.booking_daily_limit =
        body.bookingDailyLimit == null
          ? null
          : Math.max(1, Math.floor(body.bookingDailyLimit));
    }
    if (typeof body.bookingSlotCapacity === "number") {
      row.booking_slot_capacity = Math.min(
        50,
        Math.max(1, Math.floor(body.bookingSlotCapacity))
      );
    }
    if (typeof body.waitlistEnabled === "boolean") {
      row.waitlist_enabled = body.waitlistEnabled;
    }
    if (typeof body.reminder24hEnabled === "boolean") {
      row.reminder_24h_enabled = body.reminder24hEnabled;
    }
    if (typeof body.reminder2hEnabled === "boolean") {
      row.reminder_2h_enabled = body.reminder2hEnabled;
    }
    if (typeof body.reminder30mEnabled === "boolean") {
      row.reminder_30m_enabled = body.reminder30mEnabled;
    }
    if (typeof body.attendanceConfirmationRequired === "boolean") {
      row.attendance_confirmation_required = body.attendanceConfirmationRequired;
    }
    if (typeof body.attendanceConfirmationDeadlineMinutes === "number") {
      const d = Math.floor(body.attendanceConfirmationDeadlineMinutes);
      row.attendance_confirmation_deadline_minutes = Math.min(10080, Math.max(60, d));
    }
    if (typeof body.autoReleaseUnconfirmed === "boolean") {
      row.auto_release_unconfirmed = body.autoReleaseUnconfirmed;
    }
    if (typeof body.bookingRescheduleCutoffMinutes === "number") {
      row.booking_reschedule_cutoff_minutes = Math.max(
        0,
        Math.floor(body.bookingRescheduleCutoffMinutes)
      );
    }
    if (typeof body.bookingCancelCutoffMinutes === "number") {
      row.booking_cancel_cutoff_minutes = Math.max(0, Math.floor(body.bookingCancelCutoffMinutes));
    }
    if (typeof body.postVisitThankYouEnabled === "boolean") {
      row.post_visit_thank_you_enabled = body.postVisitThankYouEnabled;
    }
    if (typeof body.postVisitCouponEnabled === "boolean") {
      row.post_visit_coupon_enabled = body.postVisitCouponEnabled;
    }
    if (typeof body.remarketingEnabled === "boolean") {
      row.remarketing_enabled = body.remarketingEnabled;
    }
    if (typeof body.remarketingInactiveDays === "number") {
      row.remarketing_inactive_days = Math.min(
        365,
        Math.max(7, Math.floor(body.remarketingInactiveDays))
      );
    }
    if (typeof body.birthdayCampaignEnabled === "boolean") {
      row.birthday_campaign_enabled = body.birthdayCampaignEnabled;
    }
    if (typeof body.autoReturnEnabled === "boolean") {
      row.auto_return_enabled = body.autoReturnEnabled;
    }
    if (typeof body.autoReturnDays === "number") {
      row.auto_return_days = Math.min(120, Math.max(7, Math.floor(body.autoReturnDays)));
    }
    if (typeof body.oneClickRescheduleEnabled === "boolean") {
      row.one_click_reschedule_enabled = body.oneClickRescheduleEnabled;
    }
    if (typeof body.checkinQrEnabled === "boolean") {
      row.checkin_qr_enabled = body.checkinQrEnabled;
    }
    if (typeof body.autoFeedbackEnabled === "boolean") {
      row.auto_feedback_enabled = body.autoFeedbackEnabled;
    }

    const automationGate = await enforceServiceAutomationPatch(supabase, body.businessId, body);
    if (!automationGate.ok) return automationGate.response;

    const { data, error } = await supabase.from("services").insert(row).select(SERVICE_SELECT).single();

    if (error) {
      return NextResponse.json(
        { error: "Falha ao criar servico." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Servico criado com sucesso.", service: data },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
