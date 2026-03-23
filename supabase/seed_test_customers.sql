-- =============================================================================
-- Dados de teste: clientes, pagamentos e agendamentos (CRM)
-- Rode no SQL Editor do Supabase (Run).
--
-- Usa o primeiro negócio em public.businesses (ORDER BY created_at).
-- Para fixar um UUID específico, troque a subquery por:
--   '89b520c8-bc46-4f00-8d70-30a03ee4a33c'::uuid
-- =============================================================================

BEGIN;

-- Limpar execução anterior deste seed (mesmos IDs fixos)
DELETE FROM public.customer_payments
WHERE id IN (
  'c3000000-0000-4000-8000-000000000001'::uuid,
  'c3000000-0000-4000-8000-000000000002'::uuid,
  'c3000000-0000-4000-8000-000000000003'::uuid
);
DELETE FROM public.appointments
WHERE id IN (
  'b2000000-0000-4000-8000-000000000001'::uuid,
  'b2000000-0000-4000-8000-000000000002'::uuid
);
DELETE FROM public.customers
WHERE id IN (
  'a1000000-0000-4000-8000-000000000001'::uuid,
  'a1000000-0000-4000-8000-000000000002'::uuid,
  'a1000000-0000-4000-8000-000000000003'::uuid,
  'a1000000-0000-4000-8000-000000000004'::uuid
);

-- ---------------------------------------------------------------------------
-- Clientes (telefone só dígitos, com DDI 55 — igual ao app)
-- ---------------------------------------------------------------------------
INSERT INTO public.customers (
  id,
  business_id,
  full_name,
  whatsapp_profile_name,
  phone_normalized,
  email,
  document_id,
  birth_date,
  gender,
  address_line,
  address_number,
  neighborhood,
  city,
  state,
  postal_code,
  notes,
  source,
  marketing_opt_in
) VALUES (
  'a1000000-0000-4000-8000-000000000001'::uuid,
  (SELECT id FROM public.businesses ORDER BY created_at ASC LIMIT 1),
  'Maria Silva Santos',
  'Maria Silva',
  '5511987654321',
  'maria.silva@email.com',
  '12345678901',
  '1990-05-15',
  'F',
  'Rua das Flores',
  '100',
  'Centro',
  'São Paulo',
  'SP',
  '01310100',
  'Prefere horário pela manhã.',
  'whatsapp',
  true
);

INSERT INTO public.customers (
  id,
  business_id,
  full_name,
  whatsapp_profile_name,
  phone_normalized,
  email,
  document_id,
  birth_date,
  gender,
  address_line,
  address_number,
  neighborhood,
  city,
  state,
  postal_code,
  notes,
  source,
  marketing_opt_in
) VALUES (
  'a1000000-0000-4000-8000-000000000002'::uuid,
  (SELECT id FROM public.businesses ORDER BY created_at ASC LIMIT 1),
  'João Pedro Oliveira',
  NULL,
  '5511976543210',
  'joao.oliveira@gmail.com',
  NULL,
  '1985-11-22',
  'M',
  'Av. Paulista',
  '1500',
  'Bela Vista',
  'São Paulo',
  'SP',
  '01310100',
  NULL,
  'manual',
  false
);

INSERT INTO public.customers (
  id,
  business_id,
  full_name,
  whatsapp_profile_name,
  phone_normalized,
  email,
  document_id,
  birth_date,
  gender,
  address_line,
  address_number,
  neighborhood,
  city,
  state,
  postal_code,
  notes,
  source,
  marketing_opt_in
) VALUES (
  'a1000000-0000-4000-8000-000000000003'::uuid,
  (SELECT id FROM public.businesses ORDER BY created_at ASC LIMIT 1),
  'Ana Carolina Ferreira',
  'Ana C. Ferreira',
  '5511965432109',
  'ana.ferreira@outlook.com',
  NULL,
  NULL,
  'F',
  NULL,
  NULL,
  NULL,
  'Campinas',
  'SP',
  '13010000',
  'Cliente indicada pela Maria.',
  'import',
  true
);

