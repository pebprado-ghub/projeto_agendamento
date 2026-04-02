import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePhoneDigits } from "@/lib/phone";

const SELECT_FIELDS =
  "id, business_id, full_name, whatsapp_profile_name, phone_normalized, email, document_id, birth_date, gender, address_line, address_number, address_complement, neighborhood, city, state, postal_code, notes, preferences, restrictions, tags, is_vip, is_blocked, block_reason, source, marketing_opt_in, marketing_opt_in_at, created_at, updated_at";
const SELECT_FIELDS_LEGACY =
  "id, business_id, full_name, phone_normalized, email, document_id, birth_date, gender, address_line, address_number, address_complement, neighborhood, city, state, postal_code, notes, source, marketing_opt_in, created_at, updated_at";

type Params = { params: { customerId: string } };

type PatchBody = {
  businessId: string;
  fullName?: string;
  phone?: string;
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

async function linkAppointmentsByPhone(
  businessId: string,
  customerId: string,
  phoneNormalized: string
) {
  const supabase = getSupabaseAdmin();
  const { data: rows } = await supabase
    .from("appointments")
    .select("id, customer_phone")
    .eq("business_id", businessId)
    .is("customer_id", null)
    .limit(500);

  if (!rows?.length) return;

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

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const customerId = params.customerId;
    const businessId = request.nextUrl.searchParams.get("businessId");
    if (!customerId || !businessId) {
      return NextResponse.json(
        { error: "customerId e businessId sao obrigatorios." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("customers")
      .select(SELECT_FIELDS)
      .eq("id", customerId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!error && data) {
      return NextResponse.json({ data });
    }

    const missingColumnError =
      error?.code === "42703" || /column .* does not exist/i.test(error?.message || "");

    if (missingColumnError) {
      const { data: legacyData, error: legacyError } = await supabase
        .from("customers")
        .select(SELECT_FIELDS_LEGACY)
        .eq("id", customerId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (legacyError) {
        return NextResponse.json({ error: "Falha ao carregar cliente." }, { status: 500 });
      }
      if (!legacyData) {
        return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 });
      }
      return NextResponse.json({
        data: {
          ...legacyData,
          whatsapp_profile_name: null,
          preferences: null,
          restrictions: null,
          tags: [],
          is_vip: false,
          is_blocked: false,
          block_reason: null,
          marketing_opt_in_at: null
        }
      });
    }

    if (!data) {
      return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 });
    }
    return NextResponse.json({ error: "Falha ao carregar cliente." }, { status: 500 });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const customerId = params.customerId;
    const body = (await request.json()) as PatchBody;
    if (!customerId || !body.businessId) {
      return NextResponse.json(
        { error: "customerId e businessId sao obrigatorios." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: existing, error: exErr } = await supabase
      .from("customers")
      .select("id, phone_normalized")
      .eq("id", customerId)
      .eq("business_id", body.businessId)
      .maybeSingle();

    if (exErr || !existing) {
      return NextResponse.json({ error: "Cliente nao encontrado." }, { status: 404 });
    }

    const patch: Record<string, unknown> = {};

    if (body.fullName !== undefined) patch.full_name = body.fullName.trim();
    let newPhoneNorm = existing.phone_normalized;
    if (body.phone !== undefined) {
      newPhoneNorm = normalizePhoneDigits(body.phone);
      if (newPhoneNorm.length < 10) {
        return NextResponse.json(
          { error: "Telefone invalido (minimo 10 digitos)." },
          { status: 400 }
        );
      }
      patch.phone_normalized = newPhoneNorm;
    }
    if (body.email !== undefined) patch.email = body.email?.trim() || null;
    if (body.documentId !== undefined) {
      patch.document_id = body.documentId?.replace(/\D/g, "") || null;
    }
    if (body.birthDate !== undefined) patch.birth_date = body.birthDate || null;
    if (body.gender !== undefined) patch.gender = body.gender?.trim() || null;
    if (body.addressLine !== undefined) {
      patch.address_line = body.addressLine?.trim() || null;
    }
    if (body.addressNumber !== undefined) {
      patch.address_number = body.addressNumber?.trim() || null;
    }
    if (body.addressComplement !== undefined) {
      patch.address_complement = body.addressComplement?.trim() || null;
    }
    if (body.neighborhood !== undefined) {
      patch.neighborhood = body.neighborhood?.trim() || null;
    }
    if (body.city !== undefined) patch.city = body.city?.trim() || null;
    if (body.state !== undefined) patch.state = body.state?.trim() || null;
    if (body.postalCode !== undefined) {
      patch.postal_code = body.postalCode?.replace(/\D/g, "") || null;
    }
    if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;
    if (body.preferences !== undefined) patch.preferences = body.preferences?.trim() || null;
    if (body.restrictions !== undefined) patch.restrictions = body.restrictions?.trim() || null;
    if (body.tags !== undefined) {
      patch.tags = Array.isArray(body.tags)
        ? body.tags.map((t) => (t || "").trim()).filter(Boolean)
        : [];
    }
    if (body.isVip !== undefined) patch.is_vip = Boolean(body.isVip);
    if (body.isBlocked !== undefined) patch.is_blocked = Boolean(body.isBlocked);
    if (body.blockReason !== undefined) patch.block_reason = body.blockReason?.trim() || null;
    if (body.source !== undefined) {
      const allowed = ["manual", "whatsapp", "import", "campaign", "other"] as const;
      if (!allowed.includes(body.source as (typeof allowed)[number])) {
        return NextResponse.json({ error: "Origem invalida." }, { status: 400 });
      }
      patch.source = body.source;
    }
    if (body.marketingOptIn !== undefined) {
      const v = Boolean(body.marketingOptIn);
      patch.marketing_opt_in = v;
      patch.marketing_opt_in_at = v ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from("customers")
      .update(patch)
      .eq("id", customerId)
      .eq("business_id", body.businessId)
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ja existe um cliente com este telefone nesta empresa." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Falha ao atualizar cliente." }, { status: 500 });
    }

    if (data && body.phone !== undefined) {
      await linkAppointmentsByPhone(body.businessId, customerId, newPhoneNorm);
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const customerId = params.customerId;
    const businessId = request.nextUrl.searchParams.get("businessId");
    if (!customerId || !businessId) {
      return NextResponse.json(
        { error: "customerId e businessId sao obrigatorios." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customerId)
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json(
        { error: "Falha ao excluir cliente." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
