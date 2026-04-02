-- Central unificada de comunicação desenvolvedor ↔ empresas.
-- Ordem sugerida no SQL Editor:
--   1) migration_developer_contact_logs.sql (se ainda não existir — opcional para migração de dados)
--   2) este arquivo
--   3) migration_developer_communication_thread_touch.sql (atualiza threads.updated_at ao gravar mensagem)
--   4) migration_developer_communication_idempotency.sql (import legado sem duplicar — opcional se não repete o script)

create table if not exists developer_communication_threads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint developer_communication_threads_business_unique unique (business_id)
);

create index if not exists developer_communication_threads_updated_at_idx
  on developer_communication_threads (updated_at desc);

create table if not exists developer_communication_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references developer_communication_threads (id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email', 'internal')),
  direction text not null check (direction in ('inbound', 'outbound', 'system')),
  subject text,
  body text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  external_provider_id text,
  external_thread_key text,
  sender_label text,
  created_at timestamptz not null default now()
);

create index if not exists developer_communication_messages_thread_created_idx
  on developer_communication_messages (thread_id, created_at desc);

create or replace view developer_communication_thread_summaries as
select
  t.id as thread_id,
  t.business_id,
  t.updated_at as thread_updated_at,
  b.name as business_name,
  b.slug as business_slug,
  lm.body as last_message_body,
  lm.channel as last_message_channel,
  lm.direction as last_message_direction,
  lm.created_at as last_message_at
from developer_communication_threads t
inner join businesses b on b.id = t.business_id
left join lateral (
  select m.body, m.channel, m.direction, m.created_at
  from developer_communication_messages m
  where m.thread_id = t.id
  order by m.created_at desc
  limit 1
) lm on true;

-- Migra registros legados de developer_contact_logs (se a tabela existir)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'developer_contact_logs'
  ) then
    insert into developer_communication_threads (business_id)
    select distinct l.business_id
    from developer_contact_logs l
    where not exists (
      select 1 from developer_communication_threads t where t.business_id = l.business_id
    );

    insert into developer_communication_messages (
      thread_id, channel, direction, body, created_at, source_contact_log_id
    )
    select t.id, 'internal', 'outbound',
      case when trim(coalesce(l.note, '')) = '' then '(sem texto)' else trim(l.note) end,
      l.created_at,
      l.id
    from developer_contact_logs l
    join developer_communication_threads t on t.business_id = l.business_id
    on conflict (source_contact_log_id) do nothing;

    update developer_communication_threads t
    set updated_at = coalesce((
      select max(m.created_at) from developer_communication_messages m where m.thread_id = t.id
    ), t.updated_at);
  end if;
end $$;
