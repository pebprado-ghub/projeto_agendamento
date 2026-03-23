import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: {
    businessId: string;
  };
};

type UpdateWhatsappInput = {
  whatsappNumber: string;
};

function normalizeWhatsapp(value: string) {
  return value.replace(/[^\d]/g, "");
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const adminKey = request.headers.get("x-admin-key") || "";
    const expectedAdminKey = process.env.ADMIN_PANEL_KEY || "";
    if (!expectedAdminKey) {
      return NextResponse.json(
        { error: "ADMIN_PANEL_KEY nao configurada no ambiente." },
        { status: 500 }
      );
    }
    if (adminKey !== expectedAdminKey) {
      return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
    }

    const businessId = params.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "businessId e obrigatorio." }, { status: 400 });
    }

    const body = (await request.json()) as UpdateWhatsappInput;
    const whatsappNumber = normalizeWhatsapp(body.whatsappNumber || "");
    if (!whatsappNumber) {
      return NextResponse.json(
        { error: "whatsappNumber e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("businesses")
      .update({ whatsapp_number: whatsappNumber })
      .eq("id", businessId)
      .select("id, name, whatsapp_number")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Falha ao salvar WhatsApp do cliente." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "WhatsApp do cliente atualizado com sucesso.",
      data
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
