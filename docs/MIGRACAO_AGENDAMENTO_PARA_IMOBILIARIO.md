# Migração: funcionalidades do projeto Agendamento → base Imobiliária

**Propósito deste documento:** inventário orientado a implementação, para quando o repositório **imobiliária** for a “fonte de verdade” estrutural e as capacidades do **agendamento** forem portadas para lá. O leitor principal é o assistente (e desenvolvedores): seções numeradas, caminhos de arquivo explícitos e dependências entre módulos.

**Projeto origem (este repo):** `projeto_agendamento` — Next.js 14 App Router, React 18, Supabase (service role no servidor), cookie de sessão simples.

**Projeto destino (a copiar depois):** monorepo/app **imobiliária** (estrutura de pastas, layout admin, AG Grid, modais, identidade visual esmeralda).

**Convenções usadas aqui:**

- `[ORIG]` = caminho no projeto agendamento atual.
- `[DEST]` = onde colocar no imobiliário (placeholder até o repo estar copiado; ajustar para o padrão do imobiliário).
- APIs listadas como `POST/GET/PATCH…` + path relativo `app/api/...`.

---

## 0. Contexto técnico do agendamento (visão rápida)

| Aspecto | Detalhe |
|--------|---------|
| Auth | Cookie `session_role`: `developer` \| `owner` (aliases legados `admin`/`client`). Middleware protege tudo exceto login + auth API. Ver `[ORIG]/middleware.ts`, `[ORIG]/lib/authRoles.ts`. |
| UI principal | Quase todo o app em `[ORIG]/app/page.tsx` (arquivo muito grande). Componentes menores em `[ORIG]/components/`. |
| Banco | Supabase via `[ORIG]/lib/supabaseAdmin.ts`. Sem migrations versionadas neste repo; schema inferido pelos `from("...")` nas rotas. |
| Deploy / env | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, cookies de tenant (`OWNER_BUSINESS_ID` / `CLIENT_BUSINESS_ID` no fluxo owner), Google OAuth, segredos de webhook WhatsApp/n8n, etc. |

**Diretriz para a migração:** reaproveitar **comportamento e contratos de API**; no imobiliário, **não** reproduzir o monólito `page.tsx` — quebrar em rotas/páginas/componentes como já é feito no imobiliário.

---

## 1. Autenticação e sessão

| ID | Funcionalidade | Origem principal | APIs | Notas para migração |
|----|----------------|------------------|------|---------------------|
| 1.1 | Login / logout / me | `[ORIG]/app/login`, `[ORIG]/app/api/auth/login`, `logout`, `me` | — | Integrar ao fluxo de auth do imobiliário (pode manter cookie ou unificar com auth existente). |
| 1.2 | Papéis developer vs owner | `[ORIG]/lib/authRoles.ts`, middleware | — | Garantir RBAC equivalente nas rotas/páginas do admin imobiliário. |
| 1.3 | Tenant fixo (owner) | Uso de env `OWNER_BUSINESS_ID` / `CLIENT_BUSINESS_ID` em `[ORIG]/app/page.tsx` + `loadBusinesses` | — | Documentar env no imobiliário; necessário quando há mais de um negócio. |

---

## 2. Multi-empresa (negócios / tenants)

| ID | Funcionalidade | Origem principal | APIs | Notas para migração |
|----|----------------|------------------|------|---------------------|
| 2.1 | CRUD lista empresas (dev) | `[ORIG]/app/api/businesses/route.ts` (GET limite alto, POST) | `GET/POST /api/businesses` | Inclui slug automático, sanitização, planos default. |
| 2.2 | Obter / atualizar / modo agenda | `[ORIG]/app/api/businesses/[businessId]/route.ts`, `[businessId]/mode` | `GET/PATCH …/businesses/:id` | PATCH ampla (cadastro + assinatura + buffers). |
| 2.3 | Feriados “dia útil” por negócio | `[ORIG]/app/api/businesses/[businessId]/holiday-working-days` | CRUD datas liberadas | Usado com agenda e feriados nacionais. |
| 2.4 | UI desenvolvedor: grid + modal novo/editar | `[ORIG]/components/admin/DeveloperBusinessesAgGrid.tsx`, trechos em `page.tsx` (modal, `developerBusinessConfigurationFields`) | — | **Portar para o padrão imobiliário:** card, quick filter, badge contagem, modal igual “novo imóvel”, botão esmeralda. |
| 2.5 | Cadastro enriquecido | CNPJ (ReceitaWS proxy), CEP ViaCEP, CNAE | `[ORIG]/app/api/cnpj/[cnpj]`, `[ORIG]/lib/cnae.ts`, `[ORIG]/lib/viacep.ts` | Formulário com grupos accordion (`FieldGroup`), timezone do browser. |
| 2.6 | Resumo plataforma (dev) | `[ORIG]/app/api/admin/platform-summary` | GET | Métricas agregadas para dashboard dev. |
| 2.7 | WhatsApp admin por negócio | `[ORIG]/app/api/admin/businesses/[businessId]/whatsapp` | — | Configuração operacional. |

