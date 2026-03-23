alter table customers
  add column if not exists is_blocked boolean not null default false;
alter table customers
  add column if not exists block_reason text;

alter table customers
  drop constraint if exists customers_source_check;
alter table customers
  add constraint customers_source_check
  check (source in ('manual', 'whatsapp', 'import', 'campaign', 'other'));

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

create index if not exists idx_campaign_events_business_happened
  on campaign_events (business_id, happened_at desc);

create index if not exists idx_campaign_events_business_code
  on campaign_events (business_id, campaign_code, event_type, happened_at desc);

drop trigger if exists trg_campaign_events_updated_at on campaign_events;
create trigger trg_campaign_events_updated_at before update on campaign_events
for each row execute function set_updated_at();
