import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveScheduleWeekday } from "@/lib/resolveScheduleWeekday";

type AvailabilityInput = {
  businessId: string;
  serviceId?: string;
  date: string;
  timezone?: string;
  slotDurationMinutes?: number;
};

type BusyRange = {
  start: string;
  end: string;
};

function toMinutes(time: string) {
  const [hh, mm] = time.slice(0, 5).split(":").map(Number);
  return hh * 60 + mm;
}

function toIsoDateInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function buildUtcBoundsForLocalDate(dateIso: string) {
  const timeMin = new Date(`${dateIso}T00:00:00.000Z`).toISOString();
  const timeMax = new Date(`${dateIso}T23:59:59.999Z`).toISOString();
  return { timeMin, timeMax };
}

async function refreshGoogleAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET sao obrigatorios."
    );
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    }).toString()
  });

  const result = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!response.ok || !result.access_token) {
    throw new Error(result.error || "Falha ao atualizar token do Google.");
  }

  return {
    accessToken: result.access_token,
    expiresIn: result.expires_in ?? 3600
  };
}

async function fetchGoogleEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
) {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
  );
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 401) {
    return { unauthorized: true, items: [] as BusyRange[] };
  }

  const result = (await response.json()) as {
    items?: Array<{
      start?: { dateTime?: string };
      end?: { dateTime?: string };
    }>;
  };

  if (!response.ok) {
    throw new Error("Falha ao consultar eventos do Google Calendar.");
  }

  const busyRanges: BusyRange[] = (result.items || [])
    .map((item) => ({
      start: item.start?.dateTime || "",
      end: item.end?.dateTime || ""
    }))
    .filter((item) => item.start && item.end);

  return { unauthorized: false, items: busyRanges };
}

function calculateAvailableSlots(
  dateIso: string,
  durationMinutes: number,
  windows: Array<{
    start_time: string;
    end_time: string;
    lunch_start_time?: string | null;
    lunch_end_time?: string | null;
  }>,
  busyRanges: BusyRange[],
  rules: {
    minNoticeMinutes: number;
    maxDaysAhead: number;
    slotCapacity: number;
  }
) {
  const busyMinutes = busyRanges.map((range) => ({
    start: toMinutes(range.start.slice(11, 16)),
    end: toMinutes(range.end.slice(11, 16))
  }));

  const slots: string[] = [];
  const now = new Date();
  const minAllowed = new Date(now.getTime() + rules.minNoticeMinutes * 60_000);
  const maxAllowed = new Date(now.getTime() + rules.maxDaysAhead * 24 * 60 * 60_000);

  windows.forEach((window) => {
    const windowsToProcess: Array<{ start: number; end: number }> = [];
    const startMin = toMinutes(window.start_time);
    const endMin = toMinutes(window.end_time);
    if (window.lunch_start_time && window.lunch_end_time) {
      const lunchStartMin = toMinutes(window.lunch_start_time);
      const lunchEndMin = toMinutes(window.lunch_end_time);
      windowsToProcess.push({ start: startMin, end: lunchStartMin });
      windowsToProcess.push({ start: lunchEndMin, end: endMin });
    } else {
      windowsToProcess.push({ start: startMin, end: endMin });
    }

    windowsToProcess.forEach((segment) => {
      for (
        let cursor = segment.start;
        cursor + durationMinutes <= segment.end;
        cursor += durationMinutes
      ) {
        const slotStart = cursor;
        const slotEnd = cursor + durationMinutes;
        const overlaps = busyMinutes.some(
          (busy) => slotStart < busy.end && slotEnd > busy.start
        );
        const concurrentCount = busyMinutes.filter(
          (busy) => slotStart < busy.end && slotEnd > busy.start
        ).length;
        if (!overlaps || concurrentCount < rules.slotCapacity) {
          const hh = String(Math.floor(slotStart / 60)).padStart(2, "0");
          const mm = String(slotStart % 60).padStart(2, "0");
          const slotIso = `${dateIso}T${hh}:${mm}:00`;
          const slotDate = new Date(`${slotIso}Z`);
          if (slotDate >= minAllowed && slotDate <= maxAllowed) {
            slots.push(slotIso);
          }
        }
      }
    });
  });

  return slots;
}

