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

alter table businesses add column if not exists subscription_plan_code text not null default 'free';
alter table businesses add column if not exists subscription_status text not null default 'active';
alter table businesses add column if not exists monthly_appointment_limit int;
alter table businesses add column if not exists professional_limit int;
alter table businesses add column if not exists automations_enabled boolean not null default false;
alter table businesses add column if not exists multi_unit_enabled boolean not null default false;
alter table businesses add column if not exists billing_period_start date;
alter table businesses add column if not exists billing_period_end date;

alter table businesses drop constraint if exists businesses_subscription_plan_code_check;
alter table businesses add constraint businesses_subscription_plan_code_check
  check (subscription_plan_code in ('free', 'pro', 'enterprise'));

alter table businesses drop constraint if exists businesses_subscription_status_check;
alter table businesses add constraint businesses_subscription_status_check
  check (subscription_status in ('active', 'trialing', 'past_due', 'cancelled'));

drop trigger if exists trg_subscription_plans_updated_at on subscription_plans;
create trigger trg_subscription_plans_updated_at before update on subscription_plans
for each row execute function set_updated_at();
