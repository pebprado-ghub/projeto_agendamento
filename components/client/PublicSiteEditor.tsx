"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { HelpHint } from "@/components/ui/help-hint";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  formatNextEditLabel,
  type PublicSiteEditLimits
} from "@/lib/publicSiteEditLimits";

export type PublicSiteForm = {
  isPublished: boolean;
  headline: string;
  subheadline: string;
  aboutText: string;
  heroImageUrl: string | null;
  galleryUrls: string[];
  ctaLabel: string;
  showPrices: boolean;
};

type Props = {
  businessId: string;
  businessSlug: string;
};

const emptyForm: PublicSiteForm = {
  isPublished: false,
  headline: "",
  subheadline: "",
  aboutText: "",
  heroImageUrl: null,
  galleryUrls: [],
  ctaLabel: "Agendar",
  showPrices: true
};

function applyServerForm(data: PublicSiteForm): PublicSiteForm {
  return {
    isPublished: Boolean(data.isPublished),
    headline: data.headline || "",
    subheadline: data.subheadline || "",
    aboutText: data.aboutText || "",
    heroImageUrl: data.heroImageUrl || null,
    galleryUrls: data.galleryUrls || [],
    ctaLabel: data.ctaLabel || "Agendar",
    showPrices: data.showPrices !== false
  };
}

