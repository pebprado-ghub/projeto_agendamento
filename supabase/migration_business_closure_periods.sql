-- Bloqueios operacionais (ferias, viagem, emergencia): periodo em que nao se aceita novos agendamentos.

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

drop trigger if exists trg_business_closure_periods_updated_at on business_closure_periods;
create trigger trg_business_closure_periods_updated_at
before update on business_closure_periods
for each row execute function set_updated_at();
