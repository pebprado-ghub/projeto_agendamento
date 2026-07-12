-- Limites de edição do site público: cota mensal + intervalo entre alterações.

alter table business_public_sites
  add column if not exists last_edit_at timestamptz,
  add column if not exists edit_count integer not null default 0,
  add column if not exists edit_count_month text;

comment on column business_public_sites.last_edit_at is
  'Última alteração de conteúdo que consumiu cota (buffer entre edições).';
comment on column business_public_sites.edit_count is
  'Quantidade de alterações no mês indicado por edit_count_month.';
comment on column business_public_sites.edit_count_month is
  'Mês da cota no formato YYYY-MM (America/Sao_Paulo).';
