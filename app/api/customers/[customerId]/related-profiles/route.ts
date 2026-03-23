import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePhoneDigits } from "@/lib/phone";

type Params = { params: { customerId: string } };
type Body = {
  businessId: string;
  fullName: string;
  relationship?: string | null;
  phone?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    if (!businessId || !params.customerId) {
      return NextResponse.json(
        { error: "businessId e customerId sao obrigatorios." },
        { status: 400 }
      );
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("customer_related_profiles")
      .select(
        "id, full_name, relationship, phone_normalized, notes, is_active, created_at, updated_at"
      )
      .eq("business_id", businessId)
      .eq("customer_id", params.customerId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      return NextResponse.json({ error: "Falha ao listar perfis relacionados." }, { status: 500 });
    }
    return NextResponse.json({ data: data || [] });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const body = (await request.json()) as Body;
    if (!body.businessId || !params.customerId || !body.fullName?.trim()) {
      return NextResponse.json(
        { error: "businessId, customerId e fullName sao obrigatorios." },
        { status: 400 }
      );
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("customer_related_profiles")
      .insert({
        business_id: body.businessId,
        customer_id: params.customerId,
        full_name: body.fullName.trim(),
        relationship: body.relationship?.trim() || null,
        phone_normalized: body.phone ? normalizePhoneDigits(body.phone) : null,
        notes: body.notes?.trim() || null,
        is_active: body.isActive !== false
      })
      .select(
        "id, full_name, relationship, phone_normalized, notes, is_active, created_at, updated_at"
      )
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Falha ao criar perfil relacionado." }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
