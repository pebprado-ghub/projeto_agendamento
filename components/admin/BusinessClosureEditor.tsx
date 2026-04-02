"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const CLOSURE_KIND_LABEL: Record<string, string> = {
  vacation: "Férias",
  emergency: "Emergência / imprevisto",
  travel: "Viagem / ausência",
  other: "Outro"
};

function formatClosureDateTimePt(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function appointmentStatusLabel(status: string) {
  if (status === "confirmed") return "Confirmado";
  if (status === "pending") return "Pendente";
  return status;
}

function isUuidAppointmentId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

export type BusinessClosureRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  kind: string;
  note: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string | null;
};

/** Só em `npm run dev`: botão para ver o aviso de conflito sem API nem agendamentos reais. */
const SHOW_CONFLICT_PREVIEW_DEMO =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_CLOSURE_CONFLICT_PREVIEW === "1";

function buildConflictPreviewDemoRows(): Array<{
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  customer_name: string | null;
  customer_phone: string;
}> {
  const base = new Date();
  const day1 = new Date(base);
  day1.setDate(day1.getDate() + 1);
  day1.setHours(9, 30, 0, 0);
  const day1End = new Date(day1);
  day1End.setHours(10, 30, 0, 0);

  const day2 = new Date(base);
  day2.setDate(day2.getDate() + 2);
  day2.setHours(14, 0, 0, 0);
  const day2End = new Date(day2);
  day2End.setHours(15, 0, 0, 0);

  return [
    {
      id: "demo-preview-1",
      starts_at: day1.toISOString(),
      ends_at: day1End.toISOString(),
      status: "confirmed",
      customer_name: "Maria Silva (exemplo)",
      customer_phone: "(11) 98765-4321"
    },
    {
      id: "demo-preview-2",
      starts_at: day2.toISOString(),
      ends_at: day2End.toISOString(),
      status: "pending",
      customer_name: "João Santos (exemplo)",
      customer_phone: "(21) 99876-5432"
    }
  ];
}

