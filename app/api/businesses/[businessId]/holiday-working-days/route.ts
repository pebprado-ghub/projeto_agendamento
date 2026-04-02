import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = { params: { businessId: string } };

/** Datas em que a empresa atende mesmo sendo feriado (só informativo). */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const businessId = params.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "businessId e obrigatorio." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("business_holiday_working_days")
      .select("date_iso")
      .eq("business_id", businessId)
      .order("date_iso", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Falha ao carregar excecoes de feriado." },
        { status: 500 }
      );
    }

    const dates = (data || []).map((row) => row.date_iso as string);
    return NextResponse.json({ data: dates });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const businessId = params.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "businessId e obrigatorio." }, { status: 400 });
    }

    const body = (await request.json()) as { dateIso?: string };
    const raw = body.dateIso?.trim();
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return NextResponse.json({ error: "dateIso invalido (use YYYY-MM-DD)." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("business_holiday_working_days").upsert(
      { business_id: businessId, date_iso: raw },
      { onConflict: "business_id,date_iso" }
    );

    if (error) {
      return NextResponse.json(
        { error: "Falha ao salvar excecao de feriado." },
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

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const businessId = params.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "businessId e obrigatorio." }, { status: 400 });
    }

    const dateIso = request.nextUrl.searchParams.get("dateIso")?.trim();
    if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
      return NextResponse.json({ error: "dateIso invalido." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("business_holiday_working_days")
      .delete()
      .eq("business_id", businessId)
      .eq("date_iso", dateIso);

    if (error) {
      return NextResponse.json(
        { error: "Falha ao remover excecao de feriado." },
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
