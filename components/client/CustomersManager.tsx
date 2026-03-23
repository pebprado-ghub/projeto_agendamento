"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { normalizePhoneDigits } from "@/lib/phone";
import { formatMaskedFromDigits, maskCep } from "@/lib/masksBr";
import { lookupViaCep } from "@/lib/viacep";

export type CustomerRow = {
  id: string;
  business_id: string;
  full_name: string;
  /** Nome público do perfil WhatsApp (somente leitura no painel; atualizado pela integração). */
  whatsapp_profile_name?: string | null;
  phone_normalized: string;
  email: string | null;
  document_id: string | null;
  birth_date: string | null;
  gender: string | null;
  address_line: string | null;
  address_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  notes: string | null;
  preferences?: string | null;
  restrictions?: string | null;
  tags?: string[];
  is_vip?: boolean;
  is_blocked?: boolean;
  block_reason?: string | null;
  source: string;
  marketing_opt_in: boolean;
  created_at: string;
  updated_at: string;
};

type ServiceLite = { id: string; name: string };

type ActivityPayload = {
  appointments: Array<{
    id: string;
    service_id: string | null;
    customer_name: string | null;
    customer_phone: string;
    starts_at: string;
    ends_at: string;
    status: string;
    notes: string | null;
  }>;
  payments: Array<{
    id: string;
    appointment_id: string | null;
    amount_cents: number;
    currency: string;
    payment_method: string;
    status: string;
    paid_at: string;
    notes: string | null;
  }>;
  contracts: Array<{
    id: string;
    offer_plan_id: string;
    offer_name: string;
    offer_type: string;
    status: string;
    starts_at: string;
    ends_at: string | null;
    sessions_total: number | null;
    sessions_used: number;
    next_billing_at: string | null;
    notes: string | null;
    created_at: string;
    usages?: Array<{
      id: string;
      customer_plan_contract_id: string;
      appointment_id: string | null;
      used_sessions: number;
      used_at: string;
      notes: string | null;
      created_at: string;
    }>;
  }>;
  stats: {
    visitCount: number;
    totalPaidCents: number;
    lifetimeValueCents?: number;
    uniqueServicesCount?: number;
  };
  loyalty?: {
    pointsBalance: number;
    lifetimePoints: number;
    totalRedeemedPoints: number;
    levelCode: string;
    availableDiscountCents: number;
  };
  badges?: Array<{
    id: string;
    badge_code: string;
    badge_name: string;
    achieved_at: string;
  }>;
  referrals?: Array<{
    id: string;
    referred_customer_id: string;
    referral_code: string;
    status: string;
    reward_referrer_cents: number;
    reward_referred_cents: number;
    converted_at: string | null;
    created_at: string;
  }>;
};

function formatBrl(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(cents / 100);
}

function formatPhoneBrDigits(digits: string) {
  const d = digits.replace(/\D/g, "");
  if (d.length <= 2) return d;
  if (d.length <= 4) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

function formatDateTimePt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  whatsapp: "WhatsApp",
  import: "Importação",
  campaign: "Campanha",
  other: "Outro"
};

const PAY_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  boleto: "Boleto",
  credit_card: "Cartão crédito",
  debit_card: "Cartão débito",
  transfer: "Transferência",
  other: "Outro"
};

/** URL segura para exibir no painel (evita javascript: etc.). */
function resolvePrivacyPolicyUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL?.trim();
  if (!raw || /^javascript:/i.test(raw)) {
    return null;
  }
  if (raw.startsWith("/")) {
    return raw;
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return null;
}

type Props = {
  businessId: string | null;
  services: ServiceLite[];
  /** Quando false e não há businessId, mostra carregamento em vez do aviso de .env (após login). Default: true. */
  businessContextReady?: boolean;
};

type CustomerInsights = {
  month: number;
  inactiveDays: number;
  birthdaysThisMonth: Array<{
    customerId: string;
    fullName: string;
    birthDate: string;
    phone: string;
  }>;
  inactiveCustomers: Array<{
    customerId: string;
    fullName: string;
    lastVisitAt: string | null;
    daysSinceLastVisit: number | null;
    lifetimeValueCents: number;
    tags: string[];
    isVip: boolean;
    marketingOptIn: boolean;
  }>;
  totals: {
    customers: number;
    vip: number;
  };
};

