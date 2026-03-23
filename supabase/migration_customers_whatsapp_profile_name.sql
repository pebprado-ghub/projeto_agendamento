-- Executar no Supabase SQL Editor se o projeto ja existia antes desta coluna.
alter table public.customers add column if not exists whatsapp_profile_name text;
