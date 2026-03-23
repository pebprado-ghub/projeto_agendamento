# Projeto Agendamento (WhatsApp + n8n + Supabase + Google Calendar)

MVP de uma ferramenta de agendamento simples para varios tipos de negocio, com atendimento automatizado pelo WhatsApp, sincronizacao com Google Calendar do proprio cliente e painel web de personalizacao.

Padrao atual: agenda interna (baixo custo), com Google Calendar opcional por negocio.

O cadastro administrativo do cliente inclui dados fiscais e comerciais (CNPJ, razao social, nome fantasia, endereco e contato).

### Nomenclatura (só desenvolvimento / docs)

Na **interface**, quem usa o painel vê **“Clientes”** para o CRM; não aparecem os termos técnicos abaixo.

- **Administrador** = administra **a ferramenta** (papel `admin`).
- **Cliente primário** (termo dev) = quem **usa a ferramenta** por negócio (papel `client`).
- **Cliente secundário** (termo dev) = contato do negócio na tabela `customers`.

Detalhes: [`docs/glossario.md`](docs/glossario.md).

## Objetivo do MVP

- Receber mensagens via WhatsApp.
- Conduzir conversa com respostas pre-programadas.
- Consultar disponibilidade no Google Calendar.
- Confirmar agendamento e salvar no Supabase.
- Permitir personalizacao por empresa em uma interface web.

## Stack

- Frontend: Next.js
- Backend/API: Next.js (Route Handlers) ou servico Node separado
- Banco: Supabase (Postgres + RLS)
- Automacao: n8n
- Agenda: Google Calendar API (OAuth2)
- Canal: WhatsApp Cloud API (ou provedor compativel)

## Estrutura inicial

- `docs/arquitetura.md`: visao da arquitetura e responsabilidades.
- `docs/glossario.md`: termos técnicos para desenvolvimento (UI mostra só **Clientes** no CRM).
- `docs/workflows-n8n.md`: fluxos recomendados no n8n.
- `supabase/schema.sql`: schema inicial do banco.
- `supabase/rls.sql`: base inicial para politicas de RLS.
- `n8n/workflows/`: pasta para versionar workflows exportados do n8n.
- `app/`: painel web em Next.js com layout responsivo (desktop e mobile).
- `app/api/`: endpoints base para health check e webhook.
- `app/api/businesses/`: endpoint para criar/listar configuracoes de negocio.
- `app/api/businesses/[businessId]/`: atualiza cadastro completo do cliente.
- `app/api/businesses/[businessId]/mode/`: atualiza modo de agenda (`internal` ou `google`).
- `app/api/admin/businesses/[businessId]/whatsapp/`: atualiza WhatsApp do cliente com chave admin.
- `app/api/auth/login/`: autentica por usuario/senha e define sessao.
- `app/api/auth/me/`: retorna papel da sessao atual (`admin` ou `client`).
- `app/api/auth/logout/`: encerra sessao.
- `app/api/services/`: endpoints para CRUD basico de servicos por negocio.
- `app/api/business-hours/`: carregar/salvar horario padrao semanal por negocio.
- `app/api/availability/`: consulta de horarios livres usando Google Calendar.
- `app/api/appointments/`: cria/lista agendamentos (agenda interna).
- `app/api/conversation-state/`: le e atualiza estado da conversa por cliente.
- `app/api/calendar-connections/`: salvar/consultar conexao Google por negocio.
- `app/api/google/connect/`: inicia OAuth do Google Calendar.
- `app/api/google/callback/`: callback OAuth que salva tokens no Supabase.
- `lib/supabaseAdmin.ts`: client server-side para persistencia no Supabase.

### CRM (tela **Clientes** no painel)

Inspirado em fluxos de **Fresha**, **Zenoti** e **Mindbody**: ficha do contato, histórico de atendimentos e lançamentos financeiros.

- Tabelas: `customers` (perfil + LGPD `marketing_opt_in`), `customer_payments`, vínculo opcional `appointments.customer_id`.
- Telefone único por negócio (`phone_normalized`); ao criar/atualizar cliente, agendamentos antigos **sem** vínculo mas com o **mesmo telefone** são associados automaticamente.
- `app/api/customers/`: listar/criar com busca (`q`).
- `app/api/customers/[customerId]/`: obter, atualizar, excluir.
- `app/api/customers/[customerId]/activity/`: agendamentos (incl. órfãos por telefone) + pagamentos + totais.
- `app/api/payments/`: listar / registrar pagamento (valor, meio, vínculo opcional a agendamento).
- Painel: **Configurações → Clientes** (perfil, abas *Histórico de serviços* e *Pagamentos*).

Após puxar o código, rode no Supabase o trecho novo de `supabase/schema.sql` (tabelas `customers`, `customer_payments`, coluna `appointments.customer_id`). Para a coluna **`customers.whatsapp_profile_name`**, use também `supabase/migration_customers_whatsapp_profile_name.sql` se o banco já existia antes dessa alteração.

Para **feriados informativos** no calendário e exceções “atendo no feriado”, aplique `supabase/migration_business_holiday_working_days.sql` (tabela `business_holiday_working_days`).

Para a linha **Feriados** na agenda (`weekday = 7`) e o ajuste de constraint, aplique `supabase/migration_business_hours_weekday_7_feriados.sql`.

Para evoluir o **catálogo de serviços** (categoria, descrição, ícone, cor e ordenação), aplique `supabase/migration_services_catalog_upgrade.sql`.

Para upload de imagens dos serviços, crie no Supabase Storage um bucket público `service-images` (ou defina `SUPABASE_SERVICE_IMAGES_BUCKET` no `.env`) e use a mesma migração de catálogo, que inclui `services.image_urls`.

