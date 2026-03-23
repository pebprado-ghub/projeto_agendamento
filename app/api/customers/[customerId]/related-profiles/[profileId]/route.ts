import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePhoneDigits } from "@/lib/phone";

type Params = { params: { customerId: string; profileId: string } };
type PatchBody = {
  businessId: string;
  fullName?: string;
  relationship?: string | null;
  phone?: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const body = (await request.json()) as PatchBody;
    if (!body.businessId || !params.customerId || !params.profileId) {
      return NextResponse.json(
        { error: "businessId, customerId e profileId sao obrigatorios." },
        { status: 400 }
      );
    }
    const patch: Record<string, unknown> = {};
    if (typeof body.fullName === "string") patch.full_name = body.fullName.trim() || null;
    if (typeof body.relationship === "string" || body.relationship === null) {
      patch.relationship = body.relationship?.trim() || null;
    }
    if (typeof body.phone === "string" || body.phone === null) {
      patch.phone_normalized = body.phone ? normalizePhoneDigits(body.phone) : null;
    }
    if (typeof body.notes === "string" || body.notes === null) {
      patch.notes = body.notes?.trim() || null;
    }
    if (typeof body.isActive === "boolean") patch.is_active = body.isActive;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("customer_related_profiles")
      .update(patch)
      .eq("id", params.profileId)
      .eq("business_id", body.businessId)
      .eq("customer_id", params.customerId)
      .select(
        "id, full_name, relationship, phone_normalized, notes, is_active, created_at, updated_at"
      )
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Falha ao atualizar perfil relacionado." }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    if (!businessId || !params.customerId || !params.profileId) {
      return NextResponse.json(
        { error: "businessId, customerId e profileId sao obrigatorios." },
        { status: 400 }
      );
    }
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("customer_related_profiles")
      .delete()
      .eq("id", params.profileId)
      .eq("business_id", businessId)
      .eq("customer_id", params.customerId);
    if (error) {
      return NextResponse.json({ error: "Falha ao excluir perfil relacionado." }, { status: 500 });
    }
    return NextResponse.json({ message: "Perfil relacionado excluido." });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
