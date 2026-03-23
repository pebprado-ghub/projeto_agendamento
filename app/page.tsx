"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { FieldGroup } from "@/components/admin/FieldGroup";
import { MetricCard } from "@/components/admin/MetricCard";
import { CustomersManager } from "@/components/client/CustomersManager";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMaskedFromDigits, maskCep } from "@/lib/masksBr";
import { lookupViaCep } from "@/lib/viacep";
import { resolveScheduleWeekday } from "@/lib/resolveScheduleWeekday";
import { CNAE_OPTIONS, getCnaeByCode } from "@/lib/cnae";
import { getLocalPriceFactor } from "@/lib/pricingLocal";

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
    normalized = normalized.replace(rule.pattern, rule.replacement);
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
  code: "free" | "pro" | "enterprise";
  name: string;
  monthly_price_cents: number;
  monthly_appointment_limit: number | null;
  professional_limit: number | null;
  allows_automations: boolean;
  allows_multi_unit: boolean;
  is_active: boolean;
};

type MonetizationUsage = {
  month: string;
  currentAppointments: number;
  planCode: "free" | "pro" | "enterprise";
  planStatus: "active" | "trialing" | "past_due" | "cancelled";
  monthlyAppointmentLimit: number | null;
  professionalLimit: number | null;
  automationsEnabled: boolean;
  multiUnitEnabled: boolean;
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

type BusinessHoursState = {
  weekday: number;
  isActive: boolean;
  startTime: string;
  endTime: string;
  hasLunchBreak: boolean;
  lunchStartTime: string;
  lunchEndTime: string;
};

type AppointmentSummary = {
  id: string;
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

function inferTimezoneFromPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return null;
  const ddi = digits.slice(0, 2);
  const ddd = digits.slice(2, 4);

  if (ddi !== "55") return null;

  const map: Record<string, string> = {
    "68": "America/Rio_Branco",
    "69": "America/Porto_Velho",
    "92": "America/Manaus",
    "97": "America/Manaus",
    "95": "America/Boa_Vista",
    "65": "America/Cuiaba",
    "66": "America/Cuiaba",
    "67": "America/Campo_Grande"
  };

  return map[ddd] || "America/Sao_Paulo";
}

function digitsOnly(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
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
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
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
    campaigns: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | "">(
    ""
  );
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
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState("");
  const [serviceStatusFilter, setServiceStatusFilter] = useState<
    "" | "active" | "inactive"
  >("");
  const [servicesViewMode, setServicesViewMode] = useState<"list" | "grid">("list");
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceModalMode, setServiceModalMode] = useState<"create" | "edit">("create");
  const [serviceModalTab, setServiceModalTab] = useState<"info" | "visual" | "images">("info");
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
      startTime: "09:00",
      endTime: "18:00",
      hasLunchBreak: false,
      lunchStartTime: "12:00",
      lunchEndTime: "13:00"
    }))
  );
  const [hoursFeedback, setHoursFeedback] = useState("");
  const [bookingBufferBeforeMinutes, setBookingBufferBeforeMinutes] = useState("0");
  const [bookingBufferAfterMinutes, setBookingBufferAfterMinutes] = useState("0");
  const [bookingMinNoticeMinutes, setBookingMinNoticeMinutes] = useState("0");
  const [bookingMaxDaysAhead, setBookingMaxDaysAhead] = useState("60");
  const [bookingDailyLimit, setBookingDailyLimit] = useState("");
  const [bookingSlotCapacity, setBookingSlotCapacity] = useState("1");
  const [waitlistEnabled, setWaitlistEnabled] = useState(true);
  const [reminder24hEnabled, setReminder24hEnabled] = useState(true);
  const [reminder2hEnabled, setReminder2hEnabled] = useState(true);
  const [reminder30mEnabled, setReminder30mEnabled] = useState(true);
  const [attendanceConfirmationRequired, setAttendanceConfirmationRequired] = useState(true);
  const [attendanceConfirmationDeadlineMinutes, setAttendanceConfirmationDeadlineMinutes] =
    useState("1440");
  const [autoReleaseUnconfirmed, setAutoReleaseUnconfirmed] = useState(true);
  const [postVisitThankYouEnabled, setPostVisitThankYouEnabled] = useState(true);
  const [postVisitCouponEnabled, setPostVisitCouponEnabled] = useState(true);
  const [remarketingEnabled, setRemarketingEnabled] = useState(true);
  const [remarketingInactiveDays, setRemarketingInactiveDays] = useState("30");
  const [birthdayCampaignEnabled, setBirthdayCampaignEnabled] = useState(true);
  const [autoReturnEnabled, setAutoReturnEnabled] = useState(true);
  const [autoReturnDays, setAutoReturnDays] = useState("30");
  const [oneClickRescheduleEnabled, setOneClickRescheduleEnabled] = useState(true);
  const [checkinQrEnabled, setCheckinQrEnabled] = useState(true);
  const [autoFeedbackEnabled, setAutoFeedbackEnabled] = useState(false);
  const [googleReviewsEnabled, setGoogleReviewsEnabled] = useState(false);
  const [googleReviewsUrl, setGoogleReviewsUrl] = useState("");
  const [bookingRescheduleCutoffMinutes, setBookingRescheduleCutoffMinutes] =
    useState("0");
  const [bookingCancelCutoffMinutes, setBookingCancelCutoffMinutes] = useState("0");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [developerArea, setDeveloperArea] = useState<"configuration" | "dashboard">(
    "configuration"
  );
  const [configurationArea, setConfigurationArea] = useState<
    "business" | "integrations" | "calendar"
  >("business");
  const [dashboardArea, setDashboardArea] = useState<"overview" | "businesses">(
    "overview"
  );
  const [clientMainArea, setClientMainArea] = useState<"dashboard" | "settings">(
    "dashboard"
  );
  const [clientDashboardArea, setClientDashboardArea] = useState<
    "overview" | "analytics" | "agenda" | "subscription"
  >("overview");
  const [clientSettingsArea, setClientSettingsArea] = useState<
    "messages" | "services" | "hours" | "customers" | "finance"
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
  const [monetizationUsage, setMonetizationUsage] = useState<MonetizationUsage | null>(null);
  const [overviewMonetizationUsage, setOverviewMonetizationUsage] =
    useState<MonetizationUsage | null>(null);
  const [planCode, setPlanCode] = useState<"free" | "pro" | "enterprise">("free");
  const [planStatus, setPlanStatus] = useState<"active" | "trialing" | "past_due" | "cancelled">(
    "active"
  );
  const [planMonthlyLimit, setPlanMonthlyLimit] = useState("");
  const [planProfessionalLimit, setPlanProfessionalLimit] = useState("");
  const [planAutomationsEnabled, setPlanAutomationsEnabled] = useState(false);
  const [planMultiUnitEnabled, setPlanMultiUnitEnabled] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [requestedPlanCode, setRequestedPlanCode] = useState<"free" | "pro" | "enterprise">("free");
  const [subscriptionRequestNote, setSubscriptionRequestNote] = useState("");
  const [subscriptionRequestFeedback, setSubscriptionRequestFeedback] = useState("");
  const [subscriptionRequestSaving, setSubscriptionRequestSaving] = useState(false);
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
          throw new Error(listResult.error || "Erro ao carregar negocios.");
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
            "Nenhum negócio encontrado no banco. Cadastre um negócio (área Desenvolvedor) ou confira NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."
          );
        } else {
          setFeedback(
            "Há mais de um negócio cadastrado: defina OWNER_BUSINESS_ID ou CLIENT_BUSINESS_ID no .env.local com o UUID do negócio deste login."
          );
        }
        setFeedbackType("error");
        return;
      }

      const response = await fetch(`/api/businesses/${bid}`);
      const result = (await response.json()) as { data?: BusinessRow; error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Erro ao carregar negocio.");
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
      throw new Error(result.error || "Erro ao carregar negocios.");
    }

    const loaded = result.data || [];
    setBusinesses(loaded);

    if (!selectedBusinessId && loaded.length > 0) {
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

  async function loadBusinessHours(businessId: string) {
    if (!businessId) {
      return;
    }

    const response = await fetch(`/api/business-hours?businessId=${businessId}`);
    const result = (await response.json()) as {
      data?: Array<{
        weekday: number;
        start_time: string;
        end_time: string;
        lunch_start_time?: string | null;
        lunch_end_time?: string | null;
        is_active: boolean;
      }>;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(result.error || "Erro ao carregar horarios.");
    }

    const defaultRows = weekDaysSchedule.map((day) => ({
      weekday: day.id,
      isActive: day.id >= 1 && day.id <= 5,
      startTime: "09:00",
      endTime: "18:00",
      hasLunchBreak: false,
      lunchStartTime: "12:00",
      lunchEndTime: "13:00"
    }));

    const map = new Map((result.data || []).map((item) => [item.weekday, item]));
    const merged = defaultRows.map((row) => {
      const existing = map.get(row.weekday);
      if (!existing) {
        return row;
      }
      return {
        weekday: row.weekday,
        isActive: existing.is_active,
        startTime: existing.start_time.slice(0, 5),
        endTime: existing.end_time.slice(0, 5),
        hasLunchBreak: Boolean(existing.lunch_start_time && existing.lunch_end_time),
        lunchStartTime: existing.lunch_start_time?.slice(0, 5) || "12:00",
        lunchEndTime: existing.lunch_end_time?.slice(0, 5) || "13:00"
      };
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
      if (
        action === "cancel" &&
        oneClickRescheduleEnabled &&
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

  async function handleCreateAutoReturn(appointmentId: string) {
    if (!selectedBusinessId) return;
    setAppointmentActionFeedback("");
    setAppointmentActionLoadingId(appointmentId);
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/auto-return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: selectedBusinessId,
          daysAhead: Math.max(7, Number(autoReturnDays) || 30)
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
    void loadMessageTemplates(selectedBusinessId).catch((error: Error) => {
      setMessageTemplateFeedback(error.message);
    });
    const selectedBusiness = businesses.find((b) => b.id === selectedBusinessId);
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
      setTimezone(selectedBusiness.timezone || "America/Sao_Paulo");
      setBookingBufferBeforeMinutes(
        String(Math.max(0, Number(selectedBusiness.booking_buffer_before_minutes || 0)))
      );
      setBookingBufferAfterMinutes(
        String(Math.max(0, Number(selectedBusiness.booking_buffer_after_minutes || 0)))
      );
      setBookingMinNoticeMinutes(
        String(Math.max(0, Number(selectedBusiness.booking_min_notice_minutes || 0)))
      );
      setBookingMaxDaysAhead(
        String(Math.max(1, Number(selectedBusiness.booking_max_days_ahead || 60)))
      );
      setBookingDailyLimit(
        selectedBusiness.booking_daily_limit
          ? String(selectedBusiness.booking_daily_limit)
          : ""
      );
      setBookingSlotCapacity(
        String(Math.max(1, Number(selectedBusiness.booking_slot_capacity || 1)))
      );
      setWaitlistEnabled(selectedBusiness.waitlist_enabled !== false);
      setReminder24hEnabled(selectedBusiness.reminder_24h_enabled !== false);
      setReminder2hEnabled(selectedBusiness.reminder_2h_enabled !== false);
      setReminder30mEnabled(selectedBusiness.reminder_30m_enabled !== false);
      setAttendanceConfirmationRequired(
        selectedBusiness.attendance_confirmation_required !== false
      );
      setAttendanceConfirmationDeadlineMinutes(
        String(Math.max(60, Number(selectedBusiness.attendance_confirmation_deadline_minutes || 1440)))
      );
      setAutoReleaseUnconfirmed(selectedBusiness.auto_release_unconfirmed !== false);
      setPostVisitThankYouEnabled(selectedBusiness.post_visit_thank_you_enabled !== false);
      setPostVisitCouponEnabled(selectedBusiness.post_visit_coupon_enabled !== false);
      setRemarketingEnabled(selectedBusiness.remarketing_enabled !== false);
      setRemarketingInactiveDays(
        String(Math.max(7, Number(selectedBusiness.remarketing_inactive_days || 30)))
      );
      setBirthdayCampaignEnabled(selectedBusiness.birthday_campaign_enabled !== false);
      setAutoReturnEnabled(selectedBusiness.auto_return_enabled !== false);
      setAutoReturnDays(String(Math.max(7, Number(selectedBusiness.auto_return_days || 30))));
      setOneClickRescheduleEnabled(selectedBusiness.one_click_reschedule_enabled !== false);
      setCheckinQrEnabled(selectedBusiness.checkin_qr_enabled !== false);
      setAutoFeedbackEnabled(selectedBusiness.auto_feedback_enabled === true);
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
      setBookingRescheduleCutoffMinutes(
        String(
          Math.max(0, Number(selectedBusiness.booking_reschedule_cutoff_minutes || 0))
        )
      );
      setBookingCancelCutoffMinutes(
        String(Math.max(0, Number(selectedBusiness.booking_cancel_cutoff_minutes || 0)))
      );
    }
  }, [selectedBusinessId, businesses]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          timezone,
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
          bookingBufferBeforeMinutes: Math.max(0, Number(bookingBufferBeforeMinutes) || 0),
          bookingBufferAfterMinutes: Math.max(0, Number(bookingBufferAfterMinutes) || 0),
          bookingMinNoticeMinutes: Math.max(0, Number(bookingMinNoticeMinutes) || 0),
          bookingMaxDaysAhead: Math.max(1, Number(bookingMaxDaysAhead) || 60),
          bookingDailyLimit: bookingDailyLimit.trim()
            ? Math.max(1, Number(bookingDailyLimit) || 1)
            : null,
          bookingSlotCapacity: Math.max(1, Number(bookingSlotCapacity) || 1),
          waitlistEnabled,
          reminder24hEnabled,
          reminder2hEnabled,
          reminder30mEnabled,
          attendanceConfirmationRequired,
          attendanceConfirmationDeadlineMinutes: Math.max(
            60,
            Number(attendanceConfirmationDeadlineMinutes) || 1440
          ),
          autoReleaseUnconfirmed,
          postVisitThankYouEnabled,
          postVisitCouponEnabled,
          remarketingEnabled,
          remarketingInactiveDays: Math.max(7, Number(remarketingInactiveDays) || 30),
          birthdayCampaignEnabled,
          autoReturnEnabled,
          autoReturnDays: Math.max(7, Number(autoReturnDays) || 30),
          oneClickRescheduleEnabled,
          checkinQrEnabled,
          autoFeedbackEnabled,
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
          multiUnitEnabled: planMultiUnitEnabled,
          bookingRescheduleCutoffMinutes: Math.max(
            0,
            Number(bookingRescheduleCutoffMinutes) || 0
          ),
          bookingCancelCutoffMinutes: Math.max(
            0,
            Number(bookingCancelCutoffMinutes) || 0
          )
        })
      });

      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Erro ao salvar configuracao.");
      }

      setFeedback(result.message || "Configuracao salva com sucesso.");
      setFeedbackType("success");
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
      setBookingBufferBeforeMinutes("0");
      setBookingBufferAfterMinutes("0");
      setBookingMinNoticeMinutes("0");
      setBookingMaxDaysAhead("60");
      setBookingDailyLimit("");
      setBookingSlotCapacity("1");
      setWaitlistEnabled(true);
      setReminder24hEnabled(true);
      setReminder2hEnabled(true);
      setReminder30mEnabled(true);
      setAttendanceConfirmationRequired(true);
      setAttendanceConfirmationDeadlineMinutes("1440");
      setAutoReleaseUnconfirmed(true);
      setPostVisitThankYouEnabled(true);
      setPostVisitCouponEnabled(true);
      setRemarketingEnabled(true);
      setRemarketingInactiveDays("30");
      setBirthdayCampaignEnabled(true);
      setBookingRescheduleCutoffMinutes("0");
      setBookingCancelCutoffMinutes("0");
      await loadBusinesses();
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
      setServiceFeedback("Selecione um negocio para cadastrar servicos.");
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
        displayOrder: services.length
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
    setServiceFeedback(result.message || "Servico criado.");
    await loadServices(selectedBusinessId);
    return true;
  }

  async function handleCreateService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createServiceFromState();
  }

  async function handleUploadServiceImages(
    files: FileList | null,
    mode: "new" | "edit"
  ) {
    if (!files || files.length === 0) return;
    if (!selectedBusinessId) {
      setServiceFeedback("Selecione um negocio antes de enviar imagens.");
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
      setServiceFeedback("Selecione um negocio antes de aplicar templates.");
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

  async function handleDeleteService(serviceId: string) {
    const response = await fetch(`/api/services/${serviceId}`, {
      method: "DELETE"
    });

    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setServiceFeedback(result.error || "Erro ao excluir servico.");
      return;
    }

    setServiceFeedback(result.message || "Servico removido.");
    await loadServices(selectedBusinessId);
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
    setServiceFeedback("");
  }

  function openCreateServiceModal() {
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
        displayOrder: services.length
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
    const visible = [...filteredServices];
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

  async function handleDropReorderService(sourceId: string, targetId: string) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const ordered = [...filteredServices];
    const from = ordered.findIndex((s) => s.id === sourceId);
    const to = ordered.findIndex((s) => s.id === targetId);
    if (from < 0 || to < 0) return;
    const [item] = ordered.splice(from, 1);
    ordered.splice(to, 0, item);
    try {
      await persistServicesOrder(ordered);
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
        imageUrls: editingImages
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

  async function handleUpdateService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updateServiceFromState();
  }

  async function handleSaveMessageTemplates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessageTemplateFeedback("");
    if (!selectedBusinessId) {
      setMessageTemplateFeedback("Selecione um negocio para salvar os templates.");
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
      setOfferFeedback("Selecione um negocio para cadastrar planos/pacotes.");
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
      setCalendarFeedback("Selecione um negocio para configurar o calendario.");
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
      setCalendarFeedback("Selecione um negocio antes de conectar o Google.");
      return;
    }

    const returnTo = "/";
    window.location.href = `/api/google/connect?businessId=${encodeURIComponent(
      selectedBusinessId
    )}&returnTo=${encodeURIComponent(returnTo)}`;
  }

  async function handleCalendarModeSave() {
    if (!selectedBusinessId) {
      setCalendarFeedback("Selecione um negocio para definir o modo de agenda.");
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
  }

  function updateBusinessHour(
    weekday: number,
    patch: Partial<BusinessHoursState>
  ) {
    setBusinessHours((prev) =>
      prev.map((item) => (item.weekday === weekday ? { ...item, ...patch } : item))
    );
  }

  async function handleSaveBusinessHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHoursFeedback("");
    if (!selectedBusinessId) {
      setHoursFeedback("Selecione um negocio para definir os horarios.");
      return;
    }

    const response = await fetch("/api/business-hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: selectedBusinessId,
        hours: businessHours.map((item) => ({
          weekday: item.weekday,
          isActive: item.isActive,
          startTime: `${item.startTime}:00`,
          endTime: `${item.endTime}:00`,
          lunchStartTime:
            item.isActive && item.hasLunchBreak ? `${item.lunchStartTime}:00` : null,
          lunchEndTime:
            item.isActive && item.hasLunchBreak ? `${item.lunchEndTime}:00` : null
        }))
      })
    });

    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setHoursFeedback(result.error || "Erro ao salvar horarios.");
      return;
    }

    setHoursFeedback(result.message || "Horarios salvos com sucesso.");
    await loadBusinessHours(selectedBusinessId);
  }

  async function handleUpdateBusinessProfile() {
    if (!selectedBusinessId) {
      setFeedback("Selecione um negocio para atualizar.");
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
          timezone,
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
          bookingBufferBeforeMinutes: Math.max(0, Number(bookingBufferBeforeMinutes) || 0),
          bookingBufferAfterMinutes: Math.max(0, Number(bookingBufferAfterMinutes) || 0),
          bookingMinNoticeMinutes: Math.max(0, Number(bookingMinNoticeMinutes) || 0),
          bookingMaxDaysAhead: Math.max(1, Number(bookingMaxDaysAhead) || 60),
          bookingDailyLimit: bookingDailyLimit.trim()
            ? Math.max(1, Number(bookingDailyLimit) || 1)
            : null,
          bookingSlotCapacity: Math.max(1, Number(bookingSlotCapacity) || 1),
          waitlistEnabled,
          reminder24hEnabled,
          reminder2hEnabled,
          reminder30mEnabled,
          attendanceConfirmationRequired,
          attendanceConfirmationDeadlineMinutes: Math.max(
            60,
            Number(attendanceConfirmationDeadlineMinutes) || 1440
          ),
          autoReleaseUnconfirmed,
          postVisitThankYouEnabled,
          postVisitCouponEnabled,
          remarketingEnabled,
          remarketingInactiveDays: Math.max(7, Number(remarketingInactiveDays) || 30),
          birthdayCampaignEnabled,
          autoReturnEnabled,
          autoReturnDays: Math.max(7, Number(autoReturnDays) || 30),
          oneClickRescheduleEnabled,
          checkinQrEnabled,
          autoFeedbackEnabled,
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
          multiUnitEnabled: planMultiUnitEnabled,
          bookingRescheduleCutoffMinutes: Math.max(
            0,
            Number(bookingRescheduleCutoffMinutes) || 0
          ),
          bookingCancelCutoffMinutes: Math.max(
            0,
            Number(bookingCancelCutoffMinutes) || 0
          )
        })
      });

      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(result.error || "Erro ao atualizar cadastro.");
      }
      setFeedback(result.message || "Cadastro atualizado com sucesso.");
      setFeedbackType("success");
      await loadBusinesses();
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

  const totalBusinesses = businesses.length;
  const selectedBusiness = businesses.find((business) => business.id === selectedBusinessId);
  const selectedCnae = getCnaeByCode(selectedBusiness?.cnae_code || null);
  const suggestedTemplateByBusiness = selectedCnae?.templateKey || "";
  const localPriceFactor = getLocalPriceFactor(selectedBusiness?.state, selectedBusiness?.city);
  const googleModeBusinesses = businesses.filter(
    (business) => business.calendar_mode === "google"
  ).length;
  const internalModeBusinesses = totalBusinesses - googleModeBusinesses;
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
    scheduleBusiness?.timezone || timezone || "America/Sao_Paulo";
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
      ? dailyHoursRule.hasLunchBreak
        ? [
            {
              start: toMinutesFromHHMM(dailyHoursRule.startTime),
              end: toMinutesFromHHMM(dailyHoursRule.lunchStartTime)
            },
            {
              start: toMinutesFromHHMM(dailyHoursRule.lunchEndTime),
              end: toMinutesFromHHMM(dailyHoursRule.endTime)
            }
          ].filter((segment) => segment.start < segment.end)
        : [
            {
              start: toMinutesFromHHMM(dailyHoursRule.startTime),
              end: toMinutesFromHHMM(dailyHoursRule.endTime)
            }
          ]
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
  const serviceCategories = Array.from(
    new Set(services.map((service) => service.category || "").filter(Boolean))
  );
  const filteredServices = services.filter((service) => {
    const search = serviceSearch.trim().toLowerCase();
    const matchSearch =
      !search ||
      service.name.toLowerCase().includes(search) ||
      (service.description || "").toLowerCase().includes(search);
    const matchCategory =
      !serviceCategoryFilter || (service.category || "") === serviceCategoryFilter;
    const matchStatus =
      !serviceStatusFilter ||
      (serviceStatusFilter === "active" && service.is_active) ||
      (serviceStatusFilter === "inactive" && !service.is_active);
    return matchSearch && matchCategory && matchStatus;
  });
  const serviceTicketMedio =
    services.length > 0
      ? services.reduce((sum, service) => sum + (service.price_cents || 0), 0) / services.length
      : 0;
  const servicesWithImagesCount = services.filter((service) => service.image_urls?.length > 0).length;
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
    setSelectedBusinessId(id);
    setBusinessPickerOpen(false);
    setBusinessQuery("");
  }

  return (
    <main className="page">
      <section className="hero card glassCard">
        <div className="headerRow">
          <h1 className="gradientText">Painel de gerenciamento</h1>
          <div className="headerActions">
            <ThemeToggle />
            <Button type="button" variant="outline" onClick={() => void handleLogout()}>
              Sair
            </Button>
          </div>
        </div>
        <p>Gestão centralizada da operação, agenda, clientes, comunicação e financeiro.</p>
      </section>

      {role === "developer" ? (
        <div className="adminShell">
          <aside className="adminSidebar card glassCard">
            <div className="adminSidebarNav">
              <button
                type="button"
                className={`sidebarNavButton ${developerArea === "dashboard" ? "isActive" : ""}`}
                onClick={() => setDeveloperArea("dashboard")}
              >
                <span className="sidebarNavIcon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="sidebarNavIconSvg">
                    <rect x="3" y="3" width="8" height="8" rx="2" />
                    <rect x="13" y="3" width="8" height="5" rx="2" />
                    <rect x="13" y="10" width="8" height="11" rx="2" />
                    <rect x="3" y="13" width="8" height="8" rx="2" />
                  </svg>
                </span>
                <span>Dashboard</span>
              </button>
              <p className="adminSidebarCaption">Dashboard</p>
              <div className="adminSidebarSubnav">
                <button
                  type="button"
                  className={`sidebarSubButton ${developerArea === "dashboard" && dashboardArea === "overview" ? "isActive" : ""}`}
                  onClick={() => {
                    setDeveloperArea("dashboard");
                    setDashboardArea("overview");
                  }}
                >
                  📊 Visão geral
                </button>
                <button
                  type="button"
                  className={`sidebarSubButton ${developerArea === "dashboard" && dashboardArea === "businesses" ? "isActive" : ""}`}
                  onClick={() => {
                    setDeveloperArea("dashboard");
                    setDashboardArea("businesses");
                  }}
                >
                  🏢 Negócios
                </button>
              </div>
              <button
                type="button"
                className={`sidebarNavButton ${developerArea === "configuration" ? "isActive" : ""}`}
                onClick={() => setDeveloperArea("configuration")}
              >
                <span className="sidebarNavIcon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="sidebarNavIconSvg">
                    <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
                    <path d="M19.4 13.5c.04-.5.04-1 0-1.5l1.6-1.2a1 1 0 0 0 .24-1.3l-1.5-2.6a1 1 0 0 0-1.2-.44l-1.9.75a7.7 7.7 0 0 0-1.3-.75l-.3-2.05A1 1 0 0 0 14 3h-3a1 1 0 0 0-.98.83l-.3 2.05c-.46.2-.9.45-1.3.75l-1.9-.75a1 1 0 0 0-1.2.44L3.8 8.9a1 1 0 0 0 .24 1.3L5.64 11.4c-.04.5-.04 1 0 1.5l-1.6 1.2a1 1 0 0 0-.24 1.3l1.5 2.6a1 1 0 0 0 1.2.44l1.9-.75c.4.3.84.55 1.3.75l.3 2.05A1 1 0 0 0 11 21h3a1 1 0 0 0 .98-.83l.3-2.05c.46-.2.9-.45 1.3-.75l1.9.75a1 1 0 0 0 1.2-.44l1.5-2.6a1 1 0 0 0-.24-1.3l-1.6-1.2Z" />
                  </svg>
                </span>
                <span>Configurações</span>
              </button>
              <div className="adminSidebarSubnav">
                <button
                  type="button"
                  className={`sidebarSubButton ${developerArea === "configuration" && configurationArea === "business" ? "isActive" : ""}`}
                  onClick={() => {
                    setDeveloperArea("configuration");
                    setConfigurationArea("business");
                  }}
                >
                  🧾 Cadastro
                </button>
                <button
                  type="button"
                  className={`sidebarSubButton ${developerArea === "configuration" && configurationArea === "integrations" ? "isActive" : ""}`}
                  onClick={() => {
                    setDeveloperArea("configuration");
                    setConfigurationArea("integrations");
                  }}
                >
                  🔌 Integrações
                </button>
                <button
                  type="button"
                  className={`sidebarSubButton ${developerArea === "configuration" && configurationArea === "calendar" ? "isActive" : ""}`}
                  onClick={() => {
                    setDeveloperArea("configuration");
                    setConfigurationArea("calendar");
                  }}
                >
                  📅 Google Calendar
                </button>
              </div>
            </div>
            <div className="adminSidebarFooter">
              <span className="adminSidebarUser">Desenvolvedor</span>
              <small>Painel da ferramenta</small>
            </div>
          </aside>

          <div className="adminContent">
            <div className="grid adminGrid">
          {!(developerArea === "configuration" && configurationArea === "business") ? (
            <AdminCard
              className="full contextCard"
              title="Contexto operacional"
              description="Defina o negócio ativo antes de executar ações na plataforma (desenvolvedor)."
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
                    <span className="contextInfoLabel">Negócio ativo</span>
                    <span className="contextInfoValue">
                      {selectedBusiness?.name || "Nenhum negócio selecionado"}
                    </span>
                  </div>
                  <div className="contextInfoRow">
                    <span className="contextInfoLabel">Modo de agenda</span>
                    <span className="contextInfoValue">
                      {selectedBusiness?.calendar_mode || "Não definido"}
                    </span>
                  </div>
                </div>

                {businessPickerOpen ? (
                  <div className="contextPickerPanel">
                    <Input
                      placeholder="Buscar negócio por nome, slug ou cidade..."
                      value={businessQuery}
                      onChange={(event) => setBusinessQuery(event.target.value)}
                    />
                    <div className="contextPickerList">
                      {filteredBusinesses.length === 0 ? (
                        <p className="helperText">Nenhum negócio encontrado.</p>
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
                            <strong>{business.name}</strong>
                            <small>
                              {business.timezone} - {business.calendar_mode || "internal"}
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
                <AdminCard className="full" title="Cadastro de negócio">
                  <form className="form businessFormGrid" onSubmit={handleSubmit}>
                    <FieldGroup title="Identificação da empresa">
                      <label>
                        Nome do negócio
                        <Input
                          placeholder="Ex.: Studio Ana"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          required
                        />
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
                        Ramo de negócio (CNAE)
                        <Select
                          value={cnaeCode}
                          onChange={(event) => {
                            const code = event.target.value;
                            const cnae = getCnaeByCode(code);
                            setCnaeCode(code);
                            setCnaeDescription(cnae?.description || "");
                            // Mantém compatibilidade com o campo legado em templates.
                            setBusinessType(cnae?.description || "");
                          }}
                          required
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
                      </label>
                    </FieldGroup>

                    <FieldGroup title="Endereço">
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
                        <Input
                          value={city}
                          onChange={(event) => setCity(event.target.value)}
                        />
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

                    <FieldGroup title="Contato principal">
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
                            const masked = maskPhoneBr(event.target.value);
                            setContactPhone(masked);
                            const tz = inferTimezoneFromPhone(masked);
                            if (tz) setTimezone(tz);
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

                    <FieldGroup title="Integração">
                      <p className="helperText">
                        Configure o número de WhatsApp que será vinculado à automação para
                        identificação do negócio e roteamento das mensagens.
                      </p>
                      <label>
                        WhatsApp da integração
                        <Input
                          value={clientWhatsapp}
                          onChange={(event) =>
                            setClientWhatsapp(maskPhoneBr(event.target.value))
                          }
                          placeholder="+55 (11) 99999-9999"
                        />
                      </label>
                    </FieldGroup>

                    <FieldGroup title="Operação">
                      <label>
                        Timezone
                        <Input
                          value={timezone}
                          onChange={(event) => setTimezone(event.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Modo de agenda
                        <Select
                          value={calendarMode}
                          onChange={(event) =>
                            setCalendarMode(event.target.value as "internal" | "google")
                          }
                        >
                          <option value="internal">Interna (recomendada)</option>
                          <option value="google">Google Calendar (opcional)</option>
                        </Select>
                      </label>
                    </FieldGroup>
                    <div className="actionsRow">
                      <Button disabled={isSaving} className="saveButton">
                        {isSaving ? "Salvando..." : "Criar novo cadastro"}
                      </Button>
                      <Button
                        type="button"
                        className="saveButton"
                        disabled={isUpdatingProfile}
                        onClick={() => void handleUpdateBusinessProfile()}
                      >
                        {isUpdatingProfile
                          ? "Atualizando..."
                          : "Atualizar cadastro existente"}
                      </Button>
                    </div>
                    {feedback ? (
                      <p
                        className={
                          feedbackType === "error" ? "feedbackError" : "feedbackOk"
                        }
                      >
                        {feedback}
                      </p>
                    ) : null}
                  </form>
                  {cnpjLookupPreview ? (
                    <div className="detailsModalBackdrop" onClick={() => setCnpjLookupPreview(null)}>
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
                                toggleCnpjApplySelection("addressComplement", event.target.checked)
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
                                {formatMaskedFromDigits(cnpjLookupPreview.postalCode || "", maskCep) ||
                                  "-"}
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
                          <p className="feedbackError">Selecione ao menos um campo para aplicar.</p>
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
                </AdminCard>
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
                          Sincronização de agenda para negócios com modo Google.
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

              {configurationArea === "calendar" ? (
                <AdminCard
                  className="full"
                  title="Google Calendar"
                  description="Opcional. Configure apenas para negócios com modo Google."
                >
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
                    {calendarFeedback ? (
                      <p className="feedbackOk">{calendarFeedback}</p>
                    ) : null}
                  </form>
                </AdminCard>
              ) : null}
            </>
          ) : (
            <>
              {dashboardArea === "overview" ? (
                <AdminCard className="full" title="Visão geral">
                  <div className="statsGrid">
                    <MetricCard
                      value={totalBusinesses}
                      label="Negócios cadastrados"
                      variant="indigo"
                    />
                    <MetricCard
                      value={internalModeBusinesses}
                      label="Em agenda interna"
                      variant="rose"
                    />
                    <MetricCard
                      value={googleModeBusinesses}
                      label="Em Google Calendar"
                      variant="emerald"
                    />
                  </div>
                </AdminCard>
              ) : null}

              {dashboardArea === "businesses" ? (
                <AdminCard
                  className="full"
                  title="Negócios cadastrados"
                  description="Aplique ajustes gerenciais no negócio selecionado."
                >
                  <div className="form">
                    <ul className="list">
                      {businesses.map((business) => (
                        <li key={business.id}>
                          <span>{business.name}</span>
                          <small>
                            {business.slug} - {business.calendar_mode || "internal"}{" "}
                            {business.cnpj ? `- CNPJ: ${business.cnpj}` : ""}
                          </small>
                        </li>
                      ))}
                    </ul>
                    <Button type="button" onClick={handleCalendarModeSave}>
                      Salvar modo de agenda do negócio ativo
                    </Button>
                  </div>
                </AdminCard>
              ) : null}
            </>
          )}
            </div>
          </div>
        </div>
      ) : role === "owner" ? (
        <div className="clientShell">
          <aside className="clientSidebar card glassCard">
            <div className="adminSidebarNav">
              <p className="adminSidebarCaption">Dashboard</p>
              <div className="adminSidebarSubnav">
                <button
                  type="button"
                  className={`sidebarSubButton ${
                    clientMainArea === "dashboard" && clientDashboardArea === "overview"
                      ? "isActive"
                      : ""
                  }`}
                  onClick={() => {
                    setClientMainArea("dashboard");
                    setClientDashboardArea("overview");
                  }}
                >
                  📊 Visão geral
                </button>
                <button
                  type="button"
                  className={`sidebarSubButton ${
                    clientMainArea === "dashboard" && clientDashboardArea === "analytics"
                      ? "isActive"
                      : ""
                  }`}
                  onClick={() => {
                    setClientMainArea("dashboard");
                    setClientDashboardArea("analytics");
                  }}
                >
                  📈 Análises
                </button>
                <button
                  type="button"
                  className={`sidebarSubButton ${
                    clientMainArea === "dashboard" && clientDashboardArea === "agenda"
                      ? "isActive"
                      : ""
                  }`}
                  onClick={() => {
                    setClientMainArea("dashboard");
                    setClientDashboardArea("agenda");
                  }}
                >
                  🗓️ Agenda
                </button>
                <button
                  type="button"
                  className={`sidebarSubButton ${
                    clientMainArea === "dashboard" && clientDashboardArea === "subscription"
                      ? "isActive"
                      : ""
                  }`}
                  onClick={() => {
                    setClientMainArea("dashboard");
                    setClientDashboardArea("subscription");
                  }}
                >
                  💳 Assinatura
                </button>
              </div>
              <p className="adminSidebarCaption">Configurações</p>
              <div className="adminSidebarSubnav">
                <button
                  type="button"
                  className={`sidebarSubButton ${
                    clientMainArea === "settings" && clientSettingsArea === "messages"
                      ? "isActive"
                      : ""
                  }`}
                  onClick={() => {
                    setClientMainArea("settings");
                    setClientSettingsArea("messages");
                  }}
                >
                  💬 Comunicação
                </button>
                <button
                  type="button"
                  className={`sidebarSubButton ${
                    clientMainArea === "settings" && clientSettingsArea === "services"
                      ? "isActive"
                      : ""
                  }`}
                  onClick={() => {
                    setClientMainArea("settings");
                    setClientSettingsArea("services");
                  }}
                >
                  🧰 Catálogo de serviços
                </button>
                <button
                  type="button"
                  className={`sidebarSubButton ${
                    clientMainArea === "settings" && clientSettingsArea === "hours"
                      ? "isActive"
                      : ""
                  }`}
                  onClick={() => {
                    setClientMainArea("settings");
                    setClientSettingsArea("hours");
                  }}
                >
                  🕒 Agenda de atendimento
                </button>
                <button
                  type="button"
                  className={`sidebarSubButton ${
                    clientMainArea === "settings" && clientSettingsArea === "customers"
                      ? "isActive"
                      : ""
                  }`}
                  onClick={() => {
                    setClientMainArea("settings");
                    setClientSettingsArea("customers");
                  }}
                >
                  👤 Clientes
                </button>
                <button
                  type="button"
                  className={`sidebarSubButton ${
                    clientMainArea === "settings" && clientSettingsArea === "finance"
                      ? "isActive"
                      : ""
                  }`}
                  onClick={() => {
                    setClientMainArea("settings");
                    setClientSettingsArea("finance");
                  }}
                >
                  👥 Financeiro (clientes)
                </button>
              </div>
            </div>
            <div className="adminSidebarFooter">
              <span className="adminSidebarUser">Administrador</span>
              <small>Painel de configuração</small>
            </div>
          </aside>

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
                              const minutesToStart = Math.floor(
                                (new Date(appointment.starts_at).getTime() - Date.now()) / 60000
                              );
                              const cancelCutoff = Math.max(
                                0,
                                Number(bookingCancelCutoffMinutes) || 0
                              );
                              const rescheduleCutoff = Math.max(
                                0,
                                Number(bookingRescheduleCutoffMinutes) || 0
                              );
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
                                    disabled={isActionBusy || !autoReturnEnabled}
                                    onClick={() => void handleCreateAutoReturn(appointment.id)}
                                  >
                                    Retorno +{Math.max(7, Number(autoReturnDays) || 30)}d
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isActionBusy || !checkinQrEnabled}
                                    onClick={() => void handleGenerateCheckinToken(appointment.id)}
                                  >
                                    Gerar QR
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={isActionBusy || !autoFeedbackEnabled}
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
                {subscriptionModalOpen ? (
                  <div
                    className="detailsModalBackdrop"
                    onClick={() => {
                      if (!subscriptionRequestSaving) setSubscriptionModalOpen(false);
                    }}
                  >
                    <article
                      className="detailsModalCard serviceFormModal"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="detailsPanelHeader">
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
                      <div className="list">
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
                      </div>
                      <label>
                        Observação para o desenvolvedor (opcional)
                        <Textarea
                          rows={2}
                          value={subscriptionRequestNote}
                          onChange={(event) => setSubscriptionRequestNote(event.target.value)}
                          placeholder="Ex.: aumento de equipe previsto para o próximo mês."
                        />
                      </label>
                      <div className="actionsRow">
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
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSubscriptionModalOpen(false)}
                          disabled={subscriptionRequestSaving}
                        >
                          Cancelar
                        </Button>
                      </div>
                      {requestedPlanCode === planCode ? (
                        <p className="helperText">
                          Selecione um plano diferente do atual para enviar a solicitação.
                        </p>
                      ) : null}
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
                <div className="servicesStatsGrid">
                  <div className="servicesStatCard">
                    <small>Total de serviços</small>
                    <strong>{services.length}</strong>
                  </div>
                  <div className="servicesStatCard">
                    <small>Serviços ativos</small>
                    <strong>{activeServiceCount}</strong>
                  </div>
                  <div className="servicesStatCard">
                    <small>Ticket médio</small>
                    <strong>R$ {(serviceTicketMedio / 100).toFixed(2)}</strong>
                  </div>
                  <div className="servicesStatCard">
                    <small>Categorias</small>
                    <strong>{serviceCategories.length}</strong>
                  </div>
                  <div className="servicesStatCard">
                    <small>Com fotos</small>
                    <strong>{servicesWithImagesCount}</strong>
                  </div>
                </div>
                <div className="servicesTemplatesRow">
                  <small>Templates rápidos:</small>
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
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={openCreateServiceModal}
                  >
                    + Novo serviço
                  </Button>
                </div>
                {serviceTemplatePreviewName ? (
                  <div className="servicesTemplatePreview">
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
                <form className="form" onSubmit={handleCreateService}>
                  <label>
                    Nome do serviço
                    <Input
                      value={serviceName}
                      onChange={(event) => setServiceName(event.target.value)}
                      placeholder="Ex.: Corte masculino"
                      required
                    />
                  </label>
                  <label>
                    Categoria
                    <Input
                      value={serviceCategory}
                      onChange={(event) => setServiceCategory(event.target.value)}
                      placeholder="Ex.: Cabelo, Estética, Consultoria..."
                    />
                  </label>
                  <label>
                    Descrição
                    <Textarea
                      rows={2}
                      value={serviceDescription}
                      onChange={(event) => setServiceDescription(event.target.value)}
                      placeholder="Descreva o que está incluído neste serviço..."
                    />
                  </label>
                  <label>
                    Duração (minutos)
                    <Input
                      type="number"
                      min={5}
                      step={5}
                      value={serviceDuration}
                      onChange={(event) => setServiceDuration(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Preço (R$)
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={servicePrice}
                      onChange={(event) => setServicePrice(event.target.value)}
                      placeholder="Opcional"
                    />
                  </label>
                  <label>
                    Ícone
                    <div className="servicesPickerRow">
                      {SERVICE_ICONS.map((icon) => (
                        <button
                          key={`new-icon-${icon}`}
                          type="button"
                          className={`servicesIconOption ${
                            serviceIcon === icon ? "isSelected" : ""
                          }`}
                          onClick={() => setServiceIcon(icon)}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </label>
                  <label>
                    Cor
                    <div className="servicesPickerRow">
                      {SERVICE_COLORS.map((color) => (
                        <button
                          key={`new-color-${color}`}
                          type="button"
                          className={`servicesColorOption ${
                            serviceColor === color ? "isSelected" : ""
                          }`}
                          style={{ background: color }}
                          onClick={() => setServiceColor(color)}
                          aria-label={`Cor ${color}`}
                        />
                      ))}
                    </div>
                  </label>
                  <label>
                    Fotos (até 5)
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={serviceUploadLoading || serviceImages.length >= 5}
                      onChange={(event) =>
                        void handleUploadServiceImages(event.target.files, "new")
                      }
                    />
                    {serviceImages.length > 0 ? (
                      <div className="servicesImagesGrid">
                        {serviceImages.map((url, index) => (
                          <div key={`new-image-${index}`} className="servicesImagePreview">
                            <img src={url} alt={`Imagem ${index + 1}`} />
                            <button
                              type="button"
                              className="servicesImageRemove"
                              onClick={() => removeServiceImage("new", index)}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </label>
                  <Button className="saveButton">Adicionar serviço</Button>
                  {serviceFeedback ? <p className="feedbackOk">{serviceFeedback}</p> : null}
                </form>

                {editingServiceId ? (
                  <form className="form editBlock" onSubmit={handleUpdateService}>
                    <h3>Editar serviço</h3>
                    <label>
                      Nome do serviço
                      <Input
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Categoria
                      <Input
                        value={editingCategory}
                        onChange={(event) => setEditingCategory(event.target.value)}
                      />
                    </label>
                    <label>
                      Descrição
                      <Textarea
                        rows={2}
                        value={editingDescription}
                        onChange={(event) => setEditingDescription(event.target.value)}
                      />
                    </label>
                    <label>
                      Duração (minutos)
                      <Input
                        type="number"
                        min={5}
                        step={5}
                        value={editingDuration}
                        onChange={(event) => setEditingDuration(event.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Preço (R$)
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editingPrice}
                        onChange={(event) => setEditingPrice(event.target.value)}
                        placeholder="Opcional"
                      />
                    </label>
                    <label>
                      Ícone
                      <div className="servicesPickerRow">
                        {SERVICE_ICONS.map((icon) => (
                          <button
                            key={`edit-icon-${icon}`}
                            type="button"
                            className={`servicesIconOption ${
                              editingIcon === icon ? "isSelected" : ""
                            }`}
                            onClick={() => setEditingIcon(icon)}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </label>
                    <label>
                      Cor
                      <div className="servicesPickerRow">
                        {SERVICE_COLORS.map((color) => (
                          <button
                            key={`edit-color-${color}`}
                            type="button"
                            className={`servicesColorOption ${
                              editingColor === color ? "isSelected" : ""
                            }`}
                            style={{ background: color }}
                            onClick={() => setEditingColor(color)}
                          />
                        ))}
                      </div>
                    </label>
                    <label>
                      Fotos (até 5)
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={serviceUploadLoading || editingImages.length >= 5}
                        onChange={(event) =>
                          void handleUploadServiceImages(event.target.files, "edit")
                        }
                      />
                      {editingImages.length > 0 ? (
                        <div className="servicesImagesGrid">
                          {editingImages.map((url, index) => (
                            <div key={`edit-image-${index}`} className="servicesImagePreview">
                              <img src={url} alt={`Imagem ${index + 1}`} />
                              <button
                                type="button"
                                className="servicesImageRemove"
                                onClick={() => removeServiceImage("edit", index)}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </label>
                    <div className="actionsRow">
                      <Button className="saveButton">Salvar alterações</Button>
                      <Button type="button" variant="outline" onClick={cancelEditingService}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : null}

                <div className="servicesFilters">
                  <Input
                    value={serviceSearch}
                    onChange={(event) => setServiceSearch(event.target.value)}
                    placeholder="Buscar serviço..."
                  />
                  <Select
                    value={serviceCategoryFilter}
                    onChange={(event) => setServiceCategoryFilter(event.target.value)}
                  >
                    <option value="">Todas categorias</option>
                    {serviceCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={serviceStatusFilter}
                    onChange={(event) =>
                      setServiceStatusFilter(event.target.value as "" | "active" | "inactive")
                    }
                  >
                    <option value="">Todos status</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                  </Select>
                  <div className="servicesViewToggle">
                    <Button
                      type="button"
                      size="sm"
                      variant={servicesViewMode === "list" ? "primary" : "outline"}
                      onClick={() => setServicesViewMode("list")}
                    >
                      Lista
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={servicesViewMode === "grid" ? "primary" : "outline"}
                      onClick={() => setServicesViewMode("grid")}
                    >
                      Grade
                    </Button>
                  </div>
                </div>

                {filteredServices.length === 0 ? (
                  <ul className="list">
                    <li>
                      <span>Nenhum serviço encontrado.</span>
                      <small>Ajuste os filtros ou crie um novo serviço.</small>
                    </li>
                  </ul>
                ) : (
                  <div
                    className={
                      servicesViewMode === "grid"
                        ? "servicesCardsGrid servicesCardsGridView"
                        : "servicesCardsGrid"
                    }
                  >
                    {filteredServices.map((service) => (
                      <article
                        key={service.id}
                        className={`serviceCatalogCard ${service.is_active ? "" : "isInactive"}`}
                        style={{
                          borderLeftColor: service.color || "#3B82F6"
                        }}
                        draggable={servicesViewMode === "list"}
                        onDragStart={(event) =>
                          event.dataTransfer.setData("text/service-id", service.id)
                        }
                        onDragOver={(event) => {
                          if (servicesViewMode === "list") event.preventDefault();
                        }}
                        onDrop={(event) => {
                          if (servicesViewMode !== "list") return;
                          event.preventDefault();
                          const sourceId = event.dataTransfer.getData("text/service-id");
                          void handleDropReorderService(sourceId, service.id);
                        }}
                      >
                        <div className="serviceCatalogHeader">
                          <div className="serviceCatalogTitle">
                            {service.image_urls?.[0] ? (
                              <img
                                src={service.image_urls[0]}
                                alt={service.name}
                                className="serviceCatalogCover"
                              />
                            ) : (
                              <span className="serviceCatalogIcon">{service.icon || "✂️"}</span>
                            )}
                            <div>
                              <strong>{service.name}</strong>
                              {service.category ? (
                                <small className="serviceCatalogTag">{service.category}</small>
                              ) : null}
                              {service.image_urls?.length ? (
                                <small className="serviceCatalogTag">
                                  📸 {service.image_urls.length}
                                </small>
                              ) : null}
                            </div>
                          </div>
                          <Checkbox
                            label={service.is_active ? "Ativo" : "Inativo"}
                            checked={service.is_active}
                            onChange={() => void handleToggleServiceActive(service)}
                          />
                        </div>
                        {service.description ? (
                          <p className="serviceCatalogDescription">{service.description}</p>
                        ) : null}
                        <div className="serviceCatalogMeta">
                          <small>{service.duration_minutes} min</small>
                          <strong>
                            {typeof service.price_cents === "number"
                              ? `R$ ${(service.price_cents / 100).toFixed(2)}`
                              : "Preço sob consulta"}
                          </strong>
                        </div>
                        <div className="serviceCatalogActions">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditServiceModal(service)}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDuplicateService(service)}
                          >
                            Duplicar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleMoveService(service, -1)}
                          >
                            ↑
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleMoveService(service, 1)}
                          >
                            ↓
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDeleteService(service.id)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {serviceModalOpen ? (
                  <div className="detailsModalBackdrop" onClick={closeServiceModal}>
                    <article
                      className="detailsModalCard serviceFormModal"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="detailsPanelHeader">
                        <h3 className="integrationName">
                          {serviceModalMode === "create" ? "Novo serviço" : "Editar serviço"}
                        </h3>
                        <Button type="button" variant="outline" size="sm" onClick={closeServiceModal}>
                          Fechar
                        </Button>
                      </div>
                      <div className="servicesModalTabs">
                        <button
                          type="button"
                          className={serviceModalTab === "info" ? "isActive" : ""}
                          onClick={() => setServiceModalTab("info")}
                        >
                          Informações
                        </button>
                        <button
                          type="button"
                          className={serviceModalTab === "visual" ? "isActive" : ""}
                          onClick={() => setServiceModalTab("visual")}
                        >
                          Visual
                        </button>
                        <button
                          type="button"
                          className={serviceModalTab === "images" ? "isActive" : ""}
                          onClick={() => setServiceModalTab("images")}
                        >
                          Fotos
                        </button>
                      </div>
                      <div className="form">
                        {serviceModalTab === "info" ? (
                          <>
                            <label>
                              Nome do serviço
                              <Input
                                value={serviceModalMode === "create" ? serviceName : editingName}
                                onChange={(event) =>
                                  serviceModalMode === "create"
                                    ? setServiceName(event.target.value)
                                    : setEditingName(event.target.value)
                                }
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
                              />
                            </label>
                            <label>
                              Descrição
                              <Textarea
                                rows={2}
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
                              />
                            </label>
                            <div className="servicesModalTwoCols">
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
                                    serviceModalMode === "create" ? servicePrice : editingPrice
                                  }
                                  onChange={(event) =>
                                    serviceModalMode === "create"
                                      ? setServicePrice(event.target.value)
                                      : setEditingPrice(event.target.value)
                                  }
                                />
                              </label>
                            </div>
                          </>
                        ) : null}

                        {serviceModalTab === "visual" ? (
                          <>
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
                              Cor
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
                                  />
                                ))}
                              </div>
                            </label>
                          </>
                        ) : null}

                        {serviceModalTab === "images" ? (
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
                        ) : null}
                      </div>
                      <div className="actionsRow">
                        <Button
                          type="button"
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
                        <Button type="button" variant="outline" onClick={closeServiceModal}>
                          Cancelar
                        </Button>
                      </div>
                    </article>
                  </div>
                ) : null}
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
                <form className="form" onSubmit={handleSaveBusinessHours}>
                  <div className="hoursGrid">
                    {weekDaysSchedule.map((day) => {
                      const row = businessHours.find((item) => item.weekday === day.id);
                      if (!row) return null;

                      return (
                        <div key={day.id} className="hoursRow">
                          <Checkbox
                            className="hoursToggle"
                            checked={row.isActive}
                            onChange={(event) =>
                              updateBusinessHour(day.id, { isActive: event.target.checked })
                            }
                            label={day.label}
                          />
                          <Input
                            type="time"
                            value={row.startTime}
                            disabled={!row.isActive}
                            onChange={(event) =>
                              updateBusinessHour(day.id, { startTime: event.target.value })
                            }
                          />
                          <Input
                            type="time"
                            value={row.endTime}
                            disabled={!row.isActive}
                            onChange={(event) =>
                              updateBusinessHour(day.id, { endTime: event.target.value })
                            }
                          />
                          <Checkbox
                            checked={row.hasLunchBreak}
                            disabled={!row.isActive}
                            onChange={(event) =>
                              updateBusinessHour(day.id, {
                                hasLunchBreak: event.target.checked
                              })
                            }
                            label="Almoço"
                          />
                          <Input
                            type="time"
                            value={row.lunchStartTime}
                            disabled={!row.isActive || !row.hasLunchBreak}
                            onChange={(event) =>
                              updateBusinessHour(day.id, {
                                lunchStartTime: event.target.value
                              })
                            }
                          />
                          <Input
                            type="time"
                            value={row.lunchEndTime}
                            disabled={!row.isActive || !row.hasLunchBreak}
                            onChange={(event) =>
                              updateBusinessHour(day.id, {
                                lunchEndTime: event.target.value
                              })
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="hoursRulesGrid">
                    <p className="helperText hoursRulesHint">
                      Estes intervalos sao personalizaveis por negocio e sao aplicados na
                      disponibilidade e na validacao de conflitos de agendamento.
                    </p>
                    <label>
                      Tempo de preparação antes (min)
                      <Input
                        type="number"
                        min={0}
                        step={5}
                        value={bookingBufferBeforeMinutes}
                        onChange={(event) =>
                          setBookingBufferBeforeMinutes(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Tempo de limpeza/descanso depois (min)
                      <Input
                        type="number"
                        min={0}
                        step={5}
                        value={bookingBufferAfterMinutes}
                        onChange={(event) =>
                          setBookingBufferAfterMinutes(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Antecedencia minima para agendar (min)
                      <Input
                        type="number"
                        min={0}
                        step={5}
                        value={bookingMinNoticeMinutes}
                        onChange={(event) =>
                          setBookingMinNoticeMinutes(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Janela maxima para agendar (dias)
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={bookingMaxDaysAhead}
                        onChange={(event) =>
                          setBookingMaxDaysAhead(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Limite diario de agendamentos (opcional)
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={bookingDailyLimit}
                        onChange={(event) => setBookingDailyLimit(event.target.value)}
                        placeholder="Sem limite"
                      />
                    </label>
                    <label>
                      Capacidade simultanea por horario
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        step={1}
                        value={bookingSlotCapacity}
                        onChange={(event) => setBookingSlotCapacity(event.target.value)}
                      />
                    </label>
                    <label>
                      Lista de espera automatizada
                      <Checkbox
                        checked={waitlistEnabled}
                        onChange={(event) => setWaitlistEnabled(event.target.checked)}
                        label="Permitir fila de espera quando horarios estiverem esgotados"
                      />
                    </label>
                    <label>
                      Lembrete 24h antes
                      <Checkbox
                        checked={reminder24hEnabled}
                        onChange={(event) => setReminder24hEnabled(event.target.checked)}
                        label="Enviar aviso: seu agendamento e amanha"
                      />
                    </label>
                    <label>
                      Lembrete 2h antes
                      <Checkbox
                        checked={reminder2hEnabled}
                        onChange={(event) => setReminder2hEnabled(event.target.checked)}
                        label="Enviar lembrete proximo ao horario"
                      />
                    </label>
                    <label>
                      Lembrete 30min antes
                      <Checkbox
                        checked={reminder30mEnabled}
                        onChange={(event) => setReminder30mEnabled(event.target.checked)}
                        label="Enviar confirmacao de deslocamento"
                      />
                    </label>
                    <label>
                      Confirmacao obrigatoria de presenca
                      <Checkbox
                        checked={attendanceConfirmationRequired}
                        onChange={(event) =>
                          setAttendanceConfirmationRequired(event.target.checked)
                        }
                        label="Exigir confirmacao antes do atendimento"
                      />
                    </label>
                    <label>
                      Prazo para confirmar presenca (min antes)
                      <Input
                        type="number"
                        min={60}
                        max={10080}
                        step={30}
                        value={attendanceConfirmationDeadlineMinutes}
                        onChange={(event) =>
                          setAttendanceConfirmationDeadlineMinutes(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Liberacao automatica por falta de confirmacao
                      <Checkbox
                        checked={autoReleaseUnconfirmed}
                        onChange={(event) => setAutoReleaseUnconfirmed(event.target.checked)}
                        label="Liberar horario automaticamente se cliente nao confirmar"
                      />
                    </label>
                    <label>
                      Pos-atendimento: agradecimento + avaliacao
                      <Checkbox
                        checked={postVisitThankYouEnabled}
                        onChange={(event) => setPostVisitThankYouEnabled(event.target.checked)}
                        label="Enviar mensagem apos atendimento concluido"
                      />
                    </label>
                    <label>
                      Pos-atendimento: cupom proxima visita
                      <Checkbox
                        checked={postVisitCouponEnabled}
                        onChange={(event) => setPostVisitCouponEnabled(event.target.checked)}
                        label="Enviar incentivo para retorno"
                      />
                    </label>
                    <label>
                      Campanhas de remarketing
                      <Checkbox
                        checked={remarketingEnabled}
                        onChange={(event) => setRemarketingEnabled(event.target.checked)}
                        label="Enviar campanhas para clientes inativos"
                      />
                    </label>
                    <label>
                      Auto-agendamento de retorno
                      <Checkbox
                        checked={autoReturnEnabled}
                        onChange={(event) => setAutoReturnEnabled(event.target.checked)}
                        label="Oferecer retorno em 1 clique"
                      />
                    </label>
                    <label>
                      Dias para retorno automático
                      <Input
                        type="number"
                        min={7}
                        max={120}
                        step={1}
                        value={autoReturnDays}
                        onChange={(event) => setAutoReturnDays(event.target.value)}
                      />
                    </label>
                    <label>
                      Reagendamento em 1 clique
                      <Checkbox
                        checked={oneClickRescheduleEnabled}
                        onChange={(event) => setOneClickRescheduleEnabled(event.target.checked)}
                        label="Sugerir novos horários quando houver cancelamento"
                      />
                    </label>
                    <label>
                      Check-in por QR code
                      <Checkbox
                        checked={checkinQrEnabled}
                        onChange={(event) => setCheckinQrEnabled(event.target.checked)}
                        label="Permitir check-in automático por token/QR"
                      />
                    </label>
                    <label>
                      Feedback automático pós-atendimento
                      <Checkbox
                        checked={autoFeedbackEnabled}
                        onChange={(event) => setAutoFeedbackEnabled(event.target.checked)}
                        label="Enviar mensagem de avaliação automática"
                      />
                    </label>
                    <label>
                      Google Reviews habilitado
                      <Checkbox
                        checked={googleReviewsEnabled}
                        onChange={(event) => setGoogleReviewsEnabled(event.target.checked)}
                        label="Anexar link de avaliação do Google"
                      />
                    </label>
                    <label>
                      URL do Google Reviews
                      <Input
                        type="url"
                        value={googleReviewsUrl}
                        onChange={(event) => setGoogleReviewsUrl(event.target.value)}
                        placeholder="https://g.page/r/..."
                      />
                    </label>
                    <label>
                      Inatividade para remarketing (dias)
                      <Input
                        type="number"
                        min={7}
                        max={365}
                        step={1}
                        value={remarketingInactiveDays}
                        onChange={(event) => setRemarketingInactiveDays(event.target.value)}
                      />
                    </label>
                    <label>
                      Mensagem de aniversario
                      <Checkbox
                        checked={birthdayCampaignEnabled}
                        onChange={(event) => setBirthdayCampaignEnabled(event.target.checked)}
                        label="Enviar desconto/brinde no aniversario"
                      />
                    </label>
                    <label>
                      Limite para reagendamento (min antes do inicio)
                      <Input
                        type="number"
                        min={0}
                        step={5}
                        value={bookingRescheduleCutoffMinutes}
                        onChange={(event) =>
                          setBookingRescheduleCutoffMinutes(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Limite para cancelamento (min antes do inicio)
                      <Input
                        type="number"
                        min={0}
                        step={5}
                        value={bookingCancelCutoffMinutes}
                        onChange={(event) =>
                          setBookingCancelCutoffMinutes(event.target.value)
                        }
                      />
                    </label>
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
                  <Button className="saveButton">Salvar horário de atendimento</Button>
                  {hoursFeedback ? <p className="feedbackOk">{hoursFeedback}</p> : null}
                </form>
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
          </section>
        </div>
      ) : null}
    </main>
  );
}