export function PublicSiteEditor({ businessId, businessSlug }: Props) {
  const [form, setForm] = useState<PublicSiteForm>(emptyForm);
  const [editLimits, setEditLimits] = useState<PublicSiteEditLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [planFeatureEnabled, setPlanFeatureEnabled] = useState(true);

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/b/${encodeURIComponent(businessSlug)}`
      : `/b/${businessSlug}`;
  const previewUrl = `${publicUrl}?preview=1`;
  const planBlocked = planFeatureEnabled === false;
  const canEdit = !planBlocked && editLimits?.canEdit !== false;
  const editBlocked = planBlocked || Boolean(editLimits && !editLimits.canEdit);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/public-site`);
      const json = (await res.json()) as {
        data?: PublicSiteForm;
        editLimits?: PublicSiteEditLimits;
        planFeatureEnabled?: boolean;
        error?: string;
      };
      if (!res.ok || !json.data) {
        throw new Error(json.error || "Erro ao carregar site público.");
      }
      setForm(applyServerForm(json.data));
      if (json.editLimits) setEditLimits(json.editLimits);
      setPlanFeatureEnabled(json.planFeatureEnabled !== false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persist(next: PublicSiteForm, okMessage: string) {
    const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/public-site`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next)
    });
    const json = (await res.json()) as {
      data?: PublicSiteForm;
      editLimits?: PublicSiteEditLimits;
      error?: string;
    };
    if (json.editLimits) setEditLimits(json.editLimits);
    if (!res.ok || !json.data) {
      throw new Error(json.error || "Erro ao salvar.");
    }
    setForm(applyServerForm(json.data));
    setFeedback(okMessage);
    return json.data;
  }

  async function uploadImage(file: File): Promise<string> {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(
      `/api/businesses/${encodeURIComponent(businessId)}/public-site/upload`,
      { method: "POST", body }
    );
    const json = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !json.url) {
      throw new Error(json.error || "Falha no upload.");
    }
    return json.url;
  }

  async function handleHeroUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file || planBlocked) return;
    setUploading(true);
    setError("");
    try {
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, heroImageUrl: url }));
      setFeedback("Imagem de capa enviada. Salve o rascunho para ver no teste.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleGalleryUpload(files: FileList | null) {
    if (!files?.length || planBlocked) return;
    setUploading(true);
    setError("");
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 6)) {
        urls.push(await uploadImage(file));
      }
      setForm((f) => ({
        ...f,
        galleryUrls: [...f.galleryUrls, ...urls].slice(0, 12)
      }));
      setFeedback("Imagens da galeria enviadas. Salve o rascunho para ver no teste.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveDraft(event?: FormEvent) {
    event?.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setFeedback("");
    setError("");
    try {
      // Salva conteúdo mantendo o status atual de publicação (não publica por aqui).
      await persist(
        { ...form, isPublished: form.isPublished },
        form.isPublished
          ? "Alterações salvas no site publicado."
          : "Rascunho salvo. Use “Visualizar teste” antes de publicar."
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePreviewTest() {
    if (!businessSlug) {
      setError("Slug do negócio ausente. Cadastre o slug da empresa antes.");
      return;
    }
    setSaving(true);
    setFeedback("");
    setError("");
    try {
      if (editBlocked) {
        setFeedback(
          "Cota de edição bloqueada — abrindo a última versão já salva (alterações locais não entram no teste)."
        );
        window.open(previewUrl, "_blank", "noopener,noreferrer");
        return;
      }
      // Gravação idêntica não consome cota; mudança real consome 1 alteração.
      await persist(
        { ...form, isPublished: form.isPublished },
        "Rascunho sincronizado. Abrindo visualização de teste…"
      );
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!businessSlug) {
      setError("Slug do negócio ausente.");
      return;
    }
    const ok = window.confirm(
      "Publicar o site agora?\n\nVisitantes sem login poderão ver a página em /b/" +
        businessSlug +
        ".\n\nConfirme apenas depois de revisar com “Visualizar teste”."
    );
    if (!ok) return;

    setSaving(true);
    setFeedback("");
    setError("");
    try {
      await persist({ ...form, isPublished: true }, "Site publicado. Visitantes já podem acessar o link público.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnpublish() {
    const ok = window.confirm(
      "Despublicar o site?\n\nA página pública deixa de ficar visível para visitantes até uma nova publicação."
    );
    if (!ok) return;

    setSaving(true);
    setFeedback("");
    setError("");
    try {
      await persist({ ...form, isPublished: false }, "Site despublicado. O link público não exibe mais o conteúdo.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function copyPublicLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setFeedback(form.isPublished ? "Link público copiado." : "Link copiado (só funciona após publicar).");
    } catch {
      setFeedback(publicUrl);
    }
  }

  if (loading) {
    return <p className="helperText">Carregando site público…</p>;
  }

  return (
    <form className="form publicSiteEditorForm" onSubmit={(e) => void handleSaveDraft(e)}>
      <p className="helperText">
        Preencha os textos e imagens, salve o rascunho, clique em <strong>Visualizar teste</strong> e
        só então <strong>Publicar</strong> após confirmar. Visitantes acessam{" "}
        <code>/b/{businessSlug || "…"}</code>.
      </p>

      {editLimits ? (
        <p
          className={
            editBlocked ? "publicSiteQuota publicSiteQuota--blocked" : "publicSiteQuota"
          }
          role="status"
        >
          <span>
            Alterações neste mês: {editLimits.usedThisMonth}/{editLimits.maxPerMonth}
            {editLimits.nextEditAt
              ? ` · Próxima liberação: ${formatNextEditLabel(editLimits.nextEditAt)}`
              : ` · Intervalo mínimo: ${editLimits.bufferLabel} entre alterações`}
          </span>
          <HelpHint>
            Para manter a vitrine estável, há limite de alterações por mês e um intervalo mínimo
            entre cada salvamento real (salvar o mesmo conteúdo de novo não conta).
          </HelpHint>
        </p>
      ) : null}

      {planBlocked ? (
        <p className="feedbackError" role="alert">
          O site público (vitrine) não está incluído no plano atual. Faça upgrade para editar ou
          publicar a página /b/{businessSlug || "…"}.
        </p>
      ) : null}

      {editLimits && !editLimits.canEdit && editLimits.blockedReason ? (
        <p className="feedbackError" role="alert">
          {editLimits.blockedReason}
        </p>
      ) : null}

      <p
        className={
          form.isPublished ? "publicSiteStatus publicSiteStatus--live" : "publicSiteStatus"
        }
        role="status"
      >
        {form.isPublished ? "Status: publicado (visível ao público)" : "Status: rascunho (não publicado)"}
      </p>

      <div className="actionsRow" style={{ flexWrap: "wrap" }}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving || uploading || !businessSlug}
          onClick={() => void handlePreviewTest()}
        >
          Visualizar teste
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={saving || uploading || editBlocked}
          onClick={() => void handlePublish()}
        >
          Publicar…
        </Button>
        {form.isPublished ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving || uploading || editBlocked}
            onClick={() => void handleUnpublish()}
          >
            Despublicar…
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!businessSlug}
          onClick={() => void copyPublicLink()}
        >
          Copiar link público
        </Button>
      </div>

      <label>
        Título (headline)
        <Input
          value={form.headline}
          onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
          placeholder="Ex.: Beleza e bem-estar no seu ritmo"
        />
      </label>

      <label>
        Subtítulo
        <Input
          value={form.subheadline}
          onChange={(e) => setForm((f) => ({ ...f, subheadline: e.target.value }))}
          placeholder="Frase curta de marketing"
        />
      </label>

      <label>
        Sobre / texto de marketing
        <Textarea
          rows={5}
          value={form.aboutText}
          onChange={(e) => setForm((f) => ({ ...f, aboutText: e.target.value }))}
          placeholder="Conte a história do negócio, diferenciais, etc."
        />
      </label>

      <label>
        Texto do botão (CTA)
        <Input
          value={form.ctaLabel}
          onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
          placeholder="Agendar"
        />
      </label>

      <Checkbox
        checked={form.showPrices}
        onChange={(e) => setForm((f) => ({ ...f, showPrices: e.target.checked }))}
        label="Mostrar preços na vitrine"
      />

      <div className="structuredFormSection">
        <h4 className="structuredFormSectionTitle">Imagem de capa (hero)</h4>
        {form.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.heroImageUrl} alt="" className="publicSiteEditorPreview" />
        ) : (
          <p className="helperText">Nenhuma capa ainda.</p>
        )}
        <Input
          type="file"
          accept="image/*"
          disabled={uploading || planBlocked}
          onChange={(e) => {
            void handleHeroUpload(e.target.files);
            e.target.value = "";
          }}
        />
        {form.heroImageUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setForm((f) => ({ ...f, heroImageUrl: null }))}
          >
            Remover capa
          </Button>
        ) : null}
      </div>

      <div className="structuredFormSection">
        <h4 className="structuredFormSectionTitle">Galeria (até 12)</h4>
        <div className="publicSiteEditorGallery">
          {form.galleryUrls.map((url) => (
            <div key={url} className="publicSiteEditorGalleryItem">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    galleryUrls: f.galleryUrls.filter((u) => u !== url)
                  }))
                }
              >
                Remover
              </Button>
            </div>
          ))}
        </div>
        <Input
          type="file"
          accept="image/*"
          multiple
          disabled={uploading || planBlocked || form.galleryUrls.length >= 12}
          onChange={(e) => {
            void handleGalleryUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="actionsRow">
        <Button type="submit" disabled={saving || uploading || editBlocked}>
          {saving ? "Salvando…" : canEdit ? "Salvar rascunho" : "Salvar bloqueado"}
        </Button>
      </div>
      {feedback ? <p className="feedbackOk">{feedback}</p> : null}
      {error ? <p className="feedbackError">{error}</p> : null}
      {uploading ? <p className="helperText">Enviando imagem…</p> : null}
    </form>
  );
}