**Estado alvo no imobiliário:** módulo “Empresas” ou equivalente multi-tenant com mesma UX do grid imobiliário + modais.

---

## 3. Serviços (catálogo por negócio)

| ID | Funcionalidade | Origem principal | APIs | Notas |
|----|----------------|------------------|------|--------|
| 3.1 | CRUD serviços | `[ORIG]/app/api/services/route.ts`, `[serviceId]/route.ts` | CRUD + `businessId` | Duração, preço, imagens, ordem. |
| 3.2 | Upload imagens serviço | `[ORIG]/app/api/services/upload/route.ts` | POST multipart | Depende de storage Supabase / política. |
| 3.3 | UI serviços (owner) | Em `page.tsx` (modal criar/editar serviço, listas) | — | Replicar fluxo em páginas dedicadas no imobiliário. |

---

## 4. Horário de funcionamento e regras de agendamento

| ID | Funcionalidade | Origem principal | APIs | Notas |
|----|----------------|------------------|------|--------|
| 4.1 | Grade semanal + almoço | `[ORIG]/app/api/business-hours/route.ts` | POST payload `hours[]` + `businessId` | weekday 0–6 + linha “feriados” (7) no cliente. |
| 4.2 | Regras: buffers, antecedência, limite diário, capacidade slot, cancelamento/reagendamento | Campos em `businesses` + UI em `page.tsx` | PATCH `/businesses/:id` | Central para disponibilidade. |

---

## 5. Disponibilidade e agendamentos (core)

| ID | Funcionalidade | Origem principal | APIs | Notas |
|----|----------------|------------------|------|--------|
| 5.1 | Cálculo de slots | `[ORIG]/app/api/availability/route.ts` | POST (opção auth `x-internal-secret` para n8n) | Usa `business_hours`, appointments ocupados, modo Google ou interno, feriados (`resolveScheduleWeekday`, `holidaysBr`), `booking_*`. |
| 5.2 | CRUD agendamentos | `[ORIG]/app/api/appointments/route.ts`, `[appointmentId]/route.ts` | CRUD + ações | Status, nomes, telefone, starts/ends. |
| 5.3 | Ações: cancelar, deslocar horário | `[appointmentId]/route.ts` | PATCH body `action` | Notifica fila de espera em alguns casos (`notifyNextWaitlistForWindow`). |
| 5.4 | Check-in por token | `[ORIG]/app/api/checkin/[token]/route.ts`, `checkin-token` | — | QR / link público limitado. |
| 5.5 | Feedback pós-atendimento | `[ORIG]/app/api/appointments/[appointmentId]/feedback/route.ts` | — | |
| 5.6 | Auto-retorno | `[ORIG]/app/api/appointments/[appointmentId]/auto-return/route.ts` | — | |
| 5.7 | Reserva rápida (UX) | `[ORIG]/app/api/booking/quick/route.ts` | — | Atalho de negócio. |

**Dependências:** negócio, serviços, horários, opcional Google Calendar.

---

## 6. Calendário Google

| ID | Funcionalidade | Origem principal | APIs | Notas |
|----|----------------|------------------|------|--------|
| 6.1 | OAuth connect/callback | `[ORIG]/app/api/google/connect`, `callback` | — | Tokens em `calendar_connections`. |
| 6.2 | Listar / refresh conexão | `[ORIG]/app/api/calendar-connections/route.ts` | — | Integrado à disponibilidade quando `calendar_mode === google`. |

---

## 7. Filas de espera (waitlist)

