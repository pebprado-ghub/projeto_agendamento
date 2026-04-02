-- Turnos múltiplos por dia: uma linha em business_hours por turno (mesmo weekday).
-- sort_order ordena os turnos no mesmo dia. lunch_* fica obsoleto (sempre nulo após migração).

alter table business_hours add column if not exists sort_order int not null default 0;

-- Quem ainda tinha pausa/almoco vira dois turnos (duas linhas).
insert into business_hours (
  business_id,
  weekday,
  start_time,
  end_time,
  lunch_start_time,
  lunch_end_time,
  is_active,
  sort_order
)
select
  business_id,
  weekday,
  lunch_end_time,
  end_time,
  null,
  null,
  is_active,
  coalesce(sort_order, 0) + 1
from business_hours
where lunch_start_time is not null
  and lunch_end_time is not null;

update business_hours
set
  end_time = lunch_start_time,
  lunch_start_time = null,
  lunch_end_time = null
where lunch_start_time is not null
  and lunch_end_time is not null;
