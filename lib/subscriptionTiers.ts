import {
  ADMIN_PLAN_FEATURE_GROUPS,
  type AdminPlanFeatureId,
  tierFeaturePreset
} from "@/lib/adminPlanFeatures";

/** Núcleo comercial: tudo que uma empresa precisa para operar agendamentos. */
export const SCHEDULING_BASE_FEATURES: AdminPlanFeatureId[] = [
  "internal_calendar",
  "services_catalog",
  "business_hours",
  "customers_crm"
];

export type SubscriptionTierCode = "free" | "pro" | "enterprise";

export const SUBSCRIPTION_TIER_CATALOG: Record<
  SubscriptionTierCode,
  {
    code: SubscriptionTierCode;
    commercialName: string;
    badge: string;
    tagline: string;
    positioning: string;
  }
> = {
  free: {
    code: "free",
    commercialName: "Agendamento",
    badge: "Essencial",
    tagline: "Agenda, serviços, horários e clientes — operação básica de agendamento.",
    positioning:
      "Plano de entrada para quem precisa receber agendamentos sem automações avançadas nem vitrine."
  },
  pro: {
    code: "pro",
    commercialName: "Profissional",
    badge: "Crescimento",
    tagline:
      "Comunicação, fila de espera, Google Calendar, lembretes, confirmação e site público.",
    positioning:
      "Para negócios que querem reduzir no-show, automatizar comunicação e ter presença online."
  },
  enterprise: {
    code: "enterprise",
    commercialName: "Enterprise",
    badge: "Escala",
    tagline: "Financeiro, análises, fidelidade, remarketing, multi-unidade e automações n8n.",
    positioning:
      "Pacote completo para operação madura, retenção, receita recorrente e múltiplas unidades."
  }
};

export function featureLabel(id: AdminPlanFeatureId): string {
  for (const group of ADMIN_PLAN_FEATURE_GROUPS) {
    const item = group.items.find((entry) => entry.id === id);
    if (item) return item.label;
  }
  return id;
}

/** Áreas do painel do administrador (empresa) → feature exigida. Omitido = incluído no plano base. */
export const OWNER_PANEL_AREA_FEATURE: Partial<
  Record<"analytics" | "messages" | "publicSite" | "finance", AdminPlanFeatureId>
> = {
  analytics: "analytics_reports",
  messages: "messages_whatsapp",
  publicSite: "public_site",
  finance: "finance_payments"
};

export function listEnabledFeatures(
  features: Record<AdminPlanFeatureId, boolean>
): AdminPlanFeatureId[] {
  return (Object.keys(features) as AdminPlanFeatureId[]).filter((id) => features[id]);
}

export function tierPresetFeatures(code: SubscriptionTierCode) {
  return tierFeaturePreset(code);
}
