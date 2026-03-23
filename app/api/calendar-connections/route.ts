import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type UpsertCalendarConnectionInput = {
  businessId: string;
  calendarId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
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
      .from("calendar_connections")
      .select(
        "id, business_id, provider, calendar_id, token_expires_at, updated_at"
      )
      .eq("business_id", businessId)
      .eq("provider", "google")
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Falha ao buscar conexao do calendario." },
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
    const body = (await request.json()) as UpsertCalendarConnectionInput;
    if (!body.businessId) {
      return NextResponse.json(
        { error: "businessId e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const payload = {
      business_id: body.businessId,
      provider: "google",
      calendar_id: body.calendarId?.trim() || "primary",
      access_token: body.accessToken?.trim() || null,
      refresh_token: body.refreshToken?.trim() || null,
      token_expires_at: body.tokenExpiresAt?.trim() || null
    };

    const { data, error } = await supabase
      .from("calendar_connections")
      .upsert(payload, { onConflict: "business_id,provider" })
      .select("id, business_id, provider, calendar_id, token_expires_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Falha ao salvar conexao do Google Calendar." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Conexao do Google Calendar salva com sucesso.",
      data
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
