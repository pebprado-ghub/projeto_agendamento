import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type UpdateModeInput = {
  calendarMode: "internal" | "google";
};

type Params = {
  params: {
    businessId: string;
  };
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const body = (await request.json()) as UpdateModeInput;
    const businessId = params.businessId;

    if (!businessId) {
      return NextResponse.json({ error: "businessId e obrigatorio." }, { status: 400 });
    }

    if (body.calendarMode !== "internal" && body.calendarMode !== "google") {
      return NextResponse.json(
        { error: "calendarMode deve ser internal ou google." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("businesses")
      .update({ calendar_mode: body.calendarMode })
      .eq("id", businessId)
      .select("id, calendar_mode")
      .single();

    if (error) {
      return NextResponse.json({ error: "Falha ao atualizar modo." }, { status: 500 });
    }

    return NextResponse.json({ message: "Modo de agenda atualizado.", data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