| ID | Funcionalidade | Origem principal | APIs | Notas |
|----|----------------|------------------|------|--------|
| 7.1 | Waitlist por janela | `[ORIG]/app/api/waitlist/route.ts`, `[ORIG]/lib/waitlist.ts` | — | Liberação ao cancelar/deslocar. |

---

## 8. Clientes (CRM leve)

| ID | Funcionalidade | Origem principal | APIs / UI | Notas |
|----|----------------|------------------|-----------|--------|
| 8.1 | CRUD clientes | `[ORIG]/app/api/customers/*` | várias rotas | Insights, atividade, perfis relacionados. |
| 8.2 | UI rica | `[ORIG]/components/client/CustomersManager.tsx` | — | Grande componente: portar incrementalmente. |

---

## 9. Mensagens / automação / WhatsApp

| ID | Funcionalidade | Origem principal | APIs | Notas |
|----|----------------|------------------|------|--------|
| 9.1 | Templates por negócio | `[ORIG]/app/api/message-templates/route.ts` | — | Muitos códigos (saudação, lembretes, WA menus, etc.). |
| 9.2 | Webhook WhatsApp (n8n) | `[ORIG]/app/api/webhook/whatsapp/route.ts` | POST | Orquestra conversa, usa `conversation-state`. |
| 9.3 | Estado de conversa | `[ORIG]/app/api/conversation-state/route.ts` | — | Máquina de estados para fluxo de agendamento. |
| 9.4 | Eventos de campanha | `[ORIG]/app/api/campaign-events/route.ts` | — | Remarketing / aniversário / pós-visita (ligado a templates). |

**Migração:** exige paridade de variáveis de ambiente e possivelmente adaptação do payload do n8n.

---

## 10. Feriados

| ID | Funcionalidade | Origem principal | APIs | Notas |
|----|----------------|------------------|------|--------|
| 10.1 | API feriados (nacional/estadual/municipal) | `[ORIG]/app/api/holidays/route.ts` | GET | Usa `date-holidays` + UF/cidade do negócio. |

---

## 11. Planos, pacotes e monetização

| ID | Funcionalidade | Origem principal | APIs | Notas |
|----|----------------|------------------|------|--------|
| 11.1 | Ofertas (pacote/assinatura de serviço) | `[ORIG]/app/api/offers/route.ts` | — | |
| 11.2 | Contratos / customer-plans | `[ORIG]/app/api/customer-plans/*`, `consume`, `run-billing` | — | Cobrança recorrente, consumo de sessões. |
| 11.3 | Pagamentos | `[ORIG]/app/api/payments/route.ts` | — | |
| 11.4 | Planos monetização (dev) | `[ORIG]/app/api/monetization/plans/route.ts`, `usage` | — | Limites, uso. |
| 11.5 | Solicitação mudança de plano | `[ORIG]/app/api/subscription-change-requests/route.ts` | — | |
| 11.6 | UI planos dev | `[ORIG]/components/admin/DeveloperSubscriptionPlanCards.tsx`, métricas | — | |

---

## 12. Relatórios e analytics

| ID | Funcionalidade | Origem principal | APIs | Notas |
|----|----------------|------------------|------|--------|
| 12.1 | Analytics | `[ORIG]/app/api/reports/analytics/route.ts` | — | |
| 12.2 | Financeiro | `[ORIG]/app/api/reports/financial/route.ts`, `financial-customers` | — | |
| 12.3 | UI gráficos / tabelas | `page.tsx` (owner dashboard analytics) | — | |

---

## 13. Fidelidade / indicações

| ID | Funcionalidade | Origem principal | APIs | Notas |
|----|----------------|------------------|------|--------|
| 13.1 | Loyalty redeem | `[ORIG]/app/api/loyalty/redeem/route.ts` | — | `[ORIG]/lib/loyalty.ts`. |
| 13.2 | Referrals | `[ORIG]/app/api/referrals/route.ts` | — | |

---

## 14. Utilitários de domínio (libs)

Copiar/adaptar para `[DEST]/lib` (ou equivalente):

| Lib | Responsabilidade |
|-----|------------------|
| `supabaseAdmin.ts` | Cliente servidor com service role. |
| `resolveScheduleWeekday.ts` | Dia civil vs feriado para grade. |
| `holidaysBr.ts` | Apoio a feriados. |
| `weekdayTimezone.ts` | Auxílio fuso. |
| `browserTimezone.ts` | IANA no cliente. |
| `ensureCustomerForAppointment.ts` | Vínculo cliente-agendamento. |
| `masksBr.ts`, `phone.ts` | Máscaras BR. |
| `viacep.ts`, `cnae.ts`, `pricingLocal.ts` | Cadastro empresa. |
| `adminPlanFeatures.ts` | Regras por plano. |
| `waitlist.ts` | Lógica fila. |
| `authRoles.ts` | Normalização papel sessão. |
| `cn.ts` | Util classe CSS (shadcn-like). |

