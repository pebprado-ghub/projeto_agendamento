-- Permite linha "Feriados" (weekday = 7) na agenda de atendimento.
alter table business_hours drop constraint if exists business_hours_weekday_check;

alter table business_hours
  add constraint business_hours_weekday_check check (weekday between 0 and 7);

-- Um registro padrão por negócio: feriados fechados até o administrador configurar.
insert into business_hours (business_id, weekday, start_time, end_time, lunch_start_time, lunch_end_time, is_active)
select
  b.id,
  7,
  '09:00:00'::time,
  '18:00:00'::time,
  null,
  null,
  false
from businesses b
where not exists (
  select 1 from business_hours h where h.business_id = b.id and h.weekday = 7
);
