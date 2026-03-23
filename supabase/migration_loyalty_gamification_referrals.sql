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

create index if not exists idx_loyalty_points_ledger_customer
  on loyalty_points_ledger (customer_id, created_at desc);

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

create index if not exists idx_customer_referrals_referrer
  on customer_referrals (business_id, referrer_customer_id, created_at desc);

drop trigger if exists trg_customer_loyalty_updated_at on customer_loyalty;
create trigger trg_customer_loyalty_updated_at before update on customer_loyalty
for each row execute function set_updated_at();

drop trigger if exists trg_customer_referrals_updated_at on customer_referrals;
create trigger trg_customer_referrals_updated_at before update on customer_referrals
for each row execute function set_updated_at();
