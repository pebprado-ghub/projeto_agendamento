alter table businesses
  add column if not exists reminder_24h_enabled boolean not null default true;
alter table businesses
  add column if not exists reminder_2h_enabled boolean not null default true;
alter table businesses
  add column if not exists reminder_30m_enabled boolean not null default true;
alter table businesses
  add column if not exists attendance_confirmation_required boolean not null default true;
alter table businesses
  add column if not exists attendance_confirmation_deadline_minutes int not null default 1440;
alter table businesses
  add column if not exists auto_release_unconfirmed boolean not null default true;
alter table businesses
  add column if not exists post_visit_thank_you_enabled boolean not null default true;
alter table businesses
  add column if not exists post_visit_coupon_enabled boolean not null default true;
alter table businesses
  add column if not exists remarketing_enabled boolean not null default true;
alter table businesses
  add column if not exists remarketing_inactive_days int not null default 30;
alter table businesses
  add column if not exists birthday_campaign_enabled boolean not null default true;

alter table businesses
  drop constraint if exists businesses_attendance_confirmation_deadline_check;
alter table businesses
  add constraint businesses_attendance_confirmation_deadline_check
  check (attendance_confirmation_deadline_minutes >= 60 and attendance_confirmation_deadline_minutes <= 10080);

alter table businesses
  drop constraint if exists businesses_remarketing_inactive_days_check;
alter table businesses
  add constraint businesses_remarketing_inactive_days_check
  check (remarketing_inactive_days >= 7 and remarketing_inactive_days <= 365);
