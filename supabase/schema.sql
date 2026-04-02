-- Schema inicial do MVP de agendamento
-- Observacao: ajustar tipos e constraints conforme evolucao.

create extension if not exists "pgcrypto";

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  cnpj text,
  legal_name text,
  trade_name text,
  address_line text,
  address_number text,
  address_complement text,
  neighborhood text,
  city text,
  state text,
  postal_code text,
  contact_name text,
  contact_phone text,
  contact_email text,
  booking_buffer_before_minutes int not null default 0,
  booking_buffer_after_minutes int not null default 0,
  booking_min_notice_minutes int not null default 0,
  booking_max_days_ahead int not null default 60,
  booking_daily_limit int,
  booking_reschedule_cutoff_minutes int not null default 0,
  booking_cancel_cutoff_minutes int not null default 0,
  timezone text not null default 'America/Sao_Paulo',
  calendar_mode text not null default 'internal',
  whatsapp_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (calendar_mode in ('internal', 'google'))
);

alter table businesses
  add column if not exists calendar_mode text not null default 'internal';

alter table businesses add column if not exists cnpj text;
alter table businesses add column if not exists legal_name text;
alter table businesses add column if not exists trade_name text;
alter table businesses add column if not exists address_line text;
alter table businesses add column if not exists address_number text;
alter table businesses add column if not exists address_complement text;
alter table businesses add column if not exists neighborhood text;
alter table businesses add column if not exists city text;
alter table businesses add column if not exists state text;
alter table businesses add column if not exists postal_code text;
alter table businesses add column if not exists contact_name text;
alter table businesses add column if not exists contact_phone text;
alter table businesses add column if not exists contact_email text;
alter table businesses add column if not exists cnae_code text;
alter table businesses add column if not exists cnae_description text;
alter table businesses add column if not exists booking_buffer_before_minutes int not null default 0;
alter table businesses add column if not exists booking_buffer_after_minutes int not null default 0;
alter table businesses add column if not exists booking_min_notice_minutes int not null default 0;
alter table businesses add column if not exists booking_max_days_ahead int not null default 60;
alter table businesses add column if not exists booking_daily_limit int;
alter table businesses add column if not exists booking_reschedule_cutoff_minutes int not null default 0;
alter table businesses add column if not exists booking_cancel_cutoff_minutes int not null default 0;
alter table businesses add column if not exists booking_slot_capacity int not null default 1;
alter table businesses add column if not exists waitlist_enabled boolean not null default true;
alter table businesses add column if not exists reminder_24h_enabled boolean not null default true;
alter table businesses add column if not exists reminder_2h_enabled boolean not null default true;
alter table businesses add column if not exists reminder_30m_enabled boolean not null default true;
alter table businesses add column if not exists attendance_confirmation_required boolean not null default true;
alter table businesses add column if not exists attendance_confirmation_deadline_minutes int not null default 1440;
alter table businesses add column if not exists auto_release_unconfirmed boolean not null default true;
alter table businesses add column if not exists post_visit_thank_you_enabled boolean not null default true;
alter table businesses add column if not exists post_visit_coupon_enabled boolean not null default true;
alter table businesses add column if not exists remarketing_enabled boolean not null default true;
alter table businesses add column if not exists remarketing_inactive_days int not null default 30;
alter table businesses add column if not exists birthday_campaign_enabled boolean not null default true;

alter table businesses
  drop constraint if exists businesses_calendar_mode_check;

