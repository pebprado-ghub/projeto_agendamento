-- Registro de data/hora em que o titular manifestou consentimento para marketing (fluxos voltados ao cliente).
alter table public.customers
  add column if not exists marketing_opt_in_at timestamptz;

comment on column public.customers.marketing_opt_in_at is
  'Momento em que o cliente autorizou comunicações de marketing; preenchido por fluxos do titular (ex.: agendamento público), não pelo painel manual.';
