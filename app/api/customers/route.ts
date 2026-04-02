import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePhoneDigits } from "@/lib/phone";

type CreateCustomerBody = {
  businessId: string;
  fullName: string;
  phone: string;
  /** Opcional: preenchido por integração ou importação. */
  whatsappProfileName?: string | null;
  email?: string | null;
  documentId?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  addressLine?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  notes?: string | null;
  preferences?: string | null;
  restrictions?: string | null;
  tags?: string[];
  isVip?: boolean;
  isBlocked?: boolean;
  blockReason?: string | null;
  source?: string | null;
  marketingOptIn?: boolean;
};

const SELECT_FIELDS =
  "id, business_id, full_name, whatsapp_profile_name, phone_normalized, email, document_id, birth_date, gender, address_line, address_number, address_complement, neighborhood, city, state, postal_code, notes, preferences, restrictions, tags, is_vip, is_blocked, block_reason, source, marketing_opt_in, marketing_opt_in_at, created_at, updated_at";

const SELECT_FIELDS_LEGACY =
  "id, business_id, full_name, phone_normalized, email, document_id, birth_date, gender, address_line, address_number, address_complement, neighborhood, city, state, postal_code, notes, source, marketing_opt_in, created_at, updated_at";

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    const q = (request.nextUrl.searchParams.get("q") || "").trim();

    if (!businessId) {
      return NextResponse.json(
        { error: "Parametro businessId e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("customers")
      .select(SELECT_FIELDS)
      .eq("business_id", businessId)
      .order("full_name", { ascending: true })
      .limit(200);

    if (q.length >= 2) {
      const digits = normalizePhoneDigits(q);
      const safe = q.replace(/[%]/g, "");
      const parts = [
        `full_name.ilike.%${safe}%`,
        `whatsapp_profile_name.ilike.%${safe}%`,
        `email.ilike.%${safe}%`
      ];
      if (digits.length >= 8) {
        parts.push(`phone_normalized.eq.${digits}`);
      }
      query = query.or(parts.join(","));
    }

    const { data, error } = await query;
    if (!error) {
      return NextResponse.json({ data: data || [] });
    }

    // Fallback de compatibilidade para bancos legados sem algumas colunas novas.
    const missingColumnError =
      error.code === "42703" || /column .* does not exist/i.test(error.message || "");
    if (!missingColumnError) {
      return NextResponse.json(
        { error: "Falha ao listar clientes." },
        { status: 500 }
      );
    }

    let fallbackQuery = supabase
      .from("customers")
      .select(SELECT_FIELDS_LEGACY)
      .eq("business_id", businessId)
      .order("full_name", { ascending: true })
      .limit(200);
    if (q.length >= 2) {
      const digits = normalizePhoneDigits(q);
      const safe = q.replace(/[%]/g, "");
      const parts = [
        `full_name.ilike.%${safe}%`,
        `email.ilike.%${safe}%`
      ];
      if (digits.length >= 8) {
        parts.push(`phone_normalized.eq.${digits}`);
      }
      fallbackQuery = fallbackQuery.or(parts.join(","));
    }
    const { data: fallbackData, error: fallbackError } = await fallbackQuery;
    if (fallbackError) {
      return NextResponse.json(
        { error: "Falha ao listar clientes." },
        { status: 500 }
      );
    }
    const normalized = (fallbackData || []).map((item) => ({
      ...item,
      whatsapp_profile_name: null,
      preferences: null,
      restrictions: null,
      tags: [],
      is_vip: false,
      is_blocked: false,
      block_reason: null,
      marketing_opt_in_at: null
    }));
    return NextResponse.json({ data: normalized });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

async function linkAppointmentsByPhone(
  businessId: string,
  customerId: string,
  phoneNormalized: string
) {
  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from("appointments")
    .select("id, customer_phone")
    .eq("business_id", businessId)
    .is("customer_id", null)
    .limit(500);

  if (error || !rows?.length) return;

  const toLink = rows.filter(
    (row) => normalizePhoneDigits(row.customer_phone || "") === phoneNormalized
  );
  for (const row of toLink) {
    await supabase
      .from("appointments")
      .update({ customer_id: customerId })
      .eq("id", row.id);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCustomerBody;
    if (!body.businessId || !body.fullName?.trim() || !body.phone?.trim()) {
      return NextResponse.json(
        { error: "businessId, fullName e phone sao obrigatorios." },
        { status: 400 }
      );
    }

    const phoneNormalized = normalizePhoneDigits(body.phone);
    if (phoneNormalized.length < 10) {
      return NextResponse.json(
        { error: "Telefone invalido (minimo 10 digitos)." },
        { status: 400 }
      );
    }

    const source = body.source || "manual";
    const allowed = ["manual", "whatsapp", "import", "campaign", "other"];
    if (!allowed.includes(source)) {
      return NextResponse.json({ error: "Origem invalida." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const waName = body.whatsappProfileName?.trim() || null;

    const marketingOptIn = Boolean(body.marketingOptIn);
    const { data, error } = await supabase
      .from("customers")
      .insert({
        business_id: body.businessId,
        full_name: body.fullName.trim(),
        whatsapp_profile_name: waName,
        phone_normalized: phoneNormalized,
        email: body.email?.trim() || null,
        document_id: body.documentId?.replace(/\D/g, "") || null,
        birth_date: body.birthDate || null,
        gender: body.gender?.trim() || null,
        address_line: body.addressLine?.trim() || null,
        address_number: body.addressNumber?.trim() || null,
        address_complement: body.addressComplement?.trim() || null,
        neighborhood: body.neighborhood?.trim() || null,
        city: body.city?.trim() || null,
        state: body.state?.trim() || null,
        postal_code: body.postalCode?.replace(/\D/g, "") || null,
        notes: body.notes?.trim() || null,
        preferences: body.preferences?.trim() || null,
        restrictions: body.restrictions?.trim() || null,
        tags: Array.isArray(body.tags)
          ? body.tags.map((t) => (t || "").trim()).filter(Boolean)
          : [],
        is_vip: Boolean(body.isVip),
        is_blocked: Boolean(body.isBlocked),
        block_reason: body.blockReason?.trim() || null,
        source,
        marketing_opt_in: marketingOptIn,
        marketing_opt_in_at: marketingOptIn ? new Date().toISOString() : null
      })
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ja existe um cliente com este telefone nesta empresa." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Falha ao criar cliente." },
        { status: 500 }
      );
    }

    if (data) {
      await linkAppointmentsByPhone(body.businessId, data.id, phoneNormalized);
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
