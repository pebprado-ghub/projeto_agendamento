-- =============================================================================
-- RODAR NO SUPABASE → SQL Editor (idempotente; pode executar mais de uma vez)
-- Pendências: site público + limites de edição + feature flags dos planos
-- =============================================================================

-- 1) Site público / vitrine (/b/[slug])
create table if not exists business_public_sites (
  business_id uuid primary key references businesses(id) on delete cascade,
  is_published boolean not null default false,
  headline text not null default '',
  subheadline text not null default '',
  about_text text not null default '',
  hero_image_url text,
  gallery_urls text[] not null default '{}',
  cta_label text not null default 'Agendar',
  show_prices boolean not null default true,
  updated_at timestamptz not null default now(),
  last_edit_at timestamptz,
  edit_count integer not null default 0,
  edit_count_month text
);

comment on table business_public_sites is
  'Conteúdo de marketing da página pública /b/[slug]: textos, hero, galeria e CTA.';

create index if not exists business_public_sites_published_idx
  on business_public_sites (is_published)
  where is_published = true;

-- 2) Colunas de cota (se a tabela já existia sem elas)
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

-- 3) Feature flags por plano (monetização)
alter table subscription_plans add column if not exists feature_flags jsonb;

update subscription_plans
set name = 'Agendamento'
where code = 'free' and name in ('Gratis', 'Grátis', 'Free');

update subscription_plans
set name = 'Profissional'
where code = 'pro' and name = 'Pro';

update subscription_plans
set feature_flags = '{
  "internal_calendar": true,
  "google_calendar": true,
  "services_catalog": true,
  "business_hours": true,
  "customers_crm": true,
  "finance_payments": true,
  "messages_whatsapp": true,
  "analytics_reports": true,
  "waitlist": true,
  "reminders": true,
  "attendance_confirmation": true,
  "remarketing_campaigns": true,
  "birthday_campaign": true,
  "post_visit_feedback": true,
  "checkin_qr": true,
  "auto_return": true,
  "one_click_reschedule": true,
  "google_reviews": true,
  "offers_loyalty": true,
  "automations_n8n": true,
  "multi_unit": true,
  "public_site": true
}'::jsonb,
    allows_automations = true,
    allows_multi_unit = true
where code = 'enterprise';

update subscription_plans
set feature_flags = '{
  "internal_calendar": true,
  "google_calendar": true,
  "services_catalog": true,
  "business_hours": true,
  "customers_crm": true,
  "messages_whatsapp": true,
  "waitlist": true,
  "reminders": true,
  "attendance_confirmation": true,
  "checkin_qr": true,
  "auto_return": true,
  "one_click_reschedule": true,
  "public_site": true
}'::jsonb
where code = 'pro';

update subscription_plans
set feature_flags = '{
  "internal_calendar": true,
  "services_catalog": true,
  "business_hours": true,
  "customers_crm": true
}'::jsonb,
    allows_automations = false,
    allows_multi_unit = false
where code = 'free';
