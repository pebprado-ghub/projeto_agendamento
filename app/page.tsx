"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart2,
  Building2,
  Calendar,
  CalendarX,
  Clock,
  CreditCard,
  DollarSign,
  FolderKanban,
  Globe,
  LayoutDashboard,
  MessageSquare,
  Package,
  Plug,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { FieldGroup } from "@/components/admin/FieldGroup";
import {
  DeveloperBusinessesAgGrid,
  type DeveloperBusinessGridRow
} from "@/components/admin/DeveloperBusinessesAgGrid";
import { BusinessClosureEditor } from "@/components/admin/BusinessClosureEditor";
import {
  DeveloperHourSchedulesAgGrid,
  type HourScheduleGridRow
} from "@/components/admin/DeveloperHourSchedulesAgGrid";
import {
  DeveloperMetricTable,
  type DeveloperMetricBreakdownRow
} from "@/components/admin/DeveloperMetricTable";
import { DeveloperCommunicationHub } from "@/components/admin/DeveloperCommunicationHub";
import { DeveloperPlansAgGrid } from "@/components/admin/DeveloperPlansAgGrid";
import { OwnerServicesAgGrid } from "@/components/admin/OwnerServicesAgGrid";
import { MetricCard } from "@/components/admin/MetricCard";
import { CustomersManager } from "@/components/client/CustomersManager";
import { PublicSiteEditor } from "@/components/client/PublicSiteEditor";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { HelpHint } from "@/components/ui/help-hint";
import { Textarea } from "@/components/ui/textarea";
import { formatMaskedFromDigits, maskCep } from "@/lib/masksBr";
import { lookupViaCep } from "@/lib/viacep";
import { resolveScheduleWeekday } from "@/lib/resolveScheduleWeekday";
import { CNAE_OPTIONS, getCnaeByCode } from "@/lib/cnae";
import { getLocalPriceFactor } from "@/lib/pricingLocal";
import { getBrowserIanaTimezone } from "@/lib/browserTimezone";
import { digitsOnly } from "@/lib/developerContactLinks";
import { repairUtf8MisinterpretedAsLatin1 } from "@/lib/repairMojibake";

function formatDeveloperCalendarModeLabel(mode?: string | null): string {
  if (mode === "google") return "Google";
  if (mode === "internal") return "Interna";
  return "Não definido";
}

const weekDays = [
  { id: 0, label: "Domingo" },
  { id: 1, label: "Segunda" },
  { id: 2, label: "Terca" },
  { id: 3, label: "Quarta" },
  { id: 4, label: "Quinta" },
  { id: 5, label: "Sexta" },
  { id: 6, label: "Sabado" }
];

/** Dias civis + linha 7 = feriados (padrao em datas de feriado nacional/estadual/municipal). */
const weekDaysSchedule = [
  ...weekDays,
  {
    id: 7,
    label: "Feriados"
  }
];

const MESSAGE_TEMPLATE_ORTHOGRAPHY_FIXES: Array<{
  pattern: RegExp;
  replacement: string | ((substring: string, ...args: string[]) => string);
}> = [
  { pattern: /\bOla\b/g, replacement: "Olá" },
  { pattern: /\bola\b/g, replacement: "olá" },
  {
    pattern: /\bhorarios\b/gi,
    replacement: (value) => (value[0] === "H" ? "Horários" : "horários")
  },
  {
    pattern: /\bhorario\b/gi,
    replacement: (value) => (value[0] === "H" ? "Horário" : "horário")
  },
  { pattern: /\bconfirmacao\b/gi, replacement: "confirmação" },
  { pattern: /\bpresenca\b/gi, replacement: "presença" },
  { pattern: /\bproxima\b/gi, replacement: "próxima" },
  { pattern: /\baniversario\b/gi, replacement: "aniversário" },
  { pattern: /\bavaliacao\b/gi, replacement: "avaliação" },
  { pattern: /\bpromocao\b/gi, replacement: "promoção" },
  { pattern: /\bservicos\b/gi, replacement: "serviços" },
  { pattern: /\bvoce\b/gi, replacement: "você" },
  { pattern: /\bduvida\b/gi, replacement: "dúvida" },
  { pattern: /\bate\b/gi, replacement: "até" },
  { pattern: /\besta\b/gi, replacement: "está" },
  { pattern: /\bamanha\b/gi, replacement: "amanhã" },
  { pattern: /\bas\b (?=\{\{inicio\}\})/gi, replacement: "às " },
  { pattern: /\be\b (?=hoje)/gi, replacement: "é " }
];

function normalizeTemplateOrthography(content: string) {
  let normalized = content;
  for (const rule of MESSAGE_TEMPLATE_ORTHOGRAPHY_FIXES) {
    const { pattern, replacement } = rule;
    normalized =
      typeof replacement === "function"
        ? normalized.replace(pattern, replacement)
        : normalized.replace(pattern, replacement);
  }
  return normalized;
}

type ServiceItem = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  icon: string | null;
  color: string | null;
  image_urls: string[];
  display_order: number | null;
  duration_minutes: number;
  price_cents: number | null;
  is_active: boolean;
  booking_buffer_before_minutes: number;
  booking_buffer_after_minutes: number;
  booking_min_notice_minutes: number;
  booking_max_days_ahead: number;
  booking_daily_limit: number | null;
  booking_slot_capacity: number;
  waitlist_enabled: boolean;
  reminder_24h_enabled: boolean;
  reminder_2h_enabled: boolean;
  reminder_30m_enabled: boolean;
  attendance_confirmation_required: boolean;
  attendance_confirmation_deadline_minutes: number;
  auto_release_unconfirmed: boolean;
  booking_reschedule_cutoff_minutes: number;
  booking_cancel_cutoff_minutes: number;
  post_visit_thank_you_enabled: boolean;
  post_visit_coupon_enabled: boolean;
  remarketing_enabled: boolean;
  remarketing_inactive_days: number;
  birthday_campaign_enabled: boolean;
  auto_return_enabled: boolean;
  auto_return_days: number;
  one_click_reschedule_enabled: boolean;
  checkin_qr_enabled: boolean;
  auto_feedback_enabled: boolean;
};

type OfferPlanItem = {
  id: string;
  service_id: string | null;
  name: string;
  offer_type: "package" | "subscription";
  description: string | null;
  price_cents: number;
  sessions_included: number | null;
  billing_cycle_days: number | null;
  is_active: boolean;
};

type AnalyticsReport = {
  period: string;
  performance: {
    occupancyRate: number;
    availableSlots: number;
    bookedSlots: number;
    peakHours: Array<{ hour: number; count: number }>;
    topServices: Array<{ serviceId: string; serviceName: string; soldCount: number }>;
  };
  noShow: {
    overallRate: number;
    totalNoShow: number;
    totalConcluded: number;
    byWeekday: Array<{ weekday: number; noShowRate: number; noShowCount: number; total: number }>;
    byHour: Array<{ hour: number; noShowRate: number; noShowCount: number; total: number }>;
    problematicCustomers: Array<{
      customerId: string;
      customerName: string;
      totalAppointments: number;
      noShowCount: number;
      noShowRate: number;
      isBlocked: boolean;
    }>;
    preventionSuggestion: string;
  };
  demandForecast: {
    promoSuggestions: Array<{ weekday: number; hour: number; demandCount: number; suggestion: string }>;
  };
  campaignRoi: {
    remarketing: { sent: number; converted: number; conversionRate: number };
    newCustomers: { converted: number };
    n8nReady: boolean;
    n8nExpectedEventEndpoint: string;
  };
};

type FinancialCustomersAnalytics = {
  month: string;
  totalPaidCents: number;
  paidCount: number;
  averageTicketCents: number;
  totalDiscountRedeemedCents: number;
  promoPaymentsCount: number;
  promoRevenueCents: number;
  activePackageContracts: number;
  activeSubscriptionContracts: number;
  topLoyaltyOffers: Array<{
    offerId: string;
    offerName: string;
    offerType: string;
    startedCount: number;
  }>;
};

type AnalyticsTrendPoint = {
  month: string;
  occupancyRate: number;
  noShowRate: number;
  remarketingRate: number;
};

type FinancialTrendPoint = {
  month: string;
  totalPaidCents: number;
  totalDiscountRedeemedCents: number;
  promoPaymentsCount: number;
};

type MonetizationPlan = {
  code: string;
  name: string;
  monthly_price_cents: number;
  monthly_appointment_limit: number | null;
  professional_limit: number | null;
  allows_automations: boolean;
  allows_multi_unit: boolean;
  is_active: boolean;
  feature_flags?: Record<string, boolean> | null;
};

type MonetizationUsage = {
  month: string;
  currentAppointments: number;
  planCode: string;
  planStatus: "active" | "trialing" | "past_due" | "cancelled";
  monthlyAppointmentLimit: number | null;
  professionalLimit: number | null;
  automationsEnabled: boolean;
  multiUnitEnabled: boolean;
};

type SubscriptionChangeFeedback = {
  id: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  currentPlanCode: string;
  requestedPlanCode: string;
  requestedByRole: string;
  status: string;
  note: string | null;
  createdAt: string;
};

type SubscriptionFeedbackStatusFilter = "all" | "pending" | "approved" | "rejected" | "cancelled";

type DeveloperBusinessMetrics = {
  id: string;
  name: string;
  slug: string;
  calendarMode: "internal" | "google" | null;
  customerCount: number;
  serviceCount: number;
  appointmentCount: number;
  appointmentsThisMonth: number;
  upcomingAppointmentCount: number;
};

type DeveloperPlatformSummary = {
  businessCount: number;
  internalModeCount: number;
  googleModeCount: number;
  appointmentCount: number;
  appointmentsThisMonth: number;
  upcomingAppointmentCount: number;
  customerCount: number;
  serviceCount: number;
  byBusiness: DeveloperBusinessMetrics[];
};

type DeveloperOverviewTabId = "daily" | "urgencies" | "communication";

type DeveloperDashboardCategoryId = "companies" | "subscriptions" | "integrations";
type CategoryAnalyticsRangeId = "30d" | "60d" | "90d" | "custom";

const DEVELOPER_DASHBOARD_CATEGORY_ITEMS: Array<{
  value: DeveloperDashboardCategoryId;
  label: string;
}> = [
  { value: "companies", label: "Empresas" },
  { value: "subscriptions", label: "Assinaturas" },
  { value: "integrations", label: "Integrações" }
];

const DEVELOPER_OVERVIEW_TAB_ITEMS: Array<{
  value: DeveloperOverviewTabId;
  label: string;
}> = [
  { value: "daily", label: "Operação do dia" },
  { value: "urgencies", label: "Urgências e pendências" },
  { value: "communication", label: "Central de comunicação" }
];

const DEVELOPER_OVERVIEW_ICONS: Record<DeveloperOverviewTabId, LucideIcon> = {
  daily: Calendar,
  urgencies: AlertTriangle,
  communication: MessageSquare
};

const DEVELOPER_OVERVIEW_HINTS: Record<DeveloperOverviewTabId, string> = {
  daily: "Cada linha é uma empresa. Quem está com pouco volume no mês aparece primeiro — revise antes de ampliar campanhas.",
  urgencies: "Conta o que falta para operar bem: WhatsApp, Google, serviços no catálogo e clientes no CRM.",
  communication:
    "Só aparecem empresas com algo a regular: WhatsApp, e-mail de contato ou pedido de mudança de plano pendente."
};

const SERVICE_ICONS = [
  "✂️",
  "🧔",
  "💇",
  "💅",
  "⚖️",
  "📊",
  "🌿",
  "🔧",
  "🎨",
  "📝",
  "💼",
  "🏠",
  "🚗",
  "📱",
  "💻",
  "🎯",
  "⭐",
  "💎",
  "🔥",
  "✨"
];

const SERVICE_COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
  "#10B981",
  "#06B6D4",
  "#6366F1",
  "#EF4444"
];

const SERVICE_TEMPLATES: Record<
  string,
  Array<{
    name: string;
    category: string;
    description?: string;
    duration_minutes: number;
    price_cents: number;
    icon: string;
    color: string;
  }>
> = {
  Barbearia: [
    {
      name: "Corte Masculino",
      category: "Cabelo",
      duration_minutes: 30,
      price_cents: 4000,
      icon: "✂️",
      color: "#3B82F6"
    },
    {
      name: "Barba",
      category: "Barba",
      duration_minutes: 20,
      price_cents: 2500,
      icon: "🧔",
      color: "#10B981"
    },
    {
      name: "Corte + Barba",
      category: "Combo",
      duration_minutes: 50,
      price_cents: 6000,
      icon: "🔥",
      color: "#8B5CF6"
    }
  ],
  "Salão de beleza": [
    {
      name: "Corte Feminino",
      category: "Cabelo",
      duration_minutes: 60,
      price_cents: 8000,
      icon: "💇",
      color: "#EC4899"
    },
    {
      name: "Escova",
      category: "Cabelo",
      duration_minutes: 45,
      price_cents: 5000,
      icon: "✨",
      color: "#3B82F6"
    },
    {
      name: "Manicure",
      category: "Estética",
      duration_minutes: 45,
      price_cents: 3500,
      icon: "💅",
      color: "#F59E0B"
    }
  ],
  Consultoria: [
    {
      name: "Consulta Inicial",
      category: "Consultoria",
      duration_minutes: 60,
      price_cents: 15000,
      icon: "🎯",
      color: "#3B82F6"
    },
    {
      name: "Sessão Estratégica",
      category: "Consultoria",
      duration_minutes: 90,
      price_cents: 25000,
      icon: "💼",
      color: "#8B5CF6"
    }
  ],
  Manicure: [
    {
      name: "Manicure Tradicional",
      category: "Unhas",
      duration_minutes: 45,
      price_cents: 3500,
      icon: "💅",
      color: "#EC4899"
    },
    {
      name: "Pedicure",
      category: "Unhas",
      duration_minutes: 60,
      price_cents: 4500,
      icon: "✨",
      color: "#8B5CF6"
    },
    {
      name: "Esmaltação em Gel",
      category: "Unhas",
      duration_minutes: 70,
      price_cents: 7000,
      icon: "💎",
      color: "#F59E0B"
    }
  ],
  "Designer de sobrancelhas": [
    {
      name: "Design de Sobrancelhas",
      category: "Estética",
      duration_minutes: 35,
      price_cents: 4000,
      icon: "✨",
      color: "#3B82F6"
    },
    {
      name: "Henna",
      category: "Estética",
      duration_minutes: 45,
      price_cents: 5500,
      icon: "🎨",
      color: "#8B5CF6"
    },
    {
      name: "Lash Lifting",
      category: "Estética",
      duration_minutes: 60,
      price_cents: 9000,
      icon: "⭐",
      color: "#EC4899"
    }
  ],
  Massoterapia: [
    {
      name: "Massagem Relaxante",
      category: "Massagem",
      duration_minutes: 60,
      price_cents: 12000,
      icon: "🌿",
      color: "#10B981"
    },
    {
      name: "Massagem Terapêutica",
      category: "Massagem",
      duration_minutes: 60,
      price_cents: 15000,
      icon: "💆",
      color: "#3B82F6"
    },
    {
      name: "Drenagem Linfática",
      category: "Massagem",
      duration_minutes: 75,
      price_cents: 18000,
      icon: "✨",
      color: "#06B6D4"
    }
  ],
  Psicologia: [
    {
      name: "Sessão Individual",
      category: "Consulta",
      duration_minutes: 50,
      price_cents: 18000,
      icon: "🧠",
      color: "#6366F1"
    },
    {
      name: "Primeira Consulta",
      category: "Consulta",
      duration_minutes: 60,
      price_cents: 22000,
      icon: "💬",
      color: "#8B5CF6"
    }
  ],
  Nutrição: [
    {
      name: "Consulta Nutricional",
      category: "Consulta",
      duration_minutes: 60,
      price_cents: 20000,
      icon: "🥗",
      color: "#10B981"
    },
    {
      name: "Retorno Nutricional",
      category: "Consulta",
      duration_minutes: 40,
      price_cents: 14000,
      icon: "📈",
      color: "#3B82F6"
    }
  ],
  "Personal Trainer": [
    {
      name: "Treino Presencial",
      category: "Treino",
      duration_minutes: 60,
      price_cents: 12000,
      icon: "💪",
      color: "#EF4444"
    },
    {
      name: "Avaliação Física",
      category: "Avaliação",
      duration_minutes: 45,
      price_cents: 10000,
      icon: "📏",
      color: "#6366F1"
    }
  ],
  Fotografia: [
    {
      name: "Ensaio Individual",
      category: "Ensaio",
      duration_minutes: 90,
      price_cents: 35000,
      icon: "📸",
      color: "#3B82F6"
    },
    {
      name: "Cobertura de Evento",
      category: "Evento",
      duration_minutes: 240,
      price_cents: 80000,
      icon: "🎥",
      color: "#8B5CF6"
    }
  ],
  Tatuagem: [
    {
      name: "Tattoo Pequena",
      category: "Tattoo",
      duration_minutes: 90,
      price_cents: 30000,
      icon: "🖋️",
      color: "#3B82F6"
    },
    {
      name: "Tattoo Média",
      category: "Tattoo",
      duration_minutes: 180,
      price_cents: 65000,
      icon: "🎨",
      color: "#EF4444"
    }
  ],
  Eletricista: [
    {
      name: "Visita Técnica",
      category: "Atendimento",
      duration_minutes: 45,
      price_cents: 12000,
      icon: "⚡",
      color: "#F59E0B"
    },
    {
      name: "Instalação de Tomada",
      category: "Serviço",
      duration_minutes: 60,
      price_cents: 18000,
      icon: "🔧",
      color: "#3B82F6"
    }
  ],
  Encanador: [
    {
      name: "Visita Técnica",
      category: "Atendimento",
      duration_minutes: 45,
      price_cents: 12000,
      icon: "🔧",
      color: "#06B6D4"
    },
    {
      name: "Reparo de Vazamento",
      category: "Serviço",
      duration_minutes: 90,
      price_cents: 25000,
      icon: "💧",
      color: "#3B82F6"
    }
  ]
};

type ServiceTemplateItem = {
  name: string;
  category: string;
  description?: string;
  duration_minutes: number;
  price_cents: number;
  icon: string;
  color: string;
};

type BusinessDayShift = {
  id: string;
  startTime: string;
  endTime: string;
};

type BusinessHourValidityTypeId =
  | "indeterminate"
  | "monthly"
  | "annual"
  | "custom";

const HOUR_VALIDITY_LABEL: Record<BusinessHourValidityTypeId, string> = {
  indeterminate: "Indeterminada",
  monthly: "Mensal",
  annual: "Anual",
  custom: "Personalizado"
};

function hourValidityLabel(t: string): string {
  return HOUR_VALIDITY_LABEL[t as BusinessHourValidityTypeId] ?? t;
}

type BusinessHoursState = {
  weekday: number;
  isActive: boolean;
  shifts: BusinessDayShift[];
};

type BusinessHourApiRow = {
  weekday: number;
  start_time: string;
  end_time: string;
  lunch_start_time?: string | null;
  lunch_end_time?: string | null;
  is_active: boolean;
  sort_order?: number | null;
};

function newShiftClientId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `shift-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
}

function createDefaultShift(): BusinessDayShift {
  return { id: newShiftClientId(), startTime: "09:00", endTime: "18:00" };
}

function rowsToDayState(rows: BusinessHourApiRow[]): {
  isActive: boolean;
  shifts: BusinessDayShift[];
} {
  if (!rows.length) {
    return { isActive: false, shifts: [createDefaultShift()] };
  }
  const sorted = [...rows].sort(
    (a, b) =>
      (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) ||
      String(a.start_time).localeCompare(String(b.start_time))
  );
  const activeRows = sorted.filter((r) => r.is_active);
  if (!activeRows.length) {
    return { isActive: false, shifts: [createDefaultShift()] };
  }
  if (
    activeRows.length === 1 &&
    activeRows[0].lunch_start_time &&
    activeRows[0].lunch_end_time
  ) {
    const r = activeRows[0];
    return {
      isActive: true,
      shifts: [
        {
          id: newShiftClientId(),
          startTime: String(r.start_time).slice(0, 5),
          endTime: String(r.lunch_start_time).slice(0, 5)
        },
        {
          id: newShiftClientId(),
          startTime: String(r.lunch_end_time).slice(0, 5),
          endTime: String(r.end_time).slice(0, 5)
        }
      ]
    };
  }
  return {
    isActive: true,
    shifts: activeRows.map((r) => ({
      id: newShiftClientId(),
      startTime: String(r.start_time).slice(0, 5),
      endTime: String(r.end_time).slice(0, 5)
    }))
  };
}

type AppointmentSummary = {
  id: string;
  service_id?: string | null;
  starts_at: string;
  ends_at: string;
  customer_name: string | null;
  customer_phone: string;
  status: string;
  booked_for_name?: string | null;
  booked_for_relationship?: string | null;
  booked_for_phone?: string | null;
  checked_in_at?: string | null;
  feedback_sent_at?: string | null;
};

type CnpjLookupData = {
  legalName: string;
  tradeName: string;
  addressLine: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  cnaeCode: string;
  cnaeDescription: string;
};

type CnpjApplySelection = {
  legalName: boolean;
  tradeName: boolean;
  addressLine: boolean;
  addressNumber: boolean;
  addressComplement: boolean;
  neighborhood: boolean;
  city: boolean;
  state: boolean;
  postalCode: boolean;
  cnae: boolean;
};

const DEFAULT_CNPJ_APPLY_SELECTION: CnpjApplySelection = {
  legalName: true,
  tradeName: true,
  addressLine: true,
  addressNumber: true,
  addressComplement: true,
  neighborhood: true,
  city: true,
  state: true,
  postalCode: true,
  cnae: true
};

function maskCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskPhoneBr(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
}

function formatDatePtBr(dateIso: string) {
  const date = new Date(`${dateIso}T12:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function addDays(dateIso: string, days: number) {
  const date = new Date(`${dateIso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1, 12));
  date.setUTCMonth(date.getUTCMonth() + delta);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthPt(month: string) {
  const date = new Date(`${month}-01T12:00:00Z`);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(date);
}

/** Avança ou retrocede meses mantendo o dia quando possível (ex.: 31 jan → fev último dia). */
function addMonths(dateIso: string, delta: number) {
  const date = new Date(`${dateIso}T12:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + delta);
  if (date.getUTCDate() < day) {
    date.setUTCDate(0);
  }
  return date.toISOString().slice(0, 10);
}

function getPeriodBounds(anchorDateIso: string, mode: "day" | "week" | "month") {
  const anchor = new Date(`${anchorDateIso}T12:00:00Z`);
  if (mode === "day") {
    const date = anchor.toISOString().slice(0, 10);
    return { startDate: date, endDate: date };
  }
  if (mode === "week") {
    const day = anchor.getUTCDay();
    const start = new Date(anchor);
    start.setUTCDate(anchor.getUTCDate() - day);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10)
    };
  }
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 12));
  const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 12));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

/** Indica se a data de hoje cai no período exibido (dia / semana dom–sáb / mês civil). */
function isTodayInCalendarPeriod(
  anchorDateIso: string,
  mode: "day" | "week" | "month",
  todayIso: string
): boolean {
  if (mode === "day") {
    return anchorDateIso === todayIso;
  }
  const bounds = getPeriodBounds(anchorDateIso, mode);
  return todayIso >= bounds.startDate && todayIso <= bounds.endDate;
}

function getCalendarStepDays(mode: "day" | "week") {
  return mode === "day" ? 1 : 7;
}

function shiftCalendarAnchor(
  anchorDateIso: string,
  direction: -1 | 1,
  mode: "day" | "week" | "month"
) {
  if (mode === "month") {
    return addMonths(anchorDateIso, direction);
  }
  return addDays(anchorDateIso, direction * getCalendarStepDays(mode));
}

function getWeekDays(anchorDateIso: string) {
  const bounds = getPeriodBounds(anchorDateIso, "week");
  return Array.from({ length: 7 }, (_, index) => addDays(bounds.startDate, index));
}

type MonthGridCell =
  | { kind: "pad" }
  | { kind: "day"; dateIso: string };

/** Grade só com dias do mês do anchor; encostes vazios alinham domingo–sábado (sem dias de outros meses). */
function getMonthGridCells(anchorDateIso: string): MonthGridCell[] {
  const anchor = new Date(`${anchorDateIso}T12:00:00Z`);
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0, 12)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(y, m, 1, 12)).getUTCDay();

  const cells: MonthGridCell[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ kind: "pad" });
  }
  for (let d = 1; d <= lastDay; d++) {
    cells.push({
      kind: "day",
      dateIso: new Date(Date.UTC(y, m, d, 12)).toISOString().slice(0, 10)
    });
  }
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      cells.push({ kind: "pad" });
    }
  }
  return cells;
}

function getAppointmentStatusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "Pendente",
    confirmed: "Confirmado",
    cancelled: "Cancelado",
    completed: "Concluido",
    no_show: "Nao compareceu"
  };
  return map[status] || status;
}

function toMinutesFromHHMM(value: string) {
  const [hh, mm] = value.slice(0, 5).split(":").map(Number);
  return hh * 60 + mm;
}