alter table businesses
  add constraint businesses_calendar_mode_check
  check (calendar_mode in ('internal', 'google'));

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, email)
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  category text,
  description text,
  icon text,
  color text,
  image_urls text[] not null default '{}',
  display_order int,
  duration_minutes int not null check (duration_minutes > 0),
  price_cents int,
  booking_buffer_before_minutes int not null default 0,
  booking_buffer_after_minutes int not null default 0,
  booking_min_notice_minutes int not null default 0,
  booking_max_days_ahead int not null default 60,
  booking_daily_limit int,
  booking_slot_capacity int not null default 1,
  waitlist_enabled boolean not null default true,
  reminder_24h_enabled boolean not null default true,
  reminder_2h_enabled boolean not null default true,
  reminder_30m_enabled boolean not null default true,
  attendance_confirmation_required boolean not null default true,
  attendance_confirmation_deadline_minutes int not null default 1440,
  auto_release_unconfirmed boolean not null default true,
  booking_reschedule_cutoff_minutes int not null default 0,
  booking_cancel_cutoff_minutes int not null default 0,
  post_visit_thank_you_enabled boolean not null default true,
  post_visit_coupon_enabled boolean not null default true,
  remarketing_enabled boolean not null default true,
  remarketing_inactive_days int not null default 30,
  birthday_campaign_enabled boolean not null default true,
  auto_return_enabled boolean not null default true,
  auto_return_days int not null default 30,
  one_click_reschedule_enabled boolean not null default true,
  checkin_qr_enabled boolean not null default true,
  auto_feedback_enabled boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table services add column if not exists category text;
alter table services add column if not exists description text;
alter table services add column if not exists icon text;
alter table services add column if not exists color text;
alter table services add column if not exists image_urls text[] not null default '{}';
alter table services add column if not exists display_order int;
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

create table if not exists business_hour_schedules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  validity_type text not null,
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (validity_type in ('indeterminate', 'monthly', 'annual', 'custom')),
  check (valid_to is null or valid_to >= valid_from)
);

create index if not exists idx_business_hour_schedules_business
  on business_hour_schedules (business_id);
create index if not exists idx_business_hour_schedules_range
  on business_hour_schedules (business_id, valid_from, valid_to);

create table if not exists business_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  schedule_id uuid not null references business_hour_schedules(id) on delete cascade,
  weekday int not null check (weekday between 0 and 7),
  start_time time not null,
  end_time time not null,
  lunch_start_time time,
  lunch_end_time time,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time),
  check (
    (lunch_start_time is null and lunch_end_time is null) or
    (lunch_start_time is not null and lunch_end_time is not null and lunch_start_time < lunch_end_time)
  )
);

alter table business_hours add column if not exists lunch_start_time time;
alter table business_hours add column if not exists lunch_end_time time;
alter table business_hours add column if not exists sort_order int not null default 0;

create table if not exists calendar_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  provider text not null default 'google',
  calendar_id text not null default 'primary',
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, provider)
);

create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  code text not null,
  content text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);

create table if not exists conversation_state (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_phone text not null,
  state text not null default 'start',
  context jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (business_id, customer_phone)
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  customer_name text,
  customer_phone text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending',
  external_event_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create index if not exists idx_services_business_id on services (business_id);
create index if not exists idx_business_hours_business_id on business_hours (business_id);
create index if not exists idx_templates_business_id on message_templates (business_id);
create index if not exists idx_conversation_state_business_phone on conversation_state (business_id, customer_phone);
create index if not exists idx_appointments_business_starts_at on appointments (business_id, starts_at);
create unique index if not exists idx_businesses_cnpj_unique
  on businesses (cnpj)
  where cnpj is not null and cnpj <> '';

-- Clientes finais do negócio (contatos que agendam / consomem serviço)
-- Padrão CRM de salão/clínica: perfil único por (negócio + telefone).
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  full_name text not null,
  phone_normalized text not null,
  email text,
  document_id text,
  birth_date date,
  gender text,
  address_line text,
  address_number text,
  address_complement text,
  neighborhood text,
  city text,
  state text,
  postal_code text,
  notes text,
  source text not null default 'manual',
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source in ('manual', 'whatsapp', 'import', 'other')),
  unique (business_id, phone_normalized)
);

