import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type UpdateServiceInput = {
  name?: string;
  durationMinutes?: number;
  priceCents?: number | null;
  isActive?: boolean;
  category?: string | null;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
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

type Params = {
  params: {
    serviceId: string;
  };
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const body = (await request.json()) as UpdateServiceInput;
    const serviceId = params.serviceId;

    if (!serviceId) {
      return NextResponse.json(
        { error: "serviceId e obrigatorio." },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body.durationMinutes === "number" && body.durationMinutes > 0) {
      updates.duration_minutes = body.durationMinutes;
    }
    if (typeof body.priceCents === "number" || body.priceCents === null) {
      updates.price_cents = body.priceCents;
    }
    if (typeof body.isActive === "boolean") {
      updates.is_active = body.isActive;
    }
    if (typeof body.category === "string" || body.category === null) {
      updates.category = body.category?.trim() || null;
    }
    if (typeof body.description === "string" || body.description === null) {
      updates.description = body.description?.trim() || null;
    }
    if (typeof body.icon === "string" && body.icon.trim()) {
      updates.icon = body.icon.trim();
    }
    if (typeof body.color === "string" && body.color.trim()) {
      updates.color = body.color.trim();
    }
    if (typeof body.displayOrder === "number" || body.displayOrder === null) {
      updates.display_order =
        typeof body.displayOrder === "number" ? Math.max(0, body.displayOrder) : null;
    }
    if (Array.isArray(body.imageUrls)) {
      updates.image_urls = body.imageUrls.slice(0, 5);
    }
    if (typeof body.bookingBufferBeforeMinutes === "number") {
      updates.booking_buffer_before_minutes = Math.max(
        0,
        Math.floor(body.bookingBufferBeforeMinutes)
      );
    }
    if (typeof body.bookingBufferAfterMinutes === "number") {
      updates.booking_buffer_after_minutes = Math.max(
        0,
        Math.floor(body.bookingBufferAfterMinutes)
      );
    }
    if (typeof body.bookingMinNoticeMinutes === "number") {
      updates.booking_min_notice_minutes = Math.max(0, Math.floor(body.bookingMinNoticeMinutes));
    }
    if (typeof body.bookingMaxDaysAhead === "number") {
      updates.booking_max_days_ahead = Math.max(1, Math.floor(body.bookingMaxDaysAhead));
    }
    if (body.bookingDailyLimit === null || typeof body.bookingDailyLimit === "number") {
      updates.booking_daily_limit =
        body.bookingDailyLimit == null
          ? null
          : Math.max(1, Math.floor(body.bookingDailyLimit));
    }
    if (typeof body.bookingSlotCapacity === "number") {
      updates.booking_slot_capacity = Math.min(
        50,
        Math.max(1, Math.floor(body.bookingSlotCapacity))
      );
    }
    if (typeof body.waitlistEnabled === "boolean") {
      updates.waitlist_enabled = body.waitlistEnabled;
    }
    if (typeof body.reminder24hEnabled === "boolean") {
      updates.reminder_24h_enabled = body.reminder24hEnabled;
    }
    if (typeof body.reminder2hEnabled === "boolean") {
      updates.reminder_2h_enabled = body.reminder2hEnabled;
    }
    if (typeof body.reminder30mEnabled === "boolean") {
      updates.reminder_30m_enabled = body.reminder30mEnabled;
    }
    if (typeof body.attendanceConfirmationRequired === "boolean") {
      updates.attendance_confirmation_required = body.attendanceConfirmationRequired;
    }
    if (typeof body.attendanceConfirmationDeadlineMinutes === "number") {
      const d = Math.floor(body.attendanceConfirmationDeadlineMinutes);
      updates.attendance_confirmation_deadline_minutes = Math.min(10080, Math.max(60, d));
    }
    if (typeof body.autoReleaseUnconfirmed === "boolean") {
      updates.auto_release_unconfirmed = body.autoReleaseUnconfirmed;
    }
    if (typeof body.bookingRescheduleCutoffMinutes === "number") {
      updates.booking_reschedule_cutoff_minutes = Math.max(
        0,
        Math.floor(body.bookingRescheduleCutoffMinutes)
      );
    }
    if (typeof body.bookingCancelCutoffMinutes === "number") {
      updates.booking_cancel_cutoff_minutes = Math.max(
        0,
        Math.floor(body.bookingCancelCutoffMinutes)
      );
    }
    if (typeof body.postVisitThankYouEnabled === "boolean") {
      updates.post_visit_thank_you_enabled = body.postVisitThankYouEnabled;
    }
    if (typeof body.postVisitCouponEnabled === "boolean") {
      updates.post_visit_coupon_enabled = body.postVisitCouponEnabled;
    }
    if (typeof body.remarketingEnabled === "boolean") {
      updates.remarketing_enabled = body.remarketingEnabled;
    }
    if (typeof body.remarketingInactiveDays === "number") {
      updates.remarketing_inactive_days = Math.min(
        365,
        Math.max(7, Math.floor(body.remarketingInactiveDays))
      );
    }
    if (typeof body.birthdayCampaignEnabled === "boolean") {
      updates.birthday_campaign_enabled = body.birthdayCampaignEnabled;
    }
    if (typeof body.autoReturnEnabled === "boolean") {
      updates.auto_return_enabled = body.autoReturnEnabled;
    }
    if (typeof body.autoReturnDays === "number") {
      updates.auto_return_days = Math.min(120, Math.max(7, Math.floor(body.autoReturnDays)));
    }
    if (typeof body.oneClickRescheduleEnabled === "boolean") {
      updates.one_click_reschedule_enabled = body.oneClickRescheduleEnabled;
    }
    if (typeof body.checkinQrEnabled === "boolean") {
      updates.checkin_qr_enabled = body.checkinQrEnabled;
    }
    if (typeof body.autoFeedbackEnabled === "boolean") {
      updates.auto_feedback_enabled = body.autoFeedbackEnabled;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo valido informado para atualizacao." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("services")
      .update(updates)
      .eq("id", serviceId)
      .select(SERVICE_SELECT)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Falha ao atualizar servico." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Servico atualizado.", service: data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const serviceId = params.serviceId;
    if (!serviceId) {
      return NextResponse.json(
        { error: "serviceId e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("services").delete().eq("id", serviceId);

    if (error) {
      return NextResponse.json(
        { error: "Falha ao remover servico." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Servico removido com sucesso." });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