---

## 15. Componentes UI reutilizáveis (origem)

| Componente | Uso |
|-----------|-----|
| `AdminCard`, `FieldGroup`, `MetricCard`, `SectionHeader`, `DeveloperMetricTable` | Layout admin. |
| `DeveloperBusinessesAgGrid` | Padrão grid empresas (quick filter, ações, tema). |
| `CustomersManager` | CRM clientes. |
| `ui/*` | button, input, select, tabs, checkbox, textarea, card. |
| `ThemeProvider`, `ThemeToggle` | Tema claro/escuro. |

No imobiliário: **preferir componentes já existentes**; trazer só o que faltar (ex.: `FieldGroup`, regras de formulário).

---

## 16. Variáveis de ambiente (checklist)

Documentar no `.env.example` do imobiliário após migração (nomes a conferir no código):

- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `OWNER_BUSINESS_ID` / `CLIENT_BUSINESS_ID` (se mantidos)
- Google OAuth client/secret/redirect
- Segredos webhook: `N8N_WEBHOOK_SECRET`, `N8N_ONBOARDING_SECRET`, outros usados em `fetch` com headers
- URLs n8n / onboarding se existirem

Busca rápida: `process.env.` em `[ORIG]/app/api` e `.tsx`.

---

## 17. Ordem sugerida de implementação no imobiliário

Ordem pensada em **dependências** (cada etapa desbloqueia a próxima):

1. **Auth + papéis + tenant** (seção 1) — base para tudo.
2. **Empresas multi-tenant + UI dev** (2) — igual padrão imobiliário (grid/modal).
3. **Serviços** (3) e **horários + regras** (4).
4. **Disponibilidade + appointments** (5) — núcleo.
5. **Google Calendar** (6) se necessário antes de ir a produção com Google.
6. **Templates + webhook + conversation-state** (9) — WhatsApp completo.
7. **Clientes** (8), **waitlist** (7), **feriados** (10).
8. **Monetização / planos / billing** (11).
9. **Relatórios** (12), **loyalty/referrals** (13).
10. **Admin platform-summary** e polish dev (2.6).

Paralelizar onde não houver dependência direta (ex.: relatórios vs loyalty).

---

## 18. Riscos e decisões explícitas

| Risco | Mitigação |
|-------|-----------|
| Schema Supabase divergente | Gerar diff a partir das queries no imobiliário vs agendamento; migration SQL única por “módulo”. |
| Monólito `page.tsx` | Extrair hooks e sub-rotas no imobiliário; não colar 7k linhas em uma página. |
| Duplicação AG Grid | Um único padrão de “lista admin” (imobiliário) + column defs por entidade. |
| Segurança API | Revalidar cada rota com auth do imobiliário (RBAC + tenant). Service role só no servidor. |

---

## 19. Critérios de aceite por fase (para validar migração)

- **Fase Negócio:** dev lista/filtra empresas, cria e edita no modal, CNPJ/CEP/CNAE ok, PATCH reflete no grid.
- **Fase Agenda:** owner define horários e regras; availability retorna slots coerentes; criar/cancelar/reagendar agendamento.
- **Fase WhatsApp:** webhook responde; templates editáveis; fluxo mínimo de agendamento por conversa.
- **Fase Financeiro:** contratos/cobrança se forem requisito do produto combinado.

---

## 20. Próximo passo operacional (quando o repo imobiliário estiver na workspace)

1. Colar este arquivo no repo imobiliário (ou manter referência cruzada).
2. Marcar cada linha das tabelas §2–§13 como `TODO` / `DONE`.
3. Para cada API migrada: **mesmo contrato JSON** na transição reduz risco com n8n/apps mobile.
4. Registrar no imobiliário um `CHANGELOG_MIGRACAO.md` com datas e breaking changes.

---

*Documento gerado a partir do estado do repositório agendamento; revisar após cópia do projeto imobiliário para caminhos exatos (`[DEST]`).*
