import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRole } from "@/lib/authRoles";
import { reviewPublicSiteContent } from "@/lib/publicSiteContentReview";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const SERVICE_SELECT =
  "id, name, category, description, icon, color, image_urls, duration_minutes, price_cents, display_order";

export async function GET(request: NextRequest) {
  try {
    const slug = (request.nextUrl.searchParams.get("slug") || "").trim().toLowerCase();
    const previewRequested =
      request.nextUrl.searchParams.get("preview") === "1" ||
      request.nextUrl.searchParams.get("preview") === "true";
    if (!slug) {
      return NextResponse.json({ error: "Parametro slug e obrigatorio." }, { status: 400 });
    }

    const canPreview =
      previewRequested && isAuthenticatedRole(request.cookies.get("session_role")?.value);

    if (previewRequested && !canPreview) {
      return NextResponse.json(
        { error: "Preview disponivel apenas para usuarios autenticados." },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select(
        "id, name, slug, trade_name, city, state, address_line, address_number, neighborhood, contact_phone, whatsapp_number, contact_email, google_reviews_url"
      )
      .eq("slug", slug)
      .maybeSingle();

    if (businessError) {
      return NextResponse.json({ error: businessError.message }, { status: 500 });
    }
    if (!business) {
      return NextResponse.json({ error: "Negocio nao encontrado." }, { status: 404 });
    }

    const { data: site, error: siteError } = await supabase
      .from("business_public_sites")
      .select(
        "business_id, is_published, headline, subheadline, about_text, hero_image_url, gallery_urls, cta_label, show_prices, updated_at"
      )
      .eq("business_id", business.id)
      .maybeSingle();

    if (siteError) {
      return NextResponse.json({ error: siteError.message }, { status: 500 });
    }
    if (!site) {
      return NextResponse.json(
        {
          error: canPreview
            ? "Nenhum rascunho salvo ainda. Salve o conteudo no painel."
            : "Site publico nao publicado para este negocio."
        },
        { status: 404 }
      );
    }
    if (!site.is_published && !canPreview) {
      return NextResponse.json(
        { error: "Site publico nao publicado para este negocio." },
        { status: 404 }
      );
    }

    const { data: services, error: servicesError } = await supabase
      .from("services")
      .select(SERVICE_SELECT)
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })
      .limit(200);

    if (servicesError) {
      return NextResponse.json({ error: servicesError.message }, { status: 500 });
    }

    const mappedServices = (services || []).map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description,
      icon: s.icon,
      color: s.color,
      imageUrls: s.image_urls || [],
      durationMinutes: s.duration_minutes,
      priceCents: s.price_cents
    }));

    const contentReview = canPreview
      ? reviewPublicSiteContent({
          headline: site.headline || "",
          subheadline: site.subheadline || "",
          aboutText: site.about_text || "",
          heroImageUrl: site.hero_image_url,
          galleryUrls: site.gallery_urls || [],
          ctaLabel: site.cta_label || "Agendar",
          showPrices: site.show_prices !== false,
          services: mappedServices.map((s) => ({
            name: s.name,
            description: s.description,
            imageUrls: s.imageUrls,
            priceCents: s.priceCents
          }))
        })
      : [];

    return NextResponse.json({
      data: {
        previewMode: Boolean(canPreview),
        isPublished: Boolean(site.is_published),
        contentReview,
        business: {
          id: business.id,
          name: business.name,
          slug: business.slug,
          tradeName: business.trade_name,
          city: business.city,
          state: business.state,
          addressLine: business.address_line,
          addressNumber: business.address_number,
          neighborhood: business.neighborhood,
          contactPhone: business.contact_phone,
          whatsappNumber: business.whatsapp_number,
          contactEmail: business.contact_email,
          googleReviewsUrl: business.google_reviews_url
        },
        site: {
          headline: site.headline,
          subheadline: site.subheadline,
          aboutText: site.about_text,
          heroImageUrl: site.hero_image_url,
          galleryUrls: site.gallery_urls || [],
          ctaLabel: site.cta_label || "Agendar",
          showPrices: site.show_prices !== false,
          updatedAt: site.updated_at
        },
        services: mappedServices
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao carregar site publico." },
      { status: 500 }
    );
  }
}
