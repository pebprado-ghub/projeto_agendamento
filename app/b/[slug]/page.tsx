"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ContentReviewIssue } from "@/lib/publicSiteContentReview";
import { summarizeContentReview } from "@/lib/publicSiteContentReview";

type PublicService = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  icon: string | null;
  color: string | null;
  imageUrls: string[];
  durationMinutes: number;
  priceCents: number | null;
};

type PublicSitePayload = {
  previewMode?: boolean;
  isPublished?: boolean;
  contentReview?: ContentReviewIssue[];
  business: {
    id: string;
    name: string;
    slug: string;
    tradeName: string | null;
    city: string | null;
    state: string | null;
    addressLine: string | null;
    addressNumber: string | null;
    neighborhood: string | null;
    contactPhone: string | null;
    whatsappNumber: string | null;
    contactEmail: string | null;
    googleReviewsUrl: string | null;
  };
  site: {
    headline: string;
    subheadline: string;
    aboutText: string;
    heroImageUrl: string | null;
    galleryUrls: string[];
    ctaLabel: string;
    showPrices: boolean;
  };
  services: PublicService[];
};

function formatPrice(cents: number | null) {
  if (cents == null) return "Sob consulta";
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

function formatAddress(b: PublicSitePayload["business"]) {
  const parts = [
    [b.addressLine, b.addressNumber].filter(Boolean).join(", "),
    b.neighborhood,
    [b.city, b.state].filter(Boolean).join(" / ")
  ].filter(Boolean);
  return parts.join(" · ");
}

function whatsappHref(phone: string | null | undefined) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

function probeImage(url: string): Promise<ContentReviewIssue | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(() => {
      img.src = "";
      resolve({
        id: `img-timeout-${url.slice(-24)}`,
        severity: "warning",
        field: "images",
        message: `Imagem demorou demais ou não carregou: ${url.slice(0, 64)}${url.length > 64 ? "…" : ""}`
      });
    }, 8000);
    img.onload = () => {
      window.clearTimeout(timer);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w > 0 && h > 0 && (w < 200 || h < 120)) {
        resolve({
          id: `img-small-${url.slice(-24)}`,
          severity: "warning",
          field: "images",
          message: `Imagem muito pequena (${w}×${h}px) — pode ficar pixelada no hero/galeria.`
        });
        return;
      }
      resolve(null);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve({
        id: `img-broken-${url.slice(-24)}`,
        severity: "error",
        field: "images",
        message: `Imagem quebrada ou inacessível: ${url.slice(0, 64)}${url.length > 64 ? "…" : ""}`
      });
    };
    img.src = url;
  });
}

function severityLabel(s: ContentReviewIssue["severity"]) {
  if (s === "error") return "Erro";
  if (s === "warning") return "Atenção";
  return "Info";
}