alter table customers add column if not exists whatsapp_profile_name text;
alter table customers add column if not exists is_vip boolean not null default false;
alter table customers add column if not exists preferences text;
alter table customers add column if not exists restrictions text;
alter table customers add column if not exists tags text[] not null default '{}';
alter table customers add column if not exists last_contact_at timestamptz;
alter table customers add column if not exists is_blocked boolean not null default false;
alter table customers add column if not exists block_reason text;
alter table customers add column if not exists marketing_opt_in_at timestamptz;
alter table businesses add column if not exists auto_return_enabled boolean not null default true;
alter table businesses add column if not exists auto_return_days int not null default 30;
alter table businesses add column if not exists one_click_reschedule_enabled boolean not null default true;
alter table businesses add column if not exists checkin_qr_enabled boolean not null default true;
alter table businesses add column if not exists auto_feedback_enabled boolean not null default false;
alter table businesses add column if not exists google_reviews_enabled boolean not null default false;
alter table businesses add column if not exists google_reviews_url text;
alter table businesses add column if not exists subscription_plan_code text not null default 'free';
alter table businesses add column if not exists subscription_status text not null default 'active';
alter table businesses add column if not exists monthly_appointment_limit int;
alter table businesses add column if not exists professional_limit int;
alter table businesses add column if not exists automations_enabled boolean not null default false;
alter table businesses add column if not exists multi_unit_enabled boolean not null default false;
alter table businesses add column if not exists billing_period_start date;
alter table businesses add column if not exists billing_period_end date;
alter table businesses drop constraint if exists businesses_auto_return_days_check;
alter table businesses add constraint businesses_auto_return_days_check
  check (auto_return_days between 7 and 120);
alter table businesses drop constraint if exists businesses_subscription_plan_code_check;
alter table businesses add constraint businesses_subscription_plan_code_check
  check (subscription_plan_code in ('free', 'pro', 'enterprise'));
alter table businesses drop constraint if exists businesses_subscription_status_check;
alter table businesses add constraint businesses_subscription_status_check
  check (subscription_status in ('active', 'trialing', 'past_due', 'cancelled'));
alter table customers drop constraint if exists customers_source_check;
alter table customers add constraint customers_source_check
  check (source in ('manual', 'whatsapp', 'import', 'campaign', 'other'));

create index if not exists idx_customers_business_id on customers (business_id);
create index if not exists idx_customers_phone on customers (business_id, phone_normalized);
create index if not exists idx_customers_vip
  on customers (business_id, is_vip, created_at desc);
create index if not exists idx_customers_birth_date
  on customers (business_id, birth_date);

-- Pagamentos vinculados ao cliente (e opcionalmente a um agendamento)
create table if not exists customer_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  amount_cents int not null check (amount_cents >= 0),
  currency text not null default 'BRL',
  payment_method text not null default 'other',
  status text not null default 'paid',
  paid_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payment_method in ('cash', 'pix', 'credit_card', 'debit_card', 'transfer', 'other')),
  check (status in ('pending', 'paid', 'refunded', 'cancelled'))
);

alter table customer_payments add column if not exists payment_provider text;
alter table customer_payments add column if not exists payment_link text;
alter table customer_payments add column if not exists due_at timestamptz;
alter table customer_payments add column if not exists external_reference text;
alter table customer_payments add column if not exists paid_online boolean not null default false;
alter table customer_payments
  drop constraint if exists customer_payments_payment_method_check;
alter table customer_payments
  add constraint customer_payments_payment_method_check
  check (payment_method in ('cash', 'pix', 'boleto', 'credit_card', 'debit_card', 'transfer', 'other'));

create index if not exists idx_customer_payments_business on customer_payments (business_id);
create index if not exists idx_customer_payments_customer on customer_payments (customer_id);
create index if not exists idx_customer_payments_appointment on customer_payments (appointment_id);

alter table appointments add column if not exists customer_id uuid references customers(id) on delete set null;
create index if not exists idx_appointments_customer_id on appointments (customer_id);
alter table appointments add column if not exists checked_in_at timestamptz;
alter table appointments add column if not exists checkin_token text unique;
alter table appointments add column if not exists completed_at timestamptz;
alter table appointments add column if not exists feedback_sent_at timestamptz;
alter table appointments add column if not exists booked_for_name text;
alter table appointments add column if not exists booked_for_relationship text;
alter table appointments add column if not exists booked_for_phone text;
create index if not exists idx_appointments_checkin_token
  on appointments (checkin_token)
  where checkin_token is not null;