export async function POST(request: NextRequest) {
  try {
    const internalSecret = process.env.N8N_WEBHOOK_SECRET;
    if (internalSecret) {
      const secretHeader = request.headers.get("x-internal-secret");
      if (secretHeader !== internalSecret) {
        return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
      }
    }

    const body = (await request.json()) as AvailabilityInput;

    if (!body.businessId || !body.date) {
      return NextResponse.json(
        { error: "businessId e date sao obrigatorios." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select(
        "id, timezone, calendar_mode, city, state, booking_buffer_before_minutes, booking_buffer_after_minutes, booking_min_notice_minutes, booking_max_days_ahead, booking_daily_limit, booking_slot_capacity"
      )
      .eq("id", body.businessId)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: "Negocio nao encontrado." },
        { status: 404 }
      );
    }

    let durationMinutes = body.slotDurationMinutes || 30;
    if (body.serviceId) {
      const { data: service } = await supabase
        .from("services")
        .select("duration_minutes")
        .eq("id", body.serviceId)
        .eq("business_id", body.businessId)
        .single();

      if (service?.duration_minutes) {
        durationMinutes = service.duration_minutes;
      }
    }

    const timezone = body.timezone || business.timezone || "America/Sao_Paulo";

    const { data: liberatedRow } = await supabase
      .from("business_holiday_working_days")
      .select("date_iso")
      .eq("business_id", body.businessId)
      .eq("date_iso", body.date)
      .maybeSingle();

    const liberatedHolidayDates = new Set<string>();
    if (liberatedRow?.date_iso) {
      liberatedHolidayDates.add(body.date);
    }

    const scheduleWeekday = resolveScheduleWeekday({
      dateIso: body.date,
      timezone,
      uf: business.state as string | null | undefined,
      city: business.city as string | null | undefined,
      liberatedHolidayDates
    });

    const { data: hours } = await supabase
      .from("business_hours")
      .select("start_time, end_time, lunch_start_time, lunch_end_time")
      .eq("business_id", body.businessId)
      .eq("weekday", scheduleWeekday)
      .eq("is_active", true)
      .order("start_time", { ascending: true });

    const windows =
      hours && hours.length > 0
        ? hours
        : [{ start_time: "09:00:00", end_time: "18:00:00" }];

    let busyRanges: BusyRange[] = [];
    const { timeMin, timeMax } = buildUtcBoundsForLocalDate(body.date);

    const { data: internalAppointments } = await supabase
      .from("appointments")
      .select("starts_at, ends_at")
      .eq("business_id", body.businessId)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", timeMin)
      .lte("starts_at", timeMax);

    busyRanges = (internalAppointments || []).map((item) => ({
      start: item.starts_at,
      end: item.ends_at
    }));

    const calendarMode =
      business.calendar_mode === "google" ? "google" : "internal";

    if (calendarMode === "google") {
      const { data: calendarConnection } = await supabase
        .from("calendar_connections")
        .select("id, calendar_id, access_token, refresh_token")
        .eq("business_id", body.businessId)
        .eq("provider", "google")
        .single();

      if (calendarConnection?.access_token && calendarConnection?.calendar_id) {
        const firstFetch = await fetchGoogleEvents(
          calendarConnection.access_token,
          calendarConnection.calendar_id,
          timeMin,
          timeMax
        );

        if (!firstFetch.unauthorized) {
          busyRanges = [...busyRanges, ...firstFetch.items];
        } else if (calendarConnection.refresh_token) {
          const refreshed = await refreshGoogleAccessToken(
            calendarConnection.refresh_token
          );
          const tokenExpiresAt = new Date(
            Date.now() + refreshed.expiresIn * 1000
          ).toISOString();

          await supabase
            .from("calendar_connections")
            .update({
              access_token: refreshed.accessToken,
              token_expires_at: tokenExpiresAt
            })
            .eq("id", calendarConnection.id);

          const secondFetch = await fetchGoogleEvents(
            refreshed.accessToken,
            calendarConnection.calendar_id,
            timeMin,
            timeMax
          );
          busyRanges = [...busyRanges, ...secondFetch.items];
        }
      }
    }

    const bufferBefore = Math.max(0, Number(business.booking_buffer_before_minutes || 0));
    const bufferAfter = Math.max(0, Number(business.booking_buffer_after_minutes || 0));
    if (bufferBefore > 0 || bufferAfter > 0) {
      busyRanges = busyRanges.map((range) => {
        const start = new Date(range.start);
        const end = new Date(range.end);
        return {
          start: new Date(start.getTime() - bufferBefore * 60_000).toISOString(),
          end: new Date(end.getTime() + bufferAfter * 60_000).toISOString()
        };
      });
    }

    const dailyLimit = Number(business.booking_daily_limit || 0);
    if (dailyLimit > 0 && (internalAppointments || []).length >= dailyLimit) {
      return NextResponse.json({
        businessId: body.businessId,
        serviceId: body.serviceId || null,
        date: body.date,
        timezone,
        calendarMode,
        durationMinutes,
        windows,
        busyRanges,
        availableSlots: [],
        ruleBlockReason: "daily_limit_reached"
      });
    }

    const localDateIso = toIsoDateInTimezone(
      new Date(`${body.date}T12:00:00Z`),
      timezone
    );
    const availableSlots = calculateAvailableSlots(
      localDateIso,
      durationMinutes,
      windows,
      busyRanges,
      {
        minNoticeMinutes: Math.max(0, Number(business.booking_min_notice_minutes || 0)),
        maxDaysAhead: Math.max(1, Number(business.booking_max_days_ahead || 60)),
        slotCapacity: Math.max(1, Number(business.booking_slot_capacity || 1))
      }
    );

    return NextResponse.json({
      businessId: body.businessId,
      serviceId: body.serviceId || null,
      date: localDateIso,
      timezone,
      calendarMode,
      durationMinutes,
      windows,
      busyRanges,
      availableSlots
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
