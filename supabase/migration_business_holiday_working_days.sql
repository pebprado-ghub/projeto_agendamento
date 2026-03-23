-- Datas em que o negócio atende mesmo sendo feriado (calendário informativo).
create table if not exists business_holiday_working_days (
  business_id uuid not null references businesses (id) on delete cascade,
  date_iso date not null,
  created_at timestamptz not null default now (),
  primary key (business_id, date_iso)
);

comment on table business_holiday_working_days is
  'Datas em que não se aplica a linha Feriados (weekday 7): usa-se o horário do dia da semana civil.';