create index if not exists idx_appointments_checked_in
  on appointments (business_id, checked_in_at desc)
  where checked_in_at is not null;

-- Trigger generico para updated_at
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_businesses_updated_at on businesses;
create trigger trg_businesses_updated_at before update on businesses
for each row execute function set_updated_at();

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
for each row execute function set_updated_at();

drop trigger if exists trg_services_updated_at on services;
create trigger trg_services_updated_at before update on services
for each row execute function set_updated_at();

drop trigger if exists trg_business_hours_updated_at on business_hours;
create trigger trg_business_hours_updated_at before update on business_hours
for each row execute function set_updated_at();

drop trigger if exists trg_calendar_connections_updated_at on calendar_connections;
create trigger trg_calendar_connections_updated_at before update on calendar_connections
for each row execute function set_updated_at();

drop trigger if exists trg_message_templates_updated_at on message_templates;
create trigger trg_message_templates_updated_at before update on message_templates
for each row execute function set_updated_at();

drop trigger if exists trg_appointments_updated_at on appointments;
create trigger trg_appointments_updated_at before update on appointments
for each row execute function set_updated_at();

drop trigger if exists trg_business_closure_periods_updated_at on business_closure_periods;
create trigger trg_business_closure_periods_updated_at before update on business_closure_periods
for each row execute function set_updated_at();

drop trigger if exists trg_customers_updated_at on customers;
create trigger trg_customers_updated_at before update on customers
for each row execute function set_updated_at();

drop trigger if exists trg_customer_payments_updated_at on customer_payments;
create trigger trg_customer_payments_updated_at before update on customer_payments
for each row execute function set_updated_at();

-- Exceções de feriado (calendário informativo): negócio atende mesmo em feriado.
create table if not exists business_holiday_working_days (
  business_id uuid not null references businesses (id) on delete cascade,
  date_iso date not null,
  created_at timestamptz not null default now (),
  primary key (business_id, date_iso)
);

-- Indisponibilidade (ferias, viagem, emergencia): nao aceita novos agendamentos no intervalo.
create table if not exists business_closure_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null default 'other'
    check (kind in ('vacation', 'emergency', 'travel', 'other')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_business_closure_periods_business_range
  on business_closure_periods (business_id, starts_at, ends_at);

create table if not exists appointment_waitlist (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  customer_name text,
  customer_phone text not null,
  date_iso date not null,
  requested_start_at timestamptz not null,
  requested_end_at timestamptz not null,
  status text not null default 'waiting',
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requested_start_at < requested_end_at),
  check (status in ('waiting', 'notified', 'booked', 'cancelled'))
);

create table if not exists offer_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  name text not null,
  offer_type text not null,
  description text,
  price_cents int not null check (price_cents >= 0),
  sessions_included int check (sessions_included is null or sessions_included > 0),
  billing_cycle_days int check (billing_cycle_days is null or billing_cycle_days > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (offer_type in ('package', 'subscription'))
);

create table if not exists customer_plan_contracts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  offer_plan_id uuid not null references offer_plans(id) on delete cascade,
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  sessions_total int check (sessions_total is null or sessions_total >= 0),
  sessions_used int not null default 0 check (sessions_used >= 0),
  next_billing_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('active', 'paused', 'cancelled', 'completed'))
);

create table if not exists customer_plan_usages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_plan_contract_id uuid not null references customer_plan_contracts(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  used_sessions int not null default 1 check (used_sessions > 0),
  used_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaign_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  campaign_code text not null,
  campaign_type text not null,
  channel text not null default 'whatsapp',
  event_type text not null,
  happened_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (event_type in ('sent', 'opened', 'clicked', 'replied', 'converted')),
  check (campaign_type in ('remarketing', 'new_customer', 'birthday', 'other'))
);

