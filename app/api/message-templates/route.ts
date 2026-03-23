import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type MessageTemplateInput = {
  code: string;
  content: string;
  isActive?: boolean;
};

type UpsertTemplatesInput = {
  businessId: string;
  templates: MessageTemplateInput[];
};

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json(
        { error: "Parametro businessId e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("message_templates")
      .select("id, business_id, code, content, is_active")
      .eq("business_id", businessId)
      .order("code", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Falha ao carregar templates de mensagem." },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UpsertTemplatesInput;
    if (!body.businessId) {
      return NextResponse.json(
        { error: "businessId e obrigatorio." },
        { status: 400 }
      );
    }
    if (!Array.isArray(body.templates) || body.templates.length === 0) {
      return NextResponse.json(
        { error: "Informe ao menos um template para salvar." },
        { status: 400 }
      );
    }

    const rows = body.templates
      .map((item) => ({
        business_id: body.businessId,
        code: (item.code || "").trim().toUpperCase(),
        content: (item.content || "").trim(),
        is_active: item.isActive ?? true
      }))
      .filter((item) => item.code && item.content);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Nenhum template valido para salvar." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("message_templates")
      .upsert(rows, { onConflict: "business_id,code" });

    if (error) {
      return NextResponse.json(
        { error: "Falha ao salvar templates de mensagem." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Templates de mensagem salvos com sucesso."
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