export function CustomersManager({
  businessId,
  services,
  businessContextReady = true
}: Props) {
  const privacyPolicyUrl = resolvePrivacyPolicyUrl();

  const [list, setList] = useState<CustomerRow[]>([]);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [insights, setInsights] = useState<CustomerInsights | null>(null);
  const [inactiveDaysFilter, setInactiveDaysFilter] = useState("60");

  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);
  const [detail, setDetail] = useState<CustomerRow | null>(null);
  const [activity, setActivity] = useState<ActivityPayload | null>(null);
  const [tab, setTab] = useState<"dados" | "historico" | "pagamentos">("dados");
  const [detailLoading, setDetailLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackErr, setFeedbackErr] = useState("");

  const serviceNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of services) m.set(s.id, s.name);
    return m;
  }, [services]);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  const loadList = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setListError("");
    try {
      const url = new URL("/api/customers", window.location.origin);
      url.searchParams.set("businessId", businessId);
      if (qDebounced.trim().length >= 2) {
        url.searchParams.set("q", qDebounced.trim());
      }
      const res = await fetch(url.toString());
      const json = (await res.json()) as { data?: CustomerRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao listar.");
      setList(json.data || []);
    } catch (e) {
      setListError((e as Error).message);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, qDebounced]);

  const loadInsights = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await fetch(
        `/api/customers/insights?businessId=${encodeURIComponent(
          businessId
        )}&inactiveDays=${encodeURIComponent(inactiveDaysFilter)}`
      );
      const json = (await res.json()) as { data?: CustomerInsights; error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao carregar insights.");
      setInsights(json.data || null);
    } catch {
      setInsights(null);
    }
  }, [businessId, inactiveDaysFilter]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  async function loadDetail(id: string) {
    if (!businessId) return;
    setDetailLoading(true);
    setFeedback("");
    setFeedbackErr("");
    try {
      const res = await fetch(
        `/api/customers/${id}?businessId=${encodeURIComponent(businessId)}`
      );
      const json = (await res.json()) as { data?: CustomerRow; error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao carregar.");
      setDetail(json.data || null);
    } catch (e) {
      setFeedbackErr((e as Error).message);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadActivity(id: string) {
    if (!businessId) return;
    try {
      const res = await fetch(
        `/api/customers/${id}/activity?businessId=${encodeURIComponent(businessId)}`
      );
      const json = (await res.json()) as ActivityPayload & { error?: string };
      if (!res.ok) throw new Error((json as { error?: string }).error || "Erro.");
      setActivity({
        appointments: json.appointments || [],
        payments: json.payments || [],
        contracts: json.contracts || [],
        stats: json.stats || { visitCount: 0, totalPaidCents: 0 },
        loyalty: json.loyalty || {
          pointsBalance: 0,
          lifetimePoints: 0,
          totalRedeemedPoints: 0,
          levelCode: "bronze",
          availableDiscountCents: 0
        },
        badges: json.badges || [],
        referrals: json.referrals || []
      });
    } catch {
      setActivity({
        appointments: [],
        payments: [],
        contracts: [],
        stats: { visitCount: 0, totalPaidCents: 0 },
        loyalty: {
          pointsBalance: 0,
          lifetimePoints: 0,
          totalRedeemedPoints: 0,
          levelCode: "bronze",
          availableDiscountCents: 0
        },
        badges: [],
        referrals: []
      });
    }
  }

  useEffect(() => {
    if (!selectedId || selectedId === "new") {
      setDetail(null);
      setActivity(null);
      return;
    }
    setDetail(null);
    setActivity(null);
    void loadDetail(selectedId);
    void loadActivity(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega ao trocar cliente
  }, [selectedId, businessId]);

  type FormState = Partial<CustomerRow> & { phoneInput?: string };

  const emptyForm: FormState = useMemo(
    () => ({
      full_name: "",
      whatsapp_profile_name: null,
      phoneInput: "",
      email: "",
      document_id: "",
      birth_date: "",
      gender: "",
      address_line: "",
      address_number: "",
      address_complement: "",
      neighborhood: "",
      city: "",
      state: "",
      postal_code: "",
      notes: "",
      preferences: "",
      restrictions: "",
      tags: [],
      is_vip: false,
      is_blocked: false,
      block_reason: "",
      source: "manual",
      marketing_opt_in: false
    }),
    []
  );

  const [form, setForm] = useState<FormState>(emptyForm);
  const [lastFetchedCep, setLastFetchedCep] = useState("");
  const [cepFeedback, setCepFeedback] = useState("");

  function clearCustomerAddressFromCep() {
    setForm((f) => ({
      ...f,
      address_line: "",
      neighborhood: "",
      city: "",
      state: ""
    }));
  }

  function handleCustomerPostalCodeChange(rawValue: string) {
    const masked = maskCep(rawValue);
    const digits = masked.replace(/\D/g, "");
    setForm((f) => ({ ...f, postal_code: masked }));

    if (digits.length < 8) {
      setLastFetchedCep("");
      setCepFeedback("");
      clearCustomerAddressFromCep();
      return;
    }

    if (digits.length === 8 && digits !== lastFetchedCep) {
      void (async () => {
        const result = await lookupViaCep(digits);
        if (!result.ok) {
          setCepFeedback(result.message);
          clearCustomerAddressFromCep();
          return;
        }
        setForm((f) => ({
          ...f,
          address_line: result.data.logradouro || "",
          neighborhood: result.data.bairro || "",
          city: result.data.localidade || "",
          state: result.data.uf || ""
        }));
        setLastFetchedCep(digits);
        setCepFeedback("Endereco preenchido automaticamente.");
      })();
    }
  }

  useEffect(() => {
    if (selectedId === "new") {
      setTab("dados");
      setForm(emptyForm);
      setLastFetchedCep("");
      setCepFeedback("");
      return;
    }
    if (detail) {
      const pcDigits = (detail.postal_code || "").replace(/\D/g, "");
      setForm({
        ...detail,
        phoneInput: formatPhoneBrDigits(detail.phone_normalized),
        postal_code: formatMaskedFromDigits(detail.postal_code, maskCep)
      });
      setLastFetchedCep(pcDigits.length === 8 ? pcDigits : "");
      setCepFeedback("");
    }
  }, [detail, selectedId, emptyForm]);

  function closeDetail() {
    setSelectedId(null);
    setTab("dados");
    setFeedback("");
    setFeedbackErr("");
    setLastFetchedCep("");
    setCepFeedback("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    setFeedback("");
    setFeedbackErr("");
    const phone = normalizePhoneDigits(form.phoneInput || "");
    const payload = {
      businessId,
      fullName: form.full_name?.trim() || "",
      phone,
      email: form.email || null,
      documentId: form.document_id || null,
      birthDate: form.birth_date || null,
      gender: form.gender || null,
      addressLine: form.address_line || null,
      addressNumber: form.address_number || null,
      addressComplement: form.address_complement || null,
      neighborhood: form.neighborhood || null,
      city: form.city || null,
      state: form.state || null,
      postalCode: form.postal_code || null,
      notes: form.notes || null,
      preferences: form.preferences || null,
      restrictions: form.restrictions || null,
      tags: Array.isArray(form.tags) ? form.tags : [],
      isVip: Boolean(form.is_vip),
      isBlocked: Boolean(form.is_blocked),
      blockReason: form.block_reason || null,
      source: form.source || "manual",
      marketingOptIn: Boolean(form.marketing_opt_in)
    };

    try {
      if (selectedId === "new") {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const json = (await res.json()) as { data?: CustomerRow; error?: string };
        if (!res.ok) throw new Error(json.error || "Erro ao salvar.");
        setFeedback("Cliente cadastrado. Agendamentos com o mesmo telefone foram vinculados quando possível.");
        setSelectedId(json.data?.id || null);
        void loadList();
        return;
      }
      if (!selectedId) return;
      const res = await fetch(`/api/customers/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = (await res.json()) as { data?: CustomerRow; error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao salvar.");
      setDetail(json.data || null);
      setFeedback("Dados atualizados.");
      void loadList();
      void loadActivity(selectedId);
    } catch (err) {
      setFeedbackErr((err as Error).message);
    }
  }

  async function handleDelete() {
    if (!businessId || !selectedId || selectedId === "new") return;
    if (!window.confirm("Excluir este cliente e histórico de pagamentos vinculado?")) return;
    setFeedback("");
    setFeedbackErr("");
    try {
      const res = await fetch(
        `/api/customers/${selectedId}?businessId=${encodeURIComponent(businessId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error || "Erro ao excluir.");
      }
      setSelectedId(null);
      setDetail(null);
      void loadList();
      setFeedback("Cliente excluído.");
    } catch (err) {
      setFeedbackErr((err as Error).message);
    }
  }

  /* Pagamento rápido */
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("pix");
  const [payNotes, setPayNotes] = useState("");
  const [payAppt, setPayAppt] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [contractOfferId, setContractOfferId] = useState("");
  const [contractNotes, setContractNotes] = useState("");
  const [contractSaving, setContractSaving] = useState(false);
  const [consumeAmount, setConsumeAmount] = useState("1");
  const [consumeAppointmentId, setConsumeAppointmentId] = useState("");
  const [redeemPoints, setRedeemPoints] = useState("100");
  const [redeemSaving, setRedeemSaving] = useState(false);
  const [referralCustomerId, setReferralCustomerId] = useState("");
  const [referralSaving, setReferralSaving] = useState(false);
  const [offers, setOffers] = useState<
    Array<{
      id: string;
      name: string;
      offer_type: "package" | "subscription";
      is_active: boolean;
    }>
  >([]);

  useEffect(() => {
    if (!businessId) return;
    void (async () => {
      const res = await fetch(`/api/offers?businessId=${encodeURIComponent(businessId)}`);
      const json = (await res.json()) as {
        data?: Array<{
          id: string;
          name: string;
          offer_type: "package" | "subscription";
          is_active: boolean;
        }>;
      };
      setOffers((json.data || []).filter((item) => item.is_active));
    })();
  }, [businessId]);

  async function handleAddPayment(e: FormEvent) {
    e.preventDefault();
    if (!businessId || !selectedId || selectedId === "new") return;
    const raw = payAmount.replace(",", ".").trim();
    const reais = Number.parseFloat(raw);
    if (!Number.isFinite(reais) || reais < 0) {
      setFeedbackErr("Informe um valor válido.");
      return;
    }
    const amountCents = Math.round(reais * 100);
    setPaySaving(true);
    setFeedbackErr("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          customerId: selectedId,
          appointmentId: payAppt || null,
          amountCents,
          paymentMethod: payMethod,
          notes: payNotes.trim() || null
        })
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao registrar.");
      setPayAmount("");
      setPayNotes("");
      setPayAppt("");
      setFeedback("Pagamento registrado.");
      void loadActivity(selectedId);
    } catch (err) {
      setFeedbackErr((err as Error).message);
    } finally {
      setPaySaving(false);
    }
  }

  async function handleCreateContract(e: FormEvent) {
    e.preventDefault();
    if (!businessId || !selectedId || selectedId === "new" || !contractOfferId) return;
    setContractSaving(true);
    setFeedbackErr("");
    try {
      const res = await fetch("/api/customer-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          customerId: selectedId,
          offerPlanId: contractOfferId,
          notes: contractNotes.trim() || null
        })
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao contratar plano/pacote.");
      setContractOfferId("");
      setContractNotes("");
      setFeedback("Plano/pacote vinculado ao cliente.");
      void loadActivity(selectedId);
    } catch (err) {
      setFeedbackErr((err as Error).message);
    } finally {
      setContractSaving(false);
    }
  }

  async function handleRedeemPoints(e: FormEvent) {
    e.preventDefault();
    if (!businessId || !selectedId || selectedId === "new") return;
    const points = Math.max(0, Math.floor(Number(redeemPoints) || 0));
    if (points < 100) {
      setFeedbackErr("Informe ao menos 100 pontos para resgatar.");
      return;
    }
    setRedeemSaving(true);
    setFeedbackErr("");
    try {
      const res = await fetch("/api/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, customerId: selectedId, points })
      });
      const json = (await res.json()) as { error?: string; data?: { discountCents: number } };
      if (!res.ok) throw new Error(json.error || "Erro ao resgatar pontos.");
      setFeedback(
        `Resgate aplicado com sucesso (${formatBrl(json.data?.discountCents || 0)} de desconto).`
      );
      void loadActivity(selectedId);
    } catch (err) {
      setFeedbackErr((err as Error).message);
    } finally {
      setRedeemSaving(false);
    }
  }

  async function handleCreateReferral(e: FormEvent) {
    e.preventDefault();
    if (!businessId || !selectedId || selectedId === "new") return;
    if (!referralCustomerId) {
      setFeedbackErr("Selecione o cliente indicado.");
      return;
    }
    setReferralSaving(true);
    setFeedbackErr("");
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          referrerCustomerId: selectedId,
          referredCustomerId: referralCustomerId,
          markAsConverted: true
        })
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao registrar indicacao.");
      setReferralCustomerId("");
      setFeedback("Indicação premiada registrada (R$20 para quem indica e para o amigo).");
      void loadActivity(selectedId);
    } catch (err) {
      setFeedbackErr((err as Error).message);
    } finally {
      setReferralSaving(false);
    }
  }

  async function handleConsumeContract(contractId: string) {
    if (!businessId || !selectedId || selectedId === "new") return;
    setFeedbackErr("");
    try {
      const res = await fetch("/api/customer-plans/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          contractId,
          amount: Math.max(1, Number(consumeAmount) || 1),
          appointmentId: consumeAppointmentId || null
        })
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao registrar consumo.");
      setFeedback("Consumo registrado com sucesso.");
      setConsumeAppointmentId("");
      void loadActivity(selectedId);
    } catch (err) {
      setFeedbackErr((err as Error).message);
    }
  }

  async function handleContractAction(
    contractId: string,
    action: "pause" | "reactivate" | "cancel"
  ) {
    if (!businessId || !selectedId || selectedId === "new") return;
    setFeedbackErr("");
    try {
      const res = await fetch(`/api/customer-plans/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, action })
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao atualizar contrato.");
      setFeedback("Contrato atualizado.");
      void loadActivity(selectedId);
    } catch (err) {
      setFeedbackErr((err as Error).message);
    }
  }

  if (!businessId) {
    if (!businessContextReady) {
      return (
        <AdminCard className="full" title="Clientes">
          <p className="helperText">Carregando negócio vinculado a esta conta…</p>
        </AdminCard>
      );
    }
    return (
      <AdminCard className="full" title="Clientes">
        <p className="helperText">
          Aqui ficam o <strong>cadastro</strong>, a <strong>lista</strong>, o{" "}
          <strong>histórico de serviços</strong> e <strong>pagamentos</strong> — mas o painel
          precisa saber <strong>qual negócio</strong> usar. Com mais de um negócio cadastrado,
          defina{" "}
          <code className="customersCodeHint">OWNER_BUSINESS_ID</code> (ou{" "}
          <code className="customersCodeHint">CLIENT_BUSINESS_ID</code>) no .env.local — UUID em{" "}
          <code className="customersCodeHint">businesses</code>. Com um único negócio, a associação
          é automática.
        </p>
      </AdminCard>
    );
  }

  return (
    <AdminCard
      className="full"
      title="Clientes"
      description="Cadastro, histórico de serviços e pagamentos."
    >
      <div className="customersLayout">
        <div className="customersListPanel">
          <div className="customersToolbar">
            <Input
              className="uiInput"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar nome, e-mail ou telefone..."
              aria-label="Buscar clientes"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadList()}
            >
              Atualizar
            </Button>
            <Button type="button" size="sm" onClick={() => setSelectedId("new")}>
              Novo cliente
            </Button>
          </div>
          <div className="customersToolbar">
            <Input
              className="uiInput"
              type="number"
              min={30}
              step={1}
              value={inactiveDaysFilter}
              onChange={(e) => setInactiveDaysFilter(e.target.value)}
              placeholder="Inativos em dias"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => void loadInsights()}>
              Atualizar listas CRM
            </Button>
          </div>
          {insights ? (
            <div className="list">
              <div>
                <strong>Aniversariantes do mês:</strong> {insights.birthdaysThisMonth.length}
              </div>
              <div>
                <strong>Clientes inativos ({insights.inactiveDays}+ dias):</strong>{" "}
                {insights.inactiveCustomers.length}
              </div>
              <div>
                <strong>VIP:</strong> {insights.totals.vip}
              </div>
              {insights.birthdaysThisMonth.slice(0, 5).map((item) => (
                <div key={`birthday-${item.customerId}`}>
                  <span>Aniversário:</span>{" "}
                  <small>
                    {item.fullName} ({item.birthDate})
                  </small>
                </div>
              ))}
              {insights.inactiveCustomers.slice(0, 5).map((item) => (
                <div key={`inactive-${item.customerId}`}>
                  <span>Inativo:</span>{" "}
                  <small>
                    {item.fullName} · {item.daysSinceLastVisit ?? "sem histórico"} dias · LTV{" "}
                    {formatBrl(item.lifetimeValueCents)}
                  </small>
                </div>
              ))}
            </div>
          ) : null}
          {listError ? <p className="feedbackError">{listError}</p> : null}
          <div className="customersList">
            {loading ? (
              <p className="helperText">Carregando...</p>
            ) : list.length === 0 ? (
              <p className="helperText">Nenhum cliente encontrado.</p>
            ) : (
              list.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`customersListItem ${
                    selectedId === c.id ? "isActive" : ""
                  }`}
                  title={
                    selectedId === c.id
                      ? "Clique novamente para fechar os detalhes"
                      : "Abrir ficha do cliente"
                  }
                  onClick={() => {
                    if (selectedId === c.id) {
                      closeDetail();
                    } else {
                      setSelectedId(c.id);
                      setTab("dados");
                    }
                  }}
                >
                  <strong>{c.full_name}</strong>
                  {c.is_vip ? <small>VIP</small> : null}
                  {c.tags && c.tags.length > 0 ? <small>Tags: {c.tags.join(", ")}</small> : null}
                  {c.whatsapp_profile_name &&
                  c.whatsapp_profile_name.trim() !== c.full_name.trim() ? (
                    <span className="customersListWhatsappName" title="Nome no perfil WhatsApp">
                      Perfil WA: {c.whatsapp_profile_name}
                    </span>
                  ) : null}
                  <span>{formatPhoneBrDigits(c.phone_normalized)}</span>
                  <small>{c.email || "—"}</small>
                </button>
              ))
            )}
          </div>
        </div>

      </div>
      {selectedId ? (
        <div
          className="customersModalOverlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeDetail();
            }
          }}
        >
          <div className="customersDetailPanel customersModal" role="dialog" aria-modal="true">
            {selectedId === "new" ? (
              <form className="form" onSubmit={handleSubmit}>
                <div className="customersDetailHead">
                  <h3 className="customersDetailTitle">Novo cliente</h3>
                  <Button type="button" variant="outline" size="sm" onClick={closeDetail}>
                    Fechar
                  </Button>
                </div>
                <div className="customersModalBody">
                  <CustomerFormFields
                    form={form}
                    setForm={setForm}
                    privacyPolicyUrl={privacyPolicyUrl}
                    isNewCustomer
                    cepFeedback={cepFeedback}
                    onPostalCodeChange={handleCustomerPostalCodeChange}
                  />
                </div>
                <div className="actionsRow">
                  <Button type="submit">Salvar cadastro</Button>
                  <Button type="button" variant="outline" onClick={closeDetail}>
                    Cancelar
                  </Button>
                </div>
                {feedbackErr ? <p className="feedbackError">{feedbackErr}</p> : null}
                {feedback ? <p className="feedbackOk">{feedback}</p> : null}
              </form>
            ) : (
              <>
                <div className="customersDetailToolbar">
                  <div className="customersTabs">
                    <button
                      type="button"
                      className={`customersTab ${tab === "dados" ? "isActive" : ""}`}
                      onClick={() => setTab("dados")}
                    >
                      Dados
                    </button>
                    <button
                      type="button"
                      className={`customersTab ${tab === "historico" ? "isActive" : ""}`}
                      onClick={() => setTab("historico")}
                    >
                      Histórico de serviços
                    </button>
                    <button
                      type="button"
                      className={`customersTab ${tab === "pagamentos" ? "isActive" : ""}`}
                      onClick={() => setTab("pagamentos")}
                    >
                      Pagamentos
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="customersCloseBtn"
                    onClick={closeDetail}
                  >
                    Fechar
                  </Button>
                </div>

                <div className="customersModalBody">
                  {detailLoading ? <p className="helperText">Carregando ficha...</p> : null}
                  {!detailLoading && !detail ? (
                    <p className="feedbackError">
                      {feedbackErr || "Não foi possível carregar os detalhes deste cliente."}
                    </p>
                  ) : null}

                  {tab === "dados" && detail ? (
                    <form className="form" onSubmit={handleSubmit}>
                      <div className="customersDetailHead">
                        <h3 className="customersDetailTitle">{detail.full_name}</h3>
                        <div className="actionsRow">
                          <Button type="submit">Salvar alterações</Button>
                          <Button type="button" variant="outline" onClick={() => void handleDelete()}>
                            Excluir
                          </Button>
                        </div>
                      </div>
                      <p className="helperText">
                        Origem: {SOURCE_LABEL[detail.source] || detail.source} · Cadastro:{" "}
                        {formatDateTimePt(detail.created_at)}
                      </p>
                      <CustomerFormFields
                        form={form}
                        setForm={setForm}
                        privacyPolicyUrl={privacyPolicyUrl}
                        isNewCustomer={false}
                        cepFeedback={cepFeedback}
                        onPostalCodeChange={handleCustomerPostalCodeChange}
                      />
                      {feedbackErr ? <p className="feedbackError">{feedbackErr}</p> : null}
                      {feedback ? <p className="feedbackOk">{feedback}</p> : null}
                    </form>
                  ) : null}

                  {tab === "historico" ? (
                    <div className="customersTimeline">
                      {activity ? (
                        <>
                          <p className="helperText">
                            {activity.stats.visitCount} atendimento(s) no histórico · Total pago:{" "}
                            {formatBrl(activity.stats.totalPaidCents)}
                          </p>
                          <p className="helperText">
                            Lifetime value: {formatBrl(activity.stats.lifetimeValueCents || 0)} ·
                            Serviços contratados: {activity.stats.uniqueServicesCount || 0}
                          </p>
                          <p className="helperText">
                            Pontos: {activity.loyalty?.pointsBalance || 0} · Nível:{" "}
                            {String(activity.loyalty?.levelCode || "bronze").toUpperCase()} ·
                            Desconto disponível:{" "}
                            {formatBrl(activity.loyalty?.availableDiscountCents || 0)}
                          </p>
                          <p className="helperText">
                            Conquistas:{" "}
                            {(activity.badges || []).length === 0
                              ? "nenhuma ainda"
                              : (activity.badges || []).map((b) => b.badge_name).join(", ")}
                          </p>
                          {activity.appointments.length === 0 ? (
                            <p className="helperText">Nenhum agendamento vinculado ainda.</p>
                          ) : (
                            <ul className="customersTimelineList">
                              {activity.appointments.map((a) => (
                                <li key={a.id} className="customersTimelineItem">
                                  <strong>
                                    {a.service_id
                                      ? serviceNameById.get(a.service_id) || "Serviço"
                                      : "Serviço não informado"}
                                  </strong>
                                  <span>{formatDateTimePt(a.starts_at)}</span>
                                  <small>
                                    Status: {a.status}
                                    {a.notes ? ` · ${a.notes}` : ""}
                                  </small>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      ) : (
                        <p className="helperText">Carregando...</p>
                      )}
                    </div>
                  ) : null}

                  {tab === "pagamentos" ? (
                    <div className="customersPayments">
                      {activity ? (
                        <>
                          <form className="form customersPayForm" onSubmit={handleAddPayment}>
                            <h4>Registrar pagamento</h4>
                            <div className="businessFormGrid">
                              <label>
                                Valor (R$)
                                <Input
                                  className="uiInput"
                                  value={payAmount}
                                  onChange={(e) => setPayAmount(e.target.value)}
                                  placeholder="0,00"
                                  inputMode="decimal"
                                  required
                                />
                              </label>
                              <label>
                                Meio
                                <Select
                                  value={payMethod}
                                  onChange={(e) => setPayMethod(e.target.value)}
                                >
                                  <option value="pix">PIX</option>
                                  <option value="boleto">Boleto</option>
                                  <option value="cash">Dinheiro</option>
                                  <option value="credit_card">Cartão crédito</option>
                                  <option value="debit_card">Cartão débito</option>
                                  <option value="transfer">Transferência</option>
                                  <option value="other">Outro</option>
                                </Select>
                              </label>
                              <label className="full">
                                Vincular a agendamento (opcional)
                                <Select
                                  value={payAppt}
                                  onChange={(e) => setPayAppt(e.target.value)}
                                >
                                  <option value="">Nenhum</option>
                                  {activity.appointments.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {formatDateTimePt(a.starts_at)} —{" "}
                                      {a.service_id
                                        ? serviceNameById.get(a.service_id) || "Serviço"
                                        : "Atendimento"}
                                    </option>
                                  ))}
                                </Select>
                              </label>
                              <label className="full">
                                Observações
                                <Input
                                  className="uiInput"
                                  value={payNotes}
                                  onChange={(e) => setPayNotes(e.target.value)}
                                />
                              </label>
                            </div>
                            <Button type="submit" disabled={paySaving}>
                              {paySaving ? "Salvando..." : "Registrar"}
                            </Button>
                          </form>
                          <form className="form customersPayForm" onSubmit={handleCreateContract}>
                            <h4>Contratar pacote/assinatura</h4>
                            <div className="businessFormGrid">
                              <label>
                                Plano/Pacote
                                <Select
                                  value={contractOfferId}
                                  onChange={(e) => setContractOfferId(e.target.value)}
                                  required
                                >
                                  <option value="">Selecione</option>
                                  {offers.map((o) => (
                                    <option key={o.id} value={o.id}>
                                      {o.name} ({o.offer_type === "package" ? "Pacote" : "Assinatura"})
                                    </option>
                                  ))}
                                </Select>
                              </label>
                              <label className="full">
                                Observações
                                <Input
                                  className="uiInput"
                                  value={contractNotes}
                                  onChange={(e) => setContractNotes(e.target.value)}
                                />
                              </label>
                            </div>
                            <Button type="submit" disabled={contractSaving}>
                              {contractSaving ? "Salvando..." : "Vincular ao cliente"}
                            </Button>
                          </form>
                          <form className="form customersPayForm" onSubmit={handleRedeemPoints}>
                            <h4>Programa de pontos</h4>
                            <p className="helperText">
                              Regra: a cada R$10 = 1 ponto · 100 pontos = R$10 de desconto
                            </p>
                            <div className="businessFormGrid">
                              <label>
                                Pontos para resgate
                                <Input
                                  className="uiInput"
                                  type="number"
                                  min={100}
                                  step={100}
                                  value={redeemPoints}
                                  onChange={(e) => setRedeemPoints(e.target.value)}
                                />
                              </label>
                            </div>
                            <Button type="submit" disabled={redeemSaving}>
                              {redeemSaving ? "Resgatando..." : "Resgatar desconto"}
                            </Button>
                          </form>
                          <form className="form customersPayForm" onSubmit={handleCreateReferral}>
                            <h4>Indicação premiada</h4>
                            <p className="helperText">
                              Quem indica ganha R$20 e o amigo também ganha R$20.
                            </p>
                            <div className="businessFormGrid">
                              <label className="full">
                                Cliente indicado
                                <Select
                                  value={referralCustomerId}
                                  onChange={(e) => setReferralCustomerId(e.target.value)}
                                >
                                  <option value="">Selecione</option>
                                  {list
                                    .filter((item) => item.id !== selectedId)
                                    .map((item) => (
                                      <option key={`ref-${item.id}`} value={item.id}>
                                        {item.full_name}
                                      </option>
                                    ))}
                                </Select>
                              </label>
                            </div>
                            <Button type="submit" disabled={referralSaving}>
                              {referralSaving ? "Registrando..." : "Registrar indicação"}
                            </Button>
                          </form>
                          <h4>Histórico financeiro</h4>
                          {activity.payments.length === 0 ? (
                            <p className="helperText">Nenhum pagamento lançado.</p>
                          ) : (
                            <ul className="customersPaymentsList">
                              {activity.payments.map((p) => (
                                <li key={p.id} className="customersPaymentRow">
                                  <span>{formatBrl(p.amount_cents)}</span>
                                  <span>{PAY_LABEL[p.payment_method] || p.payment_method}</span>
                                  <span>{formatDateTimePt(p.paid_at)}</span>
                                  <small>{p.status}</small>
                                </li>
                              ))}
                            </ul>
                          )}
                          <h4>Pacotes/assinaturas do cliente</h4>
                          {activity.contracts.length === 0 ? (
                            <p className="helperText">Nenhum contrato de pacote/assinatura.</p>
                          ) : (
                            <ul className="customersPaymentsList">
                              {activity.contracts.map((c) => {
                                const saldo =
                                  c.sessions_total == null ? null : c.sessions_total - c.sessions_used;
                                return (
                                  <li key={c.id} className="customersPaymentRow">
                                    <span>
                                      {c.offer_name} ({c.offer_type === "package" ? "Pacote" : "Assinatura"})
                                    </span>
                                    <span>Status: {c.status}</span>
                                    <small>
                                      {saldo == null
                                        ? "Sem controle de sessões"
                                        : `Saldo de sessões: ${Math.max(0, saldo)}`}
                                    </small>
                                    {c.offer_type === "package" && c.status === "active" ? (
                                      <div className="actionsRow">
                                        <Input
                                          className="uiInput"
                                          type="number"
                                          min={1}
                                          step={1}
                                          value={consumeAmount}
                                          onChange={(e) => setConsumeAmount(e.target.value)}
                                        />
                                        <Select
                                          value={consumeAppointmentId}
                                          onChange={(e) => setConsumeAppointmentId(e.target.value)}
                                        >
                                          <option value="">Sem vínculo</option>
                                          {activity.appointments.map((a) => (
                                            <option key={`consume-appt-${a.id}`} value={a.id}>
                                              {formatDateTimePt(a.starts_at)}
                                            </option>
                                          ))}
                                        </Select>
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={() => void handleConsumeContract(c.id)}
                                        >
                                          Baixar sessão
                                        </Button>
                                      </div>
                                    ) : null}
                                    <div className="actionsRow">
                                      {c.status === "active" ? (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => void handleContractAction(c.id, "pause")}
                                        >
                                          Pausar
                                        </Button>
                                      ) : null}
                                      {c.status === "paused" ? (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => void handleContractAction(c.id, "reactivate")}
                                        >
                                          Reativar
                                        </Button>
                                      ) : null}
                                      {c.status !== "cancelled" && c.status !== "completed" ? (
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => void handleContractAction(c.id, "cancel")}
                                        >
                                          Cancelar
                                        </Button>
                                      ) : null}
                                    </div>
                                    {c.usages && c.usages.length > 0 ? (
                                      <small>
                                        Último consumo: {formatDateTimePt(c.usages[0].used_at)} (
                                        {c.usages[0].used_sessions} sessão/ões)
                                      </small>
                                    ) : null}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </>
                      ) : (
                        <p className="helperText">Carregando...</p>
                      )}
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </AdminCard>
  );
}

function CustomerFormFields({
  form,
  setForm,
  privacyPolicyUrl,
  isNewCustomer,
  cepFeedback,
  onPostalCodeChange
}: {
  form: Partial<CustomerRow> & { phoneInput?: string };
  setForm: Dispatch<SetStateAction<Partial<CustomerRow> & { phoneInput?: string }>>;
  privacyPolicyUrl?: string | null;
  isNewCustomer?: boolean;
  cepFeedback: string;
  onPostalCodeChange: (rawValue: string) => void;
}) {
  return (
    <>
      <div className="businessFormGrid">
        <label className="full">
          Nome no cadastro *
          <Input
            className="uiInput"
            value={form.full_name || ""}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            required
          />
          <span className="customersFieldHint">
            Nome que você usa no CRM (pode diferir do WhatsApp).
          </span>
        </label>
        <label className="full">
          Nome no perfil do WhatsApp
          <Input
            className="uiInput customersInputReadonly"
            readOnly
            tabIndex={-1}
            value={form.whatsapp_profile_name || ""}
            placeholder={
              isNewCustomer
                ? "Preenchido automaticamente quando houver agendamento pelo WhatsApp"
                : "Ainda não recebido"
            }
            aria-readonly="true"
          />
          <span className="customersFieldHint">
            Enviado pela API do WhatsApp (perfil público). Somente leitura.
          </span>
        </label>
        <label>
          WhatsApp / telefone *
          <Input
            className="uiInput"
            value={form.phoneInput ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, phoneInput: e.target.value }))
            }
            placeholder="(11) 99999-9999"
            required
          />
        </label>
        <label>
          E-mail
          <Input
            className="uiInput"
            type="email"
            value={form.email || ""}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </label>
        <label>
          CPF (opcional)
          <Input
            className="uiInput"
            value={form.document_id || ""}
            onChange={(e) => setForm((f) => ({ ...f, document_id: e.target.value }))}
          />
        </label>
        <label>
          Data de nascimento
          <Input
            className="uiInput"
            type="date"
            value={form.birth_date?.slice(0, 10) || ""}
            onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value || null }))}
          />
        </label>
        <label>
          Gênero
          <Input
            className="uiInput"
            value={form.gender || ""}
            onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
            placeholder="Opcional"
          />
        </label>
        <label className="full">
          Observações internas
          <Textarea
            className="uiTextarea"
            value={form.notes || ""}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
          />
        </label>
        <label className="full">
          Preferências de atendimento
          <Textarea
            className="uiTextarea"
            value={form.preferences || ""}
            onChange={(e) => setForm((f) => ({ ...f, preferences: e.target.value }))}
            rows={2}
            placeholder='Ex.: "Prefere café sem açúcar"'
          />
        </label>
        <label className="full">
          Restrições / alertas
          <Textarea
            className="uiTextarea"
            value={form.restrictions || ""}
            onChange={(e) => setForm((f) => ({ ...f, restrictions: e.target.value }))}
            rows={2}
            placeholder='Ex.: "Alérgico a produto X"'
          />
        </label>
        <label className="full">
          Tags (separadas por vírgula)
          <Input
            className="uiInput"
            value={(form.tags || []).join(", ")}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                tags: e.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              }))
            }
            placeholder="VIP, Novo, Inativo, Inadimplente"
          />
        </label>
        <Checkbox
          className="full"
          label="Atendimento VIP"
          checked={Boolean(form.is_vip)}
          onChange={(e) => setForm((f) => ({ ...f, is_vip: e.target.checked }))}
        />
        <Checkbox
          className="full"
          label="Cliente bloqueado para novos agendamentos"
          checked={Boolean(form.is_blocked)}
          onChange={(e) => setForm((f) => ({ ...f, is_blocked: e.target.checked }))}
        />
        <label className="full">
          Motivo do bloqueio
          <Input
            className="uiInput"
            value={form.block_reason || ""}
            onChange={(e) => setForm((f) => ({ ...f, block_reason: e.target.value }))}
            placeholder="Ex.: recorrência de não comparecimento sem aviso"
          />
        </label>
      </div>
      <h4 className="customersFormSection">Endereço</h4>
      <div className="businessFormGrid">
        <label className="full">
          CEP
          <Input
            className="uiInput"
            value={form.postal_code || ""}
            onChange={(e) => onPostalCodeChange(e.target.value)}
            placeholder="00000-000"
            inputMode="numeric"
            autoComplete="postal-code"
          />
        </label>
        {cepFeedback ? (
          <p
            className={`full ${
              cepFeedback.includes("preenchido automaticamente") ? "feedbackOk" : "feedbackError"
            }`}
          >
            {cepFeedback}
          </p>
        ) : null}
        <label className="full">
          Logradouro
          <Input
            className="uiInput"
            value={form.address_line || ""}
            onChange={(e) => setForm((f) => ({ ...f, address_line: e.target.value }))}
            placeholder="Rua, avenida, etc."
          />
        </label>
        <label>
          Número
          <Input
            className="uiInput"
            value={form.address_number || ""}
            onChange={(e) => setForm((f) => ({ ...f, address_number: e.target.value }))}
          />
        </label>
        <label>
          Complemento
          <Input
            className="uiInput"
            value={form.address_complement || ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, address_complement: e.target.value }))
            }
          />
        </label>
        <label>
          Bairro
          <Input
            className="uiInput"
            value={form.neighborhood || ""}
            onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
          />
        </label>
        <label>
          Cidade
          <Input
            className="uiInput"
            value={form.city || ""}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          />
        </label>
        <label>
          UF
          <Input
            className="uiInput"
            value={form.state || ""}
            onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            maxLength={2}
          />
        </label>
      </div>
      <div className="customersFormMeta">
        <label>
          Origem do cadastro
          <Select
            value={form.source || "manual"}
            onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
          >
            <option value="manual">Manual</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="import">Importação</option>
            <option value="campaign">Campanha</option>
            <option value="other">Outro</option>
          </Select>
        </label>
      </div>
      <div className="customersLgpdBlock">
        <h4 className="customersFormSection">Privacidade e comunicações (LGPD)</h4>
        <p className="customersLgpdHelp">
          Consentimento opcional para o envio de mensagens promocionais e informativas de
          marketing por canais como e-mail ou WhatsApp, conforme a Lei nº 13.709/2018 (LGPD).
          O titular pode retirar este consentimento a qualquer momento.
        </p>
        {privacyPolicyUrl ? (
          <p className="customersLgpdLinkRow">
            <a
              href={privacyPolicyUrl}
              className="customersLgpdLink"
              {...(/^https?:\/\//i.test(privacyPolicyUrl)
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              Política de privacidade
            </a>
            {/^https?:\/\//i.test(privacyPolicyUrl) ? (
              <span className="customersLgpdLinkHint"> · abre em nova aba</span>
            ) : null}
          </p>
        ) : null}
        <Checkbox
          label="Autorizo o recebimento de comunicações de marketing"
          checked={Boolean(form.marketing_opt_in)}
          onChange={(e) =>
            setForm((f) => ({ ...f, marketing_opt_in: e.target.checked }))
          }
        />
      </div>
    </>
  );
}