create table if not exists customer_loyalty (
  customer_id uuid primary key references customers(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  points_balance int not null default 0 check (points_balance >= 0),
  lifetime_points int not null default 0 check (lifetime_points >= 0),
  total_redeemed_points int not null default 0 check (total_redeemed_points >= 0),
  level_code text not null default 'bronze',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (level_code in ('bronze', 'prata', 'ouro', 'platina'))
);

create table if not exists loyalty_points_ledger (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  payment_id uuid references customer_payments(id) on delete set null,
  reason text not null,
  points_delta int not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists customer_badges (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  badge_code text not null,
  badge_name text not null,
  achieved_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (business_id, customer_id, badge_code)
);

create table if not exists customer_referrals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  referrer_customer_id uuid not null references customers(id) on delete cascade,
  referred_customer_id uuid not null references customers(id) on delete cascade,
  referral_code text not null,
  status text not null default 'registered',
  reward_referrer_cents int not null default 2000 check (reward_referrer_cents >= 0),
  reward_referred_cents int not null default 2000 check (reward_referred_cents >= 0),
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status in ('registered', 'converted', 'rewarded', 'cancelled')),
  unique (business_id, referrer_customer_id, referred_customer_id)
);

create table if not exists subscription_plans (
  code text primary key,
  name text not null,
  monthly_price_cents int not null check (monthly_price_cents >= 0),
  monthly_appointment_limit int,
  professional_limit int,
  allows_automations boolean not null default false,
  allows_multi_unit boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into subscription_plans (
  code,
  name,
  monthly_price_cents,
  monthly_appointment_limit,
  professional_limit,
  allows_automations,
  allows_multi_unit
)
values
  ('free', 'Gratis', 0, 50, 1, false, false),
  ('pro', 'Pro', 4900, null, null, true, false),
  ('enterprise', 'Enterprise', 14900, null, null, true, true)
on conflict (code) do update set
  name = excluded.name,
  monthly_price_cents = excluded.monthly_price_cents,
  monthly_appointment_limit = excluded.monthly_appointment_limit,
  professional_limit = excluded.professional_limit,
  allows_automations = excluded.allows_automations,
  allows_multi_unit = excluded.allows_multi_unit,
  is_active = true;

create table if not exists customer_related_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  full_name text not null,
  relationship text,
  phone_normalized text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, customer_id, full_name)
);

