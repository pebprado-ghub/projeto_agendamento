import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  computeValidityRange,
  getTodayYmdInTimezone,
  getYesterdayYmdInTimezone,
  isBusinessHourValidityType
} from "@/lib/businessHourValidity";
import { resolveScheduleIdForDate } from "@/lib/resolveBusinessHourSchedule";
import {
  listOverlappingSchedules,
  summarizeOverlaps,
  type ScheduleRangeRow
} from "@/lib/businessHourScheduleRanges";
import { applyScheduleOverlapResolution } from "@/lib/applyBusinessHourScheduleOverlap";

type ShiftInput = {
  startTime: string;
  endTime: string;
};

type DayHoursInput = {
  weekday: number;
  isActive: boolean;
  shifts: ShiftInput[];
};

type UpsertHoursInput = {
  businessId: string;
  scheduleId?: string | null;
  validityType: string;
  customValidFrom?: string | null;
  customValidTo?: string | null;
  hours: DayHoursInput[];
  /** Se true, encerra/ajusta vigências de outras agendas que cruzam o novo período. */
  confirmOverlapResolution?: boolean;
};

function normalizeTimeToHms(value: string): string {
  const s = value.trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  throw new Error(`Horario invalido: ${value}`);
}

function toMinutesFromHms(time: string): number {
  const [h, m] = time.slice(0, 8).split(":").map(Number);
  return h * 60 + m;
}

function validateShiftsForDay(day: DayHoursInput): string | null {
  if (!Array.isArray(day.shifts)) {
    return "Cada dia deve incluir a lista shifts (turnos).";
  }
  if (!day.isActive) {
    return null;
  }
  if (day.shifts.length < 1) {
    return "Dias ativos precisam de pelo menos um turno.";
  }
  const normalized = day.shifts.map((s) => ({
    start: normalizeTimeToHms(s.startTime),
    end: normalizeTimeToHms(s.endTime)
  }));
  for (const s of normalized) {
    if (!(s.start < s.end)) {
      return "Cada turno deve ter horario de inicio antes do fim.";
    }
  }
  const sorted = [...normalized].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < sorted.length - 1; i++) {
    const endI = toMinutesFromHms(sorted[i].end);
    const startNext = toMinutesFromHms(sorted[i + 1].start);
    if (endI > startNext) {
      return "Turnos no mesmo dia nao podem se sobrepor.";
    }
  }
  return null;
}

