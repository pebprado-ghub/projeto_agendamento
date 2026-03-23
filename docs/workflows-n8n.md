# Blueprint de Workflows n8n

Este documento define os fluxos base para o MVP.

## 1) `whatsapp_inbound_router`

Objetivo: receber mensagem, identificar contexto e rotear para proxima etapa.

Nos sugeridos:

1. Webhook (entrada do WhatsApp)
2. Function (normalizar payload)
3. HTTP Request (buscar empresa por numero no Supabase)
4. IF (empresa encontrada?)
5. HTTP Request (buscar estado da conversa por contato)
6. Switch (etapa atual: inicio, servico, data, horario, confirmacao)
7. HTTP Request (enviar resposta no WhatsApp)
8. HTTP Request (persistir estado atualizado)

## 2) `availability_check`

Objetivo: retornar horarios livres com base em servico + data + timezone.

Nos sugeridos:

1. Execute Workflow Trigger (chamado interno)
2. Set (normalizar `business_id`, `service_id`, `date`, `timezone`)
3. HTTP Request (POST em `/api/availability` do app)
4. Receber `availableSlots` e encaminhar para fluxo conversacional
5. Return (slots)

## 3) `internal_booking_orchestrator`

Objetivo: fluxo completo de atendimento inbound com agenda interna.

Nos sugeridos:

1. Webhook (entrada da mensagem normalizada)
2. HTTP Request (`/api/conversation-state`) para recuperar contexto
3. HTTP Request (`/api/services`) para menu ativo de servicos
4. Code (rotear etapa: menu, data, slot, confirmacao)
5. Switch por acao
6. HTTP Request (`/api/availability`) quando estiver em `awaiting_date`
7. HTTP Request (`/api/appointments`) quando estiver em `awaiting_slot`
8. HTTP Request (`/api/conversation-state`) para persistir estado
9. Respond to Webhook com mensagem final

## 4) `appointment_create`

Objetivo: confirmar agendamento e sincronizar banco + calendar.

Nos sugeridos:

1. Execute Workflow Trigger
2. IF (validar dados obrigatorios)
3. Google Calendar (create event)
4. HTTP Request (insert em `appointments` no Supabase)
5. HTTP Request (enviar confirmacao no WhatsApp)
6. Return (resultado)

## 5) `appointment_reminder_cron`

Objetivo: enviar lembretes automaticos (ex.: 24h e 2h antes).

Nos sugeridos:

1. Cron
2. HTTP Request (buscar agendamentos futuros sem lembrete enviado)
3. Split in Batches
4. HTTP Request (enviar WhatsApp)
5. HTTP Request (marcar lembrete como enviado)

## 6) `fallback_humano`

Objetivo: encaminhar para atendente quando o bot nao entende.

Nos sugeridos:

1. Execute Workflow Trigger
2. HTTP Request (registrar ocorrencia)
3. HTTP Request (notificar atendente/canal interno)
4. HTTP Request (enviar mensagem ao cliente)

## 7) `onboarding_business`

Objetivo: processar onboarding automatico ao criar/atualizar cliente.

Nos sugeridos:

1. Webhook (`/onboarding/business`)
2. Set (normalizar `event` e dados da empresa)
3. Code (comparar header `x-onboarding-secret`; prioridade: constante `WORKFLOW_ONBOARDING_SECRET` no proprio no, depois `$vars`, depois `process.env`; mesmo valor que `N8N_ONBOARDING_SECRET` no `.env.local` do app; se tudo vazio, aceita qualquer header — so em dev)
4. IF (`secret_valid`)
5. Code (montar plano de tarefas por evento)
6. Respond to Webhook (resultado)

## Boas praticas de implementacao

- Nomear todos os nos com padrao claro (`[tipo]_[acao]`).
- Salvar IDs externos (message_id, event_id).
- Tratar duplicidade com idempotencia por `message_id`.
- Versionar export JSON dos workflows em `n8n/workflows/`.
