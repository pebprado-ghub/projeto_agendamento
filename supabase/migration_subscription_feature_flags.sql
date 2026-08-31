-- Catálogo comercial: feature_flags por plano (sobrescreve parcialmente tierFeaturePreset no app).
alter table subscription_plans add column if not exists feature_flags jsonb;

-- Renomeia plano de entrada para posicionamento comercial "Agendamento".
update subscription_plans
set name = 'Agendamento'
where code = 'free' and name in ('Gratis', 'Grátis', 'Free');

update subscription_plans
set name = 'Profissional'
where code = 'pro' and name = 'Pro';

-- Enterprise: todas as flags true (referência para painel do desenvolvedor).
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

-- Profissional: crescimento (comunicação, fila, vitrine, automações leves).
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

-- Agendamento (free): só núcleo operacional.
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
