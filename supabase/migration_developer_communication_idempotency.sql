-- Idempotência na importação legada (developer_contact_logs → mensagens).
-- Não é obrigatória se a migração unificada rodou uma única vez e não será repetida.
-- Recomendada: permite reexecutar o bloco de importação sem duplicar linhas.
--
-- Rode depois de migration_developer_communication_unified.sql (e com
-- developer_contact_logs criada, se usar o import).

alter table developer_communication_messages
  add column if not exists source_contact_log_id uuid null;

create unique index if not exists developer_communication_messages_source_log_uidx
  on developer_communication_messages (source_contact_log_id)
  where source_contact_log_id is not null;
