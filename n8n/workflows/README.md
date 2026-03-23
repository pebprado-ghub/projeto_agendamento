# Workflows n8n

Coloque aqui os arquivos JSON exportados do n8n.

Sugestao de nomes:

- `01_whatsapp_inbound_router.json`
- `02_availability_check.json`
- `03_internal_booking_orchestrator.json`
- `04_appointment_create.json`
- `05_appointment_reminder_cron.json`
- `06_fallback_humano.json`
- `07_onboarding_business.json`

Recomendacao:

- Versione sempre que mudar logica de fluxo.
- Evite salvar credenciais no JSON exportado.

## Onboarding (`07_onboarding_business`)

O workflow valida o header `x-onboarding-secret` (nao use segredo vindo do body). O valor esperado e obtido nesta ordem:

1. **Constante no Code** (`WORKFLOW_ONBOARDING_SECRET` no no `code_validate_onboarding_secret`): use quando **nao** puder configurar env/vars no servidor. Deve ser **igual** a `N8N_ONBOARDING_SECRET` no `.env.local` do app. **Quem exportar o JSON do workflow ve o segredo** — nao commite esse export com valor real em repo publico.
2. **Variaveis do n8n:** `$vars.N8N_ONBOARDING_SECRET` ou `$vars.ONBOARDING_SECRET` (Pro Cloud+, Enterprise, self-hosted com Variables).
3. **Self-hosted:** `process.env.N8N_ONBOARDING_SECRET` no processo do n8n.

Se todos estiverem vazios, o fluxo aceita qualquer header (apenas para testes).

## Conversa com opcoes interativas

No `03_internal_booking_orchestrator`, os menus numericos continuam funcionando, mas agora o fluxo tambem aceita `customer_interactive_id` para integrações com botões/listas do WhatsApp (ex.: `svc_1`, `slot_2`).

Templates usados para texto/titulo de opcoes:
- `WA_SERVICE_MENU_PROMPT`
- `WA_SLOT_MENU_PROMPT`
- `WA_SERVICE_OPTION_TITLE_TEMPLATE` (usa `{{servico}}`)
- `WA_SLOT_OPTION_TITLE_TEMPLATE` (usa `{{hora}}`)
- `WA_SERVICE_OPTION_DESCRIPTION_TEMPLATE` (usa `{{duracao}}`)
- `WA_SLOT_OPTION_DESCRIPTION_TEMPLATE` (usa `{{data}}` e opcional `{{hora}}`)
