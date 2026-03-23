import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type UpsertConversationInput = {
  businessId: string;
  customerPhone: string;
  state: string;
  context?: Record<string, unknown>;
};

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    const customerPhone = request.nextUrl.searchParams.get("customerPhone");

    if (!businessId || !customerPhone) {
      return NextResponse.json(
        { error: "Parametros businessId e customerPhone sao obrigatorios." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("conversation_state")
      .select("id, state, context, updated_at")
      .eq("business_id", businessId)
      .eq("customer_phone", customerPhone)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Falha ao carregar estado da conversa." },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || null });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UpsertConversationInput;

    if (!body.businessId || !body.customerPhone || !body.state?.trim()) {
      return NextResponse.json(
        { error: "businessId, customerPhone e state sao obrigatorios." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("conversation_state")
      .upsert(
        {
          business_id: body.businessId,
          customer_phone: body.customerPhone,
          state: body.state.trim(),
          context: body.context ?? {}
        },
        { onConflict: "business_id,customer_phone" }
      )
      .select("id, state, context, updated_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Falha ao salvar estado da conversa." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Estado atualizado.", data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
