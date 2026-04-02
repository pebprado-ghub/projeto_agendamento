-- Vigencia de agendas: varias versoes de horarios por negocio (mensal, anual, personalizado, indeterminado).

create table if not exists business_hour_schedules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  validity_type text not null,
  valid_from date not null,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_hour_schedules_validity_type_check
    check (validity_type in ('indeterminate', 'monthly', 'annual', 'custom')),
  constraint business_hour_schedules_valid_range_check
    check (valid_to is null or valid_to >= valid_from)
);

create index if not exists idx_business_hour_schedules_business
  on business_hour_schedules (business_id);

create index if not exists idx_business_hour_schedules_range
  on business_hour_schedules (business_id, valid_from, valid_to);

alter table business_hours add column if not exists schedule_id uuid;

alter table business_hours
  drop constraint if exists business_hours_schedule_id_fkey;

alter table business_hours
  add constraint business_hours_schedule_id_fkey
  foreign key (schedule_id) references business_hour_schedules(id) on delete cascade;

-- Uma agenda "indeterminada" por negocio existente (para amarrar linhas atuais).
insert into business_hour_schedules (business_id, validity_type, valid_from, valid_to)
select b.id, 'indeterminate', (current_timestamp at time zone 'utc')::date, null
from businesses b
where not exists (
  select 1 from business_hour_schedules s where s.business_id = b.id
);

update business_hours bh
set schedule_id = s.id
from (
  select distinct on (business_id) id, business_id
  from business_hour_schedules
  order by business_id, created_at asc
) s
where bh.business_id = s.business_id
  and bh.schedule_id is null;

do $$
begin
  if exists (select 1 from business_hours where schedule_id is null) then
    raise exception 'Migration business_hour_schedules: business_hours sem schedule_id. Verifique o backfill.';
  end if;
end $$;

alter table business_hours alter column schedule_id set not null;

create index if not exists idx_business_hours_schedule_id on business_hours (schedule_id);
