alter table customers
  add column if not exists is_vip boolean not null default false;
alter table customers
  add column if not exists preferences text;
alter table customers
  add column if not exists restrictions text;
alter table customers
  add column if not exists tags text[] not null default '{}';
alter table customers
  add column if not exists last_contact_at timestamptz;

create index if not exists idx_customers_vip
  on customers (business_id, is_vip, created_at desc);

create index if not exists idx_customers_birth_date
  on customers (business_id, birth_date);
