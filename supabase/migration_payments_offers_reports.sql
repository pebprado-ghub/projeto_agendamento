alter table customer_payments
  add column if not exists payment_provider text;
alter table customer_payments
  add column if not exists payment_link text;
alter table customer_payments
  add column if not exists due_at timestamptz;
alter table customer_payments
  add column if not exists external_reference text;
alter table customer_payments
  add column if not exists paid_online boolean not null default false;

alter table customer_payments
  drop constraint if exists customer_payments_payment_method_check;
alter table customer_payments
  add constraint customer_payments_payment_method_check
  check (
    payment_method in (
      'cash',
      'pix',
      'boleto',
      'credit_card',
      'debit_card',
      'transfer',
      'other'
    )
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

create index if not exists idx_offer_plans_business
  on offer_plans (business_id, created_at desc);

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

create index if not exists idx_customer_plan_contracts_business
  on customer_plan_contracts (business_id, status, created_at desc);

drop trigger if exists trg_offer_plans_updated_at on offer_plans;
create trigger trg_offer_plans_updated_at before update on offer_plans
for each row execute function set_updated_at();

drop trigger if exists trg_customer_plan_contracts_updated_at on customer_plan_contracts;
create trigger trg_customer_plan_contracts_updated_at before update on customer_plan_contracts
for each row execute function set_updated_at();
