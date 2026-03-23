alter table businesses
  add column if not exists booking_slot_capacity int not null default 1;

alter table businesses
  add column if not exists waitlist_enabled boolean not null default true;

alter table businesses
  drop constraint if exists businesses_booking_slot_capacity_check;

alter table businesses
  add constraint businesses_booking_slot_capacity_check
  check (booking_slot_capacity >= 1 and booking_slot_capacity <= 50);

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

create index if not exists idx_waitlist_business_date_status
  on appointment_waitlist (business_id, date_iso, status, created_at);

create index if not exists idx_waitlist_business_slot
  on appointment_waitlist (business_id, requested_start_at, requested_end_at);

drop trigger if exists trg_appointment_waitlist_updated_at on appointment_waitlist;
create trigger trg_appointment_waitlist_updated_at before update on appointment_waitlist
for each row execute function set_updated_at();