export default function PublicBusinessSitePage({
  params
}: {
  params: { slug: string };
}) {
  const slug = (params.slug || "").trim();
  const [data, setData] = useState<PublicSitePayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [imageIssues, setImageIssues] = useState<ContentReviewIssue[]>([]);

  const load = useCallback(async () => {
    if (!slug) {
      setError("Slug inválido.");
      setLoading(false);
      return;
    }
    const preview =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("preview") === "1";
    setPreviewMode(preview);
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ slug });
      if (preview) qs.set("preview", "1");
      const res = await fetch(`/api/public/site?${qs.toString()}`);
      const json = (await res.json()) as { data?: PublicSitePayload; error?: string };
      if (!res.ok || !json.data) {
        throw new Error(json.error || "Site não encontrado.");
      }
      setData(json.data);
      setPreviewMode(Boolean(json.data.previewMode || preview));
    } catch (e) {
      setData(null);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!previewMode || !data) {
      setImageIssues([]);
      return;
    }
    let cancelled = false;
    const urls = [
      data.site.heroImageUrl,
      ...(data.site.galleryUrls || []),
      ...data.services.flatMap((s) => s.imageUrls.slice(0, 1))
    ].filter((u): u is string => Boolean(u));

    void (async () => {
      const found: ContentReviewIssue[] = [];
      for (const url of urls) {
        const issue = await probeImage(url);
        if (issue) found.push(issue);
        if (cancelled) return;
      }
      if (!cancelled) setImageIssues(found);
    })();

    return () => {
      cancelled = true;
    };
  }, [previewMode, data]);

  const allReviewIssues = useMemo(() => {
    const base = data?.contentReview || [];
    const merged = [...base, ...imageIssues];
    const rank = { error: 0, warning: 1, info: 2 };
    return merged.sort(
      (a, b) => rank[a.severity] - rank[b.severity] || a.message.localeCompare(b.message)
    );
  }, [data?.contentReview, imageIssues]);

  const reviewSummary = useMemo(
    () => summarizeContentReview(allReviewIssues),
    [allReviewIssues]
  );

  if (loading) {
    return (
      <main className="publicSitePage">
        <p className="helperText">Carregando…</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="publicSitePage">
        <h1 className="publicSiteTitle">Site indisponível</h1>
        <p className="feedbackError">{error || "Conteúdo não encontrado."}</p>
        <p className="helperText">
          Se você é o dono do negócio, salve o rascunho e use Visualizar teste, ou publique em
          Configurações → Site público.
        </p>
      </main>
    );
  }

  const { business, site, services } = data;
  const displayName = business.tradeName || business.name;
  const headline = site.headline.trim() || displayName;
  const wa = whatsappHref(business.whatsappNumber || business.contactPhone);
  const address = formatAddress(business);
  const agendarHref = `/agendar?businessId=${encodeURIComponent(business.id)}`;

  return (
    <main className="publicSitePage">
      {previewMode ? (
        <div className="publicSitePreviewBanner" role="status">
          <strong>Modo teste</strong>
          <span>
            {data.isPublished
              ? "Você está autenticado visualizando a página (já publicada)."
              : "Rascunho — visitante sem login ainda não vê esta página. Publique no painel após confirmar."}
          </span>
        </div>
      ) : null}

      {previewMode ? (
        <section className="publicSiteReviewPanel" aria-label="Revisão de conteúdo">
          <div className="publicSiteReviewHead">
            <h2>Revisão automática do conteúdo</h2>
            <p>
              {reviewSummary.total === 0
                ? "Nenhuma discrepância encontrada pelas regras da beta."
                : `${reviewSummary.errors} erro(s), ${reviewSummary.warnings} atenção(ões), ${reviewSummary.infos} info(s).`}
            </p>
          </div>
          {allReviewIssues.length > 0 ? (
            <ul className="publicSiteReviewList">
              {allReviewIssues.map((issue) => (
                <li
                  key={issue.id}
                  className={`publicSiteReviewItem publicSiteReviewItem--${issue.severity}`}
                >
                  <span className="publicSiteReviewSeverity">{severityLabel(issue.severity)}</span>
                  <span className="publicSiteReviewField">{issue.field}</span>
                  <span className="publicSiteReviewMsg">{issue.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="helperText">Revise visualmente a página abaixo e só então publique no painel.</p>
          )}
        </section>
      ) : null}

      <header
        className={
          site.heroImageUrl ? "publicSiteHero publicSiteHero--withImage" : "publicSiteHero"
        }
        style={
          site.heroImageUrl
            ? {
                backgroundImage: `linear-gradient(rgba(6,78,59,0.55), rgba(6,78,59,0.72)), url(${site.heroImageUrl})`
              }
            : undefined
        }
      >
        <div className="publicSiteHeroInner">
          <p className="publicSiteBrand">{displayName}</p>
          <h1 className="publicSiteHeadline">{headline}</h1>
          {site.subheadline.trim() ? (
            <p className="publicSiteSubheadline">{site.subheadline}</p>
          ) : null}
          <div className="publicSiteHeroActions">
            <Link href={agendarHref} className="uiButton publicSiteCta">
              {site.ctaLabel || "Agendar"}
            </Link>
            {wa ? (
              <a
                href={wa}
                className="uiButton uiButtonOutline publicSiteCtaSecondary"
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      </header>

      {site.aboutText.trim() ? (
        <section className="publicSiteSection">
          <h2 className="publicSiteSectionTitle">Sobre</h2>
          <p className="publicSiteAbout">{site.aboutText}</p>
        </section>
      ) : null}

      <section className="publicSiteSection" id="servicos">
        <h2 className="publicSiteSectionTitle">Serviços</h2>
        {services.length === 0 ? (
          <p className="helperText">Nenhum serviço publicado no momento.</p>
        ) : (
          <ul className="publicSiteServiceGrid">
            {services.map((svc) => {
              const cover = svc.imageUrls[0];
              return (
                <li key={svc.id} className="publicSiteServiceCard">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" className="publicSiteServiceImg" />
                  ) : (
                    <div
                      className="publicSiteServiceImgPlaceholder"
                      style={{ background: svc.color || "#d1fae5" }}
                      aria-hidden
                    >
                      {svc.icon || "•"}
                    </div>
                  )}
                  <div className="publicSiteServiceBody">
                    {svc.category ? (
                      <span className="publicSiteServiceCategory">{svc.category}</span>
                    ) : null}
                    <h3>{svc.name}</h3>
                    {svc.description ? <p>{svc.description}</p> : null}
                    <div className="publicSiteServiceMeta">
                      <span>{svc.durationMinutes} min</span>
                      {site.showPrices ? <strong>{formatPrice(svc.priceCents)}</strong> : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="publicSiteSectionCta">
          <Link href={agendarHref} className="uiButton">
            {site.ctaLabel || "Agendar"}
          </Link>
        </div>
      </section>

      {site.galleryUrls.length > 0 ? (
        <section className="publicSiteSection">
          <h2 className="publicSiteSectionTitle">Galeria</h2>
          <div className="publicSiteGallery">
            {site.galleryUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={url} src={url} alt="" className="publicSiteGalleryImg" />
            ))}
          </div>
        </section>
      ) : null}

      <footer className="publicSiteFooter">
        <strong>{displayName}</strong>
        {address ? <p>{address}</p> : null}
        {business.contactEmail ? <p>{business.contactEmail}</p> : null}
        {business.googleReviewsUrl ? (
          <p>
            <a href={business.googleReviewsUrl} target="_blank" rel="noopener noreferrer">
              Avaliações no Google
            </a>
          </p>
        ) : null}
        <p className="helperText publicSiteFooterNote">Powered by Agendamento</p>
      </footer>
    </main>
  );
}