async function closeOtherOpenIndeterminateSchedules(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  businessId: string,
  exceptId: string,
  yesterdayYmd: string
) {
  await supabase
    .from("business_hour_schedules")
    .update({ valid_to: yesterdayYmd, updated_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("validity_type", "indeterminate")
    .is("valid_to", null)
    .neq("id", exceptId);
}

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json(
        { error: "Parametro businessId e obrigatorio." },
        { status: 400 }
      );
    }

    const scheduleIdParam = request.nextUrl.searchParams.get("scheduleId");
    const forDate = request.nextUrl.searchParams.get("forDate");

    const supabase = getSupabaseAdmin();

    const { data: business, error: bizErr } = await supabase
      .from("businesses")
      .select("timezone")
      .eq("id", businessId)
      .maybeSingle();

    if (bizErr) {
      return NextResponse.json({ error: "Falha ao carregar empresa." }, { status: 500 });
    }

    const timezone = business?.timezone || "America/Sao_Paulo";
    const today = getTodayYmdInTimezone(timezone);

    let targetScheduleId = scheduleIdParam;
    if (!targetScheduleId && forDate) {
      targetScheduleId = await resolveScheduleIdForDate(supabase, businessId, forDate);
    }
    if (!targetScheduleId) {
      targetScheduleId = await resolveScheduleIdForDate(supabase, businessId, today);
    }

    if (!targetScheduleId) {
      return NextResponse.json({ data: [], schedule: null });
    }

    const { data: sched, error: schedErr } = await supabase
      .from("business_hour_schedules")
      .select("id, validity_type, valid_from, valid_to")
      .eq("id", targetScheduleId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (schedErr || !sched) {
      return NextResponse.json({ data: [], schedule: null });
    }

    const { data, error } = await supabase
      .from("business_hours")
      .select(
        "id, weekday, start_time, end_time, lunch_start_time, lunch_end_time, is_active, sort_order"
      )
      .eq("business_id", businessId)
      .eq("schedule_id", targetScheduleId)
      .order("weekday", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Falha ao carregar horarios de atendimento." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: data || [],
      schedule: {
        id: sched.id,
        validity_type: sched.validity_type,
        valid_from: sched.valid_from,
        valid_to: sched.valid_to
      }
    });
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

    if (!isBusinessHourValidityType(body.validityType)) {
      return NextResponse.json(
        { error: "validityType invalido (indeterminate, monthly, annual, custom)." },
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
      const err = validateShiftsForDay(day);
      if (err) {
        return NextResponse.json({ error: err }, { status: 400 });
      }
    }

    if (seen.size !== 8) {
      return NextResponse.json(
        { error: "Informe exatamente uma linha para cada weekday de 0 a 7." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: bizRow, error: bizErr } = await supabase
      .from("businesses")
      .select("timezone")
      .eq("id", body.businessId)
      .single();

    if (bizErr || !bizRow) {
      return NextResponse.json({ error: "Empresa nao encontrada." }, { status: 404 });
    }

    const timezone = bizRow.timezone || "America/Sao_Paulo";
    const yesterdayYmd = getYesterdayYmdInTimezone(timezone);

    const existingScheduleId =
      typeof body.scheduleId === "string" && body.scheduleId.length > 0
        ? body.scheduleId
        : null;

    let prospectiveFrom: string;
    let prospectiveTo: string | null;

    if (existingScheduleId) {
      const { data: existing, error: exErr } = await supabase
        .from("business_hour_schedules")
        .select("id, validity_type, valid_from, valid_to")
        .eq("id", existingScheduleId)
        .eq("business_id", body.businessId)
        .single();

      if (exErr || !existing) {
        return NextResponse.json({ error: "Agenda nao encontrada." }, { status: 404 });
      }

      let valid_from = existing.valid_from as string;
      let valid_to = (existing.valid_to as string | null) ?? null;

      const typeChanged = existing.validity_type !== body.validityType;
      const fromTrim = (body.customValidFrom || "").trim();
      const toTrim = (body.customValidTo || "").trim();
      const customChanged =
        body.validityType === "custom" &&
        (fromTrim !== valid_from || toTrim !== (valid_to ?? ""));

      const mustRecompute = typeChanged || customChanged;

      if (mustRecompute) {
        if (body.validityType === "indeterminate") {
          await closeOtherOpenIndeterminateSchedules(
            supabase,
            body.businessId,
            existing.id,
            yesterdayYmd
          );
        }
        try {
          const r = computeValidityRange({
            type: body.validityType,
            timezone,
            customValidFrom: body.customValidFrom,
            customValidTo: body.customValidTo
          });
          valid_from = r.valid_from;
          valid_to = r.valid_to;
        } catch (e) {
          return NextResponse.json(
            { error: (e as Error).message },
            { status: 400 }
          );
        }
      }

      prospectiveFrom = valid_from;
      prospectiveTo = valid_to;
    } else {
      if (body.validityType === "indeterminate") {
        await supabase
          .from("business_hour_schedules")
          .update({ valid_to: yesterdayYmd, updated_at: new Date().toISOString() })
          .eq("business_id", body.businessId)
          .eq("validity_type", "indeterminate")
          .is("valid_to", null);
      }

      try {
        const r = computeValidityRange({
          type: body.validityType,
          timezone,
          customValidFrom: body.customValidFrom,
          customValidTo: body.customValidTo
        });
        prospectiveFrom = r.valid_from;
        prospectiveTo = r.valid_to;
      } catch (e) {
        return NextResponse.json(
          { error: (e as Error).message },
          { status: 400 }
        );
      }
    }

    const { data: allRangeRows, error: rangeErr } = await supabase
      .from("business_hour_schedules")
      .select("id, validity_type, valid_from, valid_to")
      .eq("business_id", body.businessId);

    if (rangeErr) {
      return NextResponse.json(
        { error: "Falha ao verificar vigencias." },
        { status: 500 }
      );
    }

    const ranges = (allRangeRows || []) as ScheduleRangeRow[];
    const overlaps = listOverlappingSchedules(
      ranges,
      prospectiveFrom,
      prospectiveTo,
      existingScheduleId
    );
    const confirmOverlap = Boolean(body.confirmOverlapResolution);

    if (overlaps.length > 0 && !confirmOverlap) {
      return NextResponse.json(
        {
          overlapConflict: true,
          message:
            "Ja existe outra agenda cuja vigencia se cruza com este periodo. Se confirmar, as agendas afetadas terao a vigencia encurtada ou trechos removidos, e esta configuracao passara a valer nos dias em conflito.",
          newRange: {
            validFrom: prospectiveFrom,
            validTo: prospectiveTo
          },
          overlapping: summarizeOverlaps(overlaps)
        },
        { status: 409 }
      );
    }

    if (overlaps.length > 0 && confirmOverlap) {
      try {
        await applyScheduleOverlapResolution(
          supabase,
          body.businessId,
          prospectiveFrom,
          prospectiveTo,
          existingScheduleId
        );
      } catch (e) {
        return NextResponse.json(
          { error: (e as Error).message },
          { status: 500 }
        );
      }
    }

    let scheduleId: string;

    if (existingScheduleId) {
      const { error: updSchedErr } = await supabase
        .from("business_hour_schedules")
        .update({
          validity_type: body.validityType,
          valid_from: prospectiveFrom,
          valid_to: prospectiveTo,
          updated_at: new Date().toISOString()
        })
        .eq("id", existingScheduleId);

      if (updSchedErr) {
        return NextResponse.json(
          { error: "Falha ao atualizar vigencia da agenda." },
          { status: 500 }
        );
      }

      scheduleId = existingScheduleId;

      const { error: delErr } = await supabase
        .from("business_hours")
        .delete()
        .eq("schedule_id", scheduleId);

      if (delErr) {
        return NextResponse.json(
          { error: "Falha ao atualizar horarios (etapa limpeza)." },
          { status: 500 }
        );
      }
    } else {
      const { data: ins, error: insErr } = await supabase
        .from("business_hour_schedules")
        .insert({
          business_id: body.businessId,
          validity_type: body.validityType,
          valid_from: prospectiveFrom,
          valid_to: prospectiveTo
        })
        .select("id")
        .single();

      if (insErr || !ins) {
        return NextResponse.json(
          { error: "Falha ao criar agenda de horarios." },
          { status: 500 }
        );
      }

      scheduleId = ins.id as string;
    }

    const rows: Array<{
      business_id: string;
      schedule_id: string;
      weekday: number;
      start_time: string;
      end_time: string;
      lunch_start_time: null;
      lunch_end_time: null;
      is_active: boolean;
      sort_order: number;
    }> = [];

    for (const day of body.hours) {
      if (!day.isActive) {
        rows.push({
          business_id: body.businessId,
          schedule_id: scheduleId,
          weekday: day.weekday,
          start_time: "09:00:00",
          end_time: "18:00:00",
          lunch_start_time: null,
          lunch_end_time: null,
          is_active: false,
          sort_order: 0
        });
        continue;
      }
      day.shifts.forEach((shift, index) => {
        rows.push({
          business_id: body.businessId,
          schedule_id: scheduleId,
          weekday: day.weekday,
          start_time: normalizeTimeToHms(shift.startTime),
          end_time: normalizeTimeToHms(shift.endTime),
          lunch_start_time: null,
          lunch_end_time: null,
          is_active: true,
          sort_order: index
        });
      });
    }

    const { error: insertError } = await supabase.from("business_hours").insert(rows);

    if (insertError) {
      return NextResponse.json(
        { error: "Falha ao salvar horarios de atendimento." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Horarios de atendimento salvos com sucesso.",
      scheduleId
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