INSERT INTO public.customers (
  id,
  business_id,
  full_name,
  whatsapp_profile_name,
  phone_normalized,
  email,
  document_id,
  birth_date,
  gender,
  address_line,
  address_number,
  neighborhood,
  city,
  state,
  postal_code,
  notes,
  source,
  marketing_opt_in
) VALUES (
  'a1000000-0000-4000-8000-000000000004'::uuid,
  (SELECT id FROM public.businesses ORDER BY created_at ASC LIMIT 1),
  'Carlos Eduardo Souza',
  NULL,
  '5511954321098',
  NULL,
  NULL,
  NULL,
  'M',
  'Rua XV de Novembro',
  '42',
  NULL,
  'Curitiba',
  'PR',
  '80020010',
  NULL,
  'other',
  false
);

-- ---------------------------------------------------------------------------
-- Pagamentos de teste (aba Pagamentos no painel)
-- ---------------------------------------------------------------------------
INSERT INTO public.customer_payments (
  id,
  business_id,
  customer_id,
  appointment_id,
  amount_cents,
  currency,
  payment_method,
  status,
  paid_at,
  notes
) VALUES (
  'c3000000-0000-4000-8000-000000000001'::uuid,
  (SELECT id FROM public.businesses ORDER BY created_at ASC LIMIT 1),
  'a1000000-0000-4000-8000-000000000001'::uuid,
  NULL,
  8500,
  'BRL',
  'pix',
  'paid',
  now() - interval '3 days',
  'Corte + escova'
);

INSERT INTO public.customer_payments (
  id,
  business_id,
  customer_id,
  appointment_id,
  amount_cents,
  currency,
  payment_method,
  status,
  paid_at,
  notes
) VALUES (
  'c3000000-0000-4000-8000-000000000002'::uuid,
  (SELECT id FROM public.businesses ORDER BY created_at ASC LIMIT 1),
  'a1000000-0000-4000-8000-000000000001'::uuid,
  NULL,
  12000,
  'BRL',
  'credit_card',
  'paid',
  now() - interval '10 days',
  NULL
);

INSERT INTO public.customer_payments (
  id,
  business_id,
  customer_id,
  appointment_id,
  amount_cents,
  currency,
  payment_method,
  status,
  paid_at,
  notes
) VALUES (
  'c3000000-0000-4000-8000-000000000003'::uuid,
  (SELECT id FROM public.businesses ORDER BY created_at ASC LIMIT 1),
  'a1000000-0000-4000-8000-000000000002'::uuid,
  NULL,
  4500,
  'BRL',
  'cash',
  'paid',
  now() - interval '1 day',
  'Barba'
);

-- ---------------------------------------------------------------------------
-- Agendamentos vinculados ao cliente (aba Histórico de serviços)
-- service_id pode ficar NULL se ainda não houver serviços cadastrados
-- ---------------------------------------------------------------------------
INSERT INTO public.appointments (
  id,
  business_id,
  service_id,
  customer_name,
  customer_phone,
  starts_at,
  ends_at,
  status,
  notes,
  customer_id
) VALUES (
  'b2000000-0000-4000-8000-000000000001'::uuid,
  (SELECT id FROM public.businesses ORDER BY created_at ASC LIMIT 1),
  NULL,
  'Maria Silva Santos',
  '5511987654321',
  now() + interval '1 day',
  now() + interval '1 day' + interval '45 minutes',
  'confirmed',
  'Primeira consulta',
  'a1000000-0000-4000-8000-000000000001'::uuid
);

INSERT INTO public.appointments (
  id,
  business_id,
  service_id,
  customer_name,
  customer_phone,
  starts_at,
  ends_at,
  status,
  notes,
  customer_id
) VALUES (
  'b2000000-0000-4000-8000-000000000002'::uuid,
  (SELECT id FROM public.businesses ORDER BY created_at ASC LIMIT 1),
  NULL,
  'João Pedro Oliveira',
  '5511976543210',
  now() + interval '15 days',
  now() + interval '15 days' + interval '1 hour',
  'pending',
  NULL,
  'a1000000-0000-4000-8000-000000000002'::uuid
);

COMMIT;

-- Verificação rápida (opcional)
-- SELECT id, full_name, phone_normalized FROM public.customers ORDER BY full_name;
-- SELECT * FROM public.customer_payments ORDER BY paid_at DESC;
-- SELECT id, customer_name, starts_at, status FROM public.appointments ORDER BY starts_at;