Para cadastro de **ramo (CNAE)** no administrador, aplique `supabase/migration_businesses_cnae.sql`.

Para **agendamento em grupo** (capacidade simultânea por horário) e **lista de espera automatizada**, aplique `supabase/migration_group_booking_waitlist.sql`.

Para **comunicação automática** (lembretes progressivos, confirmação obrigatória, pós-atendimento, remarketing e aniversário), aplique `supabase/migration_communications_automation.sql`.

Para **pagamento online (PIX/boleto)**, **pacotes/planos** e **relatórios financeiros**, aplique `supabase/migration_payments_offers_reports.sql`.

Para gestão completa de contratos (consumo com vínculo a agendamento e histórico de uso), aplique `supabase/migration_customer_plans_management.sql`.
Para melhorias de CRM de clientes (VIP, preferências, tags e segmentação), aplique `supabase/migration_customers_crm_enhancements.sql`.
Para análises avançadas (bloqueio de cliente problemático + eventos de campanha para ROI), aplique `supabase/migration_analytics_reports_campaign_events.sql`.
Para gamificação e fidelidade (pontos, níveis, badges e indicação premiada), aplique `supabase/migration_loyalty_gamification_referrals.sql`.
Para automações de economia de tempo (retorno automático, reagendamento 1 clique, check-in QR e feedback pós-atendimento), aplique `supabase/migration_automations_timesaver.sql`.
Para experiência do cliente (agendamento em 3 cliques e agendamento para terceiros/família), aplique `supabase/migration_customer_quick_booking_family.sql`.
Para monetização (Freemium/Pro/Enterprise com limites por plano), aplique `supabase/migration_monetization_plans.sql`.
Para solicitações de troca de assinatura pelo administrador (com aprovação do desenvolvedor), aplique `supabase/migration_subscription_change_requests.sql`.

APIs novas dessa etapa:
- `POST /api/customer-plans`: contratar pacote/assinatura para cliente.
- `PATCH /api/customer-plans/[contractId]`: pausar/reativar/cancelar contrato.
- `POST /api/customer-plans/consume`: baixar sessão de pacote (opcionalmente vinculando `appointmentId`).
- `POST /api/customer-plans/run-billing`: gerar cobranças pendentes de assinaturas ativas (execução manual/agendada via n8n).
- `GET /api/reports/financial-customers`: métricas financeiras de clientes (totais, descontos de fidelidade, promoções e contratos de planos/pacotes).

## Fases sugeridas

1. Configurar banco e politicas RLS no Supabase.
2. Criar fluxo principal no n8n (`whatsapp_inbound_router`).
3. Integrar Google Calendar com OAuth por empresa.
4. Criar painel web para configurar servicos e mensagens.
5. Ativar lembretes e follow-ups automatizados.

## Convencoes basicas

- Sistema multi-tenant: toda tabela de negocio deve ter `business_id`.
- Timezone obrigatorio por empresa para evitar conflito de agenda.
- Webhooks com idempotencia para evitar agendamentos duplicados.
- Tokens OAuth nunca em texto puro no frontend.

## Como rodar local

1. Copie `.env.example` para `.env.local`.
2. Instale dependencias com `npm install`.
3. Rode em desenvolvimento com `npm run dev`.
4. Acesse `http://localhost:3000`.

Variavel adicional recomendada:

- `ADMIN_PANEL_KEY`: chave usada para proteger alteracoes sensiveis (ex.: WhatsApp do negócio).
- `DEVELOPER_LOGIN_USER` e `DEVELOPER_LOGIN_PASSWORD`: credenciais do **Desenvolvedor** (plataforma). Se `DEVELOPER_LOGIN_USER` estiver vazio, o app usa `ADMIN_LOGIN_*` (legado).
- `OWNER_LOGIN_USER` e `OWNER_LOGIN_PASSWORD`: credenciais do **Administrador** do negócio (empresário/autônomo). Se `OWNER_LOGIN_USER` estiver vazio, o app usa `CLIENT_LOGIN_*` (legado).
- `OWNER_BUSINESS_ID` (opcional) ou `CLIENT_BUSINESS_ID` (legado): UUID em `businesses` para o login **owner** (administrador do negócio). Se existir **apenas um** negócio no banco, o app usa esse automaticamente; com **vários**, defina uma dessas variáveis para indicar qual é o do painel.
- `N8N_ONBOARDING_WEBHOOK_URL`: webhook opcional para onboarding automatico apos criar/atualizar cliente.
- `N8N_ONBOARDING_SECRET`: segredo opcional enviado no header `x-onboarding-secret`.
- `NEXT_PUBLIC_PRIVACY_POLICY_URL` (opcional): link para a politica de privacidade do negócio (URL absoluta `https://...` ou caminho `/privacidade`). Aparece no bloco LGPD na secao **Clientes** do painel.

### Cliente CRM ao agendar pelo WhatsApp

Ao criar agendamento via `POST /api/appointments` **sem** `customerId`, o backend tenta **criar ou reutilizar** um registro em `customers` pelo telefone normalizado (`source: whatsapp`). Se já existir cliente com o mesmo telefone no negócio, o agendamento **vincula** a esse cadastro. Para desativar: envie `autoCreateCustomer: false` no JSON. O workflow n8n `03_internal_booking_orchestrator` envia opcionalmente `customerName` quando existir em `context.customer_name` ou `customer_display_name`.

**Nome para o cadastro:** a API do WhatsApp **não** envia o nome salvo na agenda do telefone do administrador; envia o **nome do perfil público** do cliente (`contacts[].profile.name`). O router `01_whatsapp_inbound_router` expõe isso como `whatsapp_profile_name` — repasse esse campo ao orquestrador. Detalhes em `docs/whatsapp-nome-cliente.md`.
