/**
 * Funcionalidades expostas no painel do administrador (empresa), usadas para
 * compor pacotes de assinatura no painel do desenvolvedor (estilo catálogos
 * tipo Stripe / Fresha: checklist por plano).
 */
export type AdminPlanFeatureId =
  | "internal_calendar"
  | "google_calendar"
  | "services_catalog"
  | "business_hours"
  | "customers_crm"
  | "finance_payments"
  | "messages_whatsapp"
  | "analytics_reports"
  | "waitlist"
  | "reminders"
  | "attendance_confirmation"
  | "remarketing_campaigns"
  | "birthday_campaign"
  | "post_visit_feedback"
  | "checkin_qr"
  | "auto_return"
  | "one_click_reschedule"
  | "google_reviews"
  | "offers_loyalty"
  | "automations_n8n"
  | "multi_unit";

export const ADMIN_PLAN_FEATURE_GROUPS: Array<{
  id: string;
  title: string;
  items: Array<{
    id: AdminPlanFeatureId;
    label: string;
    description: string;
  }>;
}> = [
  {
    id: "core",
    title: "Operação e agenda",
    items: [
      {
        id: "internal_calendar",
        label: "Agenda interna",
        description: "Agendamentos, status e visão operacional no sistema."
      },
      {
        id: "google_calendar",
        label: "Google Calendar",
        description: "Integração OAuth, sincronização de eventos e disponibilidade."
      },
      {
        id: "services_catalog",
        label: "Catálogo de serviços",
        description: "Serviços, preços, duração, mídia e ordenação."
      },
      {
        id: "business_hours",
        label: "Horários e exceções",
        description: "Grade semanal, almoço, feriados e ajustes por dia."
      },
      {
        id: "waitlist",
        label: "Fila de espera",
        description: "Lista de interessados quando não há slot livre."
      },
      {
        id: "multi_unit",
        label: "Multi-unidade",
        description:
          "Várias unidades (filiais, franquias ou salas) na mesma assinatura — aderente a contas com escala e precificação por plano."
      }
    ]
  },
  {
    id: "relationship",
    title: "Clientes e comunicação",
    items: [
      {
        id: "customers_crm",
        label: "CRM — Clientes",
        description: "Ficha, histórico, LGPD e vínculo com agendamentos."
      },
      {
        id: "messages_whatsapp",
        label: "Mensagens e templates",
        description: "Templates WhatsApp por evento e personalização de textos."
      },
      {
        id: "finance_payments",
        label: "Financeiro",
        description: "Pagamentos, vínculo a atendimentos e visão de faturamento."
      },
      {
        id: "offers_loyalty",
        label: "Pacotes e fidelidade",
        description: "Pacotes, assinaturas e ofertas recorrentes."
      }
    ]
  },
  {
    id: "automation",
    title: "Automação e retenção",
    items: [
      {
        id: "reminders",
        label: "Lembretes automáticos",
        description: "Notificações antes do atendimento (24h, 2h, 30min)."
      },
      {
        id: "attendance_confirmation",
        label: "Confirmação de presença",
        description: "Confirmação, SLA e liberação de horários não confirmados."
      },
      {
        id: "remarketing_campaigns",
        label: "Remarketing",
        description: "Reativação de clientes inativos via fluxo configurável."
      },
      {
        id: "birthday_campaign",
        label: "Campanha de aniversário",
        description: "Disparos e ofertas ligadas à data de nascimento."
      },
      {
        id: "post_visit_feedback",
        label: "Pós-visita",
        description: "Agradecimento, cupom pós-atendimento e fluxo de feedback."
      },
      {
        id: "checkin_qr",
        label: "Check-in por QR",
        description: "Token de check-in e experiência no balcão."
      },
      {
        id: "auto_return",
        label: "Retorno automático",
        description: "Sugestão de reagendamento após o serviço."
      },
      {
        id: "one_click_reschedule",
        label: "Reagendar em um toque",
        description: "Links e fluxos rápidos de remarcação para o cliente."
      },
      {
        id: "google_reviews",
        label: "Google Reviews",
        description: "Coleta e direcionamento para avaliações públicas."
      }
    ]
  },
  {
    id: "intelligence",
    title: "Análises e escala",
    items: [
      {
        id: "analytics_reports",
        label: "Análises e relatórios",
        description: "Ocupação, no-show, tendências e campanhas."
      },
      {
        id: "automations_n8n",
        label: "Automações avançadas (n8n)",
        description: "Orquestração de eventos com plataforma externa."
      }
    ]
  }
];

const ALL_IDS: AdminPlanFeatureId[] = ADMIN_PLAN_FEATURE_GROUPS.flatMap((g) =>
  g.items.map((i) => i.id)
);

export function emptyFeatureMap(): Record<AdminPlanFeatureId, boolean> {
  return Object.fromEntries(ALL_IDS.map((id) => [id, false])) as Record<
    AdminPlanFeatureId,
    boolean
  >;
}

export function tierFeaturePreset(
  code: "free" | "pro" | "enterprise"
): Record<AdminPlanFeatureId, boolean> {
  const m = emptyFeatureMap();
  if (code === "enterprise") {
    for (const id of ALL_IDS) m[id] = true;
    return m;
  }

  const enable = (...ids: AdminPlanFeatureId[]) => {
    for (const id of ids) m[id] = true;
  };

  enable(
    "internal_calendar",
    "services_catalog",
    "business_hours",
    "customers_crm",
    "messages_whatsapp"
  );

  if (code === "pro") {
    enable(
      "google_calendar",
      "analytics_reports",
      "finance_payments",
      "waitlist",
      "reminders",
      "attendance_confirmation",
      "remarketing_campaigns",
      "birthday_campaign",
      "post_visit_feedback",
      "checkin_qr",
      "auto_return",
      "one_click_reschedule",
      "offers_loyalty",
      "google_reviews"
    );
  }

  return m;
}