export default function HomePage() {
  const router = useRouter();
  const [role, setRole] = useState<"developer" | "owner" | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  /** Evita mostrar o aviso de .env em Clientes antes de loadBusinesses terminar (corrida após login). */
  const [businessContextReady, setBusinessContextReady] = useState(false);
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [greetingTemplate, setGreetingTemplate] = useState(
    "Olá! Bem-vindo(a). Digite 1 para agendar, 2 para reagendar, 3 para cancelar."
  );
  const [confirmationTemplate, setConfirmationTemplate] = useState(
    "Seu horário foi confirmado. Qualquer dúvida, responda esta mensagem."
  );
  const [cancelTemplate, setCancelTemplate] = useState(
    "Olá, {{cliente}}. Seu agendamento foi cancelado. Se desejar, responda esta mensagem para reagendar."
  );
  const [shiftEarlierShortTemplate, setShiftEarlierShortTemplate] = useState(
    "Olá, {{cliente}}. Seu horário foi adiantado em {{minutos}} minutos. Novo horário: {{data}} {{inicio}} até {{fim}}."
  );
  const [shiftEarlierLongTemplate, setShiftEarlierLongTemplate] = useState(
    "Olá, {{cliente}}. Precisamos adiantar seu atendimento em {{minutos}} minutos por ajuste operacional. Novo horário: {{data}} {{inicio}} até {{fim}}."
  );
  const [shiftLaterShortTemplate, setShiftLaterShortTemplate] = useState(
    "Olá, {{cliente}}. Seu horário foi atrasado em {{minutos}} minutos. Novo horário: {{data}} {{inicio}} até {{fim}}."
  );
  const [shiftLaterLongTemplate, setShiftLaterLongTemplate] = useState(
    "Olá, {{cliente}}. Precisamos atrasar seu atendimento em {{minutos}} minutos por ajuste operacional. Novo horário: {{data}} {{inicio}} até {{fim}}."
  );
  const [shiftTemplateThresholdMinutes, setShiftTemplateThresholdMinutes] = useState("15");
  const [appointmentReminder24hTemplate, setAppointmentReminder24hTemplate] = useState(
    "Lembrete: seu agendamento é amanhã, {{data}} às {{inicio}}."
  );
  const [appointmentReminder2hTemplate, setAppointmentReminder2hTemplate] = useState(
    "Lembrete: seu atendimento é hoje às {{inicio}}."
  );
  const [appointmentReminder30mTemplate, setAppointmentReminder30mTemplate] = useState(
    "Faltam 30 minutos para seu atendimento ({{inicio}}). Está a caminho?"
  );
  const [attendanceConfirm24hTemplate, setAttendanceConfirm24hTemplate] = useState(
    "Confirme sua presença para o atendimento de {{data}} {{inicio}} respondendo SIM."
  );
  const [autoReleaseUnconfirmedTemplate, setAutoReleaseUnconfirmedTemplate] = useState(
    "Seu horário de {{data}} {{inicio}} foi liberado por falta de confirmação. Responda para reagendar."
  );
  const [postVisitThankYouReviewTemplate, setPostVisitThankYouReviewTemplate] = useState(
    "Obrigado pela visita, {{cliente}}! Sua avaliação é muito importante para nós."
  );
  const [postVisitCouponTemplate, setPostVisitCouponTemplate] = useState(
    "Temos um cupom especial para sua próxima visita: {{cupom}}. Válido até {{validade}}."
  );
  const [remarketingInactive30dTemplate, setRemarketingInactive30dTemplate] = useState(
    "Oi, {{cliente}}! Faz 30 dias desde sua última visita. Que tal agendar um novo horário?"
  );
  const [remarketingPromoTemplate, setRemarketingPromoTemplate] = useState(
    "Promoção especial para você, {{cliente}}! Responda para conhecer as condições e agendar."
  );
  const [birthdayMessageTemplate, setBirthdayMessageTemplate] = useState(
    "Feliz aniversário, {{cliente}}! Preparamos um desconto/brinde especial para você."
  );
  const [waServiceMenuPrompt, setWaServiceMenuPrompt] = useState(
    "Escolha um servico:"
  );
  const [waSlotMenuPrompt, setWaSlotMenuPrompt] = useState(
    "Horários disponíveis. Escolha um horário:"
  );
  const [waServiceOptionTitleTemplate, setWaServiceOptionTitleTemplate] = useState(
    "{{servico}}"
  );
  const [waSlotOptionTitleTemplate, setWaSlotOptionTitleTemplate] = useState(
    "{{hora}}"
  );
  const [waServiceOptionDescriptionTemplate, setWaServiceOptionDescriptionTemplate] =
    useState("{{duracao}} min");
  const [waSlotOptionDescriptionTemplate, setWaSlotOptionDescriptionTemplate] =
    useState("{{data}}");
  const [messageTemplateFeedback, setMessageTemplateFeedback] = useState("");
  const [messageTemplateEditable, setMessageTemplateEditable] = useState<
    Record<string, boolean>
  >({});
  const [messageSectionOpen, setMessageSectionOpen] = useState<Record<string, boolean>>({
    greetings: true,
    confirmations: false,
    shifts: false,
    whatsapp: false,
    campaigns: false,
    reputation: false
  });
  const [hoursSettingsSectionOpen, setHoursSettingsSectionOpen] = useState({
    schedule: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | "">(
    ""
  );
  type DeveloperBusinessFormSection =
    | "identificacao"
    | "endereco"
    | "contato"
    | "integracao"
    | "operacao";
  const [developerBusinessFormSection, setDeveloperBusinessFormSection] =
    useState<DeveloperBusinessFormSection | null>("identificacao");
  const [developerNewBusinessModalOpen, setDeveloperNewBusinessModalOpen] = useState(false);
  const [developerBusinessModalMode, setDeveloperBusinessModalMode] = useState<"create" | "edit">(
    "create"
  );
  /** Novo cadastro: não autoselecionar empresa na lista nem hidratar o form a partir do tenant. */
  const [developerBusinessCreatingNew, setDeveloperBusinessCreatingNew] = useState(false);
  /** Restaura o contexto ao fechar o modal de nova empresa sem salvar. */
  const [businessIdBeforeNewModal, setBusinessIdBeforeNewModal] = useState<string | null>(null);
  const [developerBusinessRequiredFieldErrors, setDeveloperBusinessRequiredFieldErrors] =
    useState<Partial<Record<"name" | "cnaeCode", string>>>({});
  const [businesses, setBusinesses] = useState<
    Array<{
      id: string;
      name: string;
      slug: string;
      timezone: string;
      calendar_mode?: "internal" | "google";
      whatsapp_number?: string | null;
      cnpj?: string | null;
      legal_name?: string | null;
      trade_name?: string | null;
      address_line?: string | null;
      address_number?: string | null;
      address_complement?: string | null;
      neighborhood?: string | null;
      postal_code?: string | null;
      contact_name?: string | null;
      contact_phone?: string | null;
      contact_email?: string | null;
      cnae_code?: string | null;
      cnae_description?: string | null;
      city?: string | null;
      state?: string | null;
      booking_buffer_before_minutes?: number | null;
      booking_buffer_after_minutes?: number | null;
      booking_min_notice_minutes?: number | null;
      booking_max_days_ahead?: number | null;
      booking_daily_limit?: number | null;
      booking_slot_capacity?: number | null;
      waitlist_enabled?: boolean | null;
      reminder_24h_enabled?: boolean | null;
      reminder_2h_enabled?: boolean | null;
      reminder_30m_enabled?: boolean | null;
      attendance_confirmation_required?: boolean | null;
      attendance_confirmation_deadline_minutes?: number | null;
      auto_release_unconfirmed?: boolean | null;
      post_visit_thank_you_enabled?: boolean | null;
      post_visit_coupon_enabled?: boolean | null;
      remarketing_enabled?: boolean | null;
      remarketing_inactive_days?: number | null;
      birthday_campaign_enabled?: boolean | null;
      auto_return_enabled?: boolean | null;
      auto_return_days?: number | null;
      one_click_reschedule_enabled?: boolean | null;
      checkin_qr_enabled?: boolean | null;
      auto_feedback_enabled?: boolean | null;
      google_reviews_enabled?: boolean | null;
      google_reviews_url?: string | null;
      subscription_plan_code?: "free" | "pro" | "enterprise" | null;
      subscription_status?: "active" | "trialing" | "past_due" | "cancelled" | null;
      monthly_appointment_limit?: number | null;
      professional_limit?: number | null;
      automations_enabled?: boolean | null;
      multi_unit_enabled?: boolean | null;
      booking_reschedule_cutoff_minutes?: number | null;
      booking_cancel_cutoff_minutes?: number | null;
      created_at?: string | null;
    }>
  >([]);
  const [cnpj, setCnpj] = useState("");
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [cnaeCode, setCnaeCode] = useState("");
  const [cnaeDescription, setCnaeDescription] = useState("");
  const [cnpjLookupLoading, setCnpjLookupLoading] = useState(false);
  const [cnpjLookupFeedback, setCnpjLookupFeedback] = useState("");
  const [cnpjLookupPreview, setCnpjLookupPreview] = useState<CnpjLookupData | null>(null);
  const [cnpjApplySelection, setCnpjApplySelection] = useState<CnpjApplySelection>(
    DEFAULT_CNPJ_APPLY_SELECTION
  );
  const [cepFeedback, setCepFeedback] = useState("");
  const [lastFetchedCep, setLastFetchedCep] = useState("");
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  /** UUID do negócio fixo para login do administrador do negócio (via /api/auth/me + OWNER_BUSINESS_ID ou CLIENT_BUSINESS_ID). */
  const [primaryTenantBusinessId, setPrimaryTenantBusinessId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [serviceName, setServiceName] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceIcon, setServiceIcon] = useState("✂️");
  const [serviceColor, setServiceColor] = useState("#3B82F6");
  const [serviceImages, setServiceImages] = useState<string[]>([]);
  const [serviceDuration, setServiceDuration] = useState("30");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceModalMode, setServiceModalMode] = useState<"create" | "edit">("create");
  const [serviceModalTab, setServiceModalTab] = useState<"info" | "agenda" | "visual">(
    "info"
  );
  const [serviceTemplatePreviewName, setServiceTemplatePreviewName] = useState("");
  const [serviceTemplatePreviewItems, setServiceTemplatePreviewItems] = useState<
    Array<ServiceTemplateItem & { selected: boolean }>
  >([]);
  const [serviceFeedback, setServiceFeedback] = useState("");
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingIcon, setEditingIcon] = useState("✂️");
  const [editingColor, setEditingColor] = useState("#3B82F6");
  const [editingImages, setEditingImages] = useState<string[]>([]);
  const [editingDuration, setEditingDuration] = useState("30");
  const [editingPrice, setEditingPrice] = useState("");
  const [serviceBookingBufferBefore, setServiceBookingBufferBefore] = useState("0");
  const [serviceBookingBufferAfter, setServiceBookingBufferAfter] = useState("0");
  const [serviceBookingMinNotice, setServiceBookingMinNotice] = useState("0");
  const [serviceBookingMaxDays, setServiceBookingMaxDays] = useState("60");
  const [serviceBookingDailyLimit, setServiceBookingDailyLimit] = useState("");
  const [serviceBookingSlotCapacity, setServiceBookingSlotCapacity] = useState("1");
  const [serviceWaitlistEnabled, setServiceWaitlistEnabled] = useState(true);
  const [serviceReminder24h, setServiceReminder24h] = useState(true);
  const [serviceReminder2h, setServiceReminder2h] = useState(true);
  const [serviceReminder30m, setServiceReminder30m] = useState(true);
  const [serviceAttendanceRequired, setServiceAttendanceRequired] = useState(true);
  const [serviceAttendanceDeadline, setServiceAttendanceDeadline] = useState("1440");
  const [serviceAutoRelease, setServiceAutoRelease] = useState(true);
  const [editingBookingBufferBefore, setEditingBookingBufferBefore] = useState("0");
  const [editingBookingBufferAfter, setEditingBookingBufferAfter] = useState("0");
  const [editingBookingMinNotice, setEditingBookingMinNotice] = useState("0");
  const [editingBookingMaxDays, setEditingBookingMaxDays] = useState("60");
  const [editingBookingDailyLimit, setEditingBookingDailyLimit] = useState("");
  const [editingBookingSlotCapacity, setEditingBookingSlotCapacity] = useState("1");
  const [editingWaitlistEnabled, setEditingWaitlistEnabled] = useState(true);
  const [editingReminder24h, setEditingReminder24h] = useState(true);
  const [editingReminder2h, setEditingReminder2h] = useState(true);
  const [editingReminder30m, setEditingReminder30m] = useState(true);
  const [editingAttendanceRequired, setEditingAttendanceRequired] = useState(true);
  const [editingAttendanceDeadline, setEditingAttendanceDeadline] = useState("1440");
  const [editingAutoRelease, setEditingAutoRelease] = useState(true);
  const [serviceRescheduleCutoff, setServiceRescheduleCutoff] = useState("0");
  const [serviceCancelCutoff, setServiceCancelCutoff] = useState("0");
  const [servicePostVisitThankYou, setServicePostVisitThankYou] = useState(true);
  const [servicePostVisitCoupon, setServicePostVisitCoupon] = useState(true);
  const [serviceRemarketing, setServiceRemarketing] = useState(true);
  const [serviceRemarketingInactiveDays, setServiceRemarketingInactiveDays] = useState("30");
  const [serviceBirthday, setServiceBirthday] = useState(true);
  const [serviceAutoReturn, setServiceAutoReturn] = useState(true);
  const [serviceAutoReturnDays, setServiceAutoReturnDays] = useState("30");
  const [serviceOneClickReschedule, setServiceOneClickReschedule] = useState(true);
  const [serviceCheckinQr, setServiceCheckinQr] = useState(true);
  const [serviceAutoFeedback, setServiceAutoFeedback] = useState(false);
  const [editingRescheduleCutoff, setEditingRescheduleCutoff] = useState("0");
  const [editingCancelCutoff, setEditingCancelCutoff] = useState("0");
  const [editingPostVisitThankYou, setEditingPostVisitThankYou] = useState(true);
  const [editingPostVisitCoupon, setEditingPostVisitCoupon] = useState(true);
  const [editingRemarketing, setEditingRemarketing] = useState(true);
  const [editingRemarketingInactiveDays, setEditingRemarketingInactiveDays] = useState("30");
  const [editingBirthday, setEditingBirthday] = useState(true);
  const [editingAutoReturn, setEditingAutoReturn] = useState(true);
  const [editingAutoReturnDays, setEditingAutoReturnDays] = useState("30");
  const [editingOneClickReschedule, setEditingOneClickReschedule] = useState(true);
  const [editingCheckinQr, setEditingCheckinQr] = useState(true);
  const [editingAutoFeedback, setEditingAutoFeedback] = useState(false);
  const [serviceUploadLoading, setServiceUploadLoading] = useState(false);
  const [calendarId, setCalendarId] = useState("primary");
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [tokenExpiresAt, setTokenExpiresAt] = useState("");
  const [calendarFeedback, setCalendarFeedback] = useState("");
  const [calendarMode, setCalendarMode] = useState<"internal" | "google">(
    "internal"
  );
  const [businessHours, setBusinessHours] = useState<BusinessHoursState[]>(
    weekDaysSchedule.map((day) => ({
      weekday: day.id,
      isActive: day.id >= 1 && day.id <= 5,
      shifts: [createDefaultShift()]
    }))
  );
  const [hourScheduleId, setHourScheduleId] = useState<string | null>(null);
  const [hourValidityType, setHourValidityType] =
    useState<BusinessHourValidityTypeId>("indeterminate");
  const [hourCustomFrom, setHourCustomFrom] = useState("");
  const [hourCustomTo, setHourCustomTo] = useState("");
  const [hourSchedulesList, setHourSchedulesList] = useState<
    Array<{
      id: string;
      validityType: string;
      validFrom: string;
      validTo: string | null;
      createdAt: string;
      updatedAt: string;
      isVigenteHoje: boolean;
    }>
  >([]);
  const [hourScheduleGaps, setHourScheduleGaps] = useState<Array<{ from: string; to: string }>>(
    []
  );
  const [hourScheduleOverlapPrompt, setHourScheduleOverlapPrompt] = useState<null | {
    message: string;
    overlapping: Array<{
      id: string;
      validityType: string;
      validFrom: string;
      validTo: string | null;
    }>;
  }>(null);
  const [hourScheduleModalOpen, setHourScheduleModalOpen] = useState(false);
  const [hourScheduleModalMode, setHourScheduleModalMode] = useState<"create" | "edit">(
    "create"
  );
  const [closureModalOpen, setClosureModalOpen] = useState(false);
  const [hoursFeedback, setHoursFeedback] = useState("");
  const [googleReviewsEnabled, setGoogleReviewsEnabled] = useState(false);
  const [googleReviewsUrl, setGoogleReviewsUrl] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [developerArea, setDeveloperArea] = useState<"configuration" | "dashboard">(
    "dashboard"
  );
  const [configurationArea, setConfigurationArea] = useState<
    "business" | "plans" | "integrations"
  >("business");
  const [dashboardArea, setDashboardArea] = useState<
    "overview" | "categories" | "communication"
  >("overview");
  const [developerDashboardCategory, setDeveloperDashboardCategory] =
    useState<DeveloperDashboardCategoryId>("companies");
  const [categoryAnalyticsRange, setCategoryAnalyticsRange] =
    useState<CategoryAnalyticsRangeId>("30d");
  const [categoryAnalyticsStartDate, setCategoryAnalyticsStartDate] = useState("");
  const [categoryAnalyticsEndDate, setCategoryAnalyticsEndDate] = useState("");
  const [categoryPeriodLayerOpen, setCategoryPeriodLayerOpen] = useState(false);
  const [clientMainArea, setClientMainArea] = useState<"dashboard" | "settings">(
    "dashboard"
  );
  const [clientDashboardArea, setClientDashboardArea] = useState<
    "overview" | "analytics" | "agenda" | "subscription"
  >("overview");
  const [clientSettingsArea, setClientSettingsArea] = useState<
    "messages" | "services" | "hours" | "customers" | "finance" | "publicSite"
  >("messages");
  const [clientCalendarView, setClientCalendarView] = useState<"day" | "week" | "month">(
    "week"
  );
  const [clientCalendarAnchorDate, setClientCalendarAnchorDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [clientAppointments, setClientAppointments] = useState<AppointmentSummary[]>([]);
  const [clientAppointmentsLoading, setClientAppointmentsLoading] = useState(false);
  const [clientCalendarSelectedDate, setClientCalendarSelectedDate] = useState<string | null>(
    null
  );
  const [appointmentShiftMinutes, setAppointmentShiftMinutes] = useState("15");
  const [appointmentActionFeedback, setAppointmentActionFeedback] = useState("");
  const [lastCheckinUrl, setLastCheckinUrl] = useState("");
  const [appointmentActionLoadingId, setAppointmentActionLoadingId] = useState<string | null>(
    null
  );
  const [holidayNamesByDate, setHolidayNamesByDate] = useState<Record<string, string[]>>({});
  const [holidayWorkingDaySet, setHolidayWorkingDaySet] = useState<Set<string>>(new Set());
  const [holidayToggleLoading, setHolidayToggleLoading] = useState(false);
  const [businessPickerOpen, setBusinessPickerOpen] = useState(false);
  const [businessQuery, setBusinessQuery] = useState("");
  const [financialMonth, setFinancialMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monetizationPlans, setMonetizationPlans] = useState<MonetizationPlan[]>([]);
  const [subscriptionChangeFeedbacks, setSubscriptionChangeFeedbacks] = useState<
    SubscriptionChangeFeedback[]
  >([]);
  const [subscriptionChangeFeedbacksError, setSubscriptionChangeFeedbacksError] = useState("");
  const [subscriptionFeedbackStatusFilter, setSubscriptionFeedbackStatusFilter] =
    useState<SubscriptionFeedbackStatusFilter>("all");
  const [monetizationUsage, setMonetizationUsage] = useState<MonetizationUsage | null>(null);
  const [overviewMonetizationUsage, setOverviewMonetizationUsage] =
    useState<MonetizationUsage | null>(null);
  const [developerPlatformSummary, setDeveloperPlatformSummary] =
    useState<DeveloperPlatformSummary | null>(null);
  const [developerPlatformSummaryLoading, setDeveloperPlatformSummaryLoading] =
    useState(false);
  const [developerPlatformSummaryError, setDeveloperPlatformSummaryError] =
    useState("");
  const [developerCommunicationFocusBusinessId, setDeveloperCommunicationFocusBusinessId] =
    useState<string | null>(null);
  const [planCode, setPlanCode] = useState<"free" | "pro" | "enterprise">("free");
  const [planStatus, setPlanStatus] = useState<"active" | "trialing" | "past_due" | "cancelled">(
    "active"
  );
  const [planMonthlyLimit, setPlanMonthlyLimit] = useState("");
  const [planProfessionalLimit, setPlanProfessionalLimit] = useState("");
  const [planAutomationsEnabled, setPlanAutomationsEnabled] = useState(false);
  const [planMultiUnitEnabled, setPlanMultiUnitEnabled] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [requestedPlanCode, setRequestedPlanCode] = useState<string>("free");
  const [subscriptionRequestNote, setSubscriptionRequestNote] = useState("");
  const [subscriptionRequestFeedback, setSubscriptionRequestFeedback] = useState("");
  const [subscriptionRequestSaving, setSubscriptionRequestSaving] = useState(false);
  const [ownerSubscriptionFeedbacks, setOwnerSubscriptionFeedbacks] = useState<
    SubscriptionChangeFeedback[]
  >([]);
  const [ownerSubscriptionFeedbacksError, setOwnerSubscriptionFeedbacksError] = useState("");
  const [ownerSubscriptionFeedbackStatusFilter, setOwnerSubscriptionFeedbackStatusFilter] =
    useState<SubscriptionFeedbackStatusFilter>("all");
  const [offerPlans, setOfferPlans] = useState<OfferPlanItem[]>([]);
  const [offerFeedback, setOfferFeedback] = useState("");
  const [offerName, setOfferName] = useState("");
  const [offerType, setOfferType] = useState<"package" | "subscription">("package");
  const [offerServiceId, setOfferServiceId] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [offerSessionsIncluded, setOfferSessionsIncluded] = useState("");
  const [offerBillingCycleDays, setOfferBillingCycleDays] = useState("30");
  const [billingRunFeedback, setBillingRunFeedback] = useState("");
  const [analyticsMonth, setAnalyticsMonth] = useState(new Date().toISOString().slice(0, 7));
  const [analyticsReport, setAnalyticsReport] = useState<AnalyticsReport | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [financialCustomersAnalytics, setFinancialCustomersAnalytics] =
    useState<FinancialCustomersAnalytics | null>(null);
  const [financialCustomersLoading, setFinancialCustomersLoading] = useState(false);
  const [financialCustomersError, setFinancialCustomersError] = useState("");
  const [analyticsTrendPoints, setAnalyticsTrendPoints] = useState<AnalyticsTrendPoint[]>([]);
  const [analyticsTrendLoading, setAnalyticsTrendLoading] = useState(false);
  const [analyticsTrendError, setAnalyticsTrendError] = useState("");
  const [financialTrendPoints, setFinancialTrendPoints] = useState<FinancialTrendPoint[]>([]);
  const [financialTrendLoading, setFinancialTrendLoading] = useState(false);
  const [financialTrendError, setFinancialTrendError] = useState("");
  const [analyticsKpiViewMode, setAnalyticsKpiViewMode] = useState<"chart" | "table">("chart");
  const [analyticsFinancialViewMode, setAnalyticsFinancialViewMode] =
    useState<"chart" | "table">("chart");

  type BusinessRow = {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    calendar_mode?: "internal" | "google";
    whatsapp_number?: string | null;
    cnpj?: string | null;
    legal_name?: string | null;
    trade_name?: string | null;
    address_line?: string | null;
    address_number?: string | null;
    address_complement?: string | null;
    neighborhood?: string | null;
    postal_code?: string | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
    cnae_code?: string | null;
    cnae_description?: string | null;
    city?: string | null;
    state?: string | null;
    booking_buffer_before_minutes?: number | null;
    booking_buffer_after_minutes?: number | null;
    booking_min_notice_minutes?: number | null;
    booking_max_days_ahead?: number | null;
    booking_daily_limit?: number | null;
    booking_slot_capacity?: number | null;
    waitlist_enabled?: boolean | null;
    reminder_24h_enabled?: boolean | null;
    reminder_2h_enabled?: boolean | null;
    reminder_30m_enabled?: boolean | null;
    attendance_confirmation_required?: boolean | null;
    attendance_confirmation_deadline_minutes?: number | null;
    auto_release_unconfirmed?: boolean | null;
    post_visit_thank_you_enabled?: boolean | null;
    post_visit_coupon_enabled?: boolean | null;
    remarketing_enabled?: boolean | null;
    remarketing_inactive_days?: number | null;
    birthday_campaign_enabled?: boolean | null;
    auto_return_enabled?: boolean | null;
    auto_return_days?: number | null;
    one_click_reschedule_enabled?: boolean | null;
    checkin_qr_enabled?: boolean | null;
    auto_feedback_enabled?: boolean | null;
    google_reviews_enabled?: boolean | null;
    google_reviews_url?: string | null;
    subscription_plan_code?: "free" | "pro" | "enterprise" | null;
    subscription_status?: "active" | "trialing" | "past_due" | "cancelled" | null;
    monthly_appointment_limit?: number | null;
    professional_limit?: number | null;
    automations_enabled?: boolean | null;
    multi_unit_enabled?: boolean | null;
    booking_reschedule_cutoff_minutes?: number | null;
    booking_cancel_cutoff_minutes?: number | null;
    created_at?: string | null;
  };

  async function loadBusinesses() {
    if (!role) {
      return;
    }

    try {
    if (role === "owner") {
      let bid = primaryTenantBusinessId;

      // Se /api/auth/me não devolveu businessId, tenta o mesmo critério no cliente:
      // um único negócio na lista = associação automática (vários = exige OWNER_/CLIENT_BUSINESS_ID).
      if (!bid) {
        const listResponse = await fetch(`/api/businesses`);
        const listResult = (await listResponse.json()) as {
          data?: BusinessRow[];
          error?: string;
        };
        if (!listResponse.ok) {
          throw new Error(listResult.error || "Erro ao carregar empresas.");
        }
        const loaded = listResult.data || [];
        if (loaded.length === 1) {
          bid = loaded[0].id;
          setPrimaryTenantBusinessId(bid);
          setSelectedBusinessId(bid);
          setBusinesses([loaded[0]]);
          setCalendarMode(loaded[0].calendar_mode || "internal");
          setClientWhatsapp(loaded[0].whatsapp_number || "");
          return;
        }
        setBusinesses([]);
        if (loaded.length === 0) {
          setFeedback(
            "Nenhuma empresa encontrada no banco. Cadastre uma empresa (área Desenvolvedor) ou confira NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."
          );
        } else {
          setFeedback(
            "Há mais de uma empresa cadastrada: defina OWNER_BUSINESS_ID ou CLIENT_BUSINESS_ID no .env.local com o UUID da empresa deste login."
          );
        }
        setFeedbackType("error");
        return;
      }

      const response = await fetch(`/api/businesses/${bid}`);
      const result = (await response.json()) as { data?: BusinessRow; error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar empresa.");
      }

      const one = result.data;
      if (!one) {
        setBusinesses([]);
        return;
      }

      setBusinesses([one]);
      setSelectedBusinessId(one.id);
      setCalendarMode(one.calendar_mode || "internal");
      setClientWhatsapp(one.whatsapp_number || "");
      return;
    }

    const response = await fetch("/api/businesses");
    const result = (await response.json()) as {
      data?: BusinessRow[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(result.error || "Erro ao carregar empresas.");
    }

    const loaded = result.data || [];
    setBusinesses(loaded);

    const skipDeveloperAutoPick =
      role === "developer" && developerBusinessCreatingNew;
    if (!selectedBusinessId && loaded.length > 0 && !skipDeveloperAutoPick) {
      setSelectedBusinessId(loaded[0].id);
      setCalendarMode(loaded[0].calendar_mode || "internal");
      setClientWhatsapp(loaded[0].whatsapp_number || "");
    }
    } finally {
      setBusinessContextReady(true);
    }
  }

  async function loadServices(businessId: string) {
    if (!businessId) {
      setServices([]);
      return;
    }

    const response = await fetch(`/api/services?businessId=${businessId}`);
    const result = (await response.json()) as {
      data?: ServiceItem[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(result.error || "Erro ao carregar servicos.");
    }

    setServices(result.data || []);
  }

  async function loadCalendarConnection(businessId: string) {
    if (!businessId) {
      setCalendarId("primary");
      setAccessToken("");
      setRefreshToken("");
      setTokenExpiresAt("");
      return;
    }

    const response = await fetch(
      `/api/calendar-connections?businessId=${businessId}`
    );
    const result = (await response.json()) as {
      data?: {
        calendar_id?: string;
        token_expires_at?: string | null;
      } | null;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(result.error || "Erro ao carregar conexao do calendario.");
    }

    setCalendarId(result.data?.calendar_id || "primary");
    setTokenExpiresAt(result.data?.token_expires_at || "");
    setAccessToken("");
    setRefreshToken("");
  }

  async function loadBusinessHourSchedules(businessId: string) {
    if (!businessId) {
      setHourSchedulesList([]);
      setHourScheduleGaps([]);
      return;
    }

    const response = await fetch(`/api/business-hour-schedules?businessId=${businessId}`);
    const result = (await response.json()) as {
      data?: Array<{
        id: string;
        validityType: string;
        validFrom: string;
        validTo: string | null;
        createdAt: string;
        updatedAt: string;
        isVigenteHoje: boolean;
      }>;
      scheduleGaps?: Array<{ from: string; to: string }>;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(result.error || "Erro ao listar agendas de horario.");
    }

    setHourSchedulesList(result.data || []);
    setHourScheduleGaps(result.scheduleGaps || []);
  }

  async function loadBusinessHours(
    businessId: string,
    options?: { scheduleId?: string | null; forDate?: string }
  ) {
    if (!businessId) {
      return;
    }

    const params = new URLSearchParams({ businessId });
    if (options?.scheduleId) {
      params.set("scheduleId", options.scheduleId);
    } else if (options?.forDate) {
      params.set("forDate", options.forDate);
    }

    const response = await fetch(`/api/business-hours?${params}`);
    const result = (await response.json()) as {
      data?: BusinessHourApiRow[];
      schedule?: {
        id: string;
        validity_type: string;
        valid_from: string;
        valid_to: string | null;
      } | null;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(result.error || "Erro ao carregar horarios.");
    }

    if (result.schedule) {
      setHourScheduleId(result.schedule.id);
      const vt = result.schedule.validity_type;
      if (
        vt === "indeterminate" ||
        vt === "monthly" ||
        vt === "annual" ||
        vt === "custom"
      ) {
        setHourValidityType(vt);
      }
      if (result.schedule.validity_type === "custom") {
        setHourCustomFrom(result.schedule.valid_from);
        setHourCustomTo(result.schedule.valid_to ?? "");
      } else {
        setHourCustomFrom("");
        setHourCustomTo("");
      }
    } else {
      setHourScheduleId(null);
      setHourValidityType("indeterminate");
      setHourCustomFrom("");
      setHourCustomTo("");
    }

    const byWeekday = new Map<number, BusinessHourApiRow[]>();
    for (const item of result.data || []) {
      const list = byWeekday.get(item.weekday);
      if (list) {
        list.push(item);
      } else {
        byWeekday.set(item.weekday, [item]);
      }
    }

    const merged = weekDaysSchedule.map((day) => {
      const list = byWeekday.get(day.id) || [];
      if (!list.length) {
        return {
          weekday: day.id,
          isActive: day.id >= 1 && day.id <= 5,
          shifts: [createDefaultShift()]
        };
      }
      const { isActive, shifts } = rowsToDayState(list);
      return { weekday: day.id, isActive, shifts };
    });
    setBusinessHours(merged);
  }

  async function loadMessageTemplates(businessId: string) {
    if (!businessId) return;
    const response = await fetch(`/api/message-templates?businessId=${businessId}`);
    const result = (await response.json()) as {
      data?: Array<{
        code: string;
        content: string;
      }>;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(result.error || "Erro ao carregar templates de mensagem.");
    }
    const byCode = new Map(
      (result.data || []).map((item) => [item.code, normalizeTemplateOrthography(item.content)])
    );
    setGreetingTemplate(
      byCode.get("GREETING") ||
        "Olá! Bem-vindo(a). Digite 1 para agendar, 2 para reagendar, 3 para cancelar."
    );
    setConfirmationTemplate(
      byCode.get("APPOINTMENT_CONFIRMATION") ||
        "Seu horário foi confirmado. Qualquer dúvida, responda esta mensagem."
    );
    setCancelTemplate(
      byCode.get("APPOINTMENT_CANCELLED") ||
        "Olá, {{cliente}}. Seu agendamento foi cancelado. Se desejar, responda esta mensagem para reagendar."
    );
    setShiftEarlierShortTemplate(
      byCode.get("APPOINTMENT_SHIFT_EARLIER_SHORT") ||
        byCode.get("APPOINTMENT_SHIFT_EARLIER") ||
        "Olá, {{cliente}}. Seu horário foi adiantado em {{minutos}} minutos. Novo horário: {{data}} {{inicio}} até {{fim}}."
    );
    setShiftEarlierLongTemplate(
      byCode.get("APPOINTMENT_SHIFT_EARLIER_LONG") ||
        "Olá, {{cliente}}. Precisamos adiantar seu atendimento em {{minutos}} minutos por ajuste operacional. Novo horário: {{data}} {{inicio}} até {{fim}}."
    );
    setShiftLaterShortTemplate(
      byCode.get("APPOINTMENT_SHIFT_LATER_SHORT") ||
        byCode.get("APPOINTMENT_SHIFT_LATER") ||
        "Olá, {{cliente}}. Seu horário foi atrasado em {{minutos}} minutos. Novo horário: {{data}} {{inicio}} até {{fim}}."
    );
    setShiftLaterLongTemplate(
      byCode.get("APPOINTMENT_SHIFT_LATER_LONG") ||
        "Olá, {{cliente}}. Precisamos atrasar seu atendimento em {{minutos}} minutos por ajuste operacional. Novo horário: {{data}} {{inicio}} até {{fim}}."
    );
    setShiftTemplateThresholdMinutes(
      byCode.get("APPOINTMENT_SHIFT_THRESHOLD_MINUTES") || "15"
    );
    setWaServiceMenuPrompt(byCode.get("WA_SERVICE_MENU_PROMPT") || "Escolha um servico:");
    setWaSlotMenuPrompt(
      byCode.get("WA_SLOT_MENU_PROMPT") || "Horários disponíveis. Escolha um horário:"
    );
    setWaServiceOptionTitleTemplate(
      byCode.get("WA_SERVICE_OPTION_TITLE_TEMPLATE") || "{{servico}}"
    );
    setWaSlotOptionTitleTemplate(
      byCode.get("WA_SLOT_OPTION_TITLE_TEMPLATE") || "{{hora}}"
    );
    setWaServiceOptionDescriptionTemplate(
      byCode.get("WA_SERVICE_OPTION_DESCRIPTION_TEMPLATE") || "{{duracao}} min"
    );
    setWaSlotOptionDescriptionTemplate(
      byCode.get("WA_SLOT_OPTION_DESCRIPTION_TEMPLATE") || "{{data}}"
    );
    setAppointmentReminder24hTemplate(
      byCode.get("APPOINTMENT_REMINDER_24H") ||
        "Lembrete: seu agendamento é amanhã, {{data}} às {{inicio}}."
    );
    setAppointmentReminder2hTemplate(
      byCode.get("APPOINTMENT_REMINDER_2H") ||
        "Lembrete: seu atendimento é hoje às {{inicio}}."
    );
    setAppointmentReminder30mTemplate(
      byCode.get("APPOINTMENT_REMINDER_30M") ||
        "Faltam 30 minutos para seu atendimento ({{inicio}}). Está a caminho?"
    );
    setAttendanceConfirm24hTemplate(
      byCode.get("APPOINTMENT_CONFIRM_ATTENDANCE_24H") ||
        "Confirme sua presença para o atendimento de {{data}} {{inicio}} respondendo SIM."
    );
    setAutoReleaseUnconfirmedTemplate(
      byCode.get("APPOINTMENT_AUTO_RELEASE_UNCONFIRMED") ||
        "Seu horário de {{data}} {{inicio}} foi liberado por falta de confirmação. Responda para reagendar."
    );
    setPostVisitThankYouReviewTemplate(
      byCode.get("POST_APPOINTMENT_THANK_YOU_REVIEW") ||
        "Obrigado pela visita, {{cliente}}! Sua avaliação é muito importante para nós."
    );
    setPostVisitCouponTemplate(
      byCode.get("POST_APPOINTMENT_NEXT_VISIT_COUPON") ||
        "Temos um cupom especial para sua próxima visita: {{cupom}}. Válido até {{validade}}."
    );
    setRemarketingInactive30dTemplate(
      byCode.get("REMARKETING_INACTIVE_30D") ||
        "Oi, {{cliente}}! Faz 30 dias desde sua última visita. Que tal agendar um novo horário?"
    );
    setRemarketingPromoTemplate(
      byCode.get("REMARKETING_SPECIAL_PROMO") ||
        "Promoção especial para você, {{cliente}}! Responda para conhecer as condições e agendar."
    );
    setBirthdayMessageTemplate(
      byCode.get("BIRTHDAY_MESSAGE") ||
        "Feliz aniversário, {{cliente}}! Preparamos um desconto/brinde especial para você."
    );
    setMessageTemplateEditable({});
  }

  async function loadOfferPlans(businessId: string) {
    if (!businessId) {
      setOfferPlans([]);
      return;
    }
    const response = await fetch(`/api/offers?businessId=${businessId}`);
    const result = (await response.json()) as { data?: OfferPlanItem[]; error?: string };
    if (!response.ok) {
      throw new Error(result.error || "Erro ao carregar planos e pacotes.");
    }
    setOfferPlans(result.data || []);
  }

  async function loadMonetizationPlans() {
    const response = await fetch("/api/monetization/plans");
    const result = (await response.json()) as { data?: MonetizationPlan[]; error?: string };
    if (!response.ok) {
      throw new Error(result.error || "Erro ao carregar planos.");
    }
    setMonetizationPlans(result.data || []);
  }

  async function loadSubscriptionChangeFeedbacks(statusFilter: SubscriptionFeedbackStatusFilter) {
    const statusQuery = statusFilter === "all" ? "" : `&status=${encodeURIComponent(statusFilter)}`;
    const response = await fetch(`/api/subscription-change-requests?limit=40${statusQuery}`);
    const result = (await response.json()) as {
      data?: SubscriptionChangeFeedback[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(result.error || "Erro ao carregar feedbacks de planos.");
    }
    setSubscriptionChangeFeedbacks(result.data || []);
    setSubscriptionChangeFeedbacksError("");
  }

  async function loadOwnerSubscriptionFeedbacks(
    businessId: string,
    statusFilter: SubscriptionFeedbackStatusFilter
  ) {
    const statusQuery = statusFilter === "all" ? "" : `&status=${encodeURIComponent(statusFilter)}`;
    const response = await fetch(
      `/api/subscription-change-requests?limit=30&businessId=${encodeURIComponent(
        businessId
      )}${statusQuery}`
    );
    const result = (await response.json()) as {
      data?: SubscriptionChangeFeedback[];
      error?: string;
    };
    if (!response.ok) {
      throw new Error(result.error || "Erro ao carregar histórico de solicitações.");
    }
    setOwnerSubscriptionFeedbacks(result.data || []);
    setOwnerSubscriptionFeedbacksError("");
  }

  async function loadMonetizationUsage(businessId: string, month: string) {
    const response = await fetch(
      `/api/monetization/usage?businessId=${encodeURIComponent(
        businessId
      )}&month=${encodeURIComponent(month)}`
    );
    const result = (await response.json()) as { data?: MonetizationUsage; error?: string };
    if (!response.ok) {
      throw new Error(result.error || "Erro ao carregar consumo do plano.");
    }
    setMonetizationUsage(result.data || null);
  }

  async function loadAnalyticsReport(businessId: string, month: string) {
    if (!businessId) {
      setAnalyticsReport(null);
      return;
    }
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try {
      const response = await fetch(
        `/api/reports/analytics?businessId=${businessId}&month=${encodeURIComponent(month)}`
      );
      const result = (await response.json()) as { data?: AnalyticsReport; error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar analytics.");
      }
      setAnalyticsReport(result.data || null);
    } catch (error) {
      setAnalyticsReport(null);
      setAnalyticsError((error as Error).message);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function loadFinancialCustomersAnalytics(businessId: string, month: string) {
    setFinancialCustomersLoading(true);
    setFinancialCustomersError("");
    try {
      const response = await fetch(
        `/api/reports/financial-customers?businessId=${encodeURIComponent(
          businessId
        )}&month=${encodeURIComponent(month)}`
      );
      const result = (await response.json()) as {
        data?: FinancialCustomersAnalytics;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar análises financeiras.");
      }
      setFinancialCustomersAnalytics(result.data || null);
    } catch (error) {
      setFinancialCustomersAnalytics(null);
      setFinancialCustomersError((error as Error).message);
    } finally {
      setFinancialCustomersLoading(false);
    }
  }

  async function fetchAnalyticsTrendPoint(
    businessId: string,
    month: string
  ): Promise<AnalyticsTrendPoint | null> {
    const response = await fetch(
      `/api/reports/analytics?businessId=${encodeURIComponent(
        businessId
      )}&month=${encodeURIComponent(month)}`
    );
    const result = (await response.json()) as { data?: AnalyticsReport; error?: string };
    if (!response.ok || !result.data) {
      return null;
    }
    return {
      month,
      occupancyRate: result.data.performance.occupancyRate,
      noShowRate: result.data.noShow.overallRate,
      remarketingRate: result.data.campaignRoi.remarketing.conversionRate
    };
  }

  async function fetchFinancialTrendPoint(
    businessId: string,
    month: string
  ): Promise<FinancialTrendPoint | null> {
    const response = await fetch(
      `/api/reports/financial-customers?businessId=${encodeURIComponent(
        businessId
      )}&month=${encodeURIComponent(month)}`
    );
    const result = (await response.json()) as {
      data?: FinancialCustomersAnalytics;
      error?: string;
    };
    if (!response.ok || !result.data) {
      return null;
    }
    return {
      month,
      totalPaidCents: result.data.totalPaidCents,
      totalDiscountRedeemedCents: result.data.totalDiscountRedeemedCents,
      promoPaymentsCount: result.data.promoPaymentsCount
    };
  }

  async function loadAnalyticsComparisons(businessId: string, month: string) {
    setAnalyticsTrendLoading(true);
    setAnalyticsTrendError("");
    try {
      const timelineMonths = Array.from({ length: 13 }, (_, index) => shiftMonth(month, index - 12));
      const points = await Promise.all(
        timelineMonths.map((itemMonth) => fetchAnalyticsTrendPoint(businessId, itemMonth))
      );
      setAnalyticsTrendPoints(
        points.filter((item): item is AnalyticsTrendPoint => item !== null)
      );
    } catch (error) {
      setAnalyticsTrendPoints([]);
      setAnalyticsTrendError((error as Error).message);
    } finally {
      setAnalyticsTrendLoading(false);
    }
  }

  async function loadFinancialComparisons(businessId: string, month: string) {
    setFinancialTrendLoading(true);
    setFinancialTrendError("");
    try {
      const timelineMonths = Array.from({ length: 13 }, (_, index) => shiftMonth(month, index - 12));
      const points = await Promise.all(
        timelineMonths.map((itemMonth) => fetchFinancialTrendPoint(businessId, itemMonth))
      );
      setFinancialTrendPoints(
        points.filter((item): item is FinancialTrendPoint => item !== null)
      );
    } catch (error) {
      setFinancialTrendPoints([]);
      setFinancialTrendError((error as Error).message);
    } finally {
      setFinancialTrendLoading(false);
    }
  }

  async function loadClientAppointments(
    businessId: string,
    anchorDateIso: string,
    mode: "day" | "week" | "month"
  ) {
    if (!businessId) {
      setClientAppointments([]);
      return;
    }
    setClientAppointmentsLoading(true);
    try {
      const bounds = getPeriodBounds(anchorDateIso, mode);
      const response = await fetch(
        `/api/appointments?businessId=${businessId}&startDate=${bounds.startDate}&endDate=${bounds.endDate}`
      );
      const result = (await response.json()) as {
        data?: AppointmentSummary[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar agenda.");
      }
      setClientAppointments(result.data || []);
    } catch {
      setClientAppointments([]);
    } finally {
      setClientAppointmentsLoading(false);
    }
  }

  function resolveServiceRulesForAppointment(serviceId: string | null | undefined) {
    const biz = businesses.find((b) => b.id === selectedBusinessId);
    const svc = serviceId ? services.find((s) => s.id === serviceId) : undefined;
    return {
      cancelCutoff: Math.max(
        0,
        Number(svc?.booking_cancel_cutoff_minutes ?? biz?.booking_cancel_cutoff_minutes ?? 0)
      ),
      rescheduleCutoff: Math.max(
        0,
        Number(svc?.booking_reschedule_cutoff_minutes ?? biz?.booking_reschedule_cutoff_minutes ?? 0)
      ),
      autoReturnEnabled: svc
        ? svc.auto_return_enabled !== false
        : biz?.auto_return_enabled !== false,
      autoReturnDays: Math.max(7, Number(svc?.auto_return_days ?? biz?.auto_return_days ?? 30)),
      checkinQrEnabled: svc ? svc.checkin_qr_enabled !== false : biz?.checkin_qr_enabled !== false,
      autoFeedbackEnabled: svc
        ? svc.auto_feedback_enabled === true
        : biz?.auto_feedback_enabled === true,
      oneClickRescheduleEnabled: svc
        ? svc.one_click_reschedule_enabled !== false
        : biz?.one_click_reschedule_enabled !== false
    };
  }

  function buildQuickActionTemplate(action: "confirm" | "cancel" | "shift", shiftMinutes: number) {
    if (action === "confirm") {
      return `${confirmationTemplate}\n\nStatus: {{status}}.\nData: {{data}} {{inicio}}.`;
    }
    if (action === "cancel") {
      return cancelTemplate;
    }
    const threshold = Math.max(1, Number(shiftTemplateThresholdMinutes) || 15);
    const isLongShift = Math.abs(shiftMinutes) > threshold;
    if (shiftMinutes < 0) {
      return isLongShift ? shiftEarlierLongTemplate : shiftEarlierShortTemplate;
    }
    return isLongShift ? shiftLaterLongTemplate : shiftLaterShortTemplate;
  }

  async function handleAppointmentQuickAction(
    appointmentId: string,
    action: "confirm" | "cancel" | "shift" | "checkin" | "complete",
    shiftMinutes = 0
  ) {
    setAppointmentActionFeedback("");
    setLastCheckinUrl("");
    setAppointmentActionLoadingId(appointmentId);
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          shiftMinutes: action === "shift" ? shiftMinutes : undefined,
          notifyTemplate:
            action === "confirm" || action === "cancel" || action === "shift"
              ? buildQuickActionTemplate(action, shiftMinutes)
              : undefined
        })
      });
      const result = (await response.json()) as {
        error?: string;
        notification?: { sent?: boolean; reason?: string };
        suggestedSlots?: Array<{ startsAt: string; endsAt: string }>;
      };
      if (!response.ok) {
        throw new Error(result.error || "Falha ao executar acao rapida.");
      }

      if (result.notification?.sent) {
        setAppointmentActionFeedback("Acao aplicada e notificacao enviada ao cliente.");
      } else if (result.notification?.reason) {
        setAppointmentActionFeedback(
          `Acao aplicada. Notificacao nao enviada: ${result.notification.reason}`
        );
      } else {
        setAppointmentActionFeedback("Acao aplicada com sucesso.");
      }
      const apptRow = clientAppointments.find((a) => a.id === appointmentId);
      const quickRules = resolveServiceRulesForAppointment(apptRow?.service_id);
      if (
        action === "cancel" &&
        quickRules.oneClickRescheduleEnabled &&
        result.suggestedSlots &&
        result.suggestedSlots.length > 0
      ) {
        const suggestedText = result.suggestedSlots
          .slice(0, 3)
          .map((slot) => {
            const date = slot.startsAt.slice(0, 10);
            return `${formatDatePtBr(date)} ${slot.startsAt.slice(11, 16)}-${slot.endsAt.slice(
              11,
              16
            )}`;
          })
          .join(" | ");
        setAppointmentActionFeedback(
          `Cancelamento concluido. Sugestoes de reagendamento: ${suggestedText}`
        );
      }

      await loadClientAppointments(
        selectedBusinessId,
        clientCalendarAnchorDate,
        clientCalendarView
      );
    } catch (error) {
      setAppointmentActionFeedback((error as Error).message);
    } finally {
      setAppointmentActionLoadingId(null);
    }
  }

  async function handleCreateAutoReturn(appointmentId: string, daysAhead?: number) {
    if (!selectedBusinessId) return;
    setAppointmentActionFeedback("");
    setAppointmentActionLoadingId(appointmentId);
    try {
      const ahead = Math.max(7, Number(daysAhead) || 30);
      const response = await fetch(`/api/appointments/${appointmentId}/auto-return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: selectedBusinessId,
          daysAhead: ahead
        })
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Falha ao criar retorno automatico.");
      setAppointmentActionFeedback(result.message || "Retorno criado com sucesso.");
      await loadClientAppointments(selectedBusinessId, clientCalendarAnchorDate, clientCalendarView);
    } catch (error) {
      setAppointmentActionFeedback((error as Error).message);
    } finally {
      setAppointmentActionLoadingId(null);
    }
  }

  async function handleGenerateCheckinToken(appointmentId: string) {
    if (!selectedBusinessId) return;
    setAppointmentActionFeedback("");
    setAppointmentActionLoadingId(appointmentId);
    try {
      const response = await fetch(
        `/api/appointments/${appointmentId}/checkin-token?businessId=${encodeURIComponent(
          selectedBusinessId
        )}`,
        { method: "POST" }
      );
      const result = (await response.json()) as {
        error?: string;
        data?: { checkinUrl?: string };
      };
      if (!response.ok) throw new Error(result.error || "Falha ao gerar QR de check-in.");
      setLastCheckinUrl(result.data?.checkinUrl || "");
      setAppointmentActionFeedback(
        `QR/check-in gerado. URL: ${result.data?.checkinUrl || "nao disponivel"}.`
      );
    } catch (error) {
      setAppointmentActionFeedback((error as Error).message);
    } finally {
      setAppointmentActionLoadingId(null);
    }
  }

  async function handleCopyCheckinUrl() {
    if (!lastCheckinUrl) return;
    try {
      await navigator.clipboard.writeText(lastCheckinUrl);
      setAppointmentActionFeedback("Link de check-in copiado.");
    } catch {
      setAppointmentActionFeedback("Nao foi possivel copiar automaticamente. Copie manualmente.");
    }
  }

  async function handleSendPostFeedback(appointmentId: string) {
    if (!selectedBusinessId) return;
    setAppointmentActionFeedback("");
    setAppointmentActionLoadingId(appointmentId);
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: selectedBusinessId })
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Falha ao enviar feedback.");
      setAppointmentActionFeedback(result.message || "Feedback enviado.");
      await loadClientAppointments(selectedBusinessId, clientCalendarAnchorDate, clientCalendarView);
    } catch (error) {
      setAppointmentActionFeedback((error as Error).message);
    } finally {
      setAppointmentActionLoadingId(null);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) {
          router.push("/login");
          return;
        }
        const result = (await response.json()) as {
          role: "developer" | "owner";
          businessId?: string | null;
        };
        setRole(result.role);
        if (result.role === "developer") {
          setDeveloperArea("dashboard");
          setDashboardArea("overview");
        }
        if (result.role === "owner" && result.businessId) {
          setPrimaryTenantBusinessId(result.businessId);
          setSelectedBusinessId(result.businessId);
        } else if (result.role === "owner") {
          setPrimaryTenantBusinessId(null);
          setSelectedBusinessId("");
        } else {
          setPrimaryTenantBusinessId(null);
        }
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [router]);

  const loadDeveloperPlatformSummary = useCallback(async (options?: { quiet?: boolean }) => {
    const quiet = options?.quiet === true;
    if (!quiet) {
      setDeveloperPlatformSummaryLoading(true);
      setDeveloperPlatformSummaryError("");
    }
    try {
      const response = await fetch("/api/admin/platform-summary");
      const raw = await response.text();
      let json: { data?: DeveloperPlatformSummary; error?: string } = {};
      if (raw.trim().length > 0) {
        try {
          json = JSON.parse(raw) as { data?: DeveloperPlatformSummary; error?: string };
        } catch {
          throw new Error(
            response.ok
              ? "Resposta inválida do servidor ao carregar o resumo."
              : "Resposta inválida do servidor."
          );
        }
      } else if (!response.ok) {
        throw new Error("Resposta vazia do servidor.");
      }
      if (!response.ok) {
        throw new Error(json.error || "Falha ao carregar resumo da plataforma.");
      }
      if (json.data) {
        setDeveloperPlatformSummary(json.data);
      }
    } catch (error) {
      if (!quiet) {
        setDeveloperPlatformSummaryError((error as Error).message);
      }
    } finally {
      if (!quiet) {
        setDeveloperPlatformSummaryLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (authLoading || role !== "developer") {
      return;
    }
    void loadDeveloperPlatformSummary();
  }, [authLoading, role, loadDeveloperPlatformSummary]);

  useEffect(() => {
    if (authLoading || !role) {
      return;
    }
    void loadBusinesses().catch((error: Error) => {
      setFeedback(error.message);
      setFeedbackType("error");
    });
    // Recarrega negócio(s) ao autenticar ou ao trocar o tenant (login owner)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadBusinesses depende de vários estados do formulário
  }, [authLoading, role, primaryTenantBusinessId]);

  useEffect(() => {
    void loadServices(selectedBusinessId).catch((error: Error) => {
      setServiceFeedback(error.message);
    });
    void loadCalendarConnection(selectedBusinessId).catch((error: Error) => {
      setCalendarFeedback(error.message);
    });
    void loadBusinessHours(selectedBusinessId).catch((error: Error) => {
      setHoursFeedback(error.message);
    });
    void loadBusinessHourSchedules(selectedBusinessId).catch((error: Error) => {
      setHoursFeedback(error.message);
    });
    void loadMessageTemplates(selectedBusinessId).catch((error: Error) => {
      setMessageTemplateFeedback(error.message);
    });
    const selectedBusiness = businesses.find((b) => b.id === selectedBusinessId);
    if (role === "developer" && developerBusinessCreatingNew) {
      return;
    }
    if (selectedBusiness) {
      setCalendarMode(selectedBusiness.calendar_mode || "internal");
      setClientWhatsapp(formatMaskedFromDigits(selectedBusiness.whatsapp_number, maskPhoneBr));
      setName(selectedBusiness.name || "");
      setCnpj(formatMaskedFromDigits(selectedBusiness.cnpj, maskCnpj));
      setLegalName(selectedBusiness.legal_name || "");
      setTradeName(selectedBusiness.trade_name || "");
      setAddressLine(selectedBusiness.address_line || "");
      setAddressNumber(selectedBusiness.address_number || "");
      setAddressComplement(selectedBusiness.address_complement || "");
      setNeighborhood(selectedBusiness.neighborhood || "");
      setCity(selectedBusiness.city || "");
      setStateUf(selectedBusiness.state || "");
      setPostalCode(formatMaskedFromDigits(selectedBusiness.postal_code, maskCep));
      setContactName(selectedBusiness.contact_name || "");
      setContactPhone(formatMaskedFromDigits(selectedBusiness.contact_phone, maskPhoneBr));
      setContactEmail(selectedBusiness.contact_email || "");
      setCnaeCode(selectedBusiness.cnae_code || "");
      setCnaeDescription(selectedBusiness.cnae_description || "");
      setBusinessType(selectedBusiness.cnae_description || "");
      setGoogleReviewsEnabled(selectedBusiness.google_reviews_enabled === true);
      setGoogleReviewsUrl(selectedBusiness.google_reviews_url || "");
      setPlanCode((selectedBusiness.subscription_plan_code || "free") as "free" | "pro" | "enterprise");
      setPlanStatus(
        (selectedBusiness.subscription_status || "active") as
          | "active"
          | "trialing"
          | "past_due"
          | "cancelled"
      );
      setPlanMonthlyLimit(
        selectedBusiness.monthly_appointment_limit == null
          ? ""
          : String(Math.max(1, Number(selectedBusiness.monthly_appointment_limit)))
      );
      setPlanProfessionalLimit(
        selectedBusiness.professional_limit == null
          ? ""
          : String(Math.max(1, Number(selectedBusiness.professional_limit)))
      );
      setPlanAutomationsEnabled(selectedBusiness.automations_enabled === true);
      setPlanMultiUnitEnabled(selectedBusiness.multi_unit_enabled === true);
    }
  }, [role, developerBusinessCreatingNew, selectedBusinessId, businesses]);

  useEffect(() => {
    if (role !== "owner") return;
    if (clientMainArea !== "dashboard" || clientDashboardArea !== "agenda") return;
    void loadClientAppointments(
      selectedBusinessId,
      clientCalendarAnchorDate,
      clientCalendarView
    );
  }, [
    role,
    clientMainArea,
    clientDashboardArea,
    selectedBusinessId,
    clientCalendarAnchorDate,
    clientCalendarView
  ]);

  useEffect(() => {
    if (role !== "owner") return;
    if (clientMainArea !== "dashboard" || clientDashboardArea !== "agenda") return;
    if (!selectedBusinessId) return;
    const biz = businesses.find((b) => b.id === selectedBusinessId);
    if (!biz) return;

    const bounds = getPeriodBounds(clientCalendarAnchorDate, clientCalendarView);
    const y1 = parseInt(bounds.startDate.slice(0, 4), 10);
    const y2 = parseInt(bounds.endDate.slice(0, 4), 10);
    const years: number[] = [];
    for (let y = y1; y <= y2; y++) years.push(y);

    let cancelled = false;
    void (async () => {
      try {
        const qs = new URLSearchParams();
        qs.set("years", years.join(","));
        if (biz.state?.trim()) qs.set("uf", biz.state.trim());
        if (biz.city?.trim()) qs.set("city", biz.city.trim());

        const [hRes, wRes] = await Promise.all([
          fetch(`/api/holidays?${qs.toString()}`),
          fetch(`/api/businesses/${selectedBusinessId}/holiday-working-days`)
        ]);
        const hJson = (await hRes.json()) as { data?: Record<string, string[]>; error?: string };
        const wJson = (await wRes.json()) as { data?: string[]; error?: string };
        if (cancelled) return;
        if (!hRes.ok) {
          setHolidayNamesByDate({});
        } else {
          setHolidayNamesByDate(hJson.data || {});
        }
        if (!wRes.ok) {
          setHolidayWorkingDaySet(new Set());
        } else {
          setHolidayWorkingDaySet(new Set(wJson.data || []));
        }
      } catch {
        if (!cancelled) {
          setHolidayNamesByDate({});
          setHolidayWorkingDaySet(new Set());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    role,
    clientMainArea,
    clientDashboardArea,
    selectedBusinessId,
    clientCalendarAnchorDate,
    clientCalendarView,
    businesses
  ]);

  useEffect(() => {
    setClientCalendarSelectedDate(null);
    setAppointmentActionFeedback("");
    setLastCheckinUrl("");
  }, [clientCalendarView, clientCalendarAnchorDate, selectedBusinessId]);

  useEffect(() => {
    const financeInSettings =
      clientMainArea === "settings" && clientSettingsArea === "finance";
    const financeInDashboard =
      clientMainArea === "dashboard" && clientDashboardArea === "subscription";
    if (!financeInSettings && !financeInDashboard) return;
    if (!selectedBusinessId) return;
    void loadOfferPlans(selectedBusinessId).catch((error: Error) => {
      setOfferFeedback(error.message);
    });
    void loadMonetizationPlans().catch((error: Error) => {
      setOfferFeedback(error.message);
    });
    void loadMonetizationUsage(selectedBusinessId, financialMonth).catch((error: Error) => {
      setOfferFeedback(error.message);
      setMonetizationUsage(null);
    });
  }, [
    clientMainArea,
    clientSettingsArea,
    clientDashboardArea,
    selectedBusinessId,
    financialMonth
  ]);

  useEffect(() => {
    if (role !== "developer") return;
    if (developerArea !== "dashboard") return;
    if (dashboardArea === "overview") {
      void loadSubscriptionChangeFeedbacks("all").catch((error: Error) => {
        setSubscriptionChangeFeedbacksError(error.message);
        setSubscriptionChangeFeedbacks([]);
      });
      return;
    }
    if (dashboardArea === "categories" && developerDashboardCategory === "subscriptions") {
      void loadSubscriptionChangeFeedbacks(subscriptionFeedbackStatusFilter).catch((error: Error) => {
        setSubscriptionChangeFeedbacksError(error.message);
        setSubscriptionChangeFeedbacks([]);
      });
    }
  }, [
    role,
    developerArea,
    dashboardArea,
    developerDashboardCategory,
    subscriptionFeedbackStatusFilter,
  ]);

  useEffect(() => {
    if (role !== "owner") return;
    if (clientMainArea !== "dashboard" || clientDashboardArea !== "subscription") return;
    if (!selectedBusinessId) return;
    void loadOwnerSubscriptionFeedbacks(
      selectedBusinessId,
      ownerSubscriptionFeedbackStatusFilter
    ).catch((error: Error) => {
      setOwnerSubscriptionFeedbacksError(error.message);
      setOwnerSubscriptionFeedbacks([]);
    });
  }, [
    role,
    clientMainArea,
    clientDashboardArea,
    selectedBusinessId,
    ownerSubscriptionFeedbackStatusFilter,
  ]);

  useEffect(() => {
    if (role !== "owner") return;
    if (clientMainArea !== "dashboard" || clientDashboardArea !== "overview") return;
    if (!selectedBusinessId) return;
    const currentMonth = new Date().toISOString().slice(0, 7);
    void (async () => {
      try {
        const response = await fetch(
          `/api/monetization/usage?businessId=${encodeURIComponent(
            selectedBusinessId
          )}&month=${encodeURIComponent(currentMonth)}`
        );
        const result = (await response.json()) as { data?: MonetizationUsage; error?: string };
        if (!response.ok) throw new Error(result.error || "Erro ao carregar consumo do plano.");
        setOverviewMonetizationUsage(result.data || null);
      } catch {
        setOverviewMonetizationUsage(null);
      }
    })();
  }, [role, clientMainArea, clientDashboardArea, selectedBusinessId]);

  useEffect(() => {
    if (role !== "owner") return;
    if (clientMainArea !== "dashboard") return;
    if (clientDashboardArea !== "overview" && clientDashboardArea !== "analytics") return;
    if (!selectedBusinessId) return;
    void loadAnalyticsReport(selectedBusinessId, analyticsMonth);
    void loadFinancialCustomersAnalytics(selectedBusinessId, analyticsMonth);
    void loadAnalyticsComparisons(selectedBusinessId, analyticsMonth);
    void loadFinancialComparisons(selectedBusinessId, analyticsMonth);
  }, [role, clientMainArea, clientDashboardArea, selectedBusinessId, analyticsMonth]);

  function toggleDeveloperBusinessFormSection(id: DeveloperBusinessFormSection) {
    setDeveloperBusinessFormSection((prev) => (prev === id ? null : id));
  }

  function resetDeveloperBusinessFormForNew() {
    setFeedback("");
    setFeedbackType("");
    setName("");
    setBusinessType("");
    setCnaeCode("");
    setCnaeDescription("");
    setCnpj("");
    setLegalName("");
    setTradeName("");
    setAddressLine("");
    setAddressNumber("");
    setAddressComplement("");
    setNeighborhood("");
    setCity("");
    setStateUf("");
    setPostalCode("");
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setClientWhatsapp("");
    setGoogleReviewsEnabled(false);
    setGoogleReviewsUrl("");
    setPlanCode("free");
    setPlanStatus("active");
    setPlanMonthlyLimit("");
    setPlanProfessionalLimit("");
    setPlanAutomationsEnabled(false);
    setPlanMultiUnitEnabled(false);
    setCalendarMode("internal");
    setDeveloperBusinessFormSection("identificacao");
    setCnpjLookupFeedback("");
    setCnpjLookupPreview(null);
    setCnpjApplySelection(DEFAULT_CNPJ_APPLY_SELECTION);
    setCepFeedback("");
    setLastFetchedCep("");
  }

  function restoreDeveloperBusinessContextAfterClosingNewModal() {
    setDeveloperNewBusinessModalOpen(false);
    setDeveloperBusinessModalMode("create");
    setDeveloperBusinessCreatingNew(false);
    setDeveloperBusinessRequiredFieldErrors({});
    setCnpjLookupPreview(null);
    setFeedback("");
    setFeedbackType("");
    const snap = businessIdBeforeNewModal;
    setBusinessIdBeforeNewModal(null);
    if (snap && businesses.some((b) => b.id === snap)) {
      const b = businesses.find((x) => x.id === snap)!;
      setSelectedBusinessId(snap);
      setCalendarMode(b.calendar_mode || "internal");
      setClientWhatsapp(formatMaskedFromDigits(b.whatsapp_number ?? "", maskPhoneBr));
    } else if (businesses.length > 0) {
      const first = businesses[0];
      setSelectedBusinessId(first.id);
      setCalendarMode(first.calendar_mode || "internal");
      setClientWhatsapp(formatMaskedFromDigits(first.whatsapp_number ?? "", maskPhoneBr));
    }
  }

  function handleDeveloperEmpresasOpenList() {
    if (developerNewBusinessModalOpen) {
      restoreDeveloperBusinessContextAfterClosingNewModal();
      return;
    }
    setFeedback("");
    setFeedbackType("");
    if (!selectedBusinessId && businesses.length > 0) {
      const first = businesses[0];
      setSelectedBusinessId(first.id);
      setCalendarMode(first.calendar_mode || "internal");
      setClientWhatsapp(formatMaskedFromDigits(first.whatsapp_number ?? "", maskPhoneBr));
    }
  }

  function handleDeveloperStartNewBusiness() {
    setDeveloperBusinessModalMode("create");
    setBusinessIdBeforeNewModal(selectedBusinessId || null);
    setDeveloperBusinessRequiredFieldErrors({});
    resetDeveloperBusinessFormForNew();
    setDeveloperBusinessCreatingNew(true);
    setSelectedBusinessId("");
    setDeveloperNewBusinessModalOpen(true);
  }

  function handleDeveloperEditBusiness(row: DeveloperBusinessGridRow) {
    setBusinessIdBeforeNewModal(selectedBusinessId || null);
    setDeveloperBusinessModalMode("edit");
    setDeveloperBusinessRequiredFieldErrors({});
    setDeveloperBusinessCreatingNew(false);
    setCnpjLookupPreview(null);
    setFeedback("");
    setFeedbackType("");
    setSelectedBusinessId(row.id);
    setDeveloperNewBusinessModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errs: Partial<Record<"name" | "cnaeCode", string>> = {};
    if (!name.trim()) errs.name = "Informe o nome da empresa.";
    if (!cnaeCode) errs.cnaeCode = "Selecione o ramo da empresa (CNAE).";
    if (Object.keys(errs).length > 0) {
      setDeveloperBusinessRequiredFieldErrors(errs);
      return;
    }
    setDeveloperBusinessRequiredFieldErrors({});
    if (developerBusinessModalMode === "edit") {
      await handleUpdateBusinessProfile({ closeDeveloperBusinessModalOnSuccess: true });
      return;
    }
    setIsSaving(true);
    setFeedback("");
    setFeedbackType("");

    try {
      const response = await fetch("/api/businesses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          businessType,
          timezone: getBrowserIanaTimezone(),
          greetingTemplate,
          confirmationTemplate,
          calendarMode,
          cnpj,
          legalName,
          tradeName,
          addressLine,
          addressNumber,
          addressComplement,
          neighborhood,
          city,
          state: stateUf,
          postalCode,
          contactName,
          contactPhone,
          contactEmail,
          cnaeCode,
          cnaeDescription,
          whatsappNumber: clientWhatsapp,
          googleReviewsEnabled,
          googleReviewsUrl: googleReviewsUrl.trim() || null,
          subscriptionPlanCode: planCode,
          subscriptionStatus: planStatus,
          monthlyAppointmentLimit: planMonthlyLimit.trim()
            ? Math.max(1, Number(planMonthlyLimit) || 1)
            : null,
          professionalLimit: planProfessionalLimit.trim()
            ? Math.max(1, Number(planProfessionalLimit) || 1)
            : null,
          automationsEnabled: planAutomationsEnabled,
          multiUnitEnabled: planMultiUnitEnabled
        })
      });

      const result = (await response.json()) as {
        message?: string;
        error?: string;
        business?: BusinessRow;
      };

      if (!response.ok) {
        throw new Error(result.error || "Erro ao salvar configuracao.");
      }

      setFeedback(result.message || "Configuracao salva com sucesso.");
      setFeedbackType("success");
      const created = result.business;
      if (created?.id) {
        setSelectedBusinessId(created.id);
      }
      if (role === "developer") {
        setDeveloperNewBusinessModalOpen(false);
        setDeveloperBusinessModalMode("create");
        setBusinessIdBeforeNewModal(null);
        setDeveloperBusinessCreatingNew(false);
      }
      await loadBusinesses();
      if (role === "developer") {
        void loadDeveloperPlatformSummary({ quiet: true });
      }
    } catch (error) {
      setFeedback((error as Error).message);
      setFeedbackType("error");
    } finally {
      setIsSaving(false);
    }
  }

  async function createServiceFromState() {
    setServiceFeedback("");

    if (!selectedBusinessId) {
      setServiceFeedback("Selecione uma empresa para cadastrar servicos.");
      return false;
    }

    const durationMinutes = Number(serviceDuration);
    const priceCents =
      servicePrice.trim() === "" ? null : Math.round(Number(servicePrice) * 100);

    const response = await fetch("/api/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        businessId: selectedBusinessId,
        name: serviceName,
        durationMinutes,
        priceCents,
        category: serviceCategory || null,
        description: serviceDescription || null,
        icon: serviceIcon,
        color: serviceColor,
        imageUrls: serviceImages,
        displayOrder: services.length,
        bookingBufferBeforeMinutes: Math.max(0, Number(serviceBookingBufferBefore) || 0),
        bookingBufferAfterMinutes: Math.max(0, Number(serviceBookingBufferAfter) || 0),
        bookingMinNoticeMinutes: Math.max(0, Number(serviceBookingMinNotice) || 0),
        bookingMaxDaysAhead: Math.max(1, Number(serviceBookingMaxDays) || 60),
        bookingDailyLimit: serviceBookingDailyLimit.trim()
          ? Math.max(1, Number(serviceBookingDailyLimit) || 1)
          : null,
        bookingSlotCapacity: Math.max(1, Number(serviceBookingSlotCapacity) || 1),
        waitlistEnabled: serviceWaitlistEnabled,
        reminder24hEnabled: serviceReminder24h,
        reminder2hEnabled: serviceReminder2h,
        reminder30mEnabled: serviceReminder30m,
        attendanceConfirmationRequired: serviceAttendanceRequired,
        attendanceConfirmationDeadlineMinutes: Math.max(
          60,
          Number(serviceAttendanceDeadline) || 1440
        ),
        autoReleaseUnconfirmed: serviceAutoRelease,
        bookingRescheduleCutoffMinutes: Math.max(0, Number(serviceRescheduleCutoff) || 0),
        bookingCancelCutoffMinutes: Math.max(0, Number(serviceCancelCutoff) || 0),
        postVisitThankYouEnabled: servicePostVisitThankYou,
        postVisitCouponEnabled: servicePostVisitCoupon,
        remarketingEnabled: serviceRemarketing,
        remarketingInactiveDays: Math.max(
          7,
          Number(serviceRemarketingInactiveDays) || 30
        ),
        birthdayCampaignEnabled: serviceBirthday,
        autoReturnEnabled: serviceAutoReturn,
        autoReturnDays: Math.max(7, Number(serviceAutoReturnDays) || 30),
        oneClickRescheduleEnabled: serviceOneClickReschedule,
        checkinQrEnabled: serviceCheckinQr,
        autoFeedbackEnabled: serviceAutoFeedback
      })
    });

    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setServiceFeedback(result.error || "Erro ao criar servico.");
      return false;
    }

    setServiceName("");
    setServiceCategory("");
    setServiceDescription("");
    setServiceIcon("✂️");
    setServiceColor("#3B82F6");
    setServiceImages([]);
    setServiceDuration("30");
    setServicePrice("");
    applyBusinessTemplateToServiceAgendaCreate(selectedBusinessId);
    setServiceFeedback(result.message || "Servico criado.");
    await loadServices(selectedBusinessId);
    return true;
  }

  async function handleUploadServiceImages(
    files: FileList | null,
    mode: "new" | "edit"
  ) {
    if (!files || files.length === 0) return;
    if (!selectedBusinessId) {
      setServiceFeedback("Selecione uma empresa antes de enviar imagens.");
      return;
    }
    const current = mode === "new" ? serviceImages : editingImages;
    const maxToUpload = Math.max(0, 5 - current.length);
    if (maxToUpload <= 0) {
      setServiceFeedback("Limite de 5 imagens por serviço.");
      return;
    }
    const picked = Array.from(files).slice(0, maxToUpload);
    setServiceUploadLoading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of picked) {
        const formData = new FormData();
        formData.append("businessId", selectedBusinessId);
        formData.append("file", file);
        const response = await fetch("/api/services/upload", {
          method: "POST",
          body: formData
        });
        const result = (await response.json()) as { url?: string; error?: string };
        if (!response.ok || !result.url) {
          throw new Error(result.error || "Falha no upload da imagem.");
        }
        uploadedUrls.push(result.url);
      }
      if (mode === "new") {
        setServiceImages((prev) => [...prev, ...uploadedUrls].slice(0, 5));
      } else {
        setEditingImages((prev) => [...prev, ...uploadedUrls].slice(0, 5));
      }
      setServiceFeedback("Imagem(ns) enviada(s) com sucesso.");
    } catch (error) {
      setServiceFeedback((error as Error).message);
    } finally {
      setServiceUploadLoading(false);
    }
  }

  function removeServiceImage(mode: "new" | "edit", index: number) {
    if (mode === "new") {
      setServiceImages((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    setEditingImages((prev) => prev.filter((_, i) => i !== index));
  }

  function openServiceTemplateSuggestion(templateName: string) {
    const list = SERVICE_TEMPLATES[templateName] || [];
    setServiceTemplatePreviewName(templateName);
    setServiceTemplatePreviewItems(list.map((item) => ({ ...item, selected: true })));
  }

  function toggleServiceTemplateSuggestion(index: number, checked: boolean) {
    setServiceTemplatePreviewItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: checked } : item))
    );
  }

  function closeServiceTemplateSuggestion() {
    setServiceTemplatePreviewName("");
    setServiceTemplatePreviewItems([]);
  }

  async function handleApplyServiceTemplate() {
    if (!selectedBusinessId) {
      setServiceFeedback("Selecione uma empresa antes de aplicar templates.");
      return;
    }
    const list = serviceTemplatePreviewItems.filter((item) => item.selected);
    if (list.length === 0) return;
    try {
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const adjustedPriceCents = Math.round(item.price_cents * localPriceFactor);
        const response = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId: selectedBusinessId,
            name: item.name,
            category: item.category,
            description: item.description || null,
            durationMinutes: item.duration_minutes,
            priceCents: adjustedPriceCents,
            icon: item.icon,
            color: item.color,
            imageUrls: [],
            displayOrder: services.length + i
          })
        });
        if (!response.ok) {
          const result = (await response.json()) as { error?: string };
          throw new Error(result.error || "Falha ao aplicar template.");
        }
      }
      setServiceFeedback(`Template "${serviceTemplatePreviewName}" aplicado.`);
      closeServiceTemplateSuggestion();
      await loadServices(selectedBusinessId);
    } catch (error) {
      setServiceFeedback((error as Error).message);
    }
  }

  async function handleDeleteService(serviceId: string): Promise<boolean> {
    const response = await fetch(`/api/services/${serviceId}`, {
      method: "DELETE"
    });

    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setServiceFeedback(result.error || "Erro ao excluir servico.");
      return false;
    }

    setServiceFeedback(result.message || "Servico removido.");
    await loadServices(selectedBusinessId);
    return true;
  }

  async function handleDeleteEditingService() {
    if (!editingServiceId) return;
    if (
      !window.confirm(
        "Excluir este serviço? O cadastro sai do catálogo; confirme se não há impacto em agendamentos ou integrações."
      )
    ) {
      return;
    }
    const ok = await handleDeleteService(editingServiceId);
    if (ok) closeServiceModal();
  }

  function applyBusinessTemplateToServiceAgendaCreate(businessId: string) {
    const b = businesses.find((x) => x.id === businessId);
    setServiceBookingBufferBefore(String(Math.max(0, Number(b?.booking_buffer_before_minutes ?? 0))));
    setServiceBookingBufferAfter(String(Math.max(0, Number(b?.booking_buffer_after_minutes ?? 0))));
    setServiceBookingMinNotice(String(Math.max(0, Number(b?.booking_min_notice_minutes ?? 0))));
    setServiceBookingMaxDays(String(Math.max(1, Number(b?.booking_max_days_ahead ?? 60))));
    setServiceBookingDailyLimit(
      b?.booking_daily_limit != null ? String(b.booking_daily_limit) : ""
    );
    setServiceBookingSlotCapacity(String(Math.max(1, Number(b?.booking_slot_capacity ?? 1))));
    setServiceWaitlistEnabled(b?.waitlist_enabled !== false);
    setServiceReminder24h(b?.reminder_24h_enabled !== false);
    setServiceReminder2h(b?.reminder_2h_enabled !== false);
    setServiceReminder30m(b?.reminder_30m_enabled !== false);
    setServiceAttendanceRequired(b?.attendance_confirmation_required !== false);
    setServiceAttendanceDeadline(
      String(Math.max(60, Number(b?.attendance_confirmation_deadline_minutes ?? 1440)))
    );
    setServiceAutoRelease(b?.auto_release_unconfirmed !== false);
    setServiceRescheduleCutoff(
      String(Math.max(0, Number(b?.booking_reschedule_cutoff_minutes ?? 0)))
    );
    setServiceCancelCutoff(String(Math.max(0, Number(b?.booking_cancel_cutoff_minutes ?? 0))));
    setServicePostVisitThankYou(b?.post_visit_thank_you_enabled !== false);
    setServicePostVisitCoupon(b?.post_visit_coupon_enabled !== false);
    setServiceRemarketing(b?.remarketing_enabled !== false);
    setServiceRemarketingInactiveDays(
      String(Math.max(7, Number(b?.remarketing_inactive_days ?? 30)))
    );
    setServiceBirthday(b?.birthday_campaign_enabled !== false);
    setServiceAutoReturn(b?.auto_return_enabled !== false);
    setServiceAutoReturnDays(String(Math.max(7, Number(b?.auto_return_days ?? 30))));
    setServiceOneClickReschedule(b?.one_click_reschedule_enabled !== false);
    setServiceCheckinQr(b?.checkin_qr_enabled !== false);
    setServiceAutoFeedback(b?.auto_feedback_enabled === true);
  }

  function startEditingService(service: ServiceItem) {
    setEditingServiceId(service.id);
    setEditingName(service.name);
    setEditingCategory(service.category || "");
    setEditingDescription(service.description || "");
    setEditingIcon(service.icon || "✂️");
    setEditingColor(service.color || "#3B82F6");
    setEditingImages(service.image_urls || []);
    setEditingDuration(String(service.duration_minutes));
    setEditingPrice(
      typeof service.price_cents === "number"
        ? (service.price_cents / 100).toFixed(2)
        : ""
    );
    setEditingBookingBufferBefore(
      String(Math.max(0, Number(service.booking_buffer_before_minutes ?? 0)))
    );
    setEditingBookingBufferAfter(
      String(Math.max(0, Number(service.booking_buffer_after_minutes ?? 0)))
    );
    setEditingBookingMinNotice(String(Math.max(0, Number(service.booking_min_notice_minutes ?? 0))));
    setEditingBookingMaxDays(String(Math.max(1, Number(service.booking_max_days_ahead ?? 60))));
    setEditingBookingDailyLimit(
      service.booking_daily_limit != null ? String(service.booking_daily_limit) : ""
    );
    setEditingBookingSlotCapacity(
      String(Math.max(1, Number(service.booking_slot_capacity ?? 1)))
    );
    setEditingWaitlistEnabled(service.waitlist_enabled !== false);
    setEditingReminder24h(service.reminder_24h_enabled !== false);
    setEditingReminder2h(service.reminder_2h_enabled !== false);
    setEditingReminder30m(service.reminder_30m_enabled !== false);
    setEditingAttendanceRequired(service.attendance_confirmation_required !== false);
    setEditingAttendanceDeadline(
      String(Math.max(60, Number(service.attendance_confirmation_deadline_minutes ?? 1440)))
    );
    setEditingAutoRelease(service.auto_release_unconfirmed !== false);
    setEditingRescheduleCutoff(
      String(Math.max(0, Number(service.booking_reschedule_cutoff_minutes ?? 0)))
    );
    setEditingCancelCutoff(String(Math.max(0, Number(service.booking_cancel_cutoff_minutes ?? 0))));
    setEditingPostVisitThankYou(service.post_visit_thank_you_enabled !== false);
    setEditingPostVisitCoupon(service.post_visit_coupon_enabled !== false);
    setEditingRemarketing(service.remarketing_enabled !== false);
    setEditingRemarketingInactiveDays(
      String(Math.max(7, Number(service.remarketing_inactive_days ?? 30)))
    );
    setEditingBirthday(service.birthday_campaign_enabled !== false);
    setEditingAutoReturn(service.auto_return_enabled !== false);
    setEditingAutoReturnDays(String(Math.max(7, Number(service.auto_return_days ?? 30))));
    setEditingOneClickReschedule(service.one_click_reschedule_enabled !== false);
    setEditingCheckinQr(service.checkin_qr_enabled !== false);
    setEditingAutoFeedback(service.auto_feedback_enabled === true);
    setServiceFeedback("");
  }

  function openCreateServiceModal() {
    applyBusinessTemplateToServiceAgendaCreate(selectedBusinessId);
    setServiceModalMode("create");
    setServiceModalTab("info");
    setServiceModalOpen(true);
  }

  function openEditServiceModal(service: ServiceItem) {
    startEditingService(service);
    setServiceModalMode("edit");
    setServiceModalTab("info");
    setServiceModalOpen(true);
  }

  function closeServiceModal() {
    setServiceModalOpen(false);
    if (serviceModalMode === "edit") {
      cancelEditingService();
    }
  }

  function cancelEditingService() {
    setEditingServiceId(null);
    setEditingName("");
    setEditingCategory("");
    setEditingDescription("");
    setEditingIcon("✂️");
    setEditingColor("#3B82F6");
    setEditingImages([]);
    setEditingDuration("30");
    setEditingPrice("");
    setEditingBookingBufferBefore("0");
    setEditingBookingBufferAfter("0");
    setEditingBookingMinNotice("0");
    setEditingBookingMaxDays("60");
    setEditingBookingDailyLimit("");
    setEditingBookingSlotCapacity("1");
    setEditingWaitlistEnabled(true);
    setEditingReminder24h(true);
    setEditingReminder2h(true);
    setEditingReminder30m(true);
    setEditingAttendanceRequired(true);
    setEditingAttendanceDeadline("1440");
    setEditingAutoRelease(true);
    setEditingRescheduleCutoff("0");
    setEditingCancelCutoff("0");
    setEditingPostVisitThankYou(true);
    setEditingPostVisitCoupon(true);
    setEditingRemarketing(true);
    setEditingRemarketingInactiveDays("30");
    setEditingBirthday(true);
    setEditingAutoReturn(true);
    setEditingAutoReturnDays("30");
    setEditingOneClickReschedule(true);
    setEditingCheckinQr(true);
    setEditingAutoFeedback(false);
  }

  async function handleToggleServiceActive(service: ServiceItem) {
    const response = await fetch(`/api/services/${service.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ isActive: !service.is_active })
    });
    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setServiceFeedback(result.error || "Erro ao atualizar status do servico.");
      return;
    }
    setServiceFeedback(result.message || "Status atualizado.");
    await loadServices(selectedBusinessId);
  }

  async function handleDuplicateService(service: ServiceItem) {
    if (!selectedBusinessId) return;
    const response = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: selectedBusinessId,
        name: `${service.name} (copia)`,
        durationMinutes: service.duration_minutes,
        priceCents: service.price_cents,
        category: service.category,
        description: service.description,
        icon: service.icon || "✂️",
        color: service.color || "#3B82F6",
        imageUrls: service.image_urls || [],
        isActive: service.is_active,
        displayOrder: services.length,
        bookingBufferBeforeMinutes: Math.max(
          0,
          Number(service.booking_buffer_before_minutes ?? 0)
        ),
        bookingBufferAfterMinutes: Math.max(
          0,
          Number(service.booking_buffer_after_minutes ?? 0)
        ),
        bookingMinNoticeMinutes: Math.max(
          0,
          Number(service.booking_min_notice_minutes ?? 0)
        ),
        bookingMaxDaysAhead: Math.max(1, Number(service.booking_max_days_ahead ?? 60)),
        bookingDailyLimit: service.booking_daily_limit,
        bookingSlotCapacity: Math.max(1, Number(service.booking_slot_capacity ?? 1)),
        waitlistEnabled: service.waitlist_enabled !== false,
        reminder24hEnabled: service.reminder_24h_enabled !== false,
        reminder2hEnabled: service.reminder_2h_enabled !== false,
        reminder30mEnabled: service.reminder_30m_enabled !== false,
        attendanceConfirmationRequired: service.attendance_confirmation_required !== false,
        attendanceConfirmationDeadlineMinutes: Math.max(
          60,
          Number(service.attendance_confirmation_deadline_minutes ?? 1440)
        ),
        autoReleaseUnconfirmed: service.auto_release_unconfirmed !== false,
        bookingRescheduleCutoffMinutes: Math.max(
          0,
          Number(service.booking_reschedule_cutoff_minutes ?? 0)
        ),
        bookingCancelCutoffMinutes: Math.max(
          0,
          Number(service.booking_cancel_cutoff_minutes ?? 0)
        ),
        postVisitThankYouEnabled: service.post_visit_thank_you_enabled !== false,
        postVisitCouponEnabled: service.post_visit_coupon_enabled !== false,
        remarketingEnabled: service.remarketing_enabled !== false,
        remarketingInactiveDays: Math.max(7, Number(service.remarketing_inactive_days ?? 30)),
        birthdayCampaignEnabled: service.birthday_campaign_enabled !== false,
        autoReturnEnabled: service.auto_return_enabled !== false,
        autoReturnDays: Math.max(7, Number(service.auto_return_days ?? 30)),
        oneClickRescheduleEnabled: service.one_click_reschedule_enabled !== false,
        checkinQrEnabled: service.checkin_qr_enabled !== false,
        autoFeedbackEnabled: service.auto_feedback_enabled === true
      })
    });
    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setServiceFeedback(result.error || "Erro ao duplicar servico.");
      return;
    }
    setServiceFeedback(result.message || "Servico duplicado.");
    await loadServices(selectedBusinessId);
  }

  async function persistServicesOrder(ordered: ServiceItem[]) {
    await Promise.all(
      ordered.map((item, index) =>
        fetch(`/api/services/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayOrder: index })
        })
      )
    );
    await loadServices(selectedBusinessId);
  }

  async function handleMoveService(service: ServiceItem, direction: -1 | 1) {
    const visible = [...services];
    const currentIndex = visible.findIndex((s) => s.id === service.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= visible.length) {
      return;
    }
    const moved = [...visible];
    const [item] = moved.splice(currentIndex, 1);
    moved.splice(targetIndex, 0, item);
    try {
      await persistServicesOrder(moved);
    } catch {
      setServiceFeedback("Erro ao reordenar servicos.");
    }
  }

  async function updateServiceFromState() {
    if (!editingServiceId) {
      return false;
    }

    const durationMinutes = Number(editingDuration);
    const priceCents =
      editingPrice.trim() === "" ? null : Math.round(Number(editingPrice) * 100);

    const response = await fetch(`/api/services/${editingServiceId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: editingName,
        durationMinutes,
        priceCents,
        category: editingCategory || null,
        description: editingDescription || null,
        icon: editingIcon,
        color: editingColor,
        imageUrls: editingImages,
        bookingBufferBeforeMinutes: Math.max(0, Number(editingBookingBufferBefore) || 0),
        bookingBufferAfterMinutes: Math.max(0, Number(editingBookingBufferAfter) || 0),
        bookingMinNoticeMinutes: Math.max(0, Number(editingBookingMinNotice) || 0),
        bookingMaxDaysAhead: Math.max(1, Number(editingBookingMaxDays) || 60),
        bookingDailyLimit: editingBookingDailyLimit.trim()
          ? Math.max(1, Number(editingBookingDailyLimit) || 1)
          : null,
        bookingSlotCapacity: Math.max(1, Number(editingBookingSlotCapacity) || 1),
        waitlistEnabled: editingWaitlistEnabled,
        reminder24hEnabled: editingReminder24h,
        reminder2hEnabled: editingReminder2h,
        reminder30mEnabled: editingReminder30m,
        attendanceConfirmationRequired: editingAttendanceRequired,
        attendanceConfirmationDeadlineMinutes: Math.max(
          60,
          Number(editingAttendanceDeadline) || 1440
        ),
        autoReleaseUnconfirmed: editingAutoRelease,
        bookingRescheduleCutoffMinutes: Math.max(0, Number(editingRescheduleCutoff) || 0),
        bookingCancelCutoffMinutes: Math.max(0, Number(editingCancelCutoff) || 0),
        postVisitThankYouEnabled: editingPostVisitThankYou,
        postVisitCouponEnabled: editingPostVisitCoupon,
        remarketingEnabled: editingRemarketing,
        remarketingInactiveDays: Math.max(
          7,
          Number(editingRemarketingInactiveDays) || 30
        ),
        birthdayCampaignEnabled: editingBirthday,
        autoReturnEnabled: editingAutoReturn,
        autoReturnDays: Math.max(7, Number(editingAutoReturnDays) || 30),
        oneClickRescheduleEnabled: editingOneClickReschedule,
        checkinQrEnabled: editingCheckinQr,
        autoFeedbackEnabled: editingAutoFeedback
      })
    });

    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setServiceFeedback(result.error || "Erro ao atualizar servico.");
      return false;
    }

    setServiceFeedback(result.message || "Servico atualizado.");
    cancelEditingService();
    await loadServices(selectedBusinessId);
    return true;
  }

  async function handleSaveMessageTemplates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessageTemplateFeedback("");
    if (!selectedBusinessId) {
      setMessageTemplateFeedback("Selecione uma empresa para salvar os templates.");
      return;
    }

    const response = await fetch("/api/message-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: selectedBusinessId,
        templates: [
          { code: "GREETING", content: greetingTemplate },
          { code: "APPOINTMENT_CONFIRMATION", content: confirmationTemplate },
          { code: "APPOINTMENT_CANCELLED", content: cancelTemplate },
          { code: "APPOINTMENT_SHIFT_EARLIER_SHORT", content: shiftEarlierShortTemplate },
          { code: "APPOINTMENT_SHIFT_EARLIER_LONG", content: shiftEarlierLongTemplate },
          { code: "APPOINTMENT_SHIFT_LATER_SHORT", content: shiftLaterShortTemplate },
          { code: "APPOINTMENT_SHIFT_LATER_LONG", content: shiftLaterLongTemplate },
          {
            code: "APPOINTMENT_SHIFT_THRESHOLD_MINUTES",
            content: String(Math.max(1, Number(shiftTemplateThresholdMinutes) || 15))
          },
          { code: "WA_SERVICE_MENU_PROMPT", content: waServiceMenuPrompt },
          { code: "WA_SLOT_MENU_PROMPT", content: waSlotMenuPrompt },
          {
            code: "WA_SERVICE_OPTION_TITLE_TEMPLATE",
            content: waServiceOptionTitleTemplate
          },
          { code: "WA_SLOT_OPTION_TITLE_TEMPLATE", content: waSlotOptionTitleTemplate },
          {
            code: "WA_SERVICE_OPTION_DESCRIPTION_TEMPLATE",
            content: waServiceOptionDescriptionTemplate
          },
          {
            code: "WA_SLOT_OPTION_DESCRIPTION_TEMPLATE",
            content: waSlotOptionDescriptionTemplate
          },
          { code: "APPOINTMENT_REMINDER_24H", content: appointmentReminder24hTemplate },
          { code: "APPOINTMENT_REMINDER_2H", content: appointmentReminder2hTemplate },
          { code: "APPOINTMENT_REMINDER_30M", content: appointmentReminder30mTemplate },
          { code: "APPOINTMENT_CONFIRM_ATTENDANCE_24H", content: attendanceConfirm24hTemplate },
          {
            code: "APPOINTMENT_AUTO_RELEASE_UNCONFIRMED",
            content: autoReleaseUnconfirmedTemplate
          },
          {
            code: "POST_APPOINTMENT_THANK_YOU_REVIEW",
            content: postVisitThankYouReviewTemplate
          },
          { code: "POST_APPOINTMENT_NEXT_VISIT_COUPON", content: postVisitCouponTemplate },
          { code: "REMARKETING_INACTIVE_30D", content: remarketingInactive30dTemplate },
          { code: "REMARKETING_SPECIAL_PROMO", content: remarketingPromoTemplate },
          { code: "BIRTHDAY_MESSAGE", content: birthdayMessageTemplate }
        ]
      })
    });
    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setMessageTemplateFeedback(result.error || "Erro ao salvar templates.");
      return;
    }
    setMessageTemplateFeedback(result.message || "Templates salvos.");
    setMessageTemplateEditable({});
  }

  function renderMessageTemplateEditor(
    fieldKey: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    rows = 2
  ) {
    const editable = messageTemplateEditable[fieldKey] === true;
    return (
      <label>
        {label}
        {editable ? (
          <Textarea
            rows={rows}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <div className="templateSuggestionBox">
            <p>{value}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="templateSuggestionEditButton"
              onClick={() =>
                setMessageTemplateEditable((prev) => ({ ...prev, [fieldKey]: true }))
              }
            >
              Alterar
            </Button>
          </div>
        )}
      </label>
    );
  }

  async function handleCreateOfferPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOfferFeedback("");
    if (!selectedBusinessId) {
      setOfferFeedback("Selecione uma empresa para cadastrar planos/pacotes.");
      return;
    }
    const priceCents = Math.max(0, Math.round((Number(offerPrice) || 0) * 100));
    const response = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: selectedBusinessId,
        serviceId: offerServiceId || null,
        name: offerName,
        offerType,
        description: offerDescription || null,
        priceCents,
        sessionsIncluded:
          offerType === "package"
            ? Math.max(1, Math.floor(Number(offerSessionsIncluded) || 1))
            : null,
        billingCycleDays:
          offerType === "subscription"
            ? Math.max(1, Math.floor(Number(offerBillingCycleDays) || 30))
            : null
      })
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setOfferFeedback(result.error || "Erro ao criar plano/pacote.");
      return;
    }
    setOfferName("");
    setOfferDescription("");
    setOfferPrice("");
    setOfferSessionsIncluded("");
    setOfferBillingCycleDays("30");
    setOfferFeedback("Plano/pacote criado com sucesso.");
    await loadOfferPlans(selectedBusinessId);
  }

  async function handleRunRecurringBilling() {
    if (!selectedBusinessId) return;
    setBillingRunFeedback("");
    const response = await fetch("/api/customer-plans/run-billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: selectedBusinessId })
    });
    const result = (await response.json()) as {
      error?: string;
      createdCount?: number;
      message?: string;
    };
    if (!response.ok) {
      setBillingRunFeedback(result.error || "Erro ao executar cobrança recorrente.");
      return;
    }
    setBillingRunFeedback(
      `${result.message || "Cobrança recorrente executada."} Novas cobranças: ${result.createdCount || 0}.`
    );
  }

  async function handleSaveCalendarConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCalendarFeedback("");

    if (!selectedBusinessId) {
      setCalendarFeedback("Selecione uma empresa para configurar o calendario.");
      return;
    }

    const response = await fetch("/api/calendar-connections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        businessId: selectedBusinessId,
        calendarId,
        accessToken,
        refreshToken,
        tokenExpiresAt: tokenExpiresAt || null
      })
    });

    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setCalendarFeedback(result.error || "Erro ao salvar conexao.");
      return;
    }

    setCalendarFeedback(result.message || "Conexao salva com sucesso.");
    setAccessToken("");
    setRefreshToken("");
    await loadCalendarConnection(selectedBusinessId);
  }

  function handleGoogleConnect() {
    if (calendarMode !== "google") {
      setCalendarFeedback(
        "Ative o modo Google Calendar para usar a conexao com OAuth."
      );
      return;
    }
    if (!selectedBusinessId) {
      setCalendarFeedback("Selecione uma empresa antes de conectar o Google.");
      return;
    }

    const returnTo = "/";
    window.location.href = `/api/google/connect?businessId=${encodeURIComponent(
      selectedBusinessId
    )}&returnTo=${encodeURIComponent(returnTo)}`;
  }

  async function handleCalendarModeSave() {
    if (!selectedBusinessId) {
      setCalendarFeedback("Selecione uma empresa para definir o modo de agenda.");
      return;
    }

    const response = await fetch(`/api/businesses/${selectedBusinessId}/mode`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendarMode })
    });
    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setCalendarFeedback(result.error || "Erro ao atualizar modo de agenda.");
      return;
    }
    setCalendarFeedback(result.message || "Modo de agenda atualizado.");
    await loadBusinesses();
    if (role === "developer") {
      void loadDeveloperPlatformSummary({ quiet: true });
    }
  }

  function updateBusinessHour(
    weekday: number,
    patch: Partial<BusinessHoursState>
  ) {
    setBusinessHours((prev) =>
      prev.map((item) => (item.weekday === weekday ? { ...item, ...patch } : item))
    );
  }

  function updateDayShift(
    weekday: number,
    shiftId: string,
    patch: Partial<Pick<BusinessDayShift, "startTime" | "endTime">>
  ) {
    setBusinessHours((prev) =>
      prev.map((item) => {
        if (item.weekday !== weekday) return item;
        return {
          ...item,
          shifts: item.shifts.map((s) => (s.id === shiftId ? { ...s, ...patch } : s))
        };
      })
    );
  }

  function addDayShift(weekday: number) {
    setBusinessHours((prev) =>
      prev.map((item) => {
        if (item.weekday !== weekday) return item;
        const last = item.shifts[item.shifts.length - 1];
        const start = last?.endTime ?? "13:00";
        return {
          ...item,
          shifts: [
            ...item.shifts,
            { id: newShiftClientId(), startTime: start, endTime: "18:00" }
          ]
        };
      })
    );
  }

  function removeDayShift(weekday: number, shiftId: string) {
    setBusinessHours((prev) =>
      prev.map((item) => {
        if (item.weekday !== weekday) return item;
        if (item.shifts.length <= 1) return item;
        return { ...item, shifts: item.shifts.filter((s) => s.id !== shiftId) };
      })
    );
  }

  function startNewHourScheduleDraft() {
    setHourScheduleId(null);
    setHourValidityType("indeterminate");
    setHourCustomFrom("");
    setHourCustomTo("");
    setBusinessHours(
      weekDaysSchedule.map((day) => ({
        weekday: day.id,
        isActive: day.id >= 1 && day.id <= 5,
        shifts: [createDefaultShift()]
      }))
    );
  }

  function closeHourScheduleModal() {
    setHourScheduleModalOpen(false);
    setHourScheduleOverlapPrompt(null);
    if (selectedBusinessId) {
      void loadBusinessHours(selectedBusinessId).catch(() => {});
    }
  }

  function openHourScheduleModalCreate() {
    if (!selectedBusinessId) {
      setHoursFeedback("Selecione uma empresa para definir os horarios.");
      return;
    }
    setHoursFeedback("");
    startNewHourScheduleDraft();
    setHourScheduleModalMode("create");
    setHourScheduleModalOpen(true);
  }

  async function openHourScheduleModalEdit(row: HourScheduleGridRow) {
    if (!selectedBusinessId) {
      return;
    }
    setHoursFeedback("");
    try {
      await loadBusinessHours(selectedBusinessId, { scheduleId: row.id });
      setHourScheduleModalMode("edit");
      setHourScheduleModalOpen(true);
    } catch (error) {
      setHoursFeedback((error as Error).message);
    }
  }

  async function submitBusinessHoursSave(confirmOverlapResolution: boolean) {
    setHoursFeedback("");
    if (!selectedBusinessId) {
      setHoursFeedback("Selecione uma empresa para definir os horarios.");
      return;
    }

    const payload = {
      businessId: selectedBusinessId,
      ...(hourScheduleId ? { scheduleId: hourScheduleId } : {}),
      validityType: hourValidityType,
      ...(hourValidityType === "custom"
        ? { customValidFrom: hourCustomFrom, customValidTo: hourCustomTo }
        : {}),
      confirmOverlapResolution,
      hours: businessHours.map((item) => ({
        weekday: item.weekday,
        isActive: item.isActive,
        shifts: item.isActive
          ? item.shifts.map((s) => ({
              startTime: `${s.startTime}:00`,
              endTime: `${s.endTime}:00`
            }))
          : [{ startTime: "09:00:00", endTime: "18:00:00" }]
      }))
    };

    const response = await fetch("/api/business-hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = (await response.json()) as {
      error?: string;
      message?: string;
      scheduleId?: string;
      overlapConflict?: boolean;
      overlapping?: Array<{
        id: string;
        validityType: string;
        validFrom: string;
        validTo: string | null;
      }>;
    };

    if (response.status === 409 && result.overlapConflict) {
      setHourScheduleOverlapPrompt({
        message:
          result.message ||
          "Este periodo cruza vigencias de outras agendas. Confirme para ajustar as agendas afetadas.",
        overlapping: result.overlapping || []
      });
      return;
    }

    if (!response.ok) {
      setHoursFeedback(result.error || "Erro ao salvar horarios.");
      return;
    }

    setHourScheduleOverlapPrompt(null);
    setHoursFeedback(result.message || "Horarios salvos com sucesso.");
    setHourScheduleModalOpen(false);
    await loadBusinessHourSchedules(selectedBusinessId);
    if (result.scheduleId) {
      await loadBusinessHours(selectedBusinessId, { scheduleId: result.scheduleId });
    } else {
      await loadBusinessHours(selectedBusinessId);
    }
  }

  async function handleSaveBusinessHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHourScheduleOverlapPrompt(null);
    await submitBusinessHoursSave(false);
  }

  async function handleUpdateBusinessProfile(options?: {
    closeDeveloperBusinessModalOnSuccess?: boolean;
  }) {
    if (!selectedBusinessId) {
      setFeedback("Selecione uma empresa para atualizar.");
      setFeedbackType("error");
      return;
    }
    setIsUpdatingProfile(true);
    setFeedback("");
    setFeedbackType("");
    try {
      const response = await fetch(`/api/businesses/${selectedBusinessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          timezone: getBrowserIanaTimezone(),
          calendarMode,
          cnpj,
          legalName,
          tradeName,
          addressLine,
          addressNumber,
          addressComplement,
          neighborhood,
          city,
          state: stateUf,
          postalCode,
          contactName,
          contactPhone,
          contactEmail,
          cnaeCode,
          cnaeDescription,
          whatsappNumber: clientWhatsapp,
          googleReviewsEnabled,
          googleReviewsUrl: googleReviewsUrl.trim() || null,
          subscriptionPlanCode: planCode,
          subscriptionStatus: planStatus,
          monthlyAppointmentLimit: planMonthlyLimit.trim()
            ? Math.max(1, Number(planMonthlyLimit) || 1)
            : null,
          professionalLimit: planProfessionalLimit.trim()
            ? Math.max(1, Number(planProfessionalLimit) || 1)
            : null,
          automationsEnabled: planAutomationsEnabled,
          multiUnitEnabled: planMultiUnitEnabled
        })
      });

      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(result.error || "Erro ao atualizar cadastro.");
      }
      setFeedback(result.message || "Cadastro atualizado com sucesso.");
      setFeedbackType("success");
      await loadBusinesses();
      if (role === "developer" && options?.closeDeveloperBusinessModalOnSuccess) {
        setDeveloperNewBusinessModalOpen(false);
        setDeveloperBusinessModalMode("create");
        setBusinessIdBeforeNewModal(null);
      }
    } catch (error) {
      setFeedback((error as Error).message);
      setFeedbackType("error");
    } finally {
      setIsUpdatingProfile(false);
    }
  }

  async function handleRequestSubscriptionChange() {
    if (!selectedBusinessId) return;
    setSubscriptionRequestFeedback("");
    setSubscriptionRequestSaving(true);
    try {
      const response = await fetch("/api/subscription-change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: selectedBusinessId,
          currentPlanCode: planCode,
          requestedPlanCode: requestedPlanCode,
          note: subscriptionRequestNote.trim() || null
        })
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(result.error || "Não foi possível enviar a solicitação.");
      }
      setSubscriptionModalOpen(false);
      setSubscriptionRequestNote("");
      setSubscriptionRequestFeedback(
        result.message || "Solicitação enviada para confirmação do desenvolvedor."
      );
    } catch (error) {
      setSubscriptionRequestFeedback((error as Error).message);
    } finally {
      setSubscriptionRequestSaving(false);
    }
  }

  function clearAddressFields() {
    setAddressLine("");
    setNeighborhood("");
    setCity("");
    setStateUf("");
  }

  async function handleLookupCep(cepDigits: string) {
    setCepFeedback("");
    const result = await lookupViaCep(cepDigits);
    if (!result.ok) {
      setCepFeedback(result.message);
      clearAddressFields();
      return;
    }
    setAddressLine(result.data.logradouro || "");
    setNeighborhood(result.data.bairro || "");
    setCity(result.data.localidade || "");
    setStateUf(result.data.uf || "");
    setLastFetchedCep(cepDigits);
    setCepFeedback("Endereco preenchido automaticamente.");
  }

  function handlePostalCodeChange(rawValue: string) {
    const masked = maskCep(rawValue);
    const digits = masked.replace(/\D/g, "");
    setPostalCode(masked);

    if (digits.length < 8) {
      setLastFetchedCep("");
      setCepFeedback("");
      clearAddressFields();
      return;
    }

    if (digits.length === 8 && digits !== lastFetchedCep) {
      void handleLookupCep(digits);
    }
  }

  async function handleLookupCnpj() {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      setCnpjLookupFeedback("Informe um CNPJ válido com 14 dígitos.");
      return;
    }
    setCnpjLookupLoading(true);
    setCnpjLookupFeedback("");
    try {
      const response = await fetch(`/api/cnpj/${digits}`);
      const result = (await response.json()) as {
        error?: string;
        data?: {
          legalName: string;
          tradeName: string;
          addressLine: string;
          addressNumber: string;
          addressComplement: string;
          neighborhood: string;
          city: string;
          state: string;
          postalCode: string;
          cnaeCode: string;
          cnaeDescription: string;
        };
      };
      if (!response.ok || !result.data) {
        throw new Error(result.error || "Não foi possível consultar o CNPJ.");
      }
      setCnpjLookupPreview(result.data);
      setCnpjApplySelection(DEFAULT_CNPJ_APPLY_SELECTION);
      setCnpjLookupFeedback("Confirme os dados para aplicar ao cadastro.");
    } catch (error) {
      setCnpjLookupFeedback((error as Error).message);
    } finally {
      setCnpjLookupLoading(false);
    }
  }

  function applyCnpjLookupData() {
    if (!cnpjLookupPreview) return;
    const hasAnyFieldSelected = Object.values(cnpjApplySelection).some(Boolean);
    if (!hasAnyFieldSelected) {
      setCnpjLookupFeedback("Selecione ao menos um campo para aplicar.");
      return;
    }
    const data = cnpjLookupPreview;
    if (cnpjApplySelection.legalName) setLegalName(data.legalName || "");
    if (cnpjApplySelection.tradeName) setTradeName(data.tradeName || "");
    if (cnpjApplySelection.addressLine) setAddressLine(data.addressLine || "");
    if (cnpjApplySelection.addressNumber) setAddressNumber(data.addressNumber || "");
    if (cnpjApplySelection.addressComplement) {
      setAddressComplement(data.addressComplement || "");
    }
    if (cnpjApplySelection.neighborhood) setNeighborhood(data.neighborhood || "");
    if (cnpjApplySelection.city) setCity(data.city || "");
    if (cnpjApplySelection.state) setStateUf(data.state || "");
    if (cnpjApplySelection.postalCode) {
      setPostalCode(formatMaskedFromDigits(data.postalCode || "", maskCep));
    }

    if (cnpjApplySelection.cnae && data.cnaeCode) {
      const normalizedCode = data.cnaeCode.replace(/\D/g, "");
      const matched = CNAE_OPTIONS.find(
        (item) => item.code.replace(/\D/g, "") === normalizedCode
      );
      if (matched) {
        setCnaeCode(matched.code);
        setCnaeDescription(matched.description);
        setBusinessType(matched.description);
      } else {
        setCnaeCode("");
        setCnaeDescription(data.cnaeDescription || "");
        setBusinessType(data.cnaeDescription || "");
      }
    }

    setCnpjLookupFeedback("Dados do CNPJ aplicados ao cadastro.");
    setCnpjLookupPreview(null);
  }

  function toggleCnpjApplySelection(field: keyof CnpjApplySelection, value: boolean) {
    setCnpjApplySelection((prev) => ({ ...prev, [field]: value }));
  }

  function selectAllCnpjApplySelection(value: boolean) {
    setCnpjApplySelection({
      legalName: value,
      tradeName: value,
      addressLine: value,
      addressNumber: value,
      addressComplement: value,
      neighborhood: value,
      city: value,
      state: value,
      postalCode: value,
      cnae: value
    });
  }

  async function handleHolidayWorkingToggle(dateIso: string, treatAsWorkingDay: boolean) {
    if (!selectedBusinessId) return;
    setHolidayToggleLoading(true);
    try {
      const url = `/api/businesses/${selectedBusinessId}/holiday-working-days${
        treatAsWorkingDay ? "" : `?dateIso=${encodeURIComponent(dateIso)}`
      }`;
      const res = await fetch(url, {
        method: treatAsWorkingDay ? "POST" : "DELETE",
        headers: treatAsWorkingDay ? { "Content-Type": "application/json" } : undefined,
        body: treatAsWorkingDay ? JSON.stringify({ dateIso }) : undefined
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Falha ao salvar preferencia de feriado.");
      }
      setHolidayWorkingDaySet((prev) => {
        const next = new Set(prev);
        if (treatAsWorkingDay) next.add(dateIso);
        else next.delete(dateIso);
        return next;
      });
    } catch (error) {
      setAppointmentActionFeedback((error as Error).message);
    } finally {
      setHolidayToggleLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (authLoading) {
    return (
      <main className="page">
        <section className="card">
          <p>Carregando...</p>
        </section>
      </main>
    );
  }

  const selectedBusiness = businesses.find((business) => business.id === selectedBusinessId);
  const developerMetricsByBusiness = developerPlatformSummary?.byBusiness ?? [];
  const developerRowsRegistered = developerMetricsByBusiness.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    value: 1
  }));
  const developerRowsInternal = developerMetricsByBusiness
    .filter((b) => b.calendarMode !== "google")
    .map((b) => ({ id: b.id, name: b.name, slug: b.slug, value: 1 }));
  const developerRowsGoogle = developerMetricsByBusiness
    .filter((b) => b.calendarMode === "google")
    .map((b) => ({ id: b.id, name: b.name, slug: b.slug, value: 1 }));
  const developerRowsCustomers = developerMetricsByBusiness.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    value: b.customerCount
  }));
  const developerRowsServices = developerMetricsByBusiness.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    value: b.serviceCount
  }));
  const developerRowsAppointments = developerMetricsByBusiness.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    value: b.appointmentCount
  }));
  const severityOrder: Record<"critical" | "warning" | "ok", number> = {
    critical: 0,
    warning: 1,
    ok: 2
  };
  const developerRowsMonth = [...developerMetricsByBusiness]
    .map((b) => {
      const n = b.appointmentsThisMonth;
      const severity: "critical" | "warning" | "ok" =
        n === 0 ? "critical" : n <= 5 ? "warning" : "ok";
      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        value: n,
        severity
      };
    })
    .sort((a, b) => {
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return Number(a.value) - Number(b.value);
    });
  const developerRowsUpcoming = developerMetricsByBusiness.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    value: b.upcomingAppointmentCount
  }));
  const metricsByBusinessId = new Map(
    developerMetricsByBusiness.map((item) => [item.id, item] as const)
  );
  const pendingRequestCountByBusinessId = subscriptionChangeFeedbacks.reduce<Map<string, number>>(
    (acc, item) => {
      const key = item.businessId;
      const next = (acc.get(key) || 0) + (item.status === "pending" ? 1 : 0);
      acc.set(key, next);
      return acc;
    },
    new Map<string, number>()
  );
  const developerRowsOperationalUrgencies = businesses
    .map((b) => {
      const metrics = metricsByBusinessId.get(b.id);
      const hasWhatsapp = digitsOnly(b.whatsapp_number || "").length >= 12;
      const hasGoogle = b.calendar_mode === "google";
      const hasServices = Number(metrics?.serviceCount || 0) > 0;
      const hasCustomers = Number(metrics?.customerCount || 0) > 0;
      const pendingCount = Number(!hasWhatsapp) + Number(!hasGoogle) + Number(!hasServices) + Number(!hasCustomers);
      const severity: "critical" | "warning" =
        pendingCount >= 3 || !hasWhatsapp ? "critical" : "warning";
      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        pendingCount,
        severity,
      };
    })
    .filter((item) => item.pendingCount > 0)
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
      return b.pendingCount - a.pendingCount;
    })
    .map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      value: `${item.pendingCount} pend.`,
      severity: item.severity,
    }));
  const developerRowsCommunicationCenter = businesses
    .map((b) => {
      const hasWhatsapp = digitsOnly(b.whatsapp_number || "").length >= 12;
      const hasEmail = String(b.contact_email || "").includes("@");
      const pendingRequests = pendingRequestCountByBusinessId.get(b.id) || 0;
      const severity: "critical" | "warning" =
        pendingRequests > 0 || (!hasWhatsapp && !hasEmail) ? "critical" : "warning";
      return {
        id: b.id,
        name: b.name,
        slug: b.slug,
        hasWhatsapp,
        hasEmail,
        pendingRequests,
        severity,
      };
    })
    .filter((item) => !item.hasWhatsapp || !item.hasEmail || item.pendingRequests > 0)
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
      if (b.pendingRequests !== a.pendingRequests) return b.pendingRequests - a.pendingRequests;
      return a.name.localeCompare(b.name, "pt-BR");
    })
    .map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      value: `${item.hasWhatsapp ? "WA ok" : "WA pend."} · ${
        item.hasEmail ? "Email ok" : "Email pend."
      } · Req: ${item.pendingRequests}`,
      severity: item.severity,
    }));
  const analyticsRangeDays =
    categoryAnalyticsRange === "30d"
      ? 30
      : categoryAnalyticsRange === "60d"
        ? 60
        : categoryAnalyticsRange === "90d"
          ? 90
          : null;
  const analyticsCutoff = analyticsRangeDays
    ? new Date(Date.now() - analyticsRangeDays * 24 * 60 * 60 * 1000)
    : null;
  const customStartDate = categoryAnalyticsStartDate
    ? new Date(`${categoryAnalyticsStartDate}T00:00:00`)
    : null;
  const customEndDate = categoryAnalyticsEndDate
    ? new Date(`${categoryAnalyticsEndDate}T23:59:59.999`)
    : null;
  const analyticsBusinesses = businesses.filter((b) => {
    if (!b.created_at) return false;
    const d = new Date(b.created_at);
    if (Number.isNaN(d.getTime())) return false;
    if (categoryAnalyticsRange === "custom") {
      if (customStartDate && d < customStartDate) return false;
      if (customEndDate && d > customEndDate) return false;
      return true;
    }
    if (!analyticsCutoff) return true;
    return d >= analyticsCutoff;
  });
  const customRangeLabel =
    customStartDate || customEndDate
      ? `${categoryAnalyticsStartDate || "início"} até ${categoryAnalyticsEndDate || "hoje"}`
      : "intervalo personalizado";
  const analyticsRangeLabel =
    categoryAnalyticsRange === "90d"
      ? "últimos 90 dias"
      : categoryAnalyticsRange === "60d"
        ? "últimos 60 dias"
        : categoryAnalyticsRange === "30d"
          ? "últimos 30 dias"
          : customRangeLabel;
  const applyPresetRange = (days: 30 | 60 | 90) => {
    setCategoryAnalyticsRange(`${days}d` as CategoryAnalyticsRangeId);
    setCategoryAnalyticsStartDate("");
    setCategoryAnalyticsEndDate("");
    setCategoryPeriodLayerOpen(false);
  };

  const businessIntegrationsConfiguredCount = analyticsBusinesses.filter((business) => {
    const hasWhatsapp = digitsOnly(business.whatsapp_number || "").length >= 12;
    const usesGoogle = business.calendar_mode === "google";
    return hasWhatsapp || usesGoogle;
  }).length;
  const businessesGoogleCount = analyticsBusinesses.filter((b) => b.calendar_mode === "google").length;
  const businessesInternalCount = analyticsBusinesses.filter(
    (b) => (b.calendar_mode || "internal") === "internal"
  ).length;
  const businessesAutomationsCount = analyticsBusinesses.filter((b) => b.automations_enabled === true).length;
  const businessesMultiUnitCount = analyticsBusinesses.filter((b) => b.multi_unit_enabled === true).length;
  const businessesBothChannelsCount = analyticsBusinesses.filter((b) => {
    const hasWhatsapp = digitsOnly(b.whatsapp_number || "").length >= 12;
    return hasWhatsapp && b.calendar_mode === "google";
  }).length;
  const bothChannelsRate = analyticsBusinesses.length
    ? (businessesBothChannelsCount / analyticsBusinesses.length) * 100
    : 0;
  const businessesWithMonthlyLimitCount = analyticsBusinesses.filter(
    (b) => typeof b.monthly_appointment_limit === "number" && b.monthly_appointment_limit > 0
  ).length;
  const businessesIntegratedRate = analyticsBusinesses.length
    ? (businessIntegrationsConfiguredCount / analyticsBusinesses.length) * 100
    : 0;
  const businessesGoogleRate = analyticsBusinesses.length
    ? (businessesGoogleCount / analyticsBusinesses.length) * 100
    : 0;
  const businessesAutomationsRate = analyticsBusinesses.length
    ? (businessesAutomationsCount / analyticsBusinesses.length) * 100
    : 0;
  const s = developerPlatformSummary;
  const businessCreatedDates = analyticsBusinesses.reduce<Date[]>((acc, b) => {
    if (!b.created_at) return acc;
    const parsed = new Date(b.created_at);
    if (!Number.isNaN(parsed.getTime())) acc.push(parsed);
    return acc;
  }, []);
  const firstBusinessDate =
    businessCreatedDates.length > 0
      ? new Date(Math.min(...businessCreatedDates.map((d) => d.getTime())))
      : null;
  const firstBusinessDateLabel = firstBusinessDate
    ? firstBusinessDate.toLocaleDateString("pt-BR")
    : "sem histórico";
  const totalUsageDays = firstBusinessDate
    ? Math.max(1, Math.ceil((Date.now() - firstBusinessDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const totalUsageMonths = Math.max(1, Math.round(totalUsageDays / 30));

  const planUsageByCode = businesses.reduce<Record<string, number>>((acc, b) => {
    const key = String(b.subscription_plan_code || "free");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const topPlanCode =
    Object.entries(planUsageByCode).sort((a, b) => b[1] - a[1])[0]?.[0]?.toUpperCase() || "—";
  const topPlanCount = Object.entries(planUsageByCode).sort((a, b) => b[1] - a[1])[0]?.[1] || 0;
  const appointmentsThisMonthByBusinessId = new Map(
    developerMetricsByBusiness.map((item) => [item.id, item.appointmentsThisMonth] as const)
  );
  const planPriceOrder = [...monetizationPlans]
    .sort((a, b) => a.monthly_price_cents - b.monthly_price_cents)
    .map((p) => String(p.code));
  const planRankByCode = new Map(planPriceOrder.map((code, idx) => [code, idx] as const));
  const maxPlanRank = Math.max(0, planPriceOrder.length - 1);
  const upgradeCandidates = analyticsBusinesses.filter((b) => {
    const code = String(b.subscription_plan_code || "free");
    const rank = planRankByCode.get(code) ?? 0;
    if (rank >= maxPlanRank) return false;
    const limit = Number(b.monthly_appointment_limit || 0);
    if (limit <= 0) return false;
    const usageMonth = Number(appointmentsThisMonthByBusinessId.get(b.id) || 0);
    return usageMonth >= limit * 0.8;
  });
  const upgradePotentialCount = upgradeCandidates.length;
  const upgradePotentialRate = analyticsBusinesses.length
    ? (upgradePotentialCount / analyticsBusinesses.length) * 100
    : 0;
  const estimatedMrrCents = analyticsBusinesses.reduce((sum, b) => {
    const code = String(b.subscription_plan_code || "free");
    const plan = monetizationPlans.find((p) => p.code === code);
    return sum + (plan?.monthly_price_cents || 0);
  }, 0);

  const integrationRows = analyticsBusinesses.map((b) => {
    const hasWhatsapp = digitsOnly(b.whatsapp_number || "").length >= 12;
    const hasGoogle = b.calendar_mode === "google";
    const channels = Number(hasWhatsapp) + Number(hasGoogle);
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      value: `${channels}/2`,
    };
  });
  const subscriptionRows = analyticsBusinesses.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    value: `${String(b.subscription_plan_code || "free").toUpperCase()} · ${String(
      b.subscription_status || "active"
    )}`,
  }));
  const companyAnalyticsRows = analyticsBusinesses.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    value: 1,
  }));

  const businessesByCnae = Object.entries(
    analyticsBusinesses.reduce<Record<string, number>>((acc, b) => {
      const key = b.cnae_description || b.cnae_code || "Não informado";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([label, count]) => ({
      label,
      count,
      share: analyticsBusinesses.length ? (count / analyticsBusinesses.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const businessesByLocation = Object.entries(
    analyticsBusinesses.reduce<Record<string, number>>((acc, b) => {
      const key =
        b.city && b.state ? `${b.city}/${b.state}` : b.state ? `Sem cidade/${b.state}` : "Não informado";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([label, count]) => ({
      label,
      count,
      share: analyticsBusinesses.length ? (count / analyticsBusinesses.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const businessesByPlan = Object.entries(
    analyticsBusinesses.reduce<Record<string, number>>((acc, b) => {
      const key = String(b.subscription_plan_code || "free").toUpperCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([label, count]) => ({
      label,
      count,
      share: analyticsBusinesses.length ? (count / analyticsBusinesses.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const categoryAnalytics = {
    companies: {
      kpis: [
        {
          label: "Empresas ativas",
          value: String(analyticsBusinesses.length),
          helper: `${analyticsRangeLabel} (desde ${firstBusinessDateLabel})`,
          explain:
            "Quantidade total de empresas no período selecionado. Ajuda a medir crescimento e tamanho da base ativa da plataforma.",
        },
        {
          label: "Google Calendar",
          value: `${businessesGoogleRate.toFixed(0)}%`,
          helper: `${businessesGoogleCount} de ${analyticsBusinesses.length} empresas`,
          explain:
            "Percentual de empresas que operam com integração Google Calendar no período selecionado. Indica maturidade de integração da base.",
        },
        {
          label: "Integrações ativas",
          value: `${businessesIntegratedRate.toFixed(0)}%`,
          helper:
            totalUsageDays > 0
              ? `${businessIntegrationsConfiguredCount} empresas em ${totalUsageDays} dias de uso`
              : `${businessIntegrationsConfiguredCount} empresas`,
          explain:
            "Percentual de empresas com pelo menos um canal integrado (WhatsApp e/ou Google). Mede aderência operacional às integrações.",
        },
      ],
      table: {
        rows: companyAnalyticsRows,
        valueHeader: "Qtd.",
        emptyText: "Nenhuma empresa no período selecionado.",
      },
      insights: [
        businessesGoogleRate < 40
          ? `Adoção de Google Calendar em ${businessesGoogleRate.toFixed(
              0
            )}% da base. Priorize onboarding técnico porque integração ativa reduz trabalho manual, melhora confiabilidade de agenda e aumenta retenção operacional.`
          : "Adoção de Google Calendar saudável para o estágio atual.",
        businessesIntegratedRate < 60
          ? `Somente ${businessesIntegratedRate.toFixed(
              0
            )}% com integrações ativas. Isso limita automações e comunicação; elevar esse percentual tende a reduzir falhas operacionais e no-show.`
          : "Integrações com boa cobertura da base.",
        businessesInternalCount > businessesGoogleCount
          ? `Modo interno (${businessesInternalCount}) acima de Google (${businessesGoogleCount}). Avaliar migração para integração externa porque sincronização com ferramentas do cliente aumenta aderência ao fluxo real e reduz retrabalho de agenda.`
          : "Uso de calendário externo já compete com o modo interno.",
      ],
    },
    subscriptions: {
      kpis: [
        {
          label: "MRR estimado",
          value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
            estimatedMrrCents / 100
          ),
          helper:
            totalUsageMonths > 0
              ? `Referência acumulada em ~${totalUsageMonths} meses de operação`
              : "Soma por plano atual das empresas",
          explain:
            "Receita recorrente mensal estimada da base atual, calculada pela soma dos valores dos planos vinculados às empresas no período.",
        },
        {
          label: "Plano líder",
          value: topPlanCode,
          helper:
            businessesMultiUnitCount > 0
              ? `${topPlanCount} empresas · ${businessesMultiUnitCount} multi-unidade`
              : `${topPlanCount} empresas`,
          explain:
            "Plano com maior número de empresas no período selecionado. Ajuda a entender concentração de adoção e estratégia comercial dominante. Multi-unidade no rodapé indica contas com escala para precificação e upsell.",
        },
        {
          label: "Potencial de upgrade",
          value: `${upgradePotentialCount}`,
          helper:
            analyticsBusinesses.length > 0
              ? `${upgradePotentialRate.toFixed(0)}% da base no período (${analyticsRangeLabel})`
              : "Sem base suficiente no período",
          explain:
            "Quantidade de empresas próximas do limite mensal (>=80%) e com plano superior disponível. Mede oportunidade prática de upgrade comercial.",
        },
      ],
      table: {
        rows: subscriptionRows,
        valueHeader: "Plano / status",
        emptyText: "Nenhuma empresa para exibir.",
      },
      insights: [
        estimatedMrrCents === 0
          ? "MRR estimado zerado: revisar precificação e enquadramento dos planos."
          : "MRR estimado disponível para monitorar efeito de upgrades.",
        totalUsageDays > 0
          ? `Base histórica considerada: ${totalUsageDays} dias de uso (desde ${firstBusinessDateLabel}).`
          : "Sem base temporal suficiente para leitura histórica robusta.",
        businessesWithMonthlyLimitCount > 0
          ? "Há empresas com limite mensal definido; monitorar risco de estouro e upgrade."
          : "Sem limites mensais ativos; posicionamento tende a planos mais amplos.",
        upgradePotentialCount > 0
          ? `${upgradePotentialCount} empresas já operam perto do limite mensal e têm opção de plano superior: priorizar oferta de upgrade com ganho de capacidade.`
          : "Não há pressão relevante de limite mensal no período para justificar campanha de upgrade.",
        topPlanCount > 0
          ? `Plano ${topPlanCode} concentra maior base. Use como referência para estratégia de preço.`
          : "Sem concentração de plano identificada.",
        businessesMultiUnitCount > 0
          ? `${businessesMultiUnitCount} contas em multi-unidade: alinhar planos que liberam multi-unidade, suporte prioritário e oferta comercial de escala.`
          : "Nenhuma conta multi-unidade no período; priorize adoção de canais e upgrades de limite antes de empurrar pacotes multi-filial.",
      ],
    },
    integrations: {
      kpis: [
        {
          label: "Cobertura integração",
          value: `${businessesIntegratedRate.toFixed(0)}%`,
          helper:
            totalUsageDays > 0
              ? `${businessIntegrationsConfiguredCount} empresas ao longo de ${totalUsageDays} dias`
              : `${businessIntegrationsConfiguredCount} empresas`,
          explain:
            "Percentual da base com integração ativa. Quanto maior, maior a chance de automação, consistência operacional e comunicação efetiva.",
        },
        {
          label: "Automações ativas",
          value: `${businessesAutomationsRate.toFixed(0)}%`,
          helper: `${businessesAutomationsCount} empresas`,
          explain:
            "Percentual de empresas com automações habilitadas no período. Mede profundidade de uso dos recursos avançados da plataforma.",
        },
        {
          label: "Canais completos",
          value: `${bothChannelsRate.toFixed(0)}%`,
          helper: `${businessesBothChannelsCount} empresas com WhatsApp e Google`,
          explain:
            "Percentual da base com os dois canais principais ativos (mensagens e agenda externa). Mede prontidão para operação integrada e menor retrabalho ponta a ponta.",
        },
      ],
      table: {
        rows: integrationRows,
        valueHeader: "Canais ativos",
        emptyText: "Nenhuma empresa para exibir.",
      },
      insights: [
        businessesIntegratedRate < 50
          ? "Cobertura de integrações abaixo de 50%. Priorize playbook de ativação."
          : "Cobertura de integrações em nível razoável.",
        totalUsageDays > 0
          ? `Análise temporal cobre todo o uso da ferramenta desde ${firstBusinessDateLabel}.`
          : "Sem histórico temporal completo disponível.",
        businessesAutomationsRate < 30
          ? "Automações ainda pouco adotadas; revisar proposta de valor e onboarding."
          : "Automações com adoção relevante.",
        analyticsBusinesses.length > 0 && bothChannelsRate < 35
          ? `Apenas ${bothChannelsRate.toFixed(
              0
            )}% com WhatsApp e Google juntos. Priorize um fluxo de ativação dupla: reduz desencontro entre confirmações e agenda e melhora base para automações.`
          : "Boa parte da base combina mensagens com calendário Google quando há integração.",
      ],
    },
  } as const;

  const activeCategoryAnalytics = categoryAnalytics[developerDashboardCategory];

  function getDeveloperOverviewPanel(tab: DeveloperOverviewTabId): {
    value: number;
    caption: string;
    rows: DeveloperMetricBreakdownRow[];
    valueHeader: string;
    emptyText: string;
  } {
  switch (tab) {
    case "daily":
      return {
        value: s?.appointmentsThisMonth ?? 0,
        caption: "Agendamentos no mês corrente (UTC)",
        rows: developerRowsMonth,
        valueHeader: "No mês",
        emptyText: "Sem movimentação no período."
      };
    case "urgencies":
      return {
        value: developerRowsOperationalUrgencies.length,
        caption: "Empresas com pendências operacionais",
        rows: developerRowsOperationalUrgencies,
        valueHeader: "Pendências",
        emptyText: "Nenhuma urgência operacional no momento."
      };
    case "communication":
      return {
        value: developerRowsCommunicationCenter.length,
        caption: "Empresas com pendência de comunicação",
        rows: developerRowsCommunicationCenter,
        valueHeader: "Status",
        emptyText: "Central de comunicação sem pendências."
      };
    default:
      return {
        value: 0,
        caption: "",
        rows: developerRowsRegistered,
        valueHeader: "Qtd.",
        emptyText: ""
      };
  }
  }

  const developerOverviewPanels = DEVELOPER_OVERVIEW_TAB_ITEMS.map((item) => ({
    tabId: item.value,
    label: item.label,
    ...getDeveloperOverviewPanel(item.value)
  }));

  const selectedCnae = getCnaeByCode(selectedBusiness?.cnae_code || null);
  const suggestedTemplateByBusiness = selectedCnae?.templateKey || "";
  const localPriceFactor = getLocalPriceFactor(selectedBusiness?.state, selectedBusiness?.city);
  const whatsappConfigured = digitsOnly(clientWhatsapp).length >= 12;
  const googleConfigured = Boolean(tokenExpiresAt);
  const periodBounds = getPeriodBounds(clientCalendarAnchorDate, clientCalendarView);
  /** Mesmo critério do estado inicial do calendário (data UTC do relógio). */
  const calendarTodayIso = new Date().toISOString().slice(0, 10);
  const showGoToToday = !isTodayInCalendarPeriod(
    clientCalendarAnchorDate,
    clientCalendarView,
    calendarTodayIso
  );
  const hasAnyCnpjFieldSelected = Object.values(cnpjApplySelection).some(Boolean);
  const calendarPeriodLabel = `${formatDatePtBr(periodBounds.startDate)} - ${formatDatePtBr(
    periodBounds.endDate
  )}`;
  const appointmentsByDate = clientAppointments.reduce<Record<string, AppointmentSummary[]>>(
    (acc, item) => {
      const dateKey = item.starts_at.slice(0, 10);
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(item);
      return acc;
    },
    {}
  );
  const weekDaysInView = getWeekDays(clientCalendarAnchorDate);
  const monthGridCells = getMonthGridCells(clientCalendarAnchorDate);
  const selectedDateAppointments =
    clientCalendarSelectedDate && appointmentsByDate[clientCalendarSelectedDate]
      ? appointmentsByDate[clientCalendarSelectedDate]
      : [];
  const scheduleBusiness = businesses.find((b) => b.id === selectedBusinessId);
  const scheduleTimezone =
    scheduleBusiness?.timezone || "America/Sao_Paulo";
  const getHoursRuleForDate = (dateIso: string) => {
    const scheduleWeekday = resolveScheduleWeekday({
      dateIso,
      timezone: scheduleTimezone,
      uf: scheduleBusiness?.state,
      city: scheduleBusiness?.city,
      liberatedHolidayDates: holidayWorkingDaySet
    });
    return businessHours.find((item) => item.weekday === scheduleWeekday) ?? null;
  };
  const selectedDateLabel = clientCalendarSelectedDate
    ? formatDatePtBr(clientCalendarSelectedDate)
    : "";
  const selectedDateHoursRule = clientCalendarSelectedDate
    ? getHoursRuleForDate(clientCalendarSelectedDate)
    : null;
  const dailyDateInView = periodBounds.startDate;
  const dailyAppointments = appointmentsByDate[dailyDateInView] || [];
  const dailyHoursRule = getHoursRuleForDate(dailyDateInView);
  const dailyHolidayNames = holidayNamesByDate[dailyDateInView] || null;
  const selectedDateHolidayNames =
    clientCalendarSelectedDate && holidayNamesByDate[clientCalendarSelectedDate]
      ? holidayNamesByDate[clientCalendarSelectedDate]
      : null;
  const dailySegments: Array<{ start: number; end: number }> =
    dailyHoursRule && dailyHoursRule.isActive
      ? dailyHoursRule.shifts
          .map((s) => ({
            start: toMinutesFromHHMM(s.startTime),
            end: toMinutesFromHHMM(s.endTime)
          }))
          .filter((segment) => segment.start < segment.end)
      : [];
  const dayHourSlots = Array.from({ length: 24 }, (_, hour) => hour).filter((hour) => {
    const minuteMark = hour * 60;
    return dailySegments.some(
      (segment) => minuteMark >= segment.start && minuteMark < segment.end
    );
  });
  const filteredBusinesses = businesses.filter((business) => {
    const q = businessQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      business.name.toLowerCase().includes(q) ||
      business.slug.toLowerCase().includes(q) ||
      (business.city || "").toLowerCase().includes(q)
    );
  });
  const activeServiceCount = services.filter((service) => service.is_active).length;
  const activeBusinessDays = businessHours.filter(
    (item) => item.isActive && item.weekday >= 0 && item.weekday <= 6
  ).length;
  const templatesConfigured = [
    greetingTemplate,
    confirmationTemplate,
    cancelTemplate,
    shiftEarlierShortTemplate,
    shiftEarlierLongTemplate,
    shiftLaterShortTemplate,
    shiftLaterLongTemplate,
    waServiceMenuPrompt,
    waSlotMenuPrompt,
    waServiceOptionTitleTemplate,
    waSlotOptionTitleTemplate,
    waServiceOptionDescriptionTemplate,
    waSlotOptionDescriptionTemplate
  ].filter((item) => item.trim().length > 0).length;

  function handleSelectBusiness(id: string) {
    setDeveloperNewBusinessModalOpen(false);
    setDeveloperBusinessModalMode("create");
    setBusinessIdBeforeNewModal(null);
    setDeveloperBusinessCreatingNew(false);
    setSelectedBusinessId(id);
    setBusinessPickerOpen(false);
    setBusinessQuery("");
  }

  const developerBusinessConfigurationFields = (
    <>
      <FieldGroup
        title="Identificação da empresa"
        accordionId="identificacao"
        accordionOpen={developerBusinessFormSection === "identificacao"}
        onAccordionToggle={() => toggleDeveloperBusinessFormSection("identificacao")}
      >
        <label>
          Nome da empresa
          <Input
            placeholder="Ex.: Studio Ana"
            value={name}
            onChange={(event) => {
              const v = event.target.value;
              setName(v);
              if (v.trim()) {
                setDeveloperBusinessRequiredFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.name;
                  return next;
                });
              }
            }}
            onBlur={() => {
              if (!name.trim()) {
                setDeveloperBusinessRequiredFieldErrors((prev) => ({
                  ...prev,
                  name: "Informe o nome da empresa."
                }));
              } else {
                setDeveloperBusinessRequiredFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.name;
                  return next;
                });
              }
            }}
          />
          {developerBusinessRequiredFieldErrors.name ? (
            <small className="fieldInputError">{developerBusinessRequiredFieldErrors.name}</small>
          ) : null}
        </label>
        <label>
          CNPJ
          <div className="actionsRow">
            <Input
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(event) => setCnpj(maskCnpj(event.target.value))}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cnpjLookupLoading}
              onClick={() => void handleLookupCnpj()}
            >
              {cnpjLookupLoading ? "Buscando..." : "Buscar CNPJ"}
            </Button>
          </div>
          {cnpjLookupFeedback ? <small className="helperText">{cnpjLookupFeedback}</small> : null}
        </label>
        <label>
          Razão social
          <Input
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
            placeholder="Razão social da empresa"
          />
        </label>
        <label>
          Nome fantasia
          <Input
            value={tradeName}
            onChange={(event) => setTradeName(event.target.value)}
            placeholder="Nome fantasia"
          />
        </label>
        <label>
          Ramo da empresa (CNAE)
          <Select
            value={cnaeCode}
            onChange={(event) => {
              const code = event.target.value;
              const cnae = getCnaeByCode(code);
              setCnaeCode(code);
              setCnaeDescription(cnae?.description || "");
              setBusinessType(cnae?.description || "");
              if (code) {
                setDeveloperBusinessRequiredFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.cnaeCode;
                  return next;
                });
              }
            }}
            onBlur={() => {
              if (!cnaeCode) {
                setDeveloperBusinessRequiredFieldErrors((prev) => ({
                  ...prev,
                  cnaeCode: "Selecione o ramo da empresa (CNAE)."
                }));
              } else {
                setDeveloperBusinessRequiredFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.cnaeCode;
                  return next;
                });
              }
            }}
          >
            <option value="" disabled>
              Selecione
            </option>
            {CNAE_OPTIONS.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} - {item.description}
              </option>
            ))}
          </Select>
          {developerBusinessRequiredFieldErrors.cnaeCode ? (
            <small className="fieldInputError">
              {developerBusinessRequiredFieldErrors.cnaeCode}
            </small>
          ) : null}
        </label>
      </FieldGroup>

      <FieldGroup
        title="Endereço"
        accordionId="endereco"
        accordionOpen={developerBusinessFormSection === "endereco"}
        onAccordionToggle={() => toggleDeveloperBusinessFormSection("endereco")}
      >
        <label>
          CEP
          <Input
            value={postalCode}
            onChange={(event) => handlePostalCodeChange(event.target.value)}
            placeholder="00000-000"
          />
        </label>
        {cepFeedback ? <p className="feedbackOk">{cepFeedback}</p> : null}
        <label>
          Endereço (rua/avenida)
          <Input
            value={addressLine}
            onChange={(event) => setAddressLine(event.target.value)}
            placeholder="Rua, avenida, etc."
          />
        </label>
        <label>
          Número
          <Input
            value={addressNumber}
            onChange={(event) => setAddressNumber(event.target.value)}
            placeholder="Número"
          />
        </label>
        <label>
          Complemento
          <Input
            value={addressComplement}
            onChange={(event) => setAddressComplement(event.target.value)}
            placeholder="Sala, loja, referência"
          />
        </label>
        <label>
          Bairro
          <Input
            value={neighborhood}
            onChange={(event) => setNeighborhood(event.target.value)}
          />
        </label>
        <label>
          Cidade
          <Input value={city} onChange={(event) => setCity(event.target.value)} />
        </label>
        <label>
          UF
          <Input
            value={stateUf}
            onChange={(event) => setStateUf(event.target.value)}
            placeholder="SP"
          />
        </label>
      </FieldGroup>

      <FieldGroup
        title="Contato principal"
        accordionId="contato"
        accordionOpen={developerBusinessFormSection === "contato"}
        onAccordionToggle={() => toggleDeveloperBusinessFormSection("contato")}
      >
        <label>
          Nome do contato
          <Input
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
          />
        </label>
        <label>
          Telefone do contato
          <Input
            value={contactPhone}
            onChange={(event) => {
              setContactPhone(maskPhoneBr(event.target.value));
            }}
            placeholder="+55 (11) 99999-9999"
          />
        </label>
        <label>
          E-mail do contato
          <Input
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            placeholder="contato@empresa.com"
            type="email"
          />
        </label>
      </FieldGroup>

      <FieldGroup
        title="Integração"
        accordionId="integracao"
        accordionOpen={developerBusinessFormSection === "integracao"}
        onAccordionToggle={() => toggleDeveloperBusinessFormSection("integracao")}
      >
        <p className="helperText">
          Configure o número de WhatsApp que será vinculado à automação para identificação da
          empresa e roteamento das mensagens.
        </p>
        <label>
          WhatsApp da integração
          <Input
            value={clientWhatsapp}
            onChange={(event) => setClientWhatsapp(maskPhoneBr(event.target.value))}
            placeholder="+55 (11) 99999-9999"
          />
        </label>
      </FieldGroup>

      <FieldGroup
        title="Operação"
        accordionId="operacao"
        accordionOpen={developerBusinessFormSection === "operacao"}
        onAccordionToggle={() => toggleDeveloperBusinessFormSection("operacao")}
      >
        <p className="helperText">
          Fuso horário: <strong>{getBrowserIanaTimezone()}</strong> — detectado automaticamente
          neste dispositivo e aplicado ao criar ou atualizar o cadastro.
        </p>
        <label>
          Modo de agenda
          <Select
            value={calendarMode}
            onChange={(event) => setCalendarMode(event.target.value as "internal" | "google")}
          >
            <option value="internal">Interna (recomendada)</option>
            <option value="google">Google Calendar (opcional)</option>
          </Select>
        </label>
      </FieldGroup>
    </>
  );

  return (
    <div className="appLayout">
      {role === "developer" ? (
        <>
          <aside className="modernSidebar">
            <div className="modernSidebarBrand">
              <div className="modernSidebarLogo" aria-hidden>A</div>
              <span className="modernSidebarBrandName">Agendamento</span>
            </div>

            <nav className="modernSidebarNav">
              <p className="modernSidebarCaption">Dashboard</p>
              <button
                type="button"
                className={`modernSidebarItem${developerArea === "dashboard" && dashboardArea === "overview" ? " isActive" : ""}`}
                onClick={() => { setDeveloperArea("dashboard"); setDashboardArea("overview"); }}
              >
                <span className="modernSidebarIcon"><LayoutDashboard size={16} /></span>
                Visão geral
              </button>
              <button
                type="button"
                className={`modernSidebarItem${developerArea === "dashboard" && dashboardArea === "categories" ? " isActive" : ""}`}
                onClick={() => { setDeveloperArea("dashboard"); setDashboardArea("categories"); }}
              >
                <span className="modernSidebarIcon"><FolderKanban size={16} /></span>
                Gestão por categoria
              </button>
              <button
                type="button"
                className={`modernSidebarItem${developerArea === "dashboard" && dashboardArea === "communication" ? " isActive" : ""}`}
                onClick={() => { setDeveloperArea("dashboard"); setDashboardArea("communication"); }}
              >
                <span className="modernSidebarIcon"><MessageSquare size={16} /></span>
                Central de comunicação
              </button>

              <p className="modernSidebarCaption">Gerenciamento</p>
              <button
                type="button"
                className={`modernSidebarItem${developerArea === "configuration" && configurationArea === "business" ? " isActive" : ""}`}
                onClick={() => { setDeveloperArea("configuration"); setConfigurationArea("business"); handleDeveloperEmpresasOpenList(); }}
              >
                <span className="modernSidebarIcon"><Building2 size={16} /></span>
                Empresas
              </button>
              <button
                type="button"
                className={`modernSidebarItem${developerArea === "configuration" && configurationArea === "plans" ? " isActive" : ""}`}
                onClick={() => { setDeveloperArea("configuration"); setConfigurationArea("plans"); }}
              >
                <span className="modernSidebarIcon"><CreditCard size={16} /></span>
                Planos de assinatura
              </button>
              <button
                type="button"
                className={`modernSidebarItem${developerArea === "configuration" && configurationArea === "integrations" ? " isActive" : ""}`}
                onClick={() => { setDeveloperArea("configuration"); setConfigurationArea("integrations"); }}
              >
                <span className="modernSidebarIcon"><Plug size={16} /></span>
                Integrações
              </button>
            </nav>

            <div className="modernSidebarFooter">
              <div className="modernSidebarAvatar" aria-hidden>D</div>
              <div className="modernSidebarFooterInfo">
                <span>Desenvolvedor</span>
                <small>Painel da ferramenta</small>
              </div>
            </div>
          </aside>

          <div className="appMain">
            <section className="hero card pageHeroSticky pageHeroCompact">
              <div className="headerRow">
                <h1 className="gradientText">
                  {developerArea === "dashboard"
                    ? dashboardArea === "overview"
                      ? "Visão geral"
                      : dashboardArea === "categories"
                        ? "Gestão por categoria"
                        : "Central de comunicação"
                    : configurationArea === "business"
                      ? "Empresas"
                      : configurationArea === "plans"
                        ? "Planos de assinatura"
                        : "Integrações"}
                </h1>
                <div className="headerActions">
                  <ThemeToggle />
                  <Button type="button" variant="outline" onClick={() => void handleLogout()}>
                    Sair
                  </Button>
                </div>
              </div>
            </section>
            <div className="adminContent">
            <div className="grid adminGrid">
          {developerArea === "configuration" && configurationArea === "integrations" ? (
            <AdminCard
              className="full contextCard"
              title="Contexto operacional"
              description="Defina a empresa ativa antes de executar ações na plataforma (desenvolvedor)."
            >
              <div className="contextPicker">
                <div className="contextPickerSummary">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBusinessPickerOpen((open) => !open)}
                  >
                    {businessPickerOpen ? "Fechar seleção" : "Alterar"}
                  </Button>
                  <div className="contextInfoRow">
                    <span className="contextInfoLabel">Empresa ativa</span>
                    <span className="contextInfoValue">
                      {selectedBusiness
                        ? repairUtf8MisinterpretedAsLatin1(selectedBusiness.name)
                        : "Nenhuma empresa selecionada"}
                    </span>
                  </div>
                  <div className="contextInfoRow">
                    <span className="contextInfoLabel">Modo de agenda</span>
                    <span className="contextInfoValue">
                      {formatDeveloperCalendarModeLabel(selectedBusiness?.calendar_mode)}
                    </span>
                  </div>
                </div>

                {businessPickerOpen ? (
                  <div className="contextPickerPanel">
                    <Input
                      placeholder="Buscar empresa por nome, slug ou cidade..."
                      value={businessQuery}
                      onChange={(event) => setBusinessQuery(event.target.value)}
                    />
                    <div className="contextPickerList">
                      {filteredBusinesses.length === 0 ? (
                        <p className="helperText">Nenhuma empresa encontrada.</p>
                      ) : (
                        filteredBusinesses.map((business) => (
                          <button
                            key={business.id}
                            type="button"
                            className={`contextPickerItem ${
                              business.id === selectedBusinessId ? "isActive" : ""
                            }`}
                            onClick={() => handleSelectBusiness(business.id)}
                          >
                            <strong>{repairUtf8MisinterpretedAsLatin1(business.name)}</strong>
                            <small>
                              {business.timezone} — {formatDeveloperCalendarModeLabel(business.calendar_mode)}
                            </small>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </AdminCard>
          ) : null}
          {developerArea === "configuration" ? (
            <>
              {configurationArea === "business" ? (
                <>
                  <AdminCard
                    className="full"
                    title="Gerenciamento de empresas"
                    description="Cadastro, edição e visão em grade de todas as empresas da plataforma."
                  >
                    <DeveloperBusinessesAgGrid
                      rowData={businesses}
                      onEditRow={handleDeveloperEditBusiness}
                      onNewBusiness={handleDeveloperStartNewBusiness}
                    />
                    {feedback && !developerNewBusinessModalOpen ? (
                      <p
                        className={
                          feedbackType === "error" ? "feedbackError" : "feedbackOk"
                        }
                        style={{ marginTop: "12px" }}
                      >
                        {feedback}
                      </p>
                    ) : null}
                  </AdminCard>

                  {developerNewBusinessModalOpen ? (
                    <div
                      className="detailsModalBackdrop developerNewBusinessModalBackdrop"
                      onClick={() => {
                        if (cnpjLookupPreview || isSaving || isUpdatingProfile) return;
                        restoreDeveloperBusinessContextAfterClosingNewModal();
                      }}
                      role="presentation"
                    >
                      <article
                        className="detailsModalCard developerNewBusinessModalCard structuredFormModal"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="developerNewBusinessModalTitle"
                      >
                        <div className="structuredFormModalHeader">
                          <h2 id="developerNewBusinessModalTitle" className="integrationName">
                            {developerBusinessModalMode === "edit"
                              ? "Editar empresa"
                              : "Nova empresa"}
                          </h2>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isSaving || isUpdatingProfile}
                            onClick={() => restoreDeveloperBusinessContextAfterClosingNewModal()}
                          >
                            Fechar
                          </Button>
                        </div>
                        <form
                          className="structuredFormModalForm"
                          noValidate
                          onSubmit={handleSubmit}
                        >
                          <div className="structuredFormScroll form businessFormGrid">
                            {developerBusinessConfigurationFields}
                            {feedback ? (
                              <p
                                className={
                                  feedbackType === "error" ? "feedbackError" : "feedbackOk"
                                }
                              >
                                {feedback}
                              </p>
                            ) : null}
                          </div>
                          <div className="structuredFormFooter">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={isSaving || isUpdatingProfile}
                              onClick={() => restoreDeveloperBusinessContextAfterClosingNewModal()}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="submit"
                              disabled={isSaving || isUpdatingProfile}
                              className="saveButton"
                            >
                              {developerBusinessModalMode === "edit"
                                ? isUpdatingProfile
                                  ? "Salvando..."
                                  : "Salvar alterações"
                                : isSaving
                                  ? "Salvando..."
                                  : "Salvar"}
                            </Button>
                          </div>
                        </form>
                        {cnpjLookupPreview ? (
                          <div
                            className="detailsModalBackdrop developerNewBusinessCnpjOverlay"
                            onClick={() => setCnpjLookupPreview(null)}
                          >
                            <article
                              className="detailsModalCard"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="detailsPanelHeader">
                                <h3 className="integrationName">Confirmar dados do CNPJ</h3>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setCnpjLookupPreview(null)}
                                >
                                  Fechar
                                </Button>
                              </div>
                              <div className="list">
                                <div className="actionsRow">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => selectAllCnpjApplySelection(true)}
                                  >
                                    Marcar todos
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => selectAllCnpjApplySelection(false)}
                                  >
                                    Desmarcar todos
                                  </Button>
                                </div>
                                <div className="cnpjConfirmItem">
                                  <Checkbox
                                    checked={cnpjApplySelection.legalName}
                                    onChange={(event) =>
                                      toggleCnpjApplySelection("legalName", event.target.checked)
                                    }
                                    label=""
                                  />
                                  <div>
                                    <strong>Razão social</strong>
                                    <small>{cnpjLookupPreview.legalName || "-"}</small>
                                  </div>
                                </div>
                                <div className="cnpjConfirmItem">
                                  <Checkbox
                                    checked={cnpjApplySelection.tradeName}
                                    onChange={(event) =>
                                      toggleCnpjApplySelection("tradeName", event.target.checked)
                                    }
                                    label=""
                                  />
                                  <div>
                                    <strong>Nome fantasia</strong>
                                    <small>{cnpjLookupPreview.tradeName || "-"}</small>
                                  </div>
                                </div>
                                <div className="cnpjConfirmItem">
                                  <Checkbox
                                    checked={cnpjApplySelection.addressLine}
                                    onChange={(event) =>
                                      toggleCnpjApplySelection("addressLine", event.target.checked)
                                    }
                                    label=""
                                  />
                                  <div>
                                    <strong>Endereço (logradouro)</strong>
                                    <small>{cnpjLookupPreview.addressLine || "-"}</small>
                                  </div>
                                </div>
                                <div className="cnpjConfirmItem">
                                  <Checkbox
                                    checked={cnpjApplySelection.addressNumber}
                                    onChange={(event) =>
                                      toggleCnpjApplySelection("addressNumber", event.target.checked)
                                    }
                                    label=""
                                  />
                                  <div>
                                    <strong>Número</strong>
                                    <small>{cnpjLookupPreview.addressNumber || "-"}</small>
                                  </div>
                                </div>
                                <div className="cnpjConfirmItem">
                                  <Checkbox
                                    checked={cnpjApplySelection.addressComplement}
                                    onChange={(event) =>
                                      toggleCnpjApplySelection(
                                        "addressComplement",
                                        event.target.checked
                                      )
                                    }
                                    label=""
                                  />
                                  <div>
                                    <strong>Complemento</strong>
                                    <small>{cnpjLookupPreview.addressComplement || "-"}</small>
                                  </div>
                                </div>
                                <div className="cnpjConfirmItem">
                                  <Checkbox
                                    checked={cnpjApplySelection.neighborhood}
                                    onChange={(event) =>
                                      toggleCnpjApplySelection("neighborhood", event.target.checked)
                                    }
                                    label=""
                                  />
                                  <div>
                                    <strong>Bairro</strong>
                                    <small>{cnpjLookupPreview.neighborhood || "-"}</small>
                                  </div>
                                </div>
                                <div className="cnpjConfirmItem">
                                  <Checkbox
                                    checked={cnpjApplySelection.city}
                                    onChange={(event) =>
                                      toggleCnpjApplySelection("city", event.target.checked)
                                    }
                                    label=""
                                  />
                                  <div>
                                    <strong>Cidade</strong>
                                    <small>{cnpjLookupPreview.city || "-"}</small>
                                  </div>
                                </div>
                                <div className="cnpjConfirmItem">
                                  <Checkbox
                                    checked={cnpjApplySelection.state}
                                    onChange={(event) =>
                                      toggleCnpjApplySelection("state", event.target.checked)
                                    }
                                    label=""
                                  />
                                  <div>
                                    <strong>UF</strong>
                                    <small>{cnpjLookupPreview.state || "-"}</small>
                                  </div>
                                </div>
                                <div className="cnpjConfirmItem">
                                  <Checkbox
                                    checked={cnpjApplySelection.postalCode}
                                    onChange={(event) =>
                                      toggleCnpjApplySelection("postalCode", event.target.checked)
                                    }
                                    label=""
                                  />
                                  <div>
                                    <strong>CEP</strong>
                                    <small>
                                      {formatMaskedFromDigits(
                                        cnpjLookupPreview.postalCode || "",
                                        maskCep
                                      ) || "-"}
                                    </small>
                                  </div>
                                </div>
                                <div className="cnpjConfirmItem">
                                  <Checkbox
                                    checked={cnpjApplySelection.cnae}
                                    onChange={(event) =>
                                      toggleCnpjApplySelection("cnae", event.target.checked)
                                    }
                                    label=""
                                  />
                                  <div>
                                    <strong>CNAE principal</strong>
                                    <small>
                                      {cnpjLookupPreview.cnaeCode
                                        ? `${cnpjLookupPreview.cnaeCode} - ${cnpjLookupPreview.cnaeDescription || ""}`
                                        : "-"}
                                    </small>
                                  </div>
                                </div>
                              </div>
                              {!hasAnyCnpjFieldSelected ? (
                                <p className="feedbackError">
                                  Selecione ao menos um campo para aplicar.
                                </p>
                              ) : null}
                              <div className="actionsRow">
                                <Button
                                  type="button"
                                  onClick={applyCnpjLookupData}
                                  disabled={!hasAnyCnpjFieldSelected}
                                >
                                  Aplicar dados
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setCnpjLookupPreview(null)}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </article>
                          </div>
                        ) : null}
                      </article>
                    </div>
                  ) : null}
                </>
              ) : null}

              {configurationArea === "integrations" ? (
                <AdminCard
                  className="full"
                  title="Conexões da plataforma"
                  description="Visualize status, revise configurações e conecte os serviços da operação."
                >
                  <div className="integrationList">
                    <div className="integrationItem">
                      <div className="integrationMain">
                        <p className="integrationName">WhatsApp API</p>
                        <p className="integrationDescription">
                          Canal oficial de mensagens e atendimento automatizado.
                        </p>
                      </div>
                      <div className="integrationMeta">
                        <span
                          className={`integrationBadge ${
                            whatsappConfigured
                              ? "integrationBadge-ok"
                              : "integrationBadge-pending"
                          }`}
                        >
                          {whatsappConfigured ? "Conectado" : "Pendente"}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setConfigurationArea("business")}
                        >
                          {whatsappConfigured ? "Revisar número" : "Configurar número"}
                        </Button>
                      </div>
                    </div>

                    <div className="integrationItem">
                      <div className="integrationMain">
                        <p className="integrationName">Google Calendar</p>
                        <p className="integrationDescription">
                          Sincronização de agenda para empresas com modo Google.
                        </p>
                      </div>
                      <div className="integrationMeta">
                        <span
                          className={`integrationBadge ${
                            googleConfigured
                              ? "integrationBadge-ok"
                              : "integrationBadge-pending"
                          }`}
                        >
                          {googleConfigured ? "Conectado" : "Pendente"}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGoogleConnect}
                        >
                          {googleConfigured ? "Reconectar" : "Conectar"}
                        </Button>
                      </div>
                    </div>

                    <div className="integrationItem">
                      <div className="integrationMain">
                        <p className="integrationName">Supabase</p>
                        <p className="integrationDescription">
                          Banco de dados e persistência operacional da plataforma.
                        </p>
                      </div>
                      <div className="integrationMeta">
                        <span className="integrationBadge integrationBadge-ok">
                          Ativo no sistema
                        </span>
                        <Button type="button" variant="ghost" size="sm" disabled>
                          Gerenciado
                        </Button>
                      </div>
                    </div>

                    <div className="integrationItem">
                      <div className="integrationMain">
                        <p className="integrationName">n8n</p>
                        <p className="integrationDescription">
                          Orquestração de automações e execução de workflows.
                        </p>
                      </div>
                      <div className="integrationMeta">
                        <span className="integrationBadge integrationBadge-neutral">
                          Gerenciado no servidor
                        </span>
                        <Button type="button" variant="ghost" size="sm" disabled>
                          Gerenciado
                        </Button>
                      </div>
                    </div>
                  </div>
                </AdminCard>
              ) : null}

              {configurationArea === "plans" ? (
                <AdminCard
                  className="full"
                  title="Planos de assinatura"
                  description="Defina preços, limites e recursos dos planos disponíveis para as empresas."
                >
                  <DeveloperPlansAgGrid
                    rowData={monetizationPlans}
                    onCreated={async () => {
                      await loadMonetizationPlans();
                    }}
                  />
                </AdminCard>
              ) : null}

              {configurationArea === "integrations" ? (
                <AdminCard
                  className="full"
                  title="Integrações da plataforma"
                  description="Gerencie conexões e credenciais por empresa (WhatsApp e Google Calendar)."
                >
                  <div className="form">
                    <form className="form" onSubmit={handleSaveCalendarConnection}>
                      <label>
                        Calendar ID
                        <Input
                          value={calendarId}
                          onChange={(event) => setCalendarId(event.target.value)}
                          placeholder="primary"
                          required
                        />
                      </label>
                      <label>
                        Access Token
                        <Input
                          value={accessToken}
                          onChange={(event) => setAccessToken(event.target.value)}
                          placeholder="Cole aqui se quiser atualizar manualmente"
                        />
                      </label>
                      <label>
                        Refresh Token
                        <Input
                          value={refreshToken}
                          onChange={(event) => setRefreshToken(event.target.value)}
                          placeholder="Cole aqui o refresh token"
                        />
                      </label>
                      <label>
                        Expira em (ISO)
                        <Input
                          value={tokenExpiresAt}
                          onChange={(event) => setTokenExpiresAt(event.target.value)}
                          placeholder="2026-12-31T23:59:59.000Z"
                        />
                      </label>
                      <Button className="saveButton">Salvar conexão Google</Button>
                    </form>
                    {calendarFeedback ? <p className="feedbackOk">{calendarFeedback}</p> : null}
                  </div>
                </AdminCard>
              ) : null}
            </>
          ) : (
            <>
              {dashboardArea === "overview" ? (
                <>
                <AdminCard
                  className="full developerOverviewCard"
                  title="Visão geral"
                  description="Painel diário com foco em operação, urgências e comunicação."
                >
                  {developerPlatformSummaryLoading ? (
                    <p className="helperText">Carregando métricas…</p>
                  ) : null}
                  {developerPlatformSummaryError ? (
                    <p className="feedbackError">{developerPlatformSummaryError}</p>
                  ) : null}
                  {!developerPlatformSummaryLoading && !developerPlatformSummaryError ? (
                    <>
                      <div className="developerOverviewIntro">
                        <p className="developerOverviewIntroLead">
                          Volume do mês, pendências e contatos com a base. As linhas usam prioridade em
                          cores, no estilo de um painel de operações.
                        </p>
                        <div className="developerOverviewIntroMeta">
                          <span className="developerOverviewPill">
                            {developerOverviewPanels.length} painéis ativos
                          </span>
                          <span className="developerOverviewPill developerOverviewPillAccent">
                            Tempo real
                          </span>
                        </div>
                      </div>
                      <div className="developerOverviewGrid">
                        {developerOverviewPanels.map((panel) => {
                          const PanelIcon = DEVELOPER_OVERVIEW_ICONS[panel.tabId];
                          return (
                            <section
                              key={panel.tabId}
                              className={`developerOverviewPanel developerOverviewPanel--${panel.tabId}`}
                            >
                              <header className="developerOverviewPanelHead">
                                <div className="developerOverviewPanelIcon" aria-hidden>
                                  <PanelIcon strokeWidth={2} className="developerOverviewPanelIconSvg" />
                                </div>
                                <div className="developerOverviewPanelText">
                                  <div className="developerOverviewPanelTitleRow">
                                    <h3 className="developerOverviewPanelTitle">{panel.label}</h3>
                                    <span className="metricInfoTooltipWrap metricInfoTooltipWrap--below" tabIndex={0}>
                                      <span
                                        className="metricInfoTooltipTrigger"
                                        aria-label="Sobre este painel"
                                      >
                                        ?
                                      </span>
                                      <span className="metricInfoTooltipCard" role="tooltip">
                                        {DEVELOPER_OVERVIEW_HINTS[panel.tabId]}
                                      </span>
                                    </span>
                                  </div>
                                  <p className="developerOverviewPanelSubtitle">{panel.caption}</p>
                                </div>
                                <div className="developerOverviewPanelStatWrap">
                                  <div className="developerOverviewPanelStatBox">
                                    <span className="developerOverviewPanelStatValue">{panel.value}</span>
                                    <span className="developerOverviewPanelStatHint">{panel.valueHeader}</span>
                                  </div>
                                </div>
                              </header>
                              <div className="developerOverviewPanelScroll">
                                <DeveloperMetricTable
                                  rows={panel.rows}
                                  valueHeader={panel.valueHeader}
                                  emptyText={panel.emptyText}
                                  onContactRow={(row: DeveloperMetricBreakdownRow) => {
                                    setDeveloperCommunicationFocusBusinessId(row.id);
                                    setDeveloperArea("dashboard");
                                    setDashboardArea("communication");
                                  }}
                                />
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </AdminCard>
              </>
              ) : null}

              {dashboardArea === "communication" ? (
                <AdminCard
                  className="full"
                  title="Central de comunicação"
                  description="Histórico unificado com cada empresa (um thread por negócio). Atalhos para WhatsApp e e-mail; registros com canal e direção para auditoria e futuras integrações."
                >
                  <DeveloperCommunicationHub
                    businesses={businesses}
                    focusBusinessId={developerCommunicationFocusBusinessId}
                    onConsumedFocus={() => setDeveloperCommunicationFocusBusinessId(null)}
                  />
                </AdminCard>
              ) : null}

              {dashboardArea === "categories" ? (
                <AdminCard
                  className="full"
                  title="Gestão por categoria"
                  description="Painel operacional por categoria."
                >
                  <div className="form">
                    <Tabs
                      className="tabsRowOverflow"
                      variant="segmented"
                      aria-label="Categorias do painel do desenvolvedor"
                      value={developerDashboardCategory}
                      onChange={(v) => {
                        if (DEVELOPER_DASHBOARD_CATEGORY_ITEMS.some((item) => item.value === v)) {
                          setDeveloperDashboardCategory(v as DeveloperDashboardCategoryId);
                        }
                      }}
                      items={DEVELOPER_DASHBOARD_CATEGORY_ITEMS}
                    />
                    <div className="periodUi periodUiB">
                      <span className="periodUiLabel">Período</span>
                      <div className="periodUiPresetGroup">
                        <Button type="button" size="sm" variant="ghost" className={categoryAnalyticsRange === "30d" ? "isActive" : ""} onClick={() => applyPresetRange(30)}>30 dias</Button>
                        <Button type="button" size="sm" variant="ghost" className={categoryAnalyticsRange === "60d" ? "isActive" : ""} onClick={() => applyPresetRange(60)}>60 dias</Button>
                        <Button type="button" size="sm" variant="ghost" className={categoryAnalyticsRange === "90d" ? "isActive" : ""} onClick={() => applyPresetRange(90)}>90 dias</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => { setCategoryAnalyticsRange("custom"); setCategoryPeriodLayerOpen((v) => !v); }}>
                          Calendário
                        </Button>
                      </div>
                      {categoryPeriodLayerOpen ? (
                        <div className="periodUiLayer periodUiInline">
                          <label className="categoryPeriodDateField categoryPeriodDateFieldInline">
                            De
                            <Input
                              className="categoryPeriodDateInput"
                              type="date"
                              value={categoryAnalyticsStartDate}
                              onChange={(event) => {
                                setCategoryAnalyticsRange("custom");
                                setCategoryAnalyticsStartDate(event.target.value);
                              }}
                              max={categoryAnalyticsEndDate || undefined}
                            />
                          </label>
                          <label className="categoryPeriodDateField categoryPeriodDateFieldInline">
                            Até
                            <Input
                              className="categoryPeriodDateInput"
                              type="date"
                              value={categoryAnalyticsEndDate}
                              onChange={(event) => {
                                setCategoryAnalyticsRange("custom");
                                setCategoryAnalyticsEndDate(event.target.value);
                              }}
                              min={categoryAnalyticsStartDate || undefined}
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gap: "10px",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        marginTop: "10px",
                      }}
                    >
                      {activeCategoryAnalytics.kpis.map((kpi) => (
                        <article key={kpi.label} className="statCard">
                          <span className="metricCardLabelRow">
                            {kpi.label}
                            {kpi.explain ? (
                              <span className="metricInfoTooltipWrap" tabIndex={0}>
                                <span className="metricInfoTooltipTrigger" aria-label="Mais informações">
                                  ?
                                </span>
                                <span className="metricInfoTooltipCard" role="tooltip">
                                  {kpi.explain}
                                </span>
                              </span>
                            ) : null}
                          </span>
                          <strong>{kpi.value}</strong>
                          <small className="helperText">{kpi.helper}</small>
                        </article>
                      ))}
                    </div>

                    <div className="developerOverviewTableViewport">
                      <DeveloperMetricTable
                        rows={activeCategoryAnalytics.table.rows}
                        valueHeader={activeCategoryAnalytics.table.valueHeader}
                        emptyText={activeCategoryAnalytics.table.emptyText}
                      />
                    </div>

                    {developerDashboardCategory === "subscriptions" ? (
                      <div className="analyticsTableWrap">
                        <p className="helperText" style={{ marginBottom: 8 }}>
                          Feedbacks e solicitações das empresas sobre planos
                        </p>
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            flexWrap: "wrap",
                            marginBottom: "8px",
                          }}
                        >
                          {[
                            { value: "all", label: "Todos" },
                            { value: "pending", label: "Pendentes" },
                            { value: "approved", label: "Aprovadas" },
                            { value: "rejected", label: "Rejeitadas" },
                            { value: "cancelled", label: "Canceladas" },
                          ].map((item) => (
                            <Button
                              key={item.value}
                              type="button"
                              size="sm"
                              variant={
                                subscriptionFeedbackStatusFilter === item.value ? "primary" : "outline"
                              }
                              onClick={() =>
                                setSubscriptionFeedbackStatusFilter(
                                  item.value as SubscriptionFeedbackStatusFilter
                                )
                              }
                            >
                              {item.label}
                            </Button>
                          ))}
                        </div>
                        {subscriptionChangeFeedbacksError ? (
                          <p className="feedbackError">{subscriptionChangeFeedbacksError}</p>
                        ) : null}
                        {!subscriptionChangeFeedbacksError &&
                        subscriptionChangeFeedbacks.length === 0 ? (
                          <p className="helperText">Sem feedbacks de plano no momento.</p>
                        ) : null}
                        {!subscriptionChangeFeedbacksError &&
                        subscriptionChangeFeedbacks.length > 0 ? (
                          <table className="analyticsTable">
                            <thead>
                              <tr>
                                <th>Empresa</th>
                                <th>Mudança</th>
                                <th>Status</th>
                                <th>Observação</th>
                                <th>Data</th>
                              </tr>
                            </thead>
                            <tbody>
                              {subscriptionChangeFeedbacks.slice(0, 20).map((item) => (
                                <tr key={item.id}>
                                  <td>
                                    <strong>{item.businessName}</strong>
                                    {item.businessSlug ? (
                                      <small className="helperText"> {item.businessSlug}</small>
                                    ) : null}
                                  </td>
                                  <td>
                                    {String(item.currentPlanCode || "free").toUpperCase()} →{" "}
                                    {String(item.requestedPlanCode || "free").toUpperCase()}
                                  </td>
                                  <td>{item.status}</td>
                                  <td>{item.note || "—"}</td>
                                  <td>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : null}
                      </div>
                    ) : null}

                    {developerDashboardCategory === "companies" ? (
                      <div
                        style={{
                          display: "grid",
                          gap: "10px",
                          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                        }}
                      >
                        <div className="analyticsTableWrap">
                          <p className="helperText" style={{ marginBottom: 8 }}>
                            Distribuição por ramo/CNAE
                          </p>
                          <table className="analyticsTable">
                            <thead>
                              <tr>
                                <th>Ramo/CNAE</th>
                                <th>Empresas</th>
                                <th>% base</th>
                              </tr>
                            </thead>
                            <tbody>
                              {businessesByCnae.slice(0, 8).map((row) => (
                                <tr key={`cnae-${row.label}`}>
                                  <td>{row.label}</td>
                                  <td>{row.count}</td>
                                  <td>{row.share.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="analyticsTableWrap">
                          <p className="helperText" style={{ marginBottom: 8 }}>
                            Distribuição por localização
                          </p>
                          <table className="analyticsTable">
                            <thead>
                              <tr>
                                <th>Local</th>
                                <th>Empresas</th>
                                <th>% base</th>
                              </tr>
                            </thead>
                            <tbody>
                              {businessesByLocation.slice(0, 8).map((row) => (
                                <tr key={`location-${row.label}`}>
                                  <td>{row.label}</td>
                                  <td>{row.count}</td>
                                  <td>{row.share.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="analyticsTableWrap">
                          <p className="helperText" style={{ marginBottom: 8 }}>
                            Distribuição por plano de assinatura
                          </p>
                          <table className="analyticsTable">
                            <thead>
                              <tr>
                                <th>Plano</th>
                                <th>Empresas</th>
                                <th>% base</th>
                              </tr>
                            </thead>
                            <tbody>
                              {businessesByPlan.map((row) => (
                                <tr key={`plan-${row.label}`}>
                                  <td>{row.label}</td>
                                  <td>{row.count}</td>
                                  <td>{row.share.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}

                    <details className="analyticsBlock" style={{ marginTop: "6px" }} open>
                      <summary>Insights e ações recomendadas</summary>
                      <ul className="list">
                        {activeCategoryAnalytics.insights.map((insight) => (
                          <li key={insight}>
                            <small>{insight}</small>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                </AdminCard>
              ) : null}
            </>
          )}
            </div>
          </div>
          </div>
        </>
      ) : role === "owner" ? (
        <>
          <aside className="modernSidebar">
            <div className="modernSidebarBrand">
              <div className="modernSidebarLogo" aria-hidden>A</div>
              <span className="modernSidebarBrandName">Agendamento</span>
            </div>

            <nav className="modernSidebarNav">
              <p className="modernSidebarCaption">Dashboard</p>
              <button
                type="button"
                className={`modernSidebarItem${clientMainArea === "dashboard" && clientDashboardArea === "overview" ? " isActive" : ""}`}
                onClick={() => { setClientMainArea("dashboard"); setClientDashboardArea("overview"); }}
              >
                <span className="modernSidebarIcon"><LayoutDashboard size={16} /></span>
                Visão geral
              </button>
              <button
                type="button"
                className={`modernSidebarItem${clientMainArea === "dashboard" && clientDashboardArea === "analytics" ? " isActive" : ""}`}
                onClick={() => { setClientMainArea("dashboard"); setClientDashboardArea("analytics"); }}
              >
                <span className="modernSidebarIcon"><TrendingUp size={16} /></span>
                Análises
              </button>
              <button
                type="button"
                className={`modernSidebarItem${clientMainArea === "dashboard" && clientDashboardArea === "agenda" ? " isActive" : ""}`}
                onClick={() => { setClientMainArea("dashboard"); setClientDashboardArea("agenda"); }}
              >
                <span className="modernSidebarIcon"><BarChart2 size={16} /></span>
                Agenda
              </button>
              <button
                type="button"
                className={`modernSidebarItem${clientMainArea === "dashboard" && clientDashboardArea === "subscription" ? " isActive" : ""}`}
                onClick={() => { setClientMainArea("dashboard"); setClientDashboardArea("subscription"); }}
              >
                <span className="modernSidebarIcon"><CreditCard size={16} /></span>
                Assinatura
              </button>

              <p className="modernSidebarCaption">Configurações</p>
              <button
                type="button"
                className={`modernSidebarItem${clientMainArea === "settings" && clientSettingsArea === "messages" ? " isActive" : ""}`}
                onClick={() => { setClientMainArea("settings"); setClientSettingsArea("messages"); }}
              >
                <span className="modernSidebarIcon"><MessageSquare size={16} /></span>
                Comunicação
              </button>
              <button
                type="button"
                className={`modernSidebarItem${clientMainArea === "settings" && clientSettingsArea === "services" ? " isActive" : ""}`}
                onClick={() => { setClientMainArea("settings"); setClientSettingsArea("services"); }}
              >
                <span className="modernSidebarIcon"><Package size={16} /></span>
                Catálogo de serviços
              </button>
              <button
                type="button"
                className={`modernSidebarItem${clientMainArea === "settings" && clientSettingsArea === "publicSite" ? " isActive" : ""}`}
                onClick={() => { setClientMainArea("settings"); setClientSettingsArea("publicSite"); }}
              >
                <span className="modernSidebarIcon"><Globe size={16} /></span>
                Site público
              </button>
              <button
                type="button"
                className={`modernSidebarItem${clientMainArea === "settings" && clientSettingsArea === "hours" ? " isActive" : ""}`}
                onClick={() => { setClientMainArea("settings"); setClientSettingsArea("hours"); }}
              >
                <span className="modernSidebarIcon"><Clock size={16} /></span>
                Agenda de atendimento
              </button>
              <button
                type="button"
                className={`modernSidebarItem${clientMainArea === "settings" && clientSettingsArea === "customers" ? " isActive" : ""}`}
                onClick={() => { setClientMainArea("settings"); setClientSettingsArea("customers"); }}
              >
                <span className="modernSidebarIcon"><Users size={16} /></span>
                Clientes
              </button>
              <button
                type="button"
                className={`modernSidebarItem${clientMainArea === "settings" && clientSettingsArea === "finance" ? " isActive" : ""}`}
                onClick={() => { setClientMainArea("settings"); setClientSettingsArea("finance"); }}
              >
                <span className="modernSidebarIcon"><DollarSign size={16} /></span>
                Financeiro
              </button>
            </nav>

            <div className="modernSidebarFooter">
              <div className="modernSidebarAvatar" aria-hidden>A</div>
              <div className="modernSidebarFooterInfo">
                <span>Administrador</span>
                <small>Painel de configuração</small>
              </div>
            </div>
          </aside>

          <div className="appMain">
            <section className="hero card pageHeroSticky pageHeroCompact">
              <div className="headerRow">
                <h1 className="gradientText">
                  {clientMainArea === "dashboard"
                    ? clientDashboardArea === "overview"
                      ? "Visão geral"
                      : clientDashboardArea === "analytics"
                        ? "Análises"
                        : clientDashboardArea === "agenda"
                          ? "Agenda"
                          : "Assinatura"
                    : clientSettingsArea === "messages"
                      ? "Comunicação"
                      : clientSettingsArea === "services"
                        ? "Catálogo de serviços"
                        : clientSettingsArea === "publicSite"
                          ? "Site público"
                        : clientSettingsArea === "hours"
                          ? "Agenda de atendimento"
                          : clientSettingsArea === "customers"
                            ? "Clientes"
                            : "Financeiro"}
                </h1>
                <div className="headerActions">
                  <ThemeToggle />
                  <Button type="button" variant="outline" onClick={() => void handleLogout()}>
                    Sair
                  </Button>
                </div>
              </div>
            </section>
            <section className="grid clientGrid clientContent">
            {clientMainArea === "dashboard" &&
            (clientDashboardArea === "overview" ||
              clientDashboardArea === "analytics" ||
              clientDashboardArea === "agenda") ? (
              <AdminCard
                className="full"
                title={
                  clientDashboardArea === "overview"
                    ? "Visão geral"
                    : clientDashboardArea === "analytics"
                      ? "Análises"
                      : "Agenda"
                }
                description={
                  clientDashboardArea === "overview"
                    ? "Resumo rápido das métricas mais importantes."
                    : clientDashboardArea === "analytics"
                      ? "Detalhamento de desempenho, demanda e ROI."
                      : "Calendário completo e ações rápidas de agendamento."
                }
              >
                {clientDashboardArea === "overview" ? (
                  <div className="statsGrid">
                  <button
                    type="button"
                    className="metricShortcut"
                    onClick={() => {
                      setClientMainArea("settings");
                      setClientSettingsArea("messages");
                    }}
                  >
                    <MetricCard
                      value={templatesConfigured}
                      label="Modelos de mensagem ativos"
                      variant="indigo"
                    />
                  </button>
                  <button
                    type="button"
                    className="metricShortcut"
                    onClick={() => {
                      setClientMainArea("settings");
                      setClientSettingsArea("services");
                    }}
                  >
                    <MetricCard
                      value={activeServiceCount}
                      label="Serviços ativos"
                      variant="rose"
                    />
                  </button>
                  <button
                    type="button"
                    className="metricShortcut"
                    onClick={() => {
                      setClientMainArea("settings");
                      setClientSettingsArea("hours");
                    }}
                  >
                    <MetricCard
                      value={activeBusinessDays}
                      label="Dias de atendimento ativos"
                      variant="emerald"
                    />
                  </button>
                  </div>
                ) : null}
                {clientDashboardArea === "overview" && overviewMonetizationUsage ? (
                  <section className="planUsageCard">
                    <div className="planUsageHeader">
                      <span className="planBadge">
                        Plano {overviewMonetizationUsage.planCode.toUpperCase()}
                      </span>
                      <small>Status: {overviewMonetizationUsage.planStatus}</small>
                    </div>
                    <p className="helperText">
                      Consumo do mês: {overviewMonetizationUsage.currentAppointments}
                      {overviewMonetizationUsage.monthlyAppointmentLimit != null
                        ? ` / ${overviewMonetizationUsage.monthlyAppointmentLimit}`
                        : " / ilimitado"}
                    </p>
                    {overviewMonetizationUsage.monthlyAppointmentLimit != null ? (
                      <div className="planUsageProgress">
                        <div
                          className="planUsageProgressBar"
                          style={{
                            width: `${Math.min(
                              100,
                              (overviewMonetizationUsage.currentAppointments /
                                Math.max(1, overviewMonetizationUsage.monthlyAppointmentLimit)) *
                                100
                            )}%`
                          }}
                        />
                      </div>
                    ) : null}
                  </section>
                ) : null}
                {clientDashboardArea === "overview" && analyticsReport ? (
                  <div className="servicesStatsGrid">
                    <button
                      type="button"
                      className="servicesStatCard"
                      onClick={() => setClientDashboardArea("analytics")}
                    >
                      <small>Taxa de ocupação</small>
                      <strong>{(analyticsReport.performance.occupancyRate * 100).toFixed(1)}%</strong>
                    </button>
                    <button
                      type="button"
                      className="servicesStatCard"
                      onClick={() => setClientDashboardArea("analytics")}
                    >
                      <small>No-show geral</small>
                      <strong>{(analyticsReport.noShow.overallRate * 100).toFixed(1)}%</strong>
                    </button>
                    <button
                      type="button"
                      className="servicesStatCard"
                      onClick={() => setClientDashboardArea("analytics")}
                    >
                      <small>Conversão remarketing</small>
                      <strong>
                        {(analyticsReport.campaignRoi.remarketing.conversionRate * 100).toFixed(1)}%
                      </strong>
                    </button>
                  </div>
                ) : null}
                {clientDashboardArea === "overview" ? (
                  <div className="actionsRow">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={!selectedBusinessId}
                      title={
                        !selectedBusinessId
                          ? "Selecione um negócio para registrar bloqueios"
                          : "Férias, viagem ou pausa: bloqueia novos agendamentos no período"
                      }
                      onClick={() => setClosureModalOpen(true)}
                    >
                      <CalendarX size={15} aria-hidden />
                      Bloquear agenda
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setClientDashboardArea("analytics")}
                    >
                      Ver análises detalhadas
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setClientDashboardArea("agenda")}
                    >
                      Ir para agenda
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setClientDashboardArea("subscription")}
                    >
                      Ver assinatura
                    </Button>
                  </div>
                ) : null}
                {clientDashboardArea === "analytics" ? (
                  <>
                <div className="hoursRulesGrid">
                  <label>
                    Mês das análises
                    <Input
                      type="month"
                      value={analyticsMonth}
                      onChange={(event) => setAnalyticsMonth(event.target.value)}
                    />
                  </label>
                </div>
                {analyticsLoading ? <p className="helperText">Carregando análises...</p> : null}
                {analyticsError ? <p className="feedbackError">{analyticsError}</p> : null}
                {analyticsReport ? (
                  <>
                    <details className="analyticsBlock" open>
                      <summary>Métricas principais</summary>
                      <div className="actionsRow">
                        <Button
                          type="button"
                          variant={analyticsKpiViewMode === "chart" ? "primary" : "outline"}
                          size="sm"
                          onClick={() => setAnalyticsKpiViewMode("chart")}
                        >
                          Gráfico x tempo
                        </Button>
                        <Button
                          type="button"
                          variant={analyticsKpiViewMode === "table" ? "primary" : "outline"}
                          size="sm"
                          onClick={() => setAnalyticsKpiViewMode("table")}
                        >
                          Tabela comparativa
                        </Button>
                      </div>
                      {analyticsKpiViewMode === "chart" ? (
                        <ul className="list">
                          {analyticsTrendPoints.map((point) => (
                            <li key={`kpi-trend-${point.month}`} className="analyticsTrendRow">
                              <span>{formatMonthPt(point.month)}</span>
                              <div className="analyticsTrendBars">
                                <small>
                                  Ocupação {(point.occupancyRate * 100).toFixed(1)}% · No-show{" "}
                                  {(point.noShowRate * 100).toFixed(1)}% · Remarketing{" "}
                                  {(point.remarketingRate * 100).toFixed(1)}%
                                </small>
                                <div className="analyticsTrendBarTrack">
                                  <div
                                    className="analyticsTrendBar occupancy"
                                    style={{ width: `${Math.max(4, point.occupancyRate * 100)}%` }}
                                  />
                                </div>
                                <div className="analyticsTrendBarTrack">
                                  <div
                                    className="analyticsTrendBar noshow"
                                    style={{ width: `${Math.max(4, point.noShowRate * 100)}%` }}
                                  />
                                </div>
                                <div className="analyticsTrendBarTrack">
                                  <div
                                    className="analyticsTrendBar remarketing"
                                    style={{ width: `${Math.max(4, point.remarketingRate * 100)}%` }}
                                  />
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="analyticsTableWrap">
                          <table className="analyticsTable">
                            <thead>
                              <tr>
                                <th>Período</th>
                                <th>Taxa de ocupação</th>
                                <th>No-show geral</th>
                                <th>Conversão remarketing</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analyticsTrendPoints.map((point) => (
                                <tr key={`kpi-row-${point.month}`}>
                                  <td>{formatMonthPt(point.month)}</td>
                                  <td>{(point.occupancyRate * 100).toFixed(1)}%</td>
                                  <td>{(point.noShowRate * 100).toFixed(1)}%</td>
                                  <td>{(point.remarketingRate * 100).toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {analyticsTrendLoading ? (
                        <p className="helperText">Atualizando comparativos...</p>
                      ) : null}
                      {analyticsTrendError ? <p className="feedbackError">{analyticsTrendError}</p> : null}
                      <div className="servicesStatsGrid">
                        <div className="servicesStatCard">
                          <small>Taxa de ocupação</small>
                          <strong>{(analyticsReport.performance.occupancyRate * 100).toFixed(1)}%</strong>
                        </div>
                        <div className="servicesStatCard">
                          <small>No-show geral</small>
                          <strong>{(analyticsReport.noShow.overallRate * 100).toFixed(1)}%</strong>
                        </div>
                        <div className="servicesStatCard">
                          <small>Conversão remarketing</small>
                          <strong>
                            {(analyticsReport.campaignRoi.remarketing.conversionRate * 100).toFixed(1)}%
                          </strong>
                        </div>
                      </div>
                    </details>

                    <details className="analyticsBlock" open>
                      <summary>Performance operacional</summary>
                      <h3>Horários de pico</h3>
                      <ul className="list">
                        {analyticsReport.performance.peakHours.length === 0 ? (
                          <li>
                            <span>Sem dados no período.</span>
                          </li>
                        ) : (
                          analyticsReport.performance.peakHours.map((item) => (
                            <li key={`peak-${item.hour}`}>
                              <span>{String(item.hour).padStart(2, "0")}:00</span>
                              <small>{item.count} agendamento(s)</small>
                            </li>
                          ))
                        )}
                      </ul>
                      <h3>Serviços mais vendidos</h3>
                      <ul className="list">
                        {analyticsReport.performance.topServices.map((item) => (
                          <li key={`top-${item.serviceId}`}>
                            <span>{item.serviceName}</span>
                            <small>{item.soldCount} venda(s)</small>
                          </li>
                        ))}
                      </ul>
                    </details>

                    <details className="analyticsBlock" open>
                      <summary>Não-comparecimentos e demanda</summary>
                      <h3>Análise de não-comparecimentos</h3>
                      <p className="helperText">{analyticsReport.noShow.preventionSuggestion}</p>
                      <ul className="list">
                        {analyticsReport.noShow.problematicCustomers.length === 0 ? (
                          <li>
                            <span>Nenhum cliente problemático identificado.</span>
                          </li>
                        ) : (
                          analyticsReport.noShow.problematicCustomers.map((item) => (
                            <li key={`problematic-${item.customerId}`}>
                              <span>
                                {item.customerName} {item.isBlocked ? "(bloqueado)" : ""}
                              </span>
                              <small>
                                {(item.noShowRate * 100).toFixed(1)}% no-show · {item.noShowCount}/
                                {item.totalAppointments}
                              </small>
                            </li>
                          ))
                        )}
                      </ul>
                      <h3>Previsão de demanda (sugestão promocional)</h3>
                      <ul className="list">
                        {analyticsReport.demandForecast.promoSuggestions.length === 0 ? (
                          <li>
                            <span>Sem dados para prever demanda.</span>
                          </li>
                        ) : (
                          analyticsReport.demandForecast.promoSuggestions.map((item, index) => (
                            <li key={`promo-${item.weekday}-${item.hour}-${index}`}>
                              <span>
                                {weekDays[item.weekday]?.label || "Dia"}{" "}
                                {String(item.hour).padStart(2, "0")}:00
                              </span>
                              <small>{item.suggestion}</small>
                            </li>
                          ))
                        )}
                      </ul>
                    </details>

                    <details className="analyticsBlock" open>
                      <summary>Campanhas e integrações</summary>
                      <h3>ROI de campanhas</h3>
                      <ul className="list">
                        <li>
                          <span>Voltaram após remarketing</span>
                          <small>
                            {analyticsReport.campaignRoi.remarketing.converted} de{" "}
                            {analyticsReport.campaignRoi.remarketing.sent}
                          </small>
                        </li>
                        <li>
                          <span>Conversão de novos clientes</span>
                          <small>{analyticsReport.campaignRoi.newCustomers.converted}</small>
                        </li>
                        <li>
                          <span>Integração n8n</span>
                          <small>
                            Envie eventos para {analyticsReport.campaignRoi.n8nExpectedEventEndpoint}
                          </small>
                        </li>
                      </ul>
                    </details>

                    <details className="analyticsBlock" open>
                      <summary>Análises financeiras (clientes)</summary>
                      {financialCustomersLoading ? (
                        <p className="helperText">Carregando análises financeiras...</p>
                      ) : null}
                      {financialCustomersError ? (
                        <p className="feedbackError">{financialCustomersError}</p>
                      ) : null}
                      {financialCustomersAnalytics ? (
                        <>
                          <div className="actionsRow">
                            <Button
                              type="button"
                              variant={analyticsFinancialViewMode === "chart" ? "primary" : "outline"}
                              size="sm"
                              onClick={() => setAnalyticsFinancialViewMode("chart")}
                            >
                              Gráfico x tempo
                            </Button>
                            <Button
                              type="button"
                              variant={analyticsFinancialViewMode === "table" ? "primary" : "outline"}
                              size="sm"
                              onClick={() => setAnalyticsFinancialViewMode("table")}
                            >
                              Tabela comparativa
                            </Button>
                          </div>
                          {analyticsFinancialViewMode === "chart" ? (
                            <ul className="list">
                              {financialTrendPoints.map((point) => (
                                <li key={`finance-trend-${point.month}`} className="analyticsTrendRow">
                                  <span>{formatMonthPt(point.month)}</span>
                                  <div className="analyticsTrendBars">
                                    <small>
                                      Receita R$ {(point.totalPaidCents / 100).toFixed(2)} · Descontos R${" "}
                                      {(point.totalDiscountRedeemedCents / 100).toFixed(2)} · Promoções{" "}
                                      {point.promoPaymentsCount}
                                    </small>
                                    <div className="analyticsTrendBarTrack">
                                      <div
                                        className="analyticsTrendBar revenue"
                                        style={{
                                          width: `${Math.max(
                                            4,
                                            (point.totalPaidCents /
                                              Math.max(
                                                1,
                                                ...financialTrendPoints.map((item) => item.totalPaidCents)
                                              )) *
                                              100
                                          )}%`
                                        }}
                                      />
                                    </div>
                                    <div className="analyticsTrendBarTrack">
                                      <div
                                        className="analyticsTrendBar discount"
                                        style={{
                                          width: `${Math.max(
                                            4,
                                            (point.totalDiscountRedeemedCents /
                                              Math.max(
                                                1,
                                                ...financialTrendPoints.map(
                                                  (item) => item.totalDiscountRedeemedCents
                                                )
                                              )) *
                                              100
                                          )}%`
                                        }}
                                      />
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="analyticsTableWrap">
                              <table className="analyticsTable">
                                <thead>
                                  <tr>
                                    <th>Período</th>
                                    <th>Faturamento</th>
                                    <th>Descontos (fidelidade)</th>
                                    <th>Pagamentos promocionais</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {financialTrendPoints.map((point) => (
                                    <tr key={`finance-row-${point.month}`}>
                                      <td>{formatMonthPt(point.month)}</td>
                                      <td>R$ {(point.totalPaidCents / 100).toFixed(2)}</td>
                                      <td>R$ {(point.totalDiscountRedeemedCents / 100).toFixed(2)}</td>
                                      <td>{point.promoPaymentsCount}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {financialTrendLoading ? (
                            <p className="helperText">Atualizando comparativos...</p>
                          ) : null}
                          {financialTrendError ? (
                            <p className="feedbackError">{financialTrendError}</p>
                          ) : null}
                          <div className="servicesStatsGrid">
                            <div className="servicesStatCard">
                              <small>Faturamento total (clientes)</small>
                              <strong>
                                R$ {(financialCustomersAnalytics.totalPaidCents / 100).toFixed(2)}
                              </strong>
                            </div>
                            <div className="servicesStatCard">
                              <small>Ticket médio</small>
                              <strong>
                                R$ {(financialCustomersAnalytics.averageTicketCents / 100).toFixed(2)}
                              </strong>
                            </div>
                            <div className="servicesStatCard">
                              <small>Descontos aplicados (fidelidade)</small>
                              <strong>
                                R$ {(financialCustomersAnalytics.totalDiscountRedeemedCents / 100).toFixed(2)}
                              </strong>
                            </div>
                            <div className="servicesStatCard">
                              <small>Pagamentos com promoção/cupom</small>
                              <strong>{financialCustomersAnalytics.promoPaymentsCount}</strong>
                            </div>
                            <div className="servicesStatCard">
                              <small>Pacotes ativos</small>
                              <strong>{financialCustomersAnalytics.activePackageContracts}</strong>
                            </div>
                            <div className="servicesStatCard">
                              <small>Assinaturas ativas</small>
                              <strong>{financialCustomersAnalytics.activeSubscriptionContracts}</strong>
                            </div>
                          </div>
                          <ul className="list">
                            <li>
                              <span>Receita com pagamentos promocionais</span>
                              <small>R$ {(financialCustomersAnalytics.promoRevenueCents / 100).toFixed(2)}</small>
                            </li>
                            <li>
                              <span>Pagamentos no período</span>
                              <small>{financialCustomersAnalytics.paidCount}</small>
                            </li>
                          </ul>
                          <h3>Planos de fidelidade mais contratados no mês</h3>
                          <ul className="list">
                            {financialCustomersAnalytics.topLoyaltyOffers.length === 0 ? (
                              <li>
                                <span>Nenhuma contratação de plano/pacote no período.</span>
                              </li>
                            ) : (
                              financialCustomersAnalytics.topLoyaltyOffers.map((item) => (
                                <li key={item.offerId}>
                                  <span>
                                    {item.offerName} ({item.offerType === "subscription" ? "Assinatura" : "Pacote"})
                                  </span>
                                  <small>{item.startedCount} contratação(ões)</small>
                                </li>
                              ))
                            )}
                          </ul>
                        </>
                      ) : null}
                    </details>
                  </>
                ) : null}
                  </>
                ) : null}
                {clientDashboardArea === "agenda" ? (
                  <>
                <div className="dashboardCalendarHeader">
                  <div className="dashboardCalendarTopRow">
                    <div className="actionsRow">
                      <Button
                        type="button"
                        variant={clientCalendarView === "day" ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setClientCalendarView("day")}
                      >
                        Diario
                      </Button>
                      <Button
                        type="button"
                        variant={clientCalendarView === "week" ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setClientCalendarView("week")}
                      >
                        Semanal
                      </Button>
                      <Button
                        type="button"
                        variant={clientCalendarView === "month" ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setClientCalendarView("month")}
                      >
                        Mensal
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={!selectedBusinessId}
                        title={
                          !selectedBusinessId
                            ? "Selecione um negócio para registrar bloqueios"
                            : "Férias, viagem ou pausa: bloqueia novos agendamentos no período"
                        }
                        onClick={() => setClosureModalOpen(true)}
                      >
                        <CalendarX size={15} aria-hidden />
                        Bloquear agenda
                      </Button>
                    </div>
                    {showGoToToday ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        title="Voltar para a semana, o mês ou o dia que contém hoje"
                        onClick={() => setClientCalendarAnchorDate(calendarTodayIso)}
                      >
                        Dia atual
                      </Button>
                    ) : null}
                  </div>
                  <div className="actionsRow dashboardCalendarNavRow">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setClientCalendarAnchorDate(
                          shiftCalendarAnchor(clientCalendarAnchorDate, -1, clientCalendarView)
                        )
                      }
                    >
                      Anterior
                    </Button>
                    <span className="helperText">{calendarPeriodLabel}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setClientCalendarAnchorDate(
                          shiftCalendarAnchor(clientCalendarAnchorDate, 1, clientCalendarView)
                        )
                      }
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
                <ul className="list">
                  <li>
                    <span>Agendamentos no período</span>
                    <strong>{clientAppointments.length}</strong>
                  </li>
                </ul>
                <div className="dashboardCalendarLayout">
                  <div className="dashboardCalendarBoard">
                    {clientAppointmentsLoading ? (
                      <p className="helperText">Carregando agenda...</p>
                    ) : clientCalendarView === "day" ? (
                      <div className="calendarDayTimeline">
                        {dailyHolidayNames && dailyHolidayNames.length > 0 ? (
                          <div
                            className={`calendarHolidayBanner ${
                              holidayWorkingDaySet.has(dailyDateInView) ? "isWorking" : ""
                            }`}
                          >
                            <strong>Feriado (informativo)</strong>
                            <p>{dailyHolidayNames.join(" · ")}</p>
                            <Checkbox
                              className="calendarHolidayCheckbox"
                              label="Liberar esta data (usar horário do dia da semana, não a regra de Feriados)"
                              checked={holidayWorkingDaySet.has(dailyDateInView)}
                              disabled={holidayToggleLoading}
                              onChange={(event) =>
                                void handleHolidayWorkingToggle(
                                  dailyDateInView,
                                  event.target.checked
                                )
                              }
                            />
                            {holidayWorkingDaySet.has(dailyDateInView) ? (
                              <small className="calendarHolidayBannerHint">
                                Exceção: horário do dia da semana (não a regra de Feriados).
                              </small>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="calendarDayAppointments">
                          {!dailyHoursRule || !dailyHoursRule.isActive ? (
                            <p className="helperText">
                              Este dia está sem atendimento na Agenda de atendimento.
                            </p>
                          ) : dailyAppointments.length === 0 ? (
                            <p className="helperText">Nenhum agendamento neste dia.</p>
                          ) : (
                            dailyAppointments.map((appointment) => (
                              <button
                                key={appointment.id}
                                type="button"
                                className={`calendarDayItem ${
                                  clientCalendarSelectedDate === dailyDateInView ? "isSelected" : ""
                                }`}
                                onClick={() => setClientCalendarSelectedDate(dailyDateInView)}
                              >
                                <strong>
                                  {appointment.starts_at.slice(11, 16)} -{" "}
                                  {appointment.ends_at.slice(11, 16)}
                                </strong>
                                <small>
                                  {appointment.customer_name || appointment.customer_phone}
                                </small>
                              </button>
                            ))
                          )}
                        </div>
                        <div className="calendarHourGrid">
                          {!dailyHoursRule || !dailyHoursRule.isActive ? (
                            <p className="helperText">
                              Sem horários disponíveis para este dia.
                            </p>
                          ) : dayHourSlots.length === 0 ? (
                            <p className="helperText">
                              Não há faixas horárias válidas configuradas neste dia.
                            </p>
                          ) : (
                            dayHourSlots.map((hour) => {
                            const hourLabel = String(hour).padStart(2, "0");
                            const hourItems = dailyAppointments.filter(
                              (item) => Number(item.starts_at.slice(11, 13)) === hour
                            );
                            return (
                              <div key={hour} className="calendarHourRow">
                                <span>{hourLabel}:00</span>
                                <div>
                                  {hourItems.length === 0 ? (
                                    <small>Sem agendamento</small>
                                  ) : (
                                    hourItems.map((item) => (
                                      <small key={item.id}>
                                        {item.starts_at.slice(11, 16)} {item.customer_name || item.customer_phone}
                                      </small>
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                            })
                          )}
                        </div>
                      </div>
                    ) : clientCalendarView === "week" ? (
                      <div className="calendarWeekGrid">
                        {weekDaysInView.map((dateKey) => {
                          const items = appointmentsByDate[dateKey] || [];
                          const hoursRule = getHoursRuleForDate(dateKey);
                          const isClosed = !hoursRule || !hoursRule.isActive;
                          const hNames = holidayNamesByDate[dateKey];
                          return (
                            <button
                              key={dateKey}
                              type="button"
                              className={`calendarDayCard ${
                                clientCalendarSelectedDate === dateKey ? "isSelected" : ""
                              }`}
                              onClick={() => setClientCalendarSelectedDate(dateKey)}
                            >
                              <strong>{formatDatePtBr(dateKey)}</strong>
                              {hNames && hNames.length > 0 ? (
                                holidayWorkingDaySet.has(dateKey) ? (
                                  <small className="calendarHolidayWorking" title="Excecao: horario do dia">
                                    Lib. feriado
                                  </small>
                                ) : (
                                  <small
                                    className="calendarHolidayTag"
                                    title={hNames.join(" · ")}
                                  >
                                    Feriado · {hNames[0]}
                                    {hNames.length > 1 ? ` +${hNames.length - 1}` : ""}
                                  </small>
                                )
                              ) : null}
                              {isClosed ? <span className="calendarClosedBadge">Fechado</span> : null}
                              <span>{items.length} agendamento(s)</span>
                              {items.slice(0, 2).map((appointment) => (
                                <small key={appointment.id}>
                                  {appointment.starts_at.slice(11, 16)} -{" "}
                                  {appointment.customer_name || appointment.customer_phone}
                                </small>
                              ))}
                              {items.length > 2 ? <small>+{items.length - 2} mais</small> : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="calendarMonthGrid">
                        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => (
                          <div key={day} className="calendarMonthHeader">
                            {day}
                          </div>
                        ))}
                        {monthGridCells.map((cell, cellIndex) => {
                          if (cell.kind === "pad") {
                            return (
                              <div
                                key={`month-pad-${cellIndex}`}
                                className="calendarMonthCellEmpty"
                                aria-hidden
                              />
                            );
                          }
                          const dateKey = cell.dateIso;
                          const items = appointmentsByDate[dateKey] || [];
                          const dateObj = new Date(`${dateKey}T12:00:00Z`);
                          const hoursRule = getHoursRuleForDate(dateKey);
                          const isClosed = !hoursRule || !hoursRule.isActive;
                          const hNamesM = holidayNamesByDate[dateKey];
                          return (
                            <button
                              key={dateKey}
                              type="button"
                              className={`calendarMonthCell ${
                                clientCalendarSelectedDate === dateKey ? "isSelected" : ""
                              }`}
                              onClick={() => setClientCalendarSelectedDate(dateKey)}
                            >
                              <strong>{String(dateObj.getUTCDate()).padStart(2, "0")}</strong>
                              {hNamesM && hNamesM.length > 0 ? (
                                holidayWorkingDaySet.has(dateKey) ? (
                                  <small className="calendarHolidayWorking" title="Excecao: horario do dia">
                                    Lib.
                                  </small>
                                ) : (
                                  <small
                                    className="calendarHolidayTag"
                                    title={hNamesM.join(" · ")}
                                  >
                                    Feriado
                                  </small>
                                )
                              ) : null}
                              {isClosed ? <small className="calendarClosedText">Fechado</small> : null}
                              {items.slice(0, 2).map((appointment) => (
                                <small key={appointment.id}>{appointment.starts_at.slice(11, 16)}</small>
                              ))}
                              {items.length > 2 ? <small>+{items.length - 2} mais</small> : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <p className="calendarHolidayFooterNote">
                  Feriados conforme UF/cidade do cadastro. Padrão na linha Feriados da Agenda; no
                  calendário, libere uma data para usar o horário do dia da semana.
                </p>
                {clientCalendarSelectedDate ? (
                  <div
                    className="detailsModalBackdrop"
                    onClick={() => setClientCalendarSelectedDate(null)}
                  >
                    <article
                      className="detailsModalCard"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="detailsPanelHeader">
                        <h3 className="integrationName">{selectedDateLabel}</h3>
                        <div className="actionsRow">
                          <p className="integrationDescription">
                            {selectedDateAppointments.length} agendamento(s)
                          </p>
                          {clientCalendarView !== "day" ? (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                if (!clientCalendarSelectedDate) return;
                                setClientCalendarAnchorDate(clientCalendarSelectedDate);
                                setClientCalendarView("day");
                                setClientCalendarSelectedDate(null);
                              }}
                            >
                              Visão do dia
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setClientCalendarSelectedDate(null)}
                          >
                            Fechar
                          </Button>
                        </div>
                      </div>
                      {selectedDateHolidayNames &&
                      selectedDateHolidayNames.length > 0 &&
                      clientCalendarSelectedDate ? (
                        <div className="holidayInfoBox">
                          <p className="holidayInfoTitle">
                            <strong>Feriado (informativo):</strong>{" "}
                            {selectedDateHolidayNames.join(" · ")}
                          </p>
                          <Checkbox
                            label="Liberar esta data (horário do dia da semana em vez da regra de Feriados)"
                            checked={holidayWorkingDaySet.has(clientCalendarSelectedDate)}
                            disabled={holidayToggleLoading}
                            onChange={(event) =>
                              void handleHolidayWorkingToggle(
                                clientCalendarSelectedDate,
                                event.target.checked
                              )
                            }
                          />
                          <p className="helperText">
                            Afeta disponibilidade e o painel: desmarcado = usa a linha{" "}
                            <strong>Feriados</strong> da agenda; marcado = usa o dia da semana
                            correspondente.
                          </p>
                        </div>
                      ) : null}
                      {selectedDateAppointments.length === 0 ? (
                        <p className="helperText">Nenhum agendamento em {selectedDateLabel}.</p>
                      ) : (
                        <>
                          {!selectedDateHoursRule || !selectedDateHoursRule.isActive ? (
                            <p className="helperText">
                              Dia marcado como fechado na Agenda de atendimento. Ações rápidas ficam bloqueadas.
                            </p>
                          ) : null}
                          <label className="detailsShiftControl">
                            Ajuste de minutos
                            <Input
                              type="number"
                              min={1}
                              max={180}
                              step={1}
                              value={appointmentShiftMinutes}
                              onChange={(event) => setAppointmentShiftMinutes(event.target.value)}
                            />
                          </label>
                          {appointmentActionFeedback ? (
                            <div className="actionsRow">
                              <p className="helperText">{appointmentActionFeedback}</p>
                              {lastCheckinUrl ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleCopyCheckinUrl()}
                                >
                                  Copiar link do check-in
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="detailsCards">
                            {selectedDateAppointments.map((appointment) => {
                              const rules = resolveServiceRulesForAppointment(
                                appointment.service_id
                              );
                              const minutesToStart = Math.floor(
                                (new Date(appointment.starts_at).getTime() - Date.now()) / 60000
                              );
                              const cancelCutoff = rules.cancelCutoff;
                              const rescheduleCutoff = rules.rescheduleCutoff;
                              const isCancelBlocked =
                                cancelCutoff > 0 && minutesToStart < cancelCutoff;
                              const isShiftBlocked =
                                rescheduleCutoff > 0 && minutesToStart < rescheduleCutoff;
                              const isActionBusy = appointmentActionLoadingId === appointment.id;
                              return (
                              <div key={appointment.id} className="detailsCard">
                                <div className="detailsCardTop">
                                  <strong>
                                    {appointment.starts_at.slice(11, 16)} -{" "}
                                    {appointment.ends_at.slice(11, 16)}
                                  </strong>
                                  <span
                                    className={`integrationBadge ${
                                      appointment.status === "confirmed"
                                        ? "integrationBadge-ok"
                                        : appointment.status === "cancelled"
                                          ? "integrationBadge-pending"
                                          : "integrationBadge-neutral"
                                    }`}
                                  >
                                    {getAppointmentStatusLabel(appointment.status)}
                                  </span>
                                </div>
                                <p>
                                  {appointment.customer_name || "Cliente sem nome"} -{" "}
                                  {appointment.customer_phone}
                                </p>
                                {appointment.booked_for_name ? (
                                  <p className="helperText">
                                    Para: {appointment.booked_for_name}
                                    {appointment.booked_for_relationship
                                      ? ` (${appointment.booked_for_relationship})`
                                      : ""}
                                  </p>
                                ) : null}
                                <div className="detailsActions">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      isActionBusy ||
                                      !selectedDateHoursRule ||
                                      !selectedDateHoursRule.isActive ||
                                      appointment.status === "cancelled" ||
                                      appointment.status === "completed"
                                    }
                                    onClick={() =>
                                      handleAppointmentQuickAction(appointment.id, "confirm")
                                    }
                                  >
                                    Confirmar
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      isActionBusy ||
                                      !selectedDateHoursRule ||
                                      !selectedDateHoursRule.isActive ||
                                      isCancelBlocked ||
                                      appointment.status === "cancelled" ||
                                      appointment.status === "completed"
                                    }
                                    onClick={() =>
                                      handleAppointmentQuickAction(appointment.id, "cancel")
                                    }
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={
                                      isActionBusy ||
                                      !selectedDateHoursRule ||
                                      !selectedDateHoursRule.isActive ||
                                      isShiftBlocked ||
                                      appointment.status === "cancelled" ||
                                      appointment.status === "completed"
                                    }
                                    onClick={() =>
                                      handleAppointmentQuickAction(
                                        appointment.id,
                                        "shift",
                                        -Math.max(1, Number(appointmentShiftMinutes) || 15)
                                      )
                                    }
                                  >
                                    -{Math.max(1, Number(appointmentShiftMinutes) || 15)} min
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={
                                      isActionBusy ||
                                      !selectedDateHoursRule ||
                                      !selectedDateHoursRule.isActive ||
                                      isShiftBlocked ||
                                      appointment.status === "cancelled" ||
                                      appointment.status === "completed"
                                    }
                                    onClick={() =>
                                      handleAppointmentQuickAction(
                                        appointment.id,
                                        "shift",
                                        Math.max(1, Number(appointmentShiftMinutes) || 15)
                                      )
                                    }
                                  >
                                    +{Math.max(1, Number(appointmentShiftMinutes) || 15)} min
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      isActionBusy ||
                                      !selectedDateHoursRule ||
                                      !selectedDateHoursRule.isActive ||
                                      appointment.status === "cancelled" ||
                                      appointment.status === "completed"
                                    }
                                    onClick={() =>
                                      handleAppointmentQuickAction(appointment.id, "checkin")
                                    }
                                  >
                                    Check-in
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isActionBusy || appointment.status === "cancelled"}
                                    onClick={() =>
                                      handleAppointmentQuickAction(appointment.id, "complete")
                                    }
                                  >
                                    Finalizar
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isActionBusy || !rules.autoReturnEnabled}
                                    onClick={() =>
                                      void handleCreateAutoReturn(
                                        appointment.id,
                                        rules.autoReturnDays
                                      )
                                    }
                                  >
                                    Retorno +{rules.autoReturnDays}d
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isActionBusy || !rules.checkinQrEnabled}
                                    onClick={() => void handleGenerateCheckinToken(appointment.id)}
                                  >
                                    Gerar QR
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isActionBusy || !rules.autoFeedbackEnabled}
                                    onClick={() => void handleSendPostFeedback(appointment.id)}
                                  >
                                    Enviar feedback
                                  </Button>
                                </div>
                                {isCancelBlocked ? (
                                  <p className="helperText">
                                    Cancelamento bloqueado: faltam {Math.max(0, minutesToStart)} min
                                    para o inicio e o limite configurado e de {cancelCutoff} min.
                                  </p>
                                ) : null}
                                {isShiftBlocked ? (
                                  <p className="helperText">
                                    Reagendamento bloqueado: faltam {Math.max(0, minutesToStart)}{" "}
                                    min para o inicio e o limite configurado e de{" "}
                                    {rescheduleCutoff} min.
                                  </p>
                                ) : null}
                              </div>
                            )})}
                          </div>
                        </>
                      )}
                    </article>
                  </div>
                ) : null}
                  </>
                ) : null}
              </AdminCard>
            ) : null}

            {clientMainArea === "dashboard" && clientDashboardArea === "subscription" ? (
              <AdminCard
                className="full"
                title="Dashboard de assinatura"
                description="Relação financeira entre administrador e plataforma."
              >
                <div className="hoursRulesGrid">
                  <label>
                    Plano da sua assinatura
                    <Input
                      value={planCode.toUpperCase()}
                      readOnly
                      className="uiInput customersInputReadonly"
                    />
                  </label>
                  <div className="actionsRow">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setRequestedPlanCode(planCode);
                        setSubscriptionRequestNote("");
                        setSubscriptionRequestFeedback("");
                        setSubscriptionModalOpen(true);
                      }}
                    >
                      Alterar assinatura
                    </Button>
                  </div>
                </div>
                {monetizationUsage ? (
                  <ul className="list">
                    <li>
                      <span>Status da assinatura</span>
                      <small>
                        {monetizationUsage.planCode.toUpperCase()} · {monetizationUsage.planStatus}
                      </small>
                    </li>
                    <li>
                      <span>Uso mensal ({monetizationUsage.month})</span>
                      <strong>
                        {monetizationUsage.currentAppointments}
                        {monetizationUsage.monthlyAppointmentLimit != null
                          ? ` / ${monetizationUsage.monthlyAppointmentLimit}`
                          : " / ilimitado"}
                      </strong>
                    </li>
                  </ul>
                ) : null}
                <p className="helperText">
                  Os planos disponíveis são cadastrados pelo desenvolvedor. Aqui o administrador
                  escolhe apenas entre os planos ativos publicados.
                </p>
                {subscriptionRequestFeedback ? (
                  <p className="feedbackOk">{subscriptionRequestFeedback}</p>
                ) : null}
                <div className="analyticsTableWrap">
                  <p className="helperText" style={{ marginBottom: 8 }}>
                    Histórico de solicitações de plano da sua empresa
                  </p>
                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      flexWrap: "wrap",
                      marginBottom: "8px",
                    }}
                  >
                    {[
                      { value: "all", label: "Todos" },
                      { value: "pending", label: "Pendentes" },
                      { value: "approved", label: "Aprovadas" },
                      { value: "rejected", label: "Rejeitadas" },
                      { value: "cancelled", label: "Canceladas" },
                    ].map((item) => (
                      <Button
                        key={`owner-filter-${item.value}`}
                        type="button"
                        size="sm"
                        variant={
                          ownerSubscriptionFeedbackStatusFilter === item.value
                            ? "primary"
                            : "outline"
                        }
                        onClick={() =>
                          setOwnerSubscriptionFeedbackStatusFilter(
                            item.value as SubscriptionFeedbackStatusFilter
                          )
                        }
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                  {ownerSubscriptionFeedbacksError ? (
                    <p className="feedbackError">{ownerSubscriptionFeedbacksError}</p>
                  ) : null}
                  {!ownerSubscriptionFeedbacksError && ownerSubscriptionFeedbacks.length === 0 ? (
                    <p className="helperText">Sem solicitações registradas para esta empresa.</p>
                  ) : null}
                  {!ownerSubscriptionFeedbacksError && ownerSubscriptionFeedbacks.length > 0 ? (
                    <table className="analyticsTable">
                      <thead>
                        <tr>
                          <th>Mudança</th>
                          <th>Status</th>
                          <th>Observação enviada</th>
                          <th>Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ownerSubscriptionFeedbacks.slice(0, 20).map((item) => (
                          <tr key={`owner-sub-feedback-${item.id}`}>
                            <td>
                              {String(item.currentPlanCode || "free").toUpperCase()} →{" "}
                              {String(item.requestedPlanCode || "free").toUpperCase()}
                            </td>
                            <td>{item.status}</td>
                            <td>{item.note || "—"}</td>
                            <td>{new Date(item.createdAt).toLocaleDateString("pt-BR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                </div>
                {subscriptionModalOpen ? (
                  <div
                    className="detailsModalBackdrop"
                    onClick={() => {
                      if (!subscriptionRequestSaving) setSubscriptionModalOpen(false);
                    }}
                  >
                    <article
                      className="detailsModalCard structuredFormModal"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="structuredFormModalHeader">
                        <h3 className="integrationName">Selecionar novo plano</h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSubscriptionModalOpen(false)}
                          disabled={subscriptionRequestSaving}
                        >
                          Fechar
                        </Button>
                      </div>
                      <div className="structuredFormScroll list">
                        {monetizationPlans.map((plan) => (
                          <label key={plan.code} className="customersPaymentRow">
                            <input
                              type="radio"
                              name="subscription-plan"
                              checked={requestedPlanCode === plan.code}
                              onChange={() => setRequestedPlanCode(plan.code)}
                            />
                            <strong>
                              {plan.name} ({plan.code.toUpperCase()})
                            </strong>
                            <small>
                              R$ {(plan.monthly_price_cents / 100).toFixed(2)}/mês ·{" "}
                              {plan.monthly_appointment_limit == null
                                ? "agendamentos ilimitados"
                                : `${plan.monthly_appointment_limit} agendamentos/mês`}{" "}
                              ·{" "}
                              {plan.professional_limit == null
                                ? "profissionais ilimitados"
                                : `${plan.professional_limit} profissional(is)`}{" "}
                              ·{" "}
                              {plan.allows_automations ? "com automações" : "sem automações"} ·{" "}
                              {plan.allows_multi_unit ? "multiunidade" : "unidade única"}
                            </small>
                          </label>
                        ))}
                        <label>
                          Observação para o desenvolvedor (opcional)
                          <Textarea
                            rows={2}
                            value={subscriptionRequestNote}
                            onChange={(event) => setSubscriptionRequestNote(event.target.value)}
                            placeholder="Ex.: aumento de equipe previsto para o próximo mês."
                          />
                        </label>
                        {requestedPlanCode === planCode ? (
                          <p className="helperText">
                            Selecione um plano diferente do atual para enviar a solicitação.
                          </p>
                        ) : null}
                      </div>
                      <div className="structuredFormFooter">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSubscriptionModalOpen(false)}
                          disabled={subscriptionRequestSaving}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void handleRequestSubscriptionChange()}
                          disabled={
                            subscriptionRequestSaving ||
                            requestedPlanCode === planCode ||
                            monetizationPlans.length === 0
                          }
                        >
                          {subscriptionRequestSaving
                            ? "Enviando..."
                            : "Confirmar e enviar solicitação"}
                        </Button>
                      </div>
                    </article>
                  </div>
                ) : null}
              </AdminCard>
            ) : null}

            {clientMainArea === "settings" && clientSettingsArea === "messages" ? (
              <article className="card full">
                <h2>Comunicação com clientes</h2>
                <form className="form" onSubmit={handleSaveMessageTemplates}>
                  <div className="formGroup messageSection">
                    <div className="messageSectionHeader">
                      <h3>Saudações e relacionamento</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="messageSectionToggle"
                        onClick={() =>
                          setMessageSectionOpen((prev) => ({
                            ...prev,
                            greetings: !prev.greetings
                          }))
                        }
                      >
                        {messageSectionOpen.greetings ? "Recolher" : "Expandir"}
                      </Button>
                    </div>
                    {messageSectionOpen.greetings ? (
                      <>
                        {renderMessageTemplateEditor(
                          "GREETING",
                          "Saudação inicial",
                          greetingTemplate,
                          setGreetingTemplate,
                          3
                        )}
                        {renderMessageTemplateEditor(
                          "APPOINTMENT_CANCELLED",
                          "Despedida (cancelamento)",
                          cancelTemplate,
                          setCancelTemplate,
                          3
                        )}
                        {renderMessageTemplateEditor(
                          "POST_APPOINTMENT_THANK_YOU_REVIEW",
                          "Agradecimento pós-atendimento",
                          postVisitThankYouReviewTemplate,
                          setPostVisitThankYouReviewTemplate
                        )}
                        {renderMessageTemplateEditor(
                          "BIRTHDAY_MESSAGE",
                          "Mensagem de aniversário",
                          birthdayMessageTemplate,
                          setBirthdayMessageTemplate
                        )}
                      </>
                    ) : null}
                  </div>

                  <div className="formGroup messageSection">
                    <div className="messageSectionHeader">
                      <h3>Confirmações e lembretes</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="messageSectionToggle"
                        onClick={() =>
                          setMessageSectionOpen((prev) => ({
                            ...prev,
                            confirmations: !prev.confirmations
                          }))
                        }
                      >
                        {messageSectionOpen.confirmations ? "Recolher" : "Expandir"}
                      </Button>
                    </div>
                    {messageSectionOpen.confirmations ? (
                      <>
                        {renderMessageTemplateEditor(
                          "APPOINTMENT_CONFIRMATION",
                          "Confirmação de agendamento",
                          confirmationTemplate,
                          setConfirmationTemplate,
                          3
                        )}
                        {renderMessageTemplateEditor(
                          "APPOINTMENT_REMINDER_24H",
                          "Lembrete de agendamento (24h antes)",
                          appointmentReminder24hTemplate,
                          setAppointmentReminder24hTemplate
                        )}
                        {renderMessageTemplateEditor(
                          "APPOINTMENT_REMINDER_2H",
                          "Lembrete de agendamento (2h antes)",
                          appointmentReminder2hTemplate,
                          setAppointmentReminder2hTemplate
                        )}
                        {renderMessageTemplateEditor(
                          "APPOINTMENT_REMINDER_30M",
                          "Lembrete de agendamento (30min antes)",
                          appointmentReminder30mTemplate,
                          setAppointmentReminder30mTemplate
                        )}
                        {renderMessageTemplateEditor(
                          "APPOINTMENT_CONFIRM_ATTENDANCE_24H",
                          "Confirmação obrigatória de presença (24h)",
                          attendanceConfirm24hTemplate,
                          setAttendanceConfirm24hTemplate
                        )}
                        {renderMessageTemplateEditor(
                          "APPOINTMENT_AUTO_RELEASE_UNCONFIRMED",
                          "Liberação automática por falta de confirmação",
                          autoReleaseUnconfirmedTemplate,
                          setAutoReleaseUnconfirmedTemplate
                        )}
                      </>
                    ) : null}
                  </div>

                  <div className="formGroup messageSection">
                    <div className="messageSectionHeader">
                      <h3>Ajustes de horário</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="messageSectionToggle"
                        onClick={() =>
                          setMessageSectionOpen((prev) => ({
                            ...prev,
                            shifts: !prev.shifts
                          }))
                        }
                      >
                        {messageSectionOpen.shifts ? "Recolher" : "Expandir"}
                      </Button>
                    </div>
                    {messageSectionOpen.shifts ? (
                      <>
                        {renderMessageTemplateEditor(
                          "APPOINTMENT_SHIFT_EARLIER_SHORT",
                          "Ajuste de horário (adiantar - curto)",
                          shiftEarlierShortTemplate,
                          setShiftEarlierShortTemplate,
                          3
                        )}
                        {renderMessageTemplateEditor(
                          "APPOINTMENT_SHIFT_EARLIER_LONG",
                          "Ajuste de horário (adiantar - longo)",
                          shiftEarlierLongTemplate,
                          setShiftEarlierLongTemplate,
                          3
                        )}
                        {renderMessageTemplateEditor(
                          "APPOINTMENT_SHIFT_LATER_SHORT",
                          "Ajuste de horário (atrasar - curto)",
                          shiftLaterShortTemplate,
                          setShiftLaterShortTemplate,
                          3
                        )}
                        {renderMessageTemplateEditor(
                          "APPOINTMENT_SHIFT_LATER_LONG",
                          "Ajuste de horário (atrasar - longo)",
                          shiftLaterLongTemplate,
                          setShiftLaterLongTemplate,
                          3
                        )}
                        <label>
                          Limite para considerar ajuste longo (minutos)
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={shiftTemplateThresholdMinutes}
                            onChange={(event) =>
                              setShiftTemplateThresholdMinutes(event.target.value)
                            }
                          />
                        </label>
                      </>
                    ) : null}
                  </div>

                  <div className="formGroup messageSection">
                    <div className="messageSectionHeader">
                      <h3>WhatsApp interativo</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="messageSectionToggle"
                        onClick={() =>
                          setMessageSectionOpen((prev) => ({
                            ...prev,
                            whatsapp: !prev.whatsapp
                          }))
                        }
                      >
                        {messageSectionOpen.whatsapp ? "Recolher" : "Expandir"}
                      </Button>
                    </div>
                    {messageSectionOpen.whatsapp ? (
                      <>
                        {renderMessageTemplateEditor(
                          "WA_SERVICE_MENU_PROMPT",
                          "WhatsApp: texto do menu de serviços",
                          waServiceMenuPrompt,
                          setWaServiceMenuPrompt
                        )}
                        {renderMessageTemplateEditor(
                          "WA_SLOT_MENU_PROMPT",
                          "WhatsApp: texto do menu de horários",
                          waSlotMenuPrompt,
                          setWaSlotMenuPrompt
                        )}
                        <label>
                          WhatsApp: template do título da opção de serviço
                          <Input
                            value={waServiceOptionTitleTemplate}
                            onChange={(event) =>
                              setWaServiceOptionTitleTemplate(event.target.value)
                            }
                            placeholder="{{servico}}"
                          />
                        </label>
                        <label>
                          WhatsApp: template do título da opção de horário
                          <Input
                            value={waSlotOptionTitleTemplate}
                            onChange={(event) => setWaSlotOptionTitleTemplate(event.target.value)}
                            placeholder="{{hora}}"
                          />
                        </label>
                        <label>
                          WhatsApp: template da descrição da opção de serviço
                          <Input
                            value={waServiceOptionDescriptionTemplate}
                            onChange={(event) =>
                              setWaServiceOptionDescriptionTemplate(event.target.value)
                            }
                            placeholder="{{duracao}} min"
                          />
                        </label>
                        <label>
                          WhatsApp: template da descrição da opção de horário
                          <Input
                            value={waSlotOptionDescriptionTemplate}
                            onChange={(event) =>
                              setWaSlotOptionDescriptionTemplate(event.target.value)
                            }
                            placeholder="{{data}}"
                          />
                        </label>
                      </>
                    ) : null}
                  </div>

                  <div className="formGroup messageSection">
                    <div className="messageSectionHeader">
                      <h3>Campanhas e benefícios</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="messageSectionToggle"
                        onClick={() =>
                          setMessageSectionOpen((prev) => ({
                            ...prev,
                            campaigns: !prev.campaigns
                          }))
                        }
                      >
                        {messageSectionOpen.campaigns ? "Recolher" : "Expandir"}
                      </Button>
                    </div>
                    {messageSectionOpen.campaigns ? (
                      <>
                        {renderMessageTemplateEditor(
                          "POST_APPOINTMENT_NEXT_VISIT_COUPON",
                          "Pós-atendimento: cupom para próxima visita",
                          postVisitCouponTemplate,
                          setPostVisitCouponTemplate
                        )}
                        {renderMessageTemplateEditor(
                          "REMARKETING_INACTIVE_30D",
                          "Remarketing: cliente inativo",
                          remarketingInactive30dTemplate,
                          setRemarketingInactive30dTemplate
                        )}
                        {renderMessageTemplateEditor(
                          "REMARKETING_SPECIAL_PROMO",
                          "Remarketing: promoção especial",
                          remarketingPromoTemplate,
                          setRemarketingPromoTemplate
                        )}
                      </>
                    ) : null}
                  </div>

                  <div className="formGroup messageSection">
                    <div className="messageSectionHeader">
                      <h3>Publicação no Google Reviews</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="messageSectionToggle"
                        onClick={() =>
                          setMessageSectionOpen((prev) => ({
                            ...prev,
                            reputation: !prev.reputation
                          }))
                        }
                      >
                        {messageSectionOpen.reputation ? "Recolher" : "Expandir"}
                      </Button>
                    </div>
                    {messageSectionOpen.reputation ? (
                      <>
                        <p className="helperText">
                          Quando o feedback automático estiver ativo na agenda, é possível incluir o link
                          para avaliação no Google. Isso não altera os templates de mensagem salvo
                          acima — apenas o cadastro do negócio.
                        </p>
                        <Checkbox
                          checked={googleReviewsEnabled}
                          onChange={(event) => setGoogleReviewsEnabled(event.target.checked)}
                          label="Incluir link do Google na mensagem de avaliação: anexar URL de avaliação (Google) ao pós-atendimento"
                        />
                        <label>
                          URL do estabelecimento no Google
                          <Input
                            type="url"
                            value={googleReviewsUrl}
                            onChange={(event) => setGoogleReviewsUrl(event.target.value)}
                            placeholder="https://g.page/r/..."
                          />
                        </label>
                        <div className="actionsRow">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleUpdateBusinessProfile()}
                          >
                            Salvar publicação no Google
                          </Button>
                        </div>
                      </>
                    ) : null}
                  </div>

                  <p className="helperText">
                    Variaveis disponiveis: {"{{cliente}}"}, {"{{data}}"}, {"{{inicio}}"}, {"{{fim}}"}, {"{{status}}"}, {"{{minutos}}"}, {"{{cupom}}"}, {"{{validade}}"}.
                  </p>
                  <p className="helperText">
                    No WhatsApp interativo use: {"{{servico}}"}, {"{{duracao}}"} (serviços) e {"{{hora}}"}, {"{{data}}"} (horários).
                  </p>
                  <Button className="saveButton">Salvar templates de comunicação</Button>
                  {messageTemplateFeedback ? (
                    <p className="feedbackOk">{messageTemplateFeedback}</p>
                  ) : null}
                </form>
              </article>
            ) : null}

            {clientMainArea === "settings" && clientSettingsArea === "services" ? (
              <article className="card full">
                <h2>Catálogo de serviços</h2>
                {/* Dev: lista completa de ramos; em produção manter só o botão "Visualizar template" (CNAE) na barra da grade. */}
                <div className="servicesTemplatesRow">
                  <small>Templates rápidos (dev):</small>
                  {Object.keys(SERVICE_TEMPLATES).map((templateName) => (
                    <Button
                      key={templateName}
                      type="button"
                      variant={templateName === suggestedTemplateByBusiness ? "primary" : "outline"}
                      size="sm"
                      onClick={() => openServiceTemplateSuggestion(templateName)}
                      title={
                        templateName === suggestedTemplateByBusiness
                          ? "Template sugerido para o ramo CNAE cadastrado"
                          : undefined
                      }
                    >
                      {templateName}
                      {templateName === suggestedTemplateByBusiness ? " (sugerido)" : ""}
                    </Button>
                  ))}
                </div>
                {serviceTemplatePreviewName ? (
                  <div className="servicesTemplatePreview" id="service-template-preview">
                    <div className="servicesTemplatePreviewHeader">
                      <strong>Sugestão de template: {serviceTemplatePreviewName}</strong>
                      <small>Selecione o que você quer adicionar</small>
                    </div>
                    <div className="servicesTemplatePreviewList">
                      {serviceTemplatePreviewItems.map((item, index) => (
                        <label key={`${item.name}-${index}`} className="servicesTemplatePreviewItem">
                          <Checkbox
                            checked={item.selected}
                            onChange={(event) =>
                              toggleServiceTemplateSuggestion(index, event.target.checked)
                            }
                            label=""
                          />
                          <span className="servicesTemplatePreviewIcon">{item.icon}</span>
                          <span>
                            <strong>{item.name}</strong>
                            <small>
                              {item.category} • {item.duration_minutes} min • R${" "}
                              {(Math.round(item.price_cents * localPriceFactor) / 100).toFixed(2)}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="helperText">
                      Valores sugeridos com fator local ({localPriceFactor.toFixed(2)}) baseado em{" "}
                      {selectedBusiness?.city || "cidade"} / {selectedBusiness?.state || "UF"}.
                    </p>
                    <div className="actionsRow">
                      <Button type="button" onClick={() => void handleApplyServiceTemplate()}>
                        Adicionar selecionados
                      </Button>
                      <Button type="button" variant="outline" onClick={closeServiceTemplateSuggestion}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : null}
                <p className="helperText">
                  Mesmo padrão de empresas e agendas: busca rápida na barra, colunas opcionais,
                  exportação, <strong>Visualizar template de serviços</strong> (ramo/CNAE) e{" "}
                  <strong>Adicionar serviço</strong>. O resumo (totais, ticket médio, categorias,
                  fotos) fica acima da grade. Filtre por nome, categoria ou status pela busca e pelas
                  colunas. Cadastro no modal: Informações, Tempos e regras e{" "}
                  <strong>Visual e fotos</strong>.
                </p>
                <OwnerServicesAgGrid
                  rowData={services}
                  onAddService={openCreateServiceModal}
                  onViewServiceTemplate={() => {
                    const key = suggestedTemplateByBusiness;
                    if (key && SERVICE_TEMPLATES[key]) {
                      openServiceTemplateSuggestion(key);
                      setServiceFeedback("");
                      requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                          document
                            .getElementById("service-template-preview")
                            ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                        });
                      });
                      return;
                    }
                    setServiceFeedback(
                      "Não há template sugerido: cadastre o CNAE da empresa em Configurações (dados cadastrais) para vincular o ramo e exibir o pacote de serviços sugerido."
                    );
                  }}
                  onEditRow={(row) => {
                    const full = services.find((s) => s.id === row.id);
                    if (full) openEditServiceModal(full);
                  }}
                  onToggleActive={(row) => {
                    const full = services.find((s) => s.id === row.id);
                    if (full) void handleToggleServiceActive(full);
                  }}
                  onDuplicate={(row) => {
                    const full = services.find((s) => s.id === row.id);
                    if (full) void handleDuplicateService(full);
                  }}
                  onMove={(row, direction) => {
                    const full = services.find((s) => s.id === row.id);
                    if (full) void handleMoveService(full, direction);
                  }}
                />
                {serviceFeedback ? <p className="feedbackOk">{serviceFeedback}</p> : null}

                {serviceModalOpen ? (
                  <div className="detailsModalBackdrop" onClick={closeServiceModal}>
                    <article
                      className="detailsModalCard structuredFormModal structuredFormModal--tall structuredFormModal--serviceCatalog"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="structuredFormModalHeader">
                        <div>
                          <h3 className="integrationName">
                            {serviceModalMode === "create" ? "Novo serviço" : "Editar serviço"}
                          </h3>
                          <p className="structuredFormModalSubtitle">
                            {serviceModalMode === "create"
                              ? "Defina identidade, tempos de agenda e aparência. Tudo fica salvo no catálogo desta empresa."
                              : "Alterações passam a valer para novas reservas e para regras aplicadas pela API."}
                          </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={closeServiceModal}>
                          Fechar
                        </Button>
                      </div>
                      <div className="structuredFormTabsTrack">
                        <div className="structuredFormTabs" role="tablist" aria-label="Seções do serviço">
                          <button
                            type="button"
                            role="tab"
                            aria-selected={serviceModalTab === "info"}
                            className={serviceModalTab === "info" ? "isActive" : ""}
                            onClick={() => setServiceModalTab("info")}
                          >
                            Informações
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={serviceModalTab === "agenda"}
                            className={serviceModalTab === "agenda" ? "isActive" : ""}
                            onClick={() => setServiceModalTab("agenda")}
                          >
                            Tempos e regras
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={serviceModalTab === "visual"}
                            className={serviceModalTab === "visual" ? "isActive" : ""}
                            onClick={() => setServiceModalTab("visual")}
                          >
                            Visual e fotos
                          </button>
                        </div>
                      </div>
                      <div className="form structuredFormScroll">
                        {serviceModalTab === "info" ? (
                          <>
                            <section className="serviceFormSection">
                              <h4 className="serviceFormSectionTitle formSectionTitleRow">
                                Identificação
                                <HelpHint placement="below" label="Sobre identificação do serviço">
                                  Como o cliente vê este serviço no site e no WhatsApp.
                                </HelpHint>
                              </h4>
                              <div className="serviceFormSectionBody">
                                <label>
                                  Nome do serviço
                                  <Input
                                    value={serviceModalMode === "create" ? serviceName : editingName}
                                    onChange={(event) =>
                                      serviceModalMode === "create"
                                        ? setServiceName(event.target.value)
                                        : setEditingName(event.target.value)
                                    }
                                    placeholder="Ex.: Corte masculino"
                                  />
                                </label>
                                <label>
                                  Categoria
                                  <Input
                                    value={
                                      serviceModalMode === "create"
                                        ? serviceCategory
                                        : editingCategory
                                    }
                                    onChange={(event) =>
                                      serviceModalMode === "create"
                                        ? setServiceCategory(event.target.value)
                                        : setEditingCategory(event.target.value)
                                    }
                                    placeholder="Ex.: Cabelo, Combo, Consulta"
                                  />
                                </label>
                                <label>
                                  Descrição
                                  <Textarea
                                    rows={3}
                                    value={
                                      serviceModalMode === "create"
                                        ? serviceDescription
                                        : editingDescription
                                    }
                                    onChange={(event) =>
                                      serviceModalMode === "create"
                                        ? setServiceDescription(event.target.value)
                                        : setEditingDescription(event.target.value)
                                    }
                                    placeholder="O que está incluso, materiais usados ou observações."
                                  />
                                </label>
                              </div>
                            </section>
                            <section className="serviceFormSection">
                              <h4 className="serviceFormSectionTitle formSectionTitleRow">
                                Sessão e valor
                                <HelpHint placement="below" label="Sobre duração e preço">
                                  A duração entra na grade; o preço é opcional (sob consulta).
                                </HelpHint>
                              </h4>
                              <div className="serviceFormSectionBody">
                                <div className="structuredFormTwoCols">
                                  <label>
                                    Duração (min)
                                    <Input
                                      type="number"
                                      min={5}
                                      step={5}
                                      value={
                                        serviceModalMode === "create"
                                          ? serviceDuration
                                          : editingDuration
                                      }
                                      onChange={(event) =>
                                        serviceModalMode === "create"
                                          ? setServiceDuration(event.target.value)
                                          : setEditingDuration(event.target.value)
                                      }
                                    />
                                  </label>
                                  <label>
                                    Preço (R$)
                                    <Input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={
                                        serviceModalMode === "create"
                                          ? servicePrice
                                          : editingPrice
                                      }
                                      onChange={(event) =>
                                        serviceModalMode === "create"
                                          ? setServicePrice(event.target.value)
                                          : setEditingPrice(event.target.value)
                                      }
                                      placeholder="Opcional"
                                    />
                                  </label>
                                </div>
                              </div>
                            </section>
                            <div className="serviceModalTimeRulesHint">
                              <p className="helperText">
                                Buffers, antecedência, lembretes, cutoffs, campanhas e experiência do
                                fluxo ficam em <strong>Tempos e regras</strong>. Ícone, cor e fotos em{" "}
                                <strong>Visual e fotos</strong>.
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setServiceModalTab("agenda")}
                              >
                                Ir para tempos e regras
                              </Button>
                            </div>
                          </>
                        ) : null}

                        {serviceModalTab === "agenda" ? (
                          <div className="serviceFormAgendaLayout hoursRulesGrid">
                            <p className="serviceFormIntro">
                              Defina como este serviço usa a agenda, comunica com o cliente e entra nas
                              automações — sempre isolado dos demais itens do catálogo.
                            </p>
                            <section className="serviceFormSection">
                              <h4 className="serviceFormSectionTitle formSectionTitleRow">
                                Capacidade e reservas
                                <HelpHint placement="below" label="Sobre capacidade e reservas">
                                  Intervalos na grade, antecedência de marcação e fila de espera.
                                </HelpHint>
                              </h4>
                              <div className="serviceFormSectionBody">
                                <label>
                                  Tempo de preparação antes (min)
                                  <Input
                                    type="number"
                                    min={0}
                                    step={5}
                                    value={
                                      serviceModalMode === "create"
                                        ? serviceBookingBufferBefore
                                        : editingBookingBufferBefore
                                    }
                                    onChange={(event) =>
                                      serviceModalMode === "create"
                                        ? setServiceBookingBufferBefore(event.target.value)
                                        : setEditingBookingBufferBefore(event.target.value)
                                    }
                                  />
                                </label>
                                <label>
                                  Tempo de limpeza/descanso depois (min)
                              <Input
                                type="number"
                                min={0}
                                step={5}
                                value={
                                  serviceModalMode === "create"
                                    ? serviceBookingBufferAfter
                                    : editingBookingBufferAfter
                                }
                                onChange={(event) =>
                                  serviceModalMode === "create"
                                    ? setServiceBookingBufferAfter(event.target.value)
                                    : setEditingBookingBufferAfter(event.target.value)
                                }
                              />
                            </label>
                            <label>
                              Antecedência mínima para agendar (min)
                              <Input
                                type="number"
                                min={0}
                                step={5}
                                value={
                                  serviceModalMode === "create"
                                    ? serviceBookingMinNotice
                                    : editingBookingMinNotice
                                }
                                onChange={(event) =>
                                  serviceModalMode === "create"
                                    ? setServiceBookingMinNotice(event.target.value)
                                    : setEditingBookingMinNotice(event.target.value)
                                }
                              />
                            </label>
                            <label>
                              Janela máxima para agendar (dias)
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                value={
                                  serviceModalMode === "create"
                                    ? serviceBookingMaxDays
                                    : editingBookingMaxDays
                                }
                                onChange={(event) =>
                                  serviceModalMode === "create"
                                    ? setServiceBookingMaxDays(event.target.value)
                                    : setEditingBookingMaxDays(event.target.value)
                                }
                              />
                            </label>
                            <label>
                              Limite diário de agendamentos (opcional)
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                value={
                                  serviceModalMode === "create"
                                    ? serviceBookingDailyLimit
                                    : editingBookingDailyLimit
                                }
                                onChange={(event) =>
                                  serviceModalMode === "create"
                                    ? setServiceBookingDailyLimit(event.target.value)
                                    : setEditingBookingDailyLimit(event.target.value)
                                }
                                placeholder="Sem limite"
                              />
                            </label>
                            <label>
                              Capacidade simultânea por horário
                              <Input
                                type="number"
                                min={1}
                                max={50}
                                step={1}
                                value={
                                  serviceModalMode === "create"
                                    ? serviceBookingSlotCapacity
                                    : editingBookingSlotCapacity
                                }
                                onChange={(event) =>
                                  serviceModalMode === "create"
                                    ? setServiceBookingSlotCapacity(event.target.value)
                                    : setEditingBookingSlotCapacity(event.target.value)
                                }
                              />
                            </label>
                            <Checkbox
                              checked={
                                serviceModalMode === "create"
                                  ? serviceWaitlistEnabled
                                  : editingWaitlistEnabled
                              }
                              onChange={(event) =>
                                serviceModalMode === "create"
                                  ? setServiceWaitlistEnabled(event.target.checked)
                                  : setEditingWaitlistEnabled(event.target.checked)
                              }
                              label="Lista de espera automatizada: permitir fila quando os horários estiverem esgotados"
                            />
                              </div>
                            </section>
                            <section className="serviceFormSection">
                              <h4 className="serviceFormSectionTitle formSectionTitleRow">
                                Lembretes ao cliente
                                <HelpHint placement="below" label="Sobre lembretes">
                                  Avisos automáticos antes do horário do atendimento.
                                </HelpHint>
                              </h4>
                              <div className="serviceFormSectionBody">
                            <Checkbox
                              checked={
                                serviceModalMode === "create"
                                  ? serviceReminder24h
                                  : editingReminder24h
                              }
                              onChange={(event) =>
                                serviceModalMode === "create"
                                  ? setServiceReminder24h(event.target.checked)
                                  : setEditingReminder24h(event.target.checked)
                              }
                              label="Lembrete 24h antes: enviar aviso de que o agendamento é amanhã"
                            />
                            <Checkbox
                              checked={
                                serviceModalMode === "create"
                                  ? serviceReminder2h
                                  : editingReminder2h
                              }
                              onChange={(event) =>
                                serviceModalMode === "create"
                                  ? setServiceReminder2h(event.target.checked)
                                  : setEditingReminder2h(event.target.checked)
                              }
                              label="Lembrete 2h antes: enviar lembrete próximo ao horário"
                            />
                            <Checkbox
                              checked={
                                serviceModalMode === "create"
                                  ? serviceReminder30m
                                  : editingReminder30m
                              }
                              onChange={(event) =>
                                serviceModalMode === "create"
                                  ? setServiceReminder30m(event.target.checked)
                                  : setEditingReminder30m(event.target.checked)
                              }
                              label="Lembrete 30min antes: enviar confirmação de deslocamento"
                            />
                              </div>
                            </section>
                            <section className="serviceFormSection">
                              <h4 className="serviceFormSectionTitle formSectionTitleRow">
                                Confirmação de presença
                                <HelpHint placement="below" label="Sobre confirmação de presença">
                                  Exigência e prazo para o cliente confirmar que comparecerá.
                                </HelpHint>
                              </h4>
                              <div className="serviceFormSectionBody">
                            <Checkbox
                              checked={
                                serviceModalMode === "create"
                                  ? serviceAttendanceRequired
                                  : editingAttendanceRequired
                              }
                              onChange={(event) =>
                                serviceModalMode === "create"
                                  ? setServiceAttendanceRequired(event.target.checked)
                                  : setEditingAttendanceRequired(event.target.checked)
                              }
                              label="Confirmação obrigatória de presença: exigir confirmação antes do atendimento"
                            />
                            <label>
                              Prazo para confirmar presença (min antes)
                              <Input
                                type="number"
                                min={60}
                                max={10080}
                                step={30}
                                value={
                                  serviceModalMode === "create"
                                    ? serviceAttendanceDeadline
                                    : editingAttendanceDeadline
                                }
                                onChange={(event) =>
                                  serviceModalMode === "create"
                                    ? setServiceAttendanceDeadline(event.target.value)
                                    : setEditingAttendanceDeadline(event.target.value)
                                }
                              />
                            </label>
                            <Checkbox
                              checked={
                                serviceModalMode === "create"
                                  ? serviceAutoRelease
                                  : editingAutoRelease
                              }
                              onChange={(event) =>
                                serviceModalMode === "create"
                                  ? setServiceAutoRelease(event.target.checked)
                                  : setEditingAutoRelease(event.target.checked)
                              }
                              label="Liberação automática por falta de confirmação: liberar horário se o cliente não confirmar"
                            />
                              </div>
                            </section>
                            <section className="serviceFormSection">
                              <h4 className="serviceFormSectionTitle formSectionTitleRow">
                                Reagendar e cancelar
                                <HelpHint placement="below" label="Sobre reagendar e cancelar">
                                  Mínimos antes do início para mudanças via painel e API (ações rápidas).
                                </HelpHint>
                              </h4>
                              <div className="serviceFormSectionBody">
                            <label>
                              Limite para reagendar (min antes do início)
                              <Input
                                type="number"
                                min={0}
                                step={5}
                                value={
                                  serviceModalMode === "create"
                                    ? serviceRescheduleCutoff
                                    : editingRescheduleCutoff
                                }
                                onChange={(event) =>
                                  serviceModalMode === "create"
                                    ? setServiceRescheduleCutoff(event.target.value)
                                    : setEditingRescheduleCutoff(event.target.value)
                                }
                              />
                            </label>
                            <label>
                              Limite para cancelar (min antes do início)
                              <Input
                                type="number"
                                min={0}
                                step={5}
                                value={
                                  serviceModalMode === "create"
                                    ? serviceCancelCutoff
                                    : editingCancelCutoff
                                }
                                onChange={(event) =>
                                  serviceModalMode === "create"
                                    ? setServiceCancelCutoff(event.target.value)
                                    : setEditingCancelCutoff(event.target.value)
                                }
                              />
                            </label>
                              </div>
                            </section>
                            <section className="serviceFormSection">
                              <h4 className="serviceFormSectionTitle formSectionTitleRow">
                                Pós-atendimento e campanhas
                                <HelpHint placement="below" label="Sobre pós-atendimento e campanhas">
                                  n8n e demais automações usam os templates da empresa; aqui você define
                                  se este serviço entra em cada fluxo.
                                </HelpHint>
                              </h4>
                              <div className="serviceFormSectionBody">
                            <Checkbox
                              checked={
                                serviceModalMode === "create"
                                  ? servicePostVisitThankYou
                                  : editingPostVisitThankYou
                              }
                              onChange={(event) =>
                                serviceModalMode === "create"
                                  ? setServicePostVisitThankYou(event.target.checked)
                                  : setEditingPostVisitThankYou(event.target.checked)
                              }
                              label="Pós-atendimento (agradecimento + avaliação): enviar mensagem após atendimento concluído"
                            />
                            <Checkbox
                              checked={
                                serviceModalMode === "create"
                                  ? servicePostVisitCoupon
                                  : editingPostVisitCoupon
                              }
                              onChange={(event) =>
                                serviceModalMode === "create"
                                  ? setServicePostVisitCoupon(event.target.checked)
                                  : setEditingPostVisitCoupon(event.target.checked)
                              }
                              label="Pós-atendimento (cupom próxima visita): enviar incentivo para retorno"
                            />
                            <Checkbox
                              checked={
                                serviceModalMode === "create"
                                  ? serviceRemarketing
                                  : editingRemarketing
                              }
                              onChange={(event) =>
                                serviceModalMode === "create"
                                  ? setServiceRemarketing(event.target.checked)
                                  : setEditingRemarketing(event.target.checked)
                              }
                              label="Campanhas de remarketing: incluir clientes deste serviço em remarketing"
                            />
                            <label>
                              Inatividade para remarketing (dias)
                              <Input
                                type="number"
                                min={7}
                                max={365}
                                step={1}
                                value={
                                  serviceModalMode === "create"
                                    ? serviceRemarketingInactiveDays
                                    : editingRemarketingInactiveDays
                                }
                                onChange={(event) =>
                                  serviceModalMode === "create"
                                    ? setServiceRemarketingInactiveDays(event.target.value)
                                    : setEditingRemarketingInactiveDays(event.target.value)
                                }
                              />
                            </label>
                            <Checkbox
                              checked={
                                serviceModalMode === "create"
                                  ? serviceAutoReturn
                                  : editingAutoReturn
                              }
                              onChange={(event) =>
                                serviceModalMode === "create"
                                  ? setServiceAutoReturn(event.target.checked)
                                  : setEditingAutoReturn(event.target.checked)
                              }
                              label="Auto-agendamento de retorno: permitir retorno em 1 clique para este serviço"
                            />
                            <label>
                              Dias sugeridos para retorno
                              <Input
                                type="number"
                                min={7}
                                max={120}
                                step={1}
                                value={
                                  serviceModalMode === "create"
                                    ? serviceAutoReturnDays
                                    : editingAutoReturnDays
                                }
                                onChange={(event) =>
                                  serviceModalMode === "create"
                                    ? setServiceAutoReturnDays(event.target.value)
                                    : setEditingAutoReturnDays(event.target.value)
                                }
                              />
                            </label>
                            <Checkbox
                              checked={
                                serviceModalMode === "create" ? serviceBirthday : editingBirthday
                              }
                              onChange={(event) =>
                                serviceModalMode === "create"
                                  ? setServiceBirthday(event.target.checked)
                                  : setEditingBirthday(event.target.checked)
                              }
                              label="Mensagem de aniversário: incluir clientes que agendaram este serviço na campanha de aniversário"
                            />
                              </div>
                            </section>
                            <section className="serviceFormSection">
                              <h4 className="serviceFormSectionTitle formSectionTitleRow">
                                Experiência no fluxo
                                <HelpHint placement="below" label="Sobre experiência no fluxo">
                                  Reagendamento assistido, check-in e pedido de avaliação após o
                                  atendimento.
                                </HelpHint>
                              </h4>
                              <div className="serviceFormSectionBody">
                            <Checkbox
                              checked={
                                serviceModalMode === "create"
                                  ? serviceOneClickReschedule
                                  : editingOneClickReschedule
                              }
                              onChange={(event) =>
                                serviceModalMode === "create"
                                  ? setServiceOneClickReschedule(event.target.checked)
                                  : setEditingOneClickReschedule(event.target.checked)
                              }
                              label="Reagendamento assistido (WhatsApp): permitir envio de nova sugestão de horário com confirmação por SIM"
                            />
                            <Checkbox
                              checked={
                                serviceModalMode === "create" ? serviceCheckinQr : editingCheckinQr
                              }
                              onChange={(event) =>
                                serviceModalMode === "create"
                                  ? setServiceCheckinQr(event.target.checked)
                                  : setEditingCheckinQr(event.target.checked)
                              }
                              label="Check-in por QR code: gerar token de check-in para agendamentos deste serviço"
                            />
                            <Checkbox
                              checked={
                                serviceModalMode === "create"
                                  ? serviceAutoFeedback
                                  : editingAutoFeedback
                              }
                              onChange={(event) =>
                                serviceModalMode === "create"
                                  ? setServiceAutoFeedback(event.target.checked)
                                  : setEditingAutoFeedback(event.target.checked)
                              }
                              label="Feedback automático pós-atendimento: enviar mensagem pedindo avaliação após o atendimento"
                            />
                              </div>
                            </section>
                          </div>
                        ) : null}

                        {serviceModalTab === "visual" ? (
                          <>
                            <section className="serviceFormSection">
                              <h4 className="serviceFormSectionTitle formSectionTitleRow">
                                Identidade visual
                                <HelpHint placement="below" label="Sobre identidade visual do serviço">
                                  Ícone e cor aparecem na grade pública e nos cartões do catálogo.
                                </HelpHint>
                              </h4>
                              <div className="serviceFormSectionBody">
                            <label>
                              Ícone
                              <div className="servicesPickerRow">
                                {SERVICE_ICONS.map((icon) => (
                                  <button
                                    key={`modal-icon-${icon}`}
                                    type="button"
                                    className={`servicesIconOption ${
                                      (serviceModalMode === "create" ? serviceIcon : editingIcon) ===
                                      icon
                                        ? "isSelected"
                                        : ""
                                    }`}
                                    onClick={() =>
                                      serviceModalMode === "create"
                                        ? setServiceIcon(icon)
                                        : setEditingIcon(icon)
                                    }
                                  >
                                    {icon}
                                  </button>
                                ))}
                              </div>
                            </label>
                            <label>
                              Cor de destaque
                              <div className="servicesPickerRow">
                                {SERVICE_COLORS.map((color) => (
                                  <button
                                    key={`modal-color-${color}`}
                                    type="button"
                                    className={`servicesColorOption ${
                                      (serviceModalMode === "create" ? serviceColor : editingColor) ===
                                      color
                                        ? "isSelected"
                                        : ""
                                    }`}
                                    style={{ background: color }}
                                    onClick={() =>
                                      serviceModalMode === "create"
                                        ? setServiceColor(color)
                                        : setEditingColor(color)
                                    }
                                    aria-label={`Selecionar cor ${color}`}
                                  />
                                ))}
                              </div>
                            </label>
                              </div>
                            </section>
                            <section className="serviceFormSection">
                              <h4 className="serviceFormSectionTitle formSectionTitleRow">
                                Galeria
                                <HelpHint placement="below" label="Sobre galeria de fotos">
                                  Até cinco imagens para o detalhe do serviço no site.
                                </HelpHint>
                              </h4>
                              <div className="serviceFormSectionBody">
                            <label>
                              Fotos (até 5)
                              <Input
                                type="file"
                                accept="image/*"
                                multiple
                                disabled={
                                  serviceUploadLoading ||
                                  (serviceModalMode === "create"
                                    ? serviceImages.length >= 5
                                    : editingImages.length >= 5)
                                }
                                onChange={(event) =>
                                  void handleUploadServiceImages(
                                    event.target.files,
                                    serviceModalMode === "create" ? "new" : "edit"
                                  )
                                }
                              />
                              {(serviceModalMode === "create" ? serviceImages : editingImages)
                                .length > 0 ? (
                                <div className="servicesImagesGrid">
                                  {(serviceModalMode === "create"
                                    ? serviceImages
                                    : editingImages
                                  ).map((url, index) => (
                                    <div
                                      key={`modal-image-${index}`}
                                      className="servicesImagePreview"
                                    >
                                      <img src={url} alt={`Imagem ${index + 1}`} />
                                      <button
                                        type="button"
                                        className="servicesImageRemove"
                                        onClick={() =>
                                          removeServiceImage(
                                            serviceModalMode === "create" ? "new" : "edit",
                                            index
                                          )
                                        }
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </label>
                              </div>
                            </section>
                          </>
                        ) : null}
                      </div>
                      <div className="structuredFormFooter">
                        {serviceModalMode === "edit" ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleDeleteEditingService()}
                          >
                            Excluir
                          </Button>
                        ) : null}
                        <Button type="button" variant="outline" onClick={closeServiceModal}>
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          onClick={async () => {
                            const ok =
                              serviceModalMode === "create"
                                ? await createServiceFromState()
                                : await updateServiceFromState();
                            if (ok) setServiceModalOpen(false);
                          }}
                        >
                          Salvar serviço
                        </Button>
                      </div>
                    </article>
                  </div>
                ) : null}
              </article>
            ) : null}

            {clientMainArea === "settings" && clientSettingsArea === "publicSite" ? (
              <article className="card full">
                <h2>Site público</h2>
                {selectedBusinessId ? (
                  <PublicSiteEditor
                    businessId={selectedBusinessId}
                    businessSlug={
                      businesses.find((b) => b.id === selectedBusinessId)?.slug || ""
                    }
                  />
                ) : (
                  <p className="helperText">Selecione um negócio para editar o site público.</p>
                )}
              </article>
            ) : null}

            {clientMainArea === "settings" && clientSettingsArea === "hours" ? (
              <article className="card full">
                <h2>Agenda de atendimento</h2>
                <p className="helperText">
                  O cliente define os dias e horários diretamente pelo site. A linha{" "}
                  <strong>Feriados</strong> vale nas datas de feriado (nacional/estadual/municipal
                  conforme cadastro); no calendário você pode liberar uma data específica para usar
                  o horário do dia da semana em vez dessa regra.
                </p>
                <form
                  className="form"
                  onSubmit={(event) => {
                    event.preventDefault();
                  }}
                >
                  <div className="formGroup messageSection">
                    <div className="messageSectionHeader">
                      <h3>Horários e turnos</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="messageSectionToggle"
                        onClick={() =>
                          setHoursSettingsSectionOpen((prev) => ({
                            ...prev,
                            schedule: !prev.schedule
                          }))
                        }
                      >
                        {hoursSettingsSectionOpen.schedule ? "Recolher" : "Expandir"}
                      </Button>
                    </div>
                    {hoursSettingsSectionOpen.schedule ? (
                      <>
                        <p className="helperText">
                          Gerencie os períodos de vigência e os turnos por dia. Use{" "}
                          <strong>Adicionar agenda</strong> (ou <strong>Editar</strong> na grade) para abrir
                          o formulário — mesmo fluxo do cadastro de empresas (lista + modal).
                        </p>
                        <p className="helperText">
                          Cada <strong>turno</strong> é um intervalo de atendimento. Para dois períodos no
                          mesmo dia, use <strong>Adicionar turno</strong>. A linha sombreada na grade indica
                          agenda <strong>vigente hoje</strong> no fuso do negócio. Reservas usam a agenda da
                          data escolhida (desempate: personalizado → mensal → anual → indeterminada; em
                          empate, a mais recente).
                        </p>
                        <p className="helperText">
                          <strong>Pausas longas, férias ou viagem:</strong> use{" "}
                          <strong>Adicionar bloqueio</strong> na barra da grade (ou o atalho{" "}
                          <strong>Bloquear agenda</strong> na Visão geral). O bloqueio impede novas reservas
                          no período; se já houver horários marcados, o sistema avisa para você reagendar
                          manualmente.
                        </p>
                        {hourScheduleGaps.length > 0 ? (
                          <div className="hourScheduleGapsAlert" role="status">
                            <AlertTriangle
                              className="hourScheduleGapsAlertIcon"
                              size={20}
                              aria-hidden
                            />
                            <div>
                              <strong>Intervalos sem agenda entre vigências</strong>
                              <p className="hourScheduleGapsAlertText">
                                Entre duas agendas cadastradas há dias sem cobertura:{" "}
                                {hourScheduleGaps
                                  .map((g) => `${g.from} a ${g.to}`)
                                  .join("; ")}
                                . Pode ser período de férias ou um esquecimento nas datas — confira para
                                evitar confusão nas reservas.
                              </p>
                            </div>
                          </div>
                        ) : null}
                        <DeveloperHourSchedulesAgGrid
                          rowData={hourSchedulesList.map((row) => ({
                            id: row.id,
                            validityType: row.validityType,
                            validFrom: row.validFrom,
                            validTo: row.validTo,
                            isVigenteHoje: row.isVigenteHoje,
                            createdAt: row.createdAt,
                            updatedAt: row.updatedAt
                          }))}
                          onAddSchedule={openHourScheduleModalCreate}
                          onEditRow={openHourScheduleModalEdit}
                          onAddClosure={() => setClosureModalOpen(true)}
                        />
                      </>
                    ) : null}
                  </div>

                  <div className="formGroup messageSection">
                    <p className="helperText">
                      <strong>Por serviço (aba Tempos e regras no cadastro do serviço):</strong>{" "}
                      além de
                      buffers e fila, configure aqui os{" "}
                      <strong>prazos mínimos para cancelar ou reagendar</strong>,{" "}
                      <strong>pós-atendimento, remarketing, retorno e aniversário</strong>, e a{" "}
                      <strong>experiência do fluxo</strong> (reagendamento assistido por WhatsApp,
                      check-in por QR, feedback automático). Novos serviços herdam os valores atuais
                      da empresa como ponto de partida.
                    </p>
                  </div>
                  <p className="helperText">
                    Essas regras impactam os slots disponíveis para WhatsApp e painel manual.
                  </p>
                  <div className="actionsRow">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleUpdateBusinessProfile()}
                    >
                      Salvar regras de disponibilidade
                    </Button>
                  </div>
                  {hoursFeedback ? <p className="feedbackOk">{hoursFeedback}</p> : null}
                </form>

                {hourScheduleModalOpen ? (
                  <div
                    className="detailsModalBackdrop"
                    onClick={() => closeHourScheduleModal()}
                  >
                    <article
                      className="detailsModalCard structuredFormModal hourScheduleFormModal"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="structuredFormModalHeader hourScheduleModalHeader">
                        <h3 className="integrationName" id="hourScheduleModalTitle">
                          {hourScheduleModalMode === "create"
                            ? "Nova agenda de horários"
                            : "Editar agenda de horários"}
                        </h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => closeHourScheduleModal()}
                        >
                          Fechar
                        </Button>
                      </div>
                      <form
                        className="structuredFormModalForm"
                        onSubmit={(e) => void handleSaveBusinessHours(e)}
                      >
                        <div className="hourScheduleModalBody">
                          <p className="helperText hourScheduleModalIntro">
                            {hourScheduleModalMode === "edit" ? (
                              <>
                                Alterando a vigência (tipo ou datas personalizadas) recalcula o período;
                                alterar só os turnos mantém as datas já salvas.
                              </>
                            ) : (
                              <>
                                Nova agenda: as existentes permanecem na grade. A reserva usa a
                                configuração aplicável a cada data.
                              </>
                            )}
                          </p>

                          <section
                            className="hourValiditySection hourValiditySection--modal"
                            aria-labelledby="hourScheduleValidityHeading"
                          >
                            <h4 className="hourValidityTitle" id="hourScheduleValidityHeading">
                              Vigência
                            </h4>
                            <div className="hourValidityOptions hourValidityOptions--modal" role="group">
                              {(
                                [
                                  ["indeterminate", "Indeterminada (até a próxima alteração)"],
                                  ["monthly", "Mensal (mês corrente no fuso do negócio)"],
                                  ["annual", "Anual (ano corrente no fuso do negócio)"],
                                  ["custom", "Personalizado (informe início e fim)"]
                                ] as const
                              ).map(([value, label]) => (
                                <Checkbox
                                  key={value}
                                  className={`hourValidityModalCheck${
                                    hourValidityType === value ? " isSelected" : ""
                                  }`}
                                  checked={hourValidityType === value}
                                  onChange={(event) => {
                                    if (event.target.checked) setHourValidityType(value);
                                  }}
                                  label={label}
                                />
                              ))}
                            </div>
                            {hourValidityType === "custom" ? (
                              <div className="hourValidityCustomRange hourValidityCustomRange--modal">
                                <label className="hourValidityDateField">
                                  <span className="hourValidityDateLabel">Início</span>
                                  <Input
                                    type="date"
                                    value={hourCustomFrom}
                                    onChange={(event) => setHourCustomFrom(event.target.value)}
                                  />
                                </label>
                                <label className="hourValidityDateField">
                                  <span className="hourValidityDateLabel">Fim</span>
                                  <Input
                                    type="date"
                                    value={hourCustomTo}
                                    onChange={(event) => setHourCustomTo(event.target.value)}
                                  />
                                </label>
                              </div>
                            ) : null}
                          </section>

                          <section
                            className="hourScheduleModalTurnosSection"
                            aria-labelledby="hourScheduleTurnosHeading"
                          >
                            <h4 className="hourScheduleModalTurnosTitle" id="hourScheduleTurnosHeading">
                              Horários e turnos
                            </h4>
                            <div className="hoursGrid hoursGrid--modal">
                          {weekDaysSchedule.map((day) => {
                            const row = businessHours.find((item) => item.weekday === day.id);
                            if (!row) return null;

                            return (
                              <div key={day.id} className="hoursDayBlock">
                                <div className="hoursDayBlockLead">
                                  <Checkbox
                                    className="hoursToggle hoursDayLineCheck"
                                    checked={row.isActive}
                                    onChange={(event) =>
                                      updateBusinessHour(day.id, {
                                        isActive: event.target.checked
                                      })
                                    }
                                    label={day.label}
                                  />
                                </div>
                                {row.isActive ? (
                                  <div className="hoursDayBlockBody">
                                    <div
                                      className="hoursShiftTable"
                                      role="table"
                                      aria-label={`Turnos de ${day.label}`}
                                    >
                                      <div
                                        className="hoursShiftRowLine hoursShiftRowLine--head"
                                        role="row"
                                      >
                                        <span
                                          className="hoursShiftTh hoursShiftTh--idx"
                                          role="columnheader"
                                        >
                                          Turno
                                        </span>
                                        <span className="hoursShiftTh" role="columnheader">
                                          Início
                                        </span>
                                        <span className="hoursShiftTh" role="columnheader">
                                          Fim
                                        </span>
                                        <span
                                          className="hoursShiftTh hoursShiftTh--empty"
                                          role="presentation"
                                          aria-hidden="true"
                                        />
                                        <span
                                          className="hoursShiftTh hoursShiftTh--empty"
                                          role="presentation"
                                          aria-hidden="true"
                                        />
                                      </div>
                                      {row.shifts.map((shift, shiftIndex) => (
                                        <div
                                          key={shift.id}
                                          className="hoursShiftRowLine"
                                          role="row"
                                          aria-label={`${day.label}, turno ${shiftIndex + 1}`}
                                        >
                                          <span
                                            className="hoursShiftTd hoursShiftTd--idx"
                                            role="cell"
                                            title={`Turno ${shiftIndex + 1}`}
                                          >
                                            {shiftIndex + 1}
                                          </span>
                                          <div className="hoursShiftTd" role="cell">
                                            <Input
                                              type="time"
                                              value={shift.startTime}
                                              aria-label={`${day.label}: início, turno ${shiftIndex + 1}`}
                                              onChange={(event) =>
                                                updateDayShift(day.id, shift.id, {
                                                  startTime: event.target.value
                                                })
                                              }
                                            />
                                          </div>
                                          <div className="hoursShiftTd" role="cell">
                                            <Input
                                              type="time"
                                              value={shift.endTime}
                                              aria-label={`${day.label}: fim, turno ${shiftIndex + 1}`}
                                              onChange={(event) =>
                                                updateDayShift(day.id, shift.id, {
                                                  endTime: event.target.value
                                                })
                                              }
                                            />
                                          </div>
                                          <div
                                            className="hoursShiftTd hoursShiftTd--action"
                                            role="cell"
                                          >
                                            {row.shifts.length > 1 ? (
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="hoursShiftRemoveBtn"
                                                onClick={() => removeDayShift(day.id, shift.id)}
                                              >
                                                Remover
                                              </Button>
                                            ) : (
                                              <span className="hoursShiftCellMuted" aria-hidden>
                                                —
                                              </span>
                                            )}
                                          </div>
                                          <div
                                            className="hoursShiftTd hoursShiftTd--addCol"
                                            role="cell"
                                          >
                                            {shiftIndex === 0 ? (
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="hoursAddShiftBtn"
                                                onClick={() => addDayShift(day.id)}
                                              >
                                                Adicionar turno
                                              </Button>
                                            ) : null}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                            </div>
                          </section>
                          {hourScheduleOverlapPrompt ? (
                            <div className="hourScheduleOverlapPanel" role="alert">
                              <p className="hourScheduleOverlapTitle">
                                <AlertTriangle
                                  className="hourScheduleOverlapIcon"
                                  size={18}
                                  aria-hidden
                                />
                                Conflito com outras vigências
                              </p>
                              <p className="helperText hourScheduleOverlapMessage">
                                {hourScheduleOverlapPrompt.message}
                              </p>
                              {hourScheduleOverlapPrompt.overlapping.length > 0 ? (
                                <ul className="hourScheduleOverlapList">
                                  {hourScheduleOverlapPrompt.overlapping.map((o) => (
                                    <li key={o.id}>
                                      <strong>{hourValidityLabel(o.validityType)}</strong> — {o.validFrom}{" "}
                                      a {o.validTo ?? "em aberto"}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              <div className="hourScheduleOverlapActions">
                                <Button
                                  type="button"
                                  onClick={() => void submitBusinessHoursSave(true)}
                                >
                                  Sim, aplicar esta agenda e ajustar as outras
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setHourScheduleOverlapPrompt(null)}
                                >
                                  Voltar e revisar
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="structuredFormFooter hourScheduleModalFooter">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => closeHourScheduleModal()}
                          >
                            Cancelar
                          </Button>
                          <Button type="submit">Salvar agenda</Button>
                        </div>
                      </form>
                    </article>
                  </div>
                ) : null}
              </article>
            ) : null}

            {clientMainArea === "settings" && clientSettingsArea === "finance" ? (
              <article className="card full">
                <h2>Financeiro (clientes)</h2>
                <p className="helperText">
                  Nesta área o administrador configura apenas fidelização dos clientes
                  (pacotes/assinaturas e cobrança recorrente).
                </p>
                <div className="hoursRulesGrid">
                  <div className="actionsRow">
                    <Button type="button" variant="outline" onClick={() => void handleRunRecurringBilling()}>
                      Executar cobrança recorrente agora
                    </Button>
                  </div>
                </div>
                {billingRunFeedback ? <p className="feedbackOk">{billingRunFeedback}</p> : null}
                <p className="helperText">
                  Para visualizar consumo, relatórios e catálogos, acesse <strong>Dashboard &gt;
                  Financeiro</strong>.
                </p>
                <h3>Pacotes e planos</h3>
                <form className="form" onSubmit={handleCreateOfferPlan}>
                  <div className="businessFormGrid">
                    <label>
                      Nome
                      <Input
                        value={offerName}
                        onChange={(event) => setOfferName(event.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Tipo
                      <Select
                        value={offerType}
                        onChange={(event) =>
                          setOfferType(event.target.value as "package" | "subscription")
                        }
                      >
                        <option value="package">Pacote</option>
                        <option value="subscription">Assinatura</option>
                      </Select>
                    </label>
                    <label>
                      Serviço (opcional)
                      <Select
                        value={offerServiceId}
                        onChange={(event) => setOfferServiceId(event.target.value)}
                      >
                        <option value="">Todos</option>
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label>
                      Preço (R$)
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={offerPrice}
                        onChange={(event) => setOfferPrice(event.target.value)}
                        required
                      />
                    </label>
                    {offerType === "package" ? (
                      <label>
                        Sessões incluídas
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={offerSessionsIncluded}
                          onChange={(event) => setOfferSessionsIncluded(event.target.value)}
                          required
                        />
                      </label>
                    ) : (
                      <label>
                        Ciclo de cobrança (dias)
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={offerBillingCycleDays}
                          onChange={(event) => setOfferBillingCycleDays(event.target.value)}
                          required
                        />
                      </label>
                    )}
                    <label className="full">
                      Descrição
                      <Textarea
                        rows={2}
                        value={offerDescription}
                        onChange={(event) => setOfferDescription(event.target.value)}
                      />
                    </label>
                  </div>
                  <Button type="submit">Salvar pacote/plano</Button>
                </form>
                {offerFeedback ? <p className="feedbackOk">{offerFeedback}</p> : null}
              </article>
            ) : null}

            {clientMainArea === "settings" && clientSettingsArea === "customers" ? (
              <CustomersManager
                businessId={selectedBusinessId}
                businessContextReady={businessContextReady}
                services={services.map((s) => ({ id: s.id, name: s.name }))}
              />
            ) : null}
            <BusinessClosureEditor
              open={closureModalOpen}
              onOpenChange={setClosureModalOpen}
              businessId={selectedBusinessId}
            />
          </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
