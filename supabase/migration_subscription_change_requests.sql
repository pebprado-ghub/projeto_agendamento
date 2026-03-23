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

create index if not exists idx_subscription_change_requests_business_status
  on subscription_change_requests (business_id, status, created_at desc);

drop trigger if exists trg_subscription_change_requests_updated_at on subscription_change_requests;
create trigger trg_subscription_change_requests_updated_at before update on subscription_change_requests
for each row execute function set_updated_at();
