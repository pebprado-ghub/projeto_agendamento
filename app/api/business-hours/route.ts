import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type BusinessHourInput = {
  weekday: number;
  startTime: string;
  endTime: string;
  lunchStartTime?: string | null;
  lunchEndTime?: string | null;
  isActive: boolean;
};

type UpsertHoursInput = {
  businessId: string;
  hours: BusinessHourInput[];
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
      .from("business_hours")
      .select("id, weekday, start_time, end_time, lunch_start_time, lunch_end_time, is_active")
      .eq("business_id", businessId)
      .order("weekday", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Falha ao carregar horarios de atendimento." },
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
    const body = (await request.json()) as UpsertHoursInput;
    if (!body.businessId) {
      return NextResponse.json(
        { error: "businessId e obrigatorio." },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.hours) || body.hours.length !== 8) {
      return NextResponse.json(
        { error: "Envie 8 linhas de horario (domingo a sabado + feriados)." },
        { status: 400 }
      );
    }

    const seen = new Set<number>();
    for (const day of body.hours) {
      if (day.weekday < 0 || day.weekday > 7) {
        return NextResponse.json(
          { error: "weekday deve estar entre 0 e 7 (7 = feriados)." },
          { status: 400 }
        );
      }
      if (seen.has(day.weekday)) {
        return NextResponse.json(
          { error: "weekday duplicado na lista de horarios." },
          { status: 400 }
        );
      }
      seen.add(day.weekday);
      if (day.isActive && (!day.startTime || !day.endTime)) {
        return NextResponse.json(
          { error: "Dias ativos exigem startTime e endTime." },
          { status: 400 }
        );
      }
      if ((day.lunchStartTime && !day.lunchEndTime) || (!day.lunchStartTime && day.lunchEndTime)) {
        return NextResponse.json(
          { error: "Informe lunchStartTime e lunchEndTime juntos." },
          { status: 400 }
        );
      }
      if (day.lunchStartTime && day.lunchEndTime) {
        if (!day.isActive) {
          return NextResponse.json(
            { error: "Intervalo de almoco so pode ser usado em dias ativos." },
            { status: 400 }
          );
        }
        if (!(day.startTime < day.lunchStartTime && day.lunchEndTime < day.endTime)) {
          return NextResponse.json(
            {
              error:
                "Intervalo de almoco deve estar dentro do horario de atendimento."
            },
            { status: 400 }
          );
        }
      }
    }

    if (seen.size !== 8) {
      return NextResponse.json(
        { error: "Informe exatamente uma linha para cada weekday de 0 a 7." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error: deleteError } = await supabase
      .from("business_hours")
      .delete()
      .eq("business_id", body.businessId);

    if (deleteError) {
      return NextResponse.json(
        { error: "Falha ao atualizar horarios (etapa limpeza)." },
        { status: 500 }
      );
    }

    const rows = body.hours.map((day) => ({
      business_id: body.businessId,
      weekday: day.weekday,
      start_time: day.startTime || "09:00:00",
      end_time: day.endTime || "18:00:00",
      lunch_start_time: day.lunchStartTime || null,
      lunch_end_time: day.lunchEndTime || null,
      is_active: day.isActive
    }));

    const { error: insertError } = await supabase
      .from("business_hours")
      .insert(rows);

    if (insertError) {
      return NextResponse.json(
        { error: "Falha ao salvar horarios de atendimento." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Horarios de atendimento salvos com sucesso."
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
