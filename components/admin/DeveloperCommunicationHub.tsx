"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  buildMailtoForBusiness,
  buildWhatsAppUrlFromBusinessNumber
} from "@/lib/developerContactLinks";
import { repairUtf8MisinterpretedAsLatin1 } from "@/lib/repairMojibake";

type HubBusiness = {
  id: string;
  name: string;
  slug: string;
  whatsapp_number?: string | null;
  contact_email?: string | null;
  contact_name?: string | null;
};

export type ThreadSummary = {
  threadId: string;
  businessId: string;
  threadUpdatedAt: string;
  businessName: string;
  businessSlug: string;
  lastMessageBody: string | null;
  lastMessageChannel: string | null;
  lastMessageDirection: string | null;
  lastMessageAt: string | null;
};

export type CommMessage = {
  id: string;
  threadId: string;
  channel: string;
  direction: string;
  subject: string | null;
  body: string;
  metadata: Record<string, unknown>;
  senderLabel: string | null;
  createdAt: string;
};

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  internal: "Interno"
};

const DIRECTION_LABEL: Record<string, string> = {
  inbound: "Entrada",
  outbound: "Saída",
  system: "Sistema"
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

type DeveloperCommunicationHubProps = {
  businesses: HubBusiness[];
  focusBusinessId: string | null;
  onConsumedFocus?: () => void;
};

export function DeveloperCommunicationHub({
  businesses,
  focusBusinessId,
  onConsumedFocus
}: DeveloperCommunicationHubProps) {
  const [listQuery, setListQuery] = useState("");
  const [summaries, setSummaries] = useState<ThreadSummary[]>([]);
  const [summariesLoading, setSummariesLoading] = useState(true);
  const [summariesError, setSummariesError] = useState("");
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CommMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [composerChannel, setComposerChannel] = useState<"internal" | "whatsapp" | "email">(
    "internal"
  );
  const [composerBody, setComposerBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState("");

  const summaryByBusinessId = useMemo(() => {
    const m = new Map<string, ThreadSummary>();
    for (const s of summaries) m.set(s.businessId, s);
    return m;
  }, [summaries]);

  const businessById = useMemo(() => {
    const m = new Map<string, HubBusiness>();
    for (const b of businesses) m.set(b.id, b);
    return m;
  }, [businesses]);

  const listRows = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return [...businesses]
      .filter((b) => {
        if (!q) return true;
        return (
          b.name.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q)
        );
      })
      .map((b) => ({
        business: b,
        summary: summaryByBusinessId.get(b.id) ?? null
      }))
      .sort((a, b) => {
        const ta = a.summary?.lastMessageAt
          ? new Date(a.summary.lastMessageAt).getTime()
          : 0;
        const tb = b.summary?.lastMessageAt
          ? new Date(b.summary.lastMessageAt).getTime()
          : 0;
        if (tb !== ta) return tb - ta;
        return repairUtf8MisinterpretedAsLatin1(a.business.name).localeCompare(
          repairUtf8MisinterpretedAsLatin1(b.business.name),
          "pt-BR"
        );
      });
  }, [businesses, listQuery, summaryByBusinessId]);

  const loadSummaries = useCallback(async () => {
    setSummariesLoading(true);
    setSummariesError("");
    try {
      const res = await fetch("/api/admin/communication/threads?limit=500");
      const json = (await res.json()) as { data?: ThreadSummary[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao carregar resumo.");
      setSummaries(json.data || []);
    } catch (e) {
      setSummariesError((e as Error).message);
      setSummaries([]);
    } finally {
      setSummariesLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (businessId: string) => {
    setMessagesLoading(true);
    setMessagesError("");
    setMessages([]);
    setThreadId(null);
    try {
      const res = await fetch(
        `/api/admin/communication/messages?businessId=${encodeURIComponent(businessId)}&limit=80`
      );
      const json = (await res.json()) as {
        data?: CommMessage[];
        threadId?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Erro ao carregar histórico.");
      setThreadId(json.threadId ?? null);
      const chronological = [...(json.data || [])].reverse();
      setMessages(chronological);
    } catch (e) {
      setMessagesError((e as Error).message);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  useEffect(() => {
    if (focusBusinessId) {
      setSelectedBusinessId(focusBusinessId);
      onConsumedFocus?.();
    }
  }, [focusBusinessId, onConsumedFocus]);

  useEffect(() => {
    if (selectedBusinessId) void loadMessages(selectedBusinessId);
  }, [selectedBusinessId, loadMessages]);

  const selectedBusiness = selectedBusinessId
    ? businessById.get(selectedBusinessId)
    : undefined;

  const mailHref = selectedBusiness
    ? (() => {
        const displayName = repairUtf8MisinterpretedAsLatin1(selectedBusiness.name);
        return buildMailtoForBusiness(
          selectedBusiness.contact_email,
          `Contato — ${displayName} (${selectedBusiness.slug})`,
          `Olá,\n\nEscrevo em nome da equipe da plataforma, referente à empresa ${displayName} (${selectedBusiness.slug}).\n\n`
        );
      })()
    : null;
  const waUrl = selectedBusiness
    ? buildWhatsAppUrlFromBusinessNumber(selectedBusiness.whatsapp_number)
    : null;

  async function handleSaveNote() {
    if (!selectedBusinessId) return;
    setSaving(true);
    setSaveFeedback("");
    try {
      const res = await fetch("/api/admin/communication/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: selectedBusinessId,
          channel: composerChannel,
          direction: "outbound",
          body: composerBody,
          metadata: { source: "developer_communication_hub" }
        })
      });
      const json = (await res.json()) as { data?: CommMessage; error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao salvar.");
      if (json.data) setMessages((prev) => [...prev, json.data!]);
      setComposerBody("");
      setSaveFeedback("Mensagem registrada no histórico unificado.");
      void loadSummaries();
    } catch (e) {
      setSaveFeedback((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="developerCommHub">
      <aside className="developerCommHubList">
        <div className="developerCommHubListHead">
          <Input
            placeholder="Buscar empresa…"
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            aria-label="Buscar empresa"
          />
          {summariesLoading ? (
            <p className="helperText">Sincronizando conversas…</p>
          ) : null}
          {summariesError ? <p className="feedbackError">{summariesError}</p> : null}
        </div>
        <ul className="developerCommHubListUl">
          {listRows.map(({ business, summary }) => (
            <li key={business.id}>
              <button
                type="button"
                className={`developerCommHubListBtn${
                  selectedBusinessId === business.id ? " isActive" : ""
                }`}
                onClick={() => setSelectedBusinessId(business.id)}
              >
                <span className="developerCommHubListName">
                  {repairUtf8MisinterpretedAsLatin1(business.name)}
                </span>
                <code className="developerCommHubListSlug">{business.slug}</code>
                {summary?.lastMessageAt ? (
                  <span className="developerCommHubListMeta">
                    {CHANNEL_LABEL[summary.lastMessageChannel || "internal"] || "—"} ·{" "}
                    {formatWhen(summary.lastMessageAt)}
                  </span>
                ) : (
                  <span className="developerCommHubListMeta muted">Sem mensagens ainda</span>
                )}
                {summary?.lastMessageBody ? (
                  <span className="developerCommHubListPreview">
                    {summary.lastMessageBody.length > 90
                      ? `${summary.lastMessageBody.slice(0, 90)}…`
                      : summary.lastMessageBody}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="developerCommHubMain">
        {!selectedBusiness ? (
          <div className="developerCommHubEmpty">
            <p className="helperText">Selecione uma empresa à esquerda para ver o histórico.</p>
          </div>
        ) : (
          <>
            <header className="developerCommHubMainHead">
              <div>
                <h2 className="developerCommHubTitle">
                  {repairUtf8MisinterpretedAsLatin1(selectedBusiness.name)}
                </h2>
                <code className="statCardExpandableSlug">{selectedBusiness.slug}</code>
                {selectedBusiness.contact_name ? (
                  <p className="helperText">Contato: {selectedBusiness.contact_name}</p>
                ) : null}
                {threadId ? (
                  <p className="helperText developerCommHubThreadId">
                    Thread: <span className="mono">{threadId.slice(0, 8)}…</span>
                  </p>
                ) : (
                  <p className="helperText">Nenhuma mensagem ainda — o primeiro registro cria a conversa.</p>
                )}
              </div>
              <div className="developerCommHubQuickActions">
                <Button
                  type="button"
                  variant="primary"
                  disabled={!waUrl}
                  onClick={() => waUrl && window.open(waUrl, "_blank", "noopener,noreferrer")}
                >
                  WhatsApp Web
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!mailHref}
                  onClick={() => mailHref && (window.location.href = mailHref)}
                >
                  E-mail
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => void loadSummaries()}>
                  Atualizar lista
                </Button>
              </div>
            </header>

            <div className="developerCommHubMessages">
              {messagesLoading ? <p className="helperText">Carregando histórico…</p> : null}
              {messagesError ? <p className="feedbackError">{messagesError}</p> : null}
              {!messagesLoading && !messagesError && messages.length === 0 ? (
                <p className="helperText">Nenhuma mensagem nesta conversa.</p>
              ) : null}
              <ul className="developerCommHubMsgUl">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className={`developerCommHubMsg developerCommHubMsg--${m.direction}`}
                  >
                    <div className="developerCommHubMsgBar">
                      <span className="developerCommHubMsgChannel">
                        {CHANNEL_LABEL[m.channel] || m.channel}
                      </span>
                      <span className="developerCommHubMsgDir">
                        {DIRECTION_LABEL[m.direction] || m.direction}
                      </span>
                      <span className="developerCommHubMsgTime">{formatWhen(m.createdAt)}</span>
                    </div>
                    {m.subject ? <p className="developerCommHubMsgSubject">{m.subject}</p> : null}
                    <p className="developerCommHubMsgBody">{m.body || "—"}</p>
                    {m.senderLabel ? (
                      <p className="developerCommHubMsgSender">Por: {m.senderLabel}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            <div className="developerCommHubComposer">
              <p className="helperText developerCommHubComposerHint">
                Registre no sistema o que foi tratado (interno, ou canal usado após abrir WhatsApp /
                e-mail acima). Entradas automáticas por webhook/API podem aparecer como{" "}
                <strong>Entrada</strong> quando integradas.
              </p>
              <div className="developerCommHubComposerRow">
                <label className="developerCommHubComposerLabel">
                  Canal do registro
                  <Select
                    value={composerChannel}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "whatsapp" || v === "email" || v === "internal") setComposerChannel(v);
                    }}
                  >
                    <option value="internal">Interno (nota / auditoria)</option>
                    <option value="whatsapp">WhatsApp (registro de contato)</option>
                    <option value="email">E-mail (registro de contato)</option>
                  </Select>
                </label>
              </div>
              <label>
                Texto
                <Textarea
                  value={composerBody}
                  onChange={(e) => setComposerBody(e.target.value)}
                  placeholder="Ex.: Retorno sobre plano, confirmação de dados…"
                  rows={4}
                />
              </label>
              <div className="actionsRow">
                <Button
                  type="button"
                  className="saveButton"
                  disabled={saving || !selectedBusinessId}
                  onClick={() => void handleSaveNote()}
                >
                  {saving ? "Gravando…" : "Registrar no histórico"}
                </Button>
              </div>
              {saveFeedback ? (
                <p
                  className={
                    saveFeedback.startsWith("Mensagem registrada") ? "feedbackOk" : "feedbackError"
                  }
                >
                  {saveFeedback}
                </p>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
