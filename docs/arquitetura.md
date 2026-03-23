# Arquitetura do MVP

## Componentes

1. WhatsApp (entrada e saida de mensagens)
2. n8n (orquestracao dos fluxos)
3. Supabase (persistencia e regras de acesso)
4. Google Calendar (fonte oficial de disponibilidade)
5. Painel Web (configuracao por empresa)

## Visao de alto nivel

1. Cliente envia mensagem no WhatsApp.
2. Webhook chega no n8n.
3. n8n identifica empresa e estado da conversa no Supabase.
4. n8n responde etapa atual (menu, coleta de dados, confirmacao).
5. Para agendar, n8n consulta horarios no Google Calendar.
6. Cliente confirma horario.
7. n8n grava agendamento no Supabase e cria evento no Calendar.
8. n8n envia mensagem de confirmacao e agenda lembretes.

## Multi-tenant

- Tudo deve ser isolado por `business_id`.
- Cada empresa pode ter:
  - numero/conexao de WhatsApp,
  - servicos,
  - templates de mensagem,
  - horarios de atendimento,
  - conexao Google Calendar propria.

## Responsabilidades por camada

- n8n:
  - fluxo conversacional,
  - roteamento por tipo de negocio,
  - retries e tratamento de erro.
- Supabase:
  - dados de negocio,
  - historico de conversa,
  - agendamentos.
- Backend Web:
  - autenticacao do painel,
  - endpoints de administracao,
  - validacoes de configuracao.

## Seguranca

- Validar assinatura do webhook do WhatsApp.
- Criptografar ou guardar com seguranca credenciais OAuth.
- Ativar RLS no Supabase.
- Registrar logs minimos para auditoria sem expor dados sensiveis.

## Escalabilidade inicial

- Separar fluxo de entrada (`inbound`) dos fluxos de notificacao (`outbound`).
- Usar chave de idempotencia por mensagem recebida.
- Ter campo de status no agendamento (`pending`, `confirmed`, `cancelled`, `rescheduled`).
