"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type ServiceItem = { id: string; name: string; duration_minutes: number; price_cents: number | null };

function AgendarQuickContent() {
  const searchParams = useSearchParams();
  const businessId = (searchParams.get("businessId") || "").trim();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Array<{ startsAt: string; endsAt: string }>>([]);
  const [slotPick, setSlotPick] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const loadServices = useCallback(async () => {
    if (!businessId) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(
        `/api/booking/quick?businessId=${encodeURIComponent(businessId)}&step=service`
      );
      const json = (await res.json()) as { data?: ServiceItem[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao carregar serviços.");
      setServices(json.data || []);
    } catch (e) {
      setError((e as Error).message);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  async function loadSlots() {
    if (!businessId || !serviceId || !date) return;
    setError("");
    setLoading(true);
    try {
      const url = new URL("/api/booking/quick", window.location.origin);
      url.searchParams.set("businessId", businessId);
      url.searchParams.set("step", "slot");
      url.searchParams.set("serviceId", serviceId);
      url.searchParams.set("date", date);
      const res = await fetch(url.toString());
      const json = (await res.json()) as {
        data?: Array<{ startsAt: string; endsAt: string }>;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Erro ao carregar horários.");
      setSlots(json.data || []);
      setSlotPick(null);
    } catch (e) {
      setError((e as Error).message);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!businessId || !serviceId || !slotPick || !customerPhone.trim()) {
      setError("Preencha telefone e escolha serviço e horário.");
      return;
    }
    setError("");
    setDone("");
    setLoading(true);
    try {
      const res = await fetch("/api/booking/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          serviceId,
          startsAt: slotPick,
          customerPhone,
          customerName: customerName.trim() || undefined,
          marketingOptIn
        })
      });
      const json = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(json.error || "Não foi possível confirmar.");
      setDone(json.message || "Agendamento confirmado.");
      setServiceId(null);
      setSlots([]);
      setSlotPick(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!businessId) {
    return (
      <div className="publicBookingPage">
        <p className="helperText">
          Informe o negócio na URL: <code className="customersCodeHint">/agendar?businessId=UUID</code>
        </p>
      </div>
    );
  }

  return (
    <div className="publicBookingPage">
      <header className="publicBookingHeader">
        <h1 className="publicBookingTitle">Reserva rápida</h1>
        <p className="helperText">
          Escolha o serviço, data e horário. O consentimento de marketing é opcional e registrado só
          se você marcar a opção abaixo (LGPD).
        </p>
      </header>

      {error ? <p className="feedbackError">{error}</p> : null}
      {done ? <p className="feedbackOk">{done}</p> : null}

      <div className="publicBookingSteps">
        <div className="publicBookingStep">
          <h2>1. Serviço</h2>
          {loading && !services.length ? <p className="helperText">Carregando…</p> : null}
          <ul className="publicBookingList">
            {services.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={serviceId === s.id ? "publicBookingPick isActive" : "publicBookingPick"}
                  onClick={() => {
                    setServiceId(s.id);
                  }}
                >
                  <strong>{s.name}</strong>
                  <small>
                    {s.duration_minutes} min
                    {s.price_cents != null
                      ? ` · R$ ${(s.price_cents / 100).toFixed(2)}`
                      : ""}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {serviceId ? (
          <div className="publicBookingStep">
            <h2>2. Data e horário</h2>
            <label className="publicBookingLabel">
              Data
              <Input
                className="uiInput"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              className="publicBookingSlotLoadBtn"
              onClick={() => void loadSlots()}
            >
              Ver horários
            </Button>
            {slots.length > 0 ? (
              <ul className="publicBookingList publicBookingSlotList">
                {slots.map((sl) => (
                  <li key={sl.startsAt}>
                    <button
                      type="button"
                      className={
                        slotPick === sl.startsAt ? "publicBookingPick isActive" : "publicBookingPick"
                      }
                      onClick={() => {
                        setSlotPick(sl.startsAt);
                      }}
                    >
                      {sl.startsAt.slice(11, 16)} – {sl.endsAt.slice(11, 16)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {serviceId && slotPick ? (
          <div className="publicBookingStep">
            <h2>3. Seus dados</h2>
            <label className="publicBookingLabel">
              Nome (opcional)
              <Input
                className="uiInput"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Como devemos chamar você"
              />
            </label>
            <label className="publicBookingLabel">
              WhatsApp / telefone *
              <Input
                className="uiInput"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="DDD + número"
                inputMode="tel"
              />
            </label>
            <Checkbox
              className="publicBookingMarketingCheck"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              label="Aceito receber comunicações de marketing (promoções e novidades) por WhatsApp ou e-mail, conforme a política de privacidade do negócio."
            />
            <Button
              type="button"
              className="publicBookingConfirmBtn"
              disabled={loading}
              onClick={() => void confirm()}
            >
              Confirmar agendamento
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AgendarPage() {
  return (
    <Suspense
      fallback={
        <div className="publicBookingPage">
          <p className="helperText">Carregando…</p>
        </div>
      }
    >
      <AgendarQuickContent />
    </Suspense>
  );
}
