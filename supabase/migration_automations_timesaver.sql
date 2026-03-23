alter table businesses add column if not exists auto_return_enabled boolean not null default true;
alter table businesses add column if not exists auto_return_days int not null default 30;
alter table businesses add column if not exists one_click_reschedule_enabled boolean not null default true;
alter table businesses add column if not exists checkin_qr_enabled boolean not null default true;
alter table businesses add column if not exists auto_feedback_enabled boolean not null default false;
alter table businesses add column if not exists google_reviews_enabled boolean not null default false;
alter table businesses add column if not exists google_reviews_url text;
alter table businesses drop constraint if exists businesses_auto_return_days_check;
alter table businesses add constraint businesses_auto_return_days_check
  check (auto_return_days between 7 and 120);

alter table appointments add column if not exists checked_in_at timestamptz;
alter table appointments add column if not exists checkin_token text unique;
alter table appointments add column if not exists completed_at timestamptz;
alter table appointments add column if not exists feedback_sent_at timestamptz;

create index if not exists idx_appointments_checkin_token
  on appointments (checkin_token)
  where checkin_token is not null;

create index if not exists idx_appointments_checked_in
  on appointments (business_id, checked_in_at desc)
  where checked_in_at is not null;
