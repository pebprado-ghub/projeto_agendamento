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

create index if not exists idx_customer_plan_usages_contract
  on customer_plan_usages (customer_plan_contract_id, used_at desc);

create index if not exists idx_customer_plan_usages_business
  on customer_plan_usages (business_id, used_at desc);

drop trigger if exists trg_customer_plan_usages_updated_at on customer_plan_usages;
create trigger trg_customer_plan_usages_updated_at before update on customer_plan_usages
for each row execute function set_updated_at();
