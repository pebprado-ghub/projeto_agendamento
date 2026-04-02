-- Cutoffs de cancelamento/reagendamento, automações pós-visita/campanhas e flags de experiência por serviço.

alter table services add column if not exists booking_reschedule_cutoff_minutes int not null default 0;
alter table services add column if not exists booking_cancel_cutoff_minutes int not null default 0;
alter table services add column if not exists post_visit_thank_you_enabled boolean not null default true;
alter table services add column if not exists post_visit_coupon_enabled boolean not null default true;
alter table services add column if not exists remarketing_enabled boolean not null default true;
alter table services add column if not exists remarketing_inactive_days int not null default 30;
alter table services add column if not exists birthday_campaign_enabled boolean not null default true;
alter table services add column if not exists auto_return_enabled boolean not null default true;
alter table services add column if not exists auto_return_days int not null default 30;
alter table services add column if not exists one_click_reschedule_enabled boolean not null default true;
alter table services add column if not exists checkin_qr_enabled boolean not null default true;
alter table services add column if not exists auto_feedback_enabled boolean not null default false;

alter table services drop constraint if exists services_auto_return_days_check;
alter table services add constraint services_auto_return_days_check
  check (auto_return_days between 7 and 120);

alter table services drop constraint if exists services_remarketing_inactive_days_check;
alter table services add constraint services_remarketing_inactive_days_check
  check (remarketing_inactive_days >= 7 and remarketing_inactive_days <= 365);

update services s
set
  booking_reschedule_cutoff_minutes = b.booking_reschedule_cutoff_minutes,
  booking_cancel_cutoff_minutes = b.booking_cancel_cutoff_minutes,
  post_visit_thank_you_enabled = b.post_visit_thank_you_enabled,
  post_visit_coupon_enabled = b.post_visit_coupon_enabled,
  remarketing_enabled = b.remarketing_enabled,
  remarketing_inactive_days = b.remarketing_inactive_days,
  birthday_campaign_enabled = b.birthday_campaign_enabled,
  auto_return_enabled = b.auto_return_enabled,
  auto_return_days = b.auto_return_days,
  one_click_reschedule_enabled = b.one_click_reschedule_enabled,
  checkin_qr_enabled = b.checkin_qr_enabled,
  auto_feedback_enabled = b.auto_feedback_enabled
from businesses b
where s.business_id = b.id;
