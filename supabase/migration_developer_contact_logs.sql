-- Registro de contatos feitos pelo painel do desenvolvedor (notas internas + auditoria).
-- Rode no Supabase SQL Editor se o banco já existia antes deste arquivo.

create table if not exists developer_contact_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists developer_contact_logs_business_id_created_at_idx
  on developer_contact_logs (business_id, created_at desc);
