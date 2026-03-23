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

create index if not exists idx_customer_related_profiles_customer
  on customer_related_profiles (business_id, customer_id, created_at desc);

drop trigger if exists trg_customer_related_profiles_updated_at on customer_related_profiles;
create trigger trg_customer_related_profiles_updated_at before update on customer_related_profiles
for each row execute function set_updated_at();

alter table appointments add column if not exists booked_for_name text;
alter table appointments add column if not exists booked_for_relationship text;
alter table appointments add column if not exists booked_for_phone text;