export function BusinessClosureEditor({ open, onOpenChange, businessId }: Props) {
  const [closures, setClosures] = useState<BusinessClosureRow[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [kind, setKind] = useState<"vacation" | "emergency" | "travel" | "other">("other");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState("");
  const [conflictDetails, setConflictDetails] = useState<
    Array<{
      id: string;
      starts_at: string;
      ends_at: string;
      status: string;
      customer_name: string | null;
      customer_phone: string;
    }>
  >([]);
  const [saving, setSaving] = useState(false);
  /** Fim do bloqueio recém-registrado — usado para calcular sugestão após a pausa. */
  const [outreachAnchorIso, setOutreachAnchorIso] = useState<string | null>(null);
  const [outreachBusy, setOutreachBusy] = useState(false);
  const [outreachResult, setOutreachResult] = useState("");
  /** True quando a lista de conflitos é só da demo (pré-visualização). */
  const [conflictDemoMode, setConflictDemoMode] = useState(false);

  const loadClosures = useCallback(async () => {
    if (!businessId) {
      setClosures([]);
      return;
    }
    const response = await fetch(`/api/business-closures?businessId=${businessId}`);
    const result = (await response.json()) as {
      data?: BusinessClosureRow[];
      error?: string;
    };
    if (!response.ok) {
      setFeedback(result.error || "Erro ao listar bloqueios.");
      return;
    }
    setClosures(result.data || []);
  }, [businessId]);

  useEffect(() => {
    if (!open) return;
    setConflictDetails([]);
    setFeedback("");
    setOutreachAnchorIso(null);
    setOutreachResult("");
    setConflictDemoMode(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!businessId) {
      setClosures([]);
      return;
    }
    void loadClosures();
  }, [open, businessId, loadClosures]);

  async function handleAdd() {
    if (!businessId) {
      setFeedback("Selecione uma empresa.");
      return;
    }
    if (!startsAt || !endsAt) {
      setFeedback("Informe início e fim do bloqueio.");
      return;
    }
    const startMs = new Date(startsAt).getTime();
    const endMs = new Date(endsAt).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      setFeedback("Verifique as datas: o fim deve ser depois do início.");
      return;
    }

    setSaving(true);
    setFeedback("");
    setConflictDetails([]);
    try {
      const response = await fetch("/api/business-closures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          kind,
          note: note.trim() || null
        })
      });
      const result = (await response.json()) as {
        error?: string;
        data?: { ends_at: string };
        conflictingAppointments?: Array<{
          id: string;
          starts_at: string;
          ends_at: string;
          status: string;
          customer_name: string | null;
          customer_phone: string;
        }>;
      };
      if (!response.ok) {
        setFeedback(result.error || "Erro ao registrar bloqueio.");
        setOutreachAnchorIso(null);
        setConflictDemoMode(false);
        return;
      }
      setConflictDemoMode(false);
      const conflicts = result.conflictingAppointments ?? [];
      setOutreachAnchorIso(result.data?.ends_at ?? null);
      if (conflicts.length > 0) {
        setConflictDetails(conflicts);
        setFeedback(
          "Bloqueio registrado: novas reservas não entram nesse intervalo. Ajuste manualmente os agendamentos que já existem (lista abaixo)."
        );
      } else {
        setFeedback("Bloqueio registrado. Novos agendamentos não serão oferecidos nesse intervalo.");
        setOutreachAnchorIso(null);
      }
      setStartsAt("");
      setEndsAt("");
      setNote("");
      await loadClosures();
    } catch (error) {
      setFeedback((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function showConflictPreviewDemo() {
    setOutreachAnchorIso(null);
    setOutreachResult("");
    setConflictDemoMode(true);
    setConflictDetails(buildConflictPreviewDemoRows());
    setFeedback(
      "Bloqueio registrado: novas reservas não entram nesse intervalo. Ajuste manualmente os agendamentos que já existem (lista abaixo)."
    );
  }

  async function sendRescheduleOutreach(appointmentIds: string[]) {
    if (!businessId || !outreachAnchorIso || appointmentIds.length === 0) return;
    setOutreachBusy(true);
    setOutreachResult("");
    try {
      const response = await fetch("/api/appointments/reschedule-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          appointmentIds,
          afterIso: outreachAnchorIso
        })
      });
      const json = (await response.json()) as {
        error?: string;
        message?: string;
        results?: Array<{ appointmentId: string; sent: boolean; reason?: string }>;
      };
      if (!response.ok) {
        setOutreachResult(json.error || "Falha ao enviar mensagens.");
        return;
      }
      const lines = (json.results || [])
        .filter((r) => !r.sent)
        .map((r) => `${r.appointmentId.slice(0, 8)}… ${r.reason || "falhou"}`);
      setOutreachResult(
        lines.length > 0
          ? `${json.message || "Concluído."} Falhas: ${lines.join("; ")}`
          : json.message || "Mensagens enviadas."
      );
    } catch (e) {
      setOutreachResult((e as Error).message);
    } finally {
      setOutreachBusy(false);
    }
  }

  async function handleRemove(closureId: string) {
    if (!businessId) return;
    setFeedback("");
    setConflictDetails([]);
    setOutreachAnchorIso(null);
    setOutreachResult("");
    setConflictDemoMode(false);
    const response = await fetch(
      `/api/business-closures/${closureId}?businessId=${businessId}`,
      { method: "DELETE" }
    );
    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      setFeedback(result.error || "Erro ao remover bloqueio.");
      return;
    }
    setFeedback(result.message || "Bloqueio removido.");
    await loadClosures();
  }

  if (!open) return null;

  const realConflictIds = conflictDetails
    .filter((r) => isUuidAppointmentId(r.id))
    .map((r) => r.id);
  const canSendOutreach =
    Boolean(businessId) && Boolean(outreachAnchorIso) && realConflictIds.length > 0;
  const showOutreachToolbar =
    canSendOutreach || (SHOW_CONFLICT_PREVIEW_DEMO && conflictDemoMode && conflictDetails.length > 0);
  const outreachControlsDisabled =
    outreachBusy || conflictDemoMode || !canSendOutreach;

  const body = (
    <>
      {!businessId ? (
        <p className="feedbackError" role="status">
          Selecione uma empresa no cabeçalho para cadastrar bloqueios.
        </p>
      ) : null}
      <p className="helperText">
        Bloqueia <strong>novos</strong> agendamentos entre o início e o fim informados (horário do seu
        navegador). O sistema <strong>não cancela</strong> o que já está agendado.
      </p>
      <div className="closureFormGrid">
        <label>
          Motivo
          <Select
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as "vacation" | "emergency" | "travel" | "other")
            }
          >
            <option value="vacation">{CLOSURE_KIND_LABEL.vacation}</option>
            <option value="emergency">{CLOSURE_KIND_LABEL.emergency}</option>
            <option value="travel">{CLOSURE_KIND_LABEL.travel}</option>
            <option value="other">{CLOSURE_KIND_LABEL.other}</option>
          </Select>
        </label>
        <label>
          Início
          <Input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </label>
        <label>
          Fim
          <Input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
        </label>
        <label className="closureNoteField">
          Observação (opcional)
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex.: Retorno previsto dia 10"
            maxLength={500}
          />
        </label>
      </div>
      <div className="actionsRow">
        <Button
          type="button"
          disabled={saving || !businessId}
          onClick={() => void handleAdd()}
        >
          {saving ? "Salvando…" : "Registrar bloqueio"}
        </Button>
      </div>
      {SHOW_CONFLICT_PREVIEW_DEMO ? (
        <div className="closurePreviewDemoBar">
          <Button type="button" variant="outline" size="sm" onClick={showConflictPreviewDemo}>
            Pré-visualizar aviso de conflito
          </Button>
          <span className="closurePreviewDemoHint">
            Simula lista de conflitos + botões de envio (desabilitados). Não grava bloqueio nem chama
            API.
            {process.env.NODE_ENV === "production"
              ? " (ligado por NEXT_PUBLIC_CLOSURE_CONFLICT_PREVIEW)"
              : null}
          </span>
        </div>
      ) : null}
      {feedback ? (
        <p className={conflictDetails.length > 0 ? "feedbackWarn" : "feedbackOk"}>{feedback}</p>
      ) : null}
      {conflictDetails.length > 0 ? (
        <div className="closureConflictBox" role="alert" aria-live="polite">
          <strong className="closureConflictTitle">Agendamentos que cruzam este bloqueio</strong>
          <p className="closureConflictHint">
            Eles <strong>permanecem na agenda</strong>. Use o painel <strong>Agenda</strong> ou{" "}
            <strong>Clientes</strong> para reagendar ou cancelar,             ou envie pedido de reagendamento (mensagem com data sugerida; o cliente pode responder *SIM*
            para confirmar automaticamente pelo WhatsApp, se o webhook estiver configurado).
          </p>
          {showOutreachToolbar ? (
            <div className="closureOutreachActions">
              {conflictDemoMode ? (
                <div className="closurePreviewDemoOutreachBanner" role="note">
                  <strong>Pré-visualização</strong> — Os botões abaixo são os mesmos que aparecem após
                  registrar um bloqueio com clientes reais em conflito.                   Aqui o envio está desligado (dados fictícios).
                </div>
              ) : null}
              <div className="actionsRow closureOutreachTopRow">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={outreachControlsDisabled}
                    title={
                      conflictDemoMode
                        ? "Disponível só com conflitos reais após registrar o bloqueio."
                        : "Enviar mensagem com sugestão de horário; cliente pode responder SIM para confirmar."
                    }
                  onClick={() => void sendRescheduleOutreach(realConflictIds)}
                >
                  {outreachBusy
                    ? "Enviando…"
                    : `Enviar pedido de reagendamento — todos (${
                        conflictDemoMode ? conflictDetails.length : realConflictIds.length
                      })`}
                </Button>
              </div>
              <p className="closureOutreachTemplateHint helperText">
                A mensagem inclui a sugestão de data e pede *SIM* para confirmar. Personalize em
                Mensagens: <code className="closureCodeTag">WA_CLOSURE_RESCHEDULE_OUTREACH</code>{" "}
                (placeholders: cliente, empresa, horarioAtual, sugestao, sugestaoInicioIso,
                sugestaoFimIso). Configure o webhook em{" "}
                <code className="closureCodeTag">GET/POST /api/webhook/whatsapp</code>.
              </p>
            </div>
          ) : realConflictIds.length > 0 && !outreachAnchorIso && !conflictDemoMode ? (
            <p className="helperText closureOutreachFallback">
              Para disparar o pedido de reagendamento, registre o bloqueio nesta sessão (o sistema usa
              o fim do bloqueio para calcular o próximo slot livre).
            </p>
          ) : null}
          {outreachResult ? <p className="feedbackOk closureOutreachResult">{outreachResult}</p> : null}
          {outreachResult && outreachResult.includes("Falhas") ? (
            <p className="feedbackWarn closureOutreachResult">
              Verifique credenciais do WhatsApp (.env) e números dos clientes.
            </p>
          ) : null}
          <ul className="closureConflictList">
            {conflictDetails.map((row) => (
              <li key={row.id} className="closureConflictListItem">
                <div className="closureConflictListText">
                  <span className="closureConflictLineMain">
                    {row.customer_name || "Cliente"} — {row.customer_phone}
                  </span>
                  <span className="closureConflictLineMeta">
                    {formatClosureDateTimePt(row.starts_at)} → {formatClosureDateTimePt(row.ends_at)} ·{" "}
                    {appointmentStatusLabel(row.status)}
                  </span>
                </div>
                {showOutreachToolbar &&
                (isUuidAppointmentId(row.id) || conflictDemoMode) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="closureOutreachRowBtn shrink-0"
                    disabled={
                      outreachBusy || conflictDemoMode || !isUuidAppointmentId(row.id)
                    }
                    title={
                      conflictDemoMode
                        ? "Na demo o envio está desligado."
                        : !isUuidAppointmentId(row.id)
                          ? undefined
                          : "Pedido de reagendamento só para este cliente (resposta SIM confirma)."
                    }
                    onClick={() => void sendRescheduleOutreach([row.id])}
                  >
                    Enviar pedido de reagendamento
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {closures.length > 0 ? (
        <ul className="businessClosuresList">
          {closures.map((c) => (
            <li key={c.id} className="businessClosuresItem">
              <div>
                <span className="businessClosuresKind">{CLOSURE_KIND_LABEL[c.kind] ?? c.kind}</span>
                <span className="businessClosuresRange">
                  {formatClosureDateTimePt(c.starts_at)} → {formatClosureDateTimePt(c.ends_at)}
                </span>
                {c.note ? <small className="businessClosuresNote">{c.note}</small> : null}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => void handleRemove(c.id)}>
                Remover
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="helperText">Nenhum bloqueio ativo cadastrado.</p>
      )}
    </>
  );

  return (
    <div className="detailsModalBackdrop" onClick={() => onOpenChange(false)}>
      <article
        className="detailsModalCard businessClosureModalCard structuredFormModal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="structuredFormModalHeader">
          <h3 className="integrationName" id="businessClosureModalTitle">
            Indisponibilidade da agenda
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
        <div className="structuredFormScroll">{body}</div>
      </article>
    </div>
  );
}
