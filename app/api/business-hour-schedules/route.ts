import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getTodayYmdInTimezone,
  type BusinessHourValidityType
} from "@/lib/businessHourValidity";
import {
  mergeScheduleCoverage,
  findScheduleGaps,
  type ScheduleRangeRow
} from "@/lib/businessHourScheduleRanges";

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

    const { data: business } = await supabase
      .from("businesses")
      .select("timezone")
      .eq("id", businessId)
      .maybeSingle();

    const timezone = business?.timezone || "America/Sao_Paulo";
    const today = getTodayYmdInTimezone(timezone);

    const { data: rows, error } = await supabase
      .from("business_hour_schedules")
      .select("id, validity_type, valid_from, valid_to, created_at, updated_at")
      .eq("business_id", businessId)
      .order("valid_from", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Falha ao listar agendas." }, { status: 500 });
    }

    const list = (rows || []).map((r) => ({
      id: r.id,
      validityType: r.validity_type as BusinessHourValidityType,
      validFrom: r.valid_from,
      validTo: r.valid_to,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      isVigenteHoje:
        today >= r.valid_from && (!r.valid_to || today <= r.valid_to)
    }));

    const merged = mergeScheduleCoverage((rows || []) as ScheduleRangeRow[]);
    const scheduleGaps = findScheduleGaps(merged);

    return NextResponse.json({ data: list, today, scheduleGaps });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
