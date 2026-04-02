-- Mantém developer_communication_threads.updated_at alinhado à última atividade da mensagem.
-- Rode depois de migration_developer_communication_unified.sql.
-- Útil para inserções via SQL, webhooks ou jobs sem passar pela API Next.

create or replace function developer_communication_touch_thread_updated_at()
returns trigger
language plpgsql
as $$
begin
  update developer_communication_threads
  set updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists trg_developer_communication_messages_touch_thread
  on developer_communication_messages;

create trigger trg_developer_communication_messages_touch_thread
after insert or update on developer_communication_messages
for each row execute function developer_communication_touch_thread_updated_at();