create table if not exists subscription_change_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  current_plan_code text not null check (current_plan_code in ('free', 'pro', 'enterprise')),
  requested_plan_code text not null check (requested_plan_code in ('free', 'pro', 'enterprise')),
  requested_by_role text not null default 'owner' check (requested_by_role in ('owner', 'developer')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_waitlist_business_date_status
  on appointment_waitlist (business_id, date_iso, status, created_at);
create index if not exists idx_waitlist_business_slot
  on appointment_waitlist (business_id, requested_start_at, requested_end_at);
create index if not exists idx_offer_plans_business
  on offer_plans (business_id, created_at desc);
create index if not exists idx_customer_plan_contracts_business
  on customer_plan_contracts (business_id, status, created_at desc);
create index if not exists idx_customer_plan_usages_contract
  on customer_plan_usages (customer_plan_contract_id, used_at desc);
create index if not exists idx_customer_plan_usages_business
  on customer_plan_usages (business_id, used_at desc);
create index if not exists idx_campaign_events_business_happened
  on campaign_events (business_id, happened_at desc);
create index if not exists idx_campaign_events_business_code
  on campaign_events (business_id, campaign_code, event_type, happened_at desc);
create index if not exists idx_loyalty_points_ledger_customer
  on loyalty_points_ledger (customer_id, created_at desc);
create index if not exists idx_customer_referrals_referrer
  on customer_referrals (business_id, referrer_customer_id, created_at desc);
create index if not exists idx_customer_related_profiles_customer
  on customer_related_profiles (business_id, customer_id, created_at desc);
create index if not exists idx_subscription_change_requests_business_status
  on subscription_change_requests (business_id, status, created_at desc);

drop trigger if exists trg_appointment_waitlist_updated_at on appointment_waitlist;
create trigger trg_appointment_waitlist_updated_at before update on appointment_waitlist
for each row execute function set_updated_at();

drop trigger if exists trg_offer_plans_updated_at on offer_plans;
create trigger trg_offer_plans_updated_at before update on offer_plans
for each row execute function set_updated_at();

drop trigger if exists trg_customer_plan_contracts_updated_at on customer_plan_contracts;
create trigger trg_customer_plan_contracts_updated_at before update on customer_plan_contracts
for each row execute function set_updated_at();

drop trigger if exists trg_customer_plan_usages_updated_at on customer_plan_usages;
create trigger trg_customer_plan_usages_updated_at before update on customer_plan_usages
for each row execute function set_updated_at();

drop trigger if exists trg_campaign_events_updated_at on campaign_events;
create trigger trg_campaign_events_updated_at before update on campaign_events
for each row execute function set_updated_at();

drop trigger if exists trg_customer_loyalty_updated_at on customer_loyalty;
create trigger trg_customer_loyalty_updated_at before update on customer_loyalty
for each row execute function set_updated_at();

drop trigger if exists trg_customer_referrals_updated_at on customer_referrals;
create trigger trg_customer_referrals_updated_at before update on customer_referrals
for each row execute function set_updated_at();

drop trigger if exists trg_customer_related_profiles_updated_at on customer_related_profiles;
create trigger trg_customer_related_profiles_updated_at before update on customer_related_profiles
for each row execute function set_updated_at();

drop trigger if exists trg_subscription_plans_updated_at on subscription_plans;
create trigger trg_subscription_plans_updated_at before update on subscription_plans
for each row execute function set_updated_at();

drop trigger if exists trg_subscription_change_requests_updated_at on subscription_change_requests;
create trigger trg_subscription_change_requests_updated_at before update on subscription_change_requests
for each row execute function set_updated_at();

create table if not exists developer_contact_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists developer_contact_logs_business_id_created_at_idx
  on developer_contact_logs (business_id, created_at desc);

create table if not exists developer_communication_threads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint developer_communication_threads_business_unique unique (business_id)
);

create index if not exists developer_communication_threads_updated_at_idx
  on developer_communication_threads (updated_at desc);

create table if not exists developer_communication_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references developer_communication_threads (id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email', 'internal')),
  direction text not null check (direction in ('inbound', 'outbound', 'system')),
  subject text,
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  external_provider_id text,
  external_thread_key text,
  sender_label text,
  source_contact_log_id uuid null,
  created_at timestamptz not null default now()
);

create index if not exists developer_communication_messages_thread_created_idx
  on developer_communication_messages (thread_id, created_at desc);

create unique index if not exists developer_communication_messages_source_log_uidx
  on developer_communication_messages (source_contact_log_id)
  where source_contact_log_id is not null;

create or replace view developer_communication_thread_summaries as
select
  t.id as thread_id,
  t.business_id,
  t.updated_at as thread_updated_at,
  b.name as business_name,
  b.slug as business_slug,
  lm.body as last_message_body,
  lm.channel as last_message_channel,
  lm.direction as last_message_direction,
  lm.created_at as last_message_at
from developer_communication_threads t
inner join businesses b on b.id = t.business_id
left join lateral (
  select m.body, m.channel, m.direction, m.created_at
  from developer_communication_messages m
  where m.thread_id = t.id
  order by m.created_at desc
  limit 1
) lm on true;

create or replace function developer_communication_touch_thread_updated_at()
returns trigger
language plpgsql
as $$
begin
  update developer_communication_threads
  set updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists trg_developer_communication_messages_touch_thread
  on developer_communication_messages;

create trigger trg_developer_communication_messages_touch_thread
after insert or update on developer_communication_messages
for each row execute function developer_communication_touch_thread_updated_at();
