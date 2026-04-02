-- Regras de reserva, lembretes e confirmação passam a existir por serviço (com cópia a partir da empresa).

alter table services add column if not exists booking_buffer_before_minutes int not null default 0;
alter table services add column if not exists booking_buffer_after_minutes int not null default 0;
alter table services add column if not exists booking_min_notice_minutes int not null default 0;
alter table services add column if not exists booking_max_days_ahead int not null default 60;
alter table services add column if not exists booking_daily_limit int;
alter table services add column if not exists booking_slot_capacity int not null default 1;
alter table services add column if not exists waitlist_enabled boolean not null default true;
alter table services add column if not exists reminder_24h_enabled boolean not null default true;
alter table services add column if not exists reminder_2h_enabled boolean not null default true;
alter table services add column if not exists reminder_30m_enabled boolean not null default true;
alter table services add column if not exists attendance_confirmation_required boolean not null default true;
alter table services add column if not exists attendance_confirmation_deadline_minutes int not null default 1440;
alter table services add column if not exists auto_release_unconfirmed boolean not null default true;

alter table services drop constraint if exists services_booking_slot_capacity_check;
alter table services add constraint services_booking_slot_capacity_check
  check (booking_slot_capacity >= 1 and booking_slot_capacity <= 50);

alter table services drop constraint if exists services_attendance_confirmation_deadline_check;
alter table services add constraint services_attendance_confirmation_deadline_check
  check (
    attendance_confirmation_deadline_minutes >= 60
    and attendance_confirmation_deadline_minutes <= 10080
  );

alter table services drop constraint if exists services_booking_max_days_ahead_check;
alter table services add constraint services_booking_max_days_ahead_check
  check (booking_max_days_ahead >= 1);

update services s
set
  booking_buffer_before_minutes = b.booking_buffer_before_minutes,
  booking_buffer_after_minutes = b.booking_buffer_after_minutes,
  booking_min_notice_minutes = b.booking_min_notice_minutes,
  booking_max_days_ahead = b.booking_max_days_ahead,
  booking_daily_limit = b.booking_daily_limit,
  booking_slot_capacity = b.booking_slot_capacity,
  waitlist_enabled = b.waitlist_enabled,
  reminder_24h_enabled = b.reminder_24h_enabled,
  reminder_2h_enabled = b.reminder_2h_enabled,
  reminder_30m_enabled = b.reminder_30m_enabled,
  attendance_confirmation_required = b.attendance_confirmation_required,
  attendance_confirmation_deadline_minutes = b.attendance_confirmation_deadline_minutes,
  auto_release_unconfirmed = b.auto_release_unconfirmed
from businesses b
where s.business_id = b.id;
