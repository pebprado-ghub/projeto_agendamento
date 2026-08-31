import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRole } from "@/lib/authRoles";
import {
  buildPublicSiteEditLimits,
  nextEditQuotaFields,
  publicSiteContentFingerprint,
  type PublicSiteEditLimits
} from "@/lib/publicSiteEditLimits";
import { assertPlanFeature, hasPlanFeature } from "@/lib/planAccess";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: {
    businessId: string;
  };
};

type PublicSiteBody = {
  isPublished?: boolean;
  headline?: string;
  subheadline?: string;
  aboutText?: string;
  heroImageUrl?: string | null;
  galleryUrls?: string[];
  ctaLabel?: string;
  showPrices?: boolean;
};

const SELECT_FIELDS =
  "business_id, is_published, headline, subheadline, about_text, hero_image_url, gallery_urls, cta_label, show_prices, updated_at, last_edit_at, edit_count, edit_count_month";

function emptySite(businessId: string) {
  return {
    business_id: businessId,
    is_published: false,
    headline: "",
    subheadline: "",
    about_text: "",
    hero_image_url: null as string | null,
    gallery_urls: [] as string[],
    cta_label: "Agendar",
    show_prices: true,
    updated_at: null as string | null,
    last_edit_at: null as string | null,
    edit_count: 0,
    edit_count_month: null as string | null
  };
}

function toClient(
  row: ReturnType<typeof emptySite> & {
    updated_at?: string | null;
    last_edit_at?: string | null;
    edit_count?: number | null;
    edit_count_month?: string | null;
  }
) {
  return {
    businessId: row.business_id,
    isPublished: Boolean(row.is_published),
    headline: row.headline || "",
    subheadline: row.subheadline || "",
    aboutText: row.about_text || "",
    heroImageUrl: row.hero_image_url || null,
    galleryUrls: row.gallery_urls || [],
    ctaLabel: row.cta_label || "Agendar",
    showPrices: row.show_prices !== false,
    updatedAt: row.updated_at || null
  };
}

function withLimits(row: ReturnType<typeof emptySite> | null) {
  const data = toClient(row || emptySite(""));
  const editLimits: PublicSiteEditLimits = buildPublicSiteEditLimits(row);
  return { data, editLimits };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const raw = request.cookies.get("session_role")?.value;
    if (!isAuthenticatedRole(raw)) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const businessId = params.businessId?.trim();
    if (!businessId) {
      return NextResponse.json({ error: "businessId invalido." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const planFeatureEnabled = await hasPlanFeature(supabase, businessId, "public_site");
    const { data, error } = await supabase
      .from("business_public_sites")
      .select(SELECT_FIELDS)
      .eq("business_id", businessId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const row = data || emptySite(businessId);
    return NextResponse.json({ ...withLimits(row), planFeatureEnabled });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao carregar site publico." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const raw = request.cookies.get("session_role")?.value;
    if (!isAuthenticatedRole(raw)) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const businessId = params.businessId?.trim();
    if (!businessId) {
      return NextResponse.json({ error: "businessId invalido." }, { status: 400 });
    }

    const body = (await request.json()) as PublicSiteBody;
    const galleryUrls = Array.isArray(body.galleryUrls)
      ? body.galleryUrls.map((u) => String(u).trim()).filter(Boolean).slice(0, 12)
      : [];

    const contentPayload = {
      business_id: businessId,
      is_published: Boolean(body.isPublished),
      headline: String(body.headline ?? "").trim().slice(0, 200),
      subheadline: String(body.subheadline ?? "").trim().slice(0, 400),
      about_text: String(body.aboutText ?? "").trim().slice(0, 8000),
      hero_image_url: body.heroImageUrl ? String(body.heroImageUrl).trim() : null,
      gallery_urls: galleryUrls,
      cta_label: String(body.ctaLabel ?? "Agendar").trim().slice(0, 60) || "Agendar",
      show_prices: body.showPrices !== false
    };

    const supabase = getSupabaseAdmin();

    const gate = await assertPlanFeature(supabase, businessId, "public_site");
    if (!gate.ok) return gate.response;

    const { data: existing, error: loadError } = await supabase
      .from("business_public_sites")
      .select(SELECT_FIELDS)
      .eq("business_id", businessId)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }

    const prev = existing || emptySite(businessId);
    const unchanged =
      publicSiteContentFingerprint(prev) === publicSiteContentFingerprint(contentPayload);

    if (unchanged && existing) {
      return NextResponse.json(withLimits(prev));
    }

    const limits = buildPublicSiteEditLimits(existing);
    if (!limits.canEdit) {
      return NextResponse.json(
        {
          error: limits.blockedReason || "Alteracao bloqueada pelos limites do site publico.",
          editLimits: limits
        },
        { status: 429 }
      );
    }

    const quota = nextEditQuotaFields(existing);
    const payload = {
      ...contentPayload,
      updated_at: new Date().toISOString(),
      ...quota
    };

    const { data, error } = await supabase
      .from("business_public_sites")
      .upsert(payload, { onConflict: "business_id" })
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(withLimits(data));
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao salvar site publico." },
      { status: 500 }
    );
  }
}
