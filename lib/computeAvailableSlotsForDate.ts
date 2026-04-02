import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buffersFromBusiness,
  buffersFromServiceOrBusiness,
  expandRangeWithBuffers
} from "@/lib/bookingBuffers";
import { resolveScheduleWeekday } from "@/lib/resolveScheduleWeekday";
import { resolveScheduleIdForDate } from "@/lib/resolveBusinessHourSchedule";

export type ComputeSlotsInput = {
  businessId: string;
  date: string;
  serviceId?: string;
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

export function toIsoDateInTimezone(date: Date, timezone: string) {
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
    const segment = {
      start: toMinutes(window.start_time),
      end: toMinutes(window.end_time)
    };
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

  return slots;
}

export type ComputeSlotsResult = {
  businessId: string;
  serviceId: string | null;
  date: string;
  timezone: string;
  calendarMode: string;
  durationMinutes: number;
  windows: Array<{ start_time: string; end_time: string }>;
  busyRanges: BusyRange[];
  availableSlots: string[];
  ruleBlockReason?: string;
};

export async function computeAvailableSlotsForDate(
  supabase: SupabaseClient,
  input: ComputeSlotsInput
): Promise<ComputeSlotsResult> {
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select(
      "id, timezone, calendar_mode, city, state, booking_buffer_before_minutes, booking_buffer_after_minutes, booking_min_notice_minutes, booking_max_days_ahead, booking_daily_limit, booking_slot_capacity"
    )
    .eq("id", input.businessId)
    .single();

  if (businessError || !business) {
    throw new Error("Empresa nao encontrada.");
  }

  const businessBufferPair = buffersFromBusiness(business);

  let durationMinutes = input.slotDurationMinutes || 30;
  let serviceRow:
    | {
        duration_minutes: number;
        booking_buffer_before_minutes: number;
        booking_buffer_after_minutes: number;
        booking_min_notice_minutes: number;
        booking_max_days_ahead: number;
        booking_daily_limit: number | null;
        booking_slot_capacity: number;
      }
    | null = null;

  if (input.serviceId) {
    const { data: service } = await supabase
      .from("services")
      .select(
        "duration_minutes, booking_buffer_before_minutes, booking_buffer_after_minutes, booking_min_notice_minutes, booking_max_days_ahead, booking_daily_limit, booking_slot_capacity"
      )
      .eq("id", input.serviceId)
      .eq("business_id", input.businessId)
      .single();

    if (service?.duration_minutes) {
      durationMinutes = service.duration_minutes;
    }
    if (service) {
      serviceRow = service;
    }
  }

  const minNoticeMinutes = Math.max(
    0,
    Number(
      (serviceRow?.booking_min_notice_minutes ?? business.booking_min_notice_minutes) || 0
    )
  );
  const maxDaysAhead = Math.max(
    1,
    Number((serviceRow?.booking_max_days_ahead ?? business.booking_max_days_ahead) || 60)
  );
  const slotCapacity = Math.max(
    1,
    Number((serviceRow?.booking_slot_capacity ?? business.booking_slot_capacity) || 1)
  );
  const dailyLimitRaw = serviceRow?.booking_daily_limit ?? business.booking_daily_limit;
  const dailyLimit = Number(dailyLimitRaw || 0);

  const timezone = input.timezone || business.timezone || "America/Sao_Paulo";

  const { data: liberatedRow } = await supabase
    .from("business_holiday_working_days")
    .select("date_iso")
    .eq("business_id", input.businessId)
    .eq("date_iso", input.date)
    .maybeSingle();

  const liberatedHolidayDates = new Set<string>();
  if (liberatedRow?.date_iso) {
    liberatedHolidayDates.add(input.date);
  }

  const scheduleWeekday = resolveScheduleWeekday({
    dateIso: input.date,
    timezone,
    uf: business.state as string | null | undefined,
    city: business.city as string | null | undefined,
    liberatedHolidayDates
  });

  const hourScheduleId = await resolveScheduleIdForDate(
    supabase,
    input.businessId,
    input.date
  );

  let hours: { start_time: string; end_time: string }[] | null = null;
  if (hourScheduleId) {
    const { data } = await supabase
      .from("business_hours")
      .select("start_time, end_time")
      .eq("business_id", input.businessId)
      .eq("schedule_id", hourScheduleId)
      .eq("weekday", scheduleWeekday)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("start_time", { ascending: true });
    hours = data;
  }

  const windows =
    hours && hours.length > 0
      ? hours
      : [{ start_time: "09:00:00", end_time: "18:00:00" }];

  let busyRanges: BusyRange[] = [];
  const { timeMin, timeMax } = buildUtcBoundsForLocalDate(input.date);

  const { data: internalAppointments } = await supabase
    .from("appointments")
    .select("starts_at, ends_at, service_id")
    .eq("business_id", input.businessId)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", timeMin)
    .lte("starts_at", timeMax);

  const serviceIdsForBuffers = [
    ...new Set(
      (internalAppointments || [])
        .map((r) => r.service_id as string | null)
        .filter((id): id is string => Boolean(id))
    )
  ];
  let serviceBufferById = new Map<
    string,
    { booking_buffer_before_minutes: number; booking_buffer_after_minutes: number }
  >();
  if (serviceIdsForBuffers.length > 0) {
    const { data: svcRows } = await supabase
      .from("services")
      .select("id, booking_buffer_before_minutes, booking_buffer_after_minutes")
      .eq("business_id", input.businessId)
      .in("id", serviceIdsForBuffers);
    serviceBufferById = new Map(
      (svcRows || []).map((s) => [
        s.id as string,
        {
          booking_buffer_before_minutes: Number(s.booking_buffer_before_minutes || 0),
          booking_buffer_after_minutes: Number(s.booking_buffer_after_minutes || 0)
        }
      ])
    );
  }

  busyRanges = (internalAppointments || []).map((item) => {
    const sid = item.service_id as string | null;
    const pair = buffersFromServiceOrBusiness(
      sid ? serviceBufferById.get(sid) : undefined,
      businessBufferPair
    );
    const ex = expandRangeWithBuffers(item.starts_at as string, item.ends_at as string, pair);
    return { start: ex.start, end: ex.end };
  });

  const { data: closureRows } = await supabase
    .from("business_closure_periods")
    .select("starts_at, ends_at")
    .eq("business_id", input.businessId)
    .lt("starts_at", timeMax)
    .gt("ends_at", timeMin);

  const dayStartMs = new Date(timeMin).getTime();
  const dayEndMs = new Date(timeMax).getTime();
  for (const c of closureRows || []) {
    const cs = new Date(c.starts_at as string).getTime();
    const ce = new Date(c.ends_at as string).getTime();
    const blockStart = Math.max(cs, dayStartMs);
    const blockEnd = Math.min(ce, dayEndMs);
    if (blockStart < blockEnd) {
      busyRanges.push({
        start: new Date(blockStart).toISOString(),
        end: new Date(blockEnd).toISOString()
      });
    }
  }

  const calendarMode =
    business.calendar_mode === "google" ? "google" : "internal";

  if (calendarMode === "google") {
    const { data: calendarConnection } = await supabase
      .from("calendar_connections")
      .select("id, calendar_id, access_token, refresh_token")
      .eq("business_id", input.businessId)
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

  if (dailyLimit > 0) {
    const apptsForLimit = input.serviceId
      ? (internalAppointments || []).filter((a) => a.service_id === input.serviceId)
      : internalAppointments || [];
    if (apptsForLimit.length >= dailyLimit) {
      const localDateIsoBlocked = toIsoDateInTimezone(
        new Date(`${input.date}T12:00:00Z`),
        timezone
      );
      return {
        businessId: input.businessId,
        serviceId: input.serviceId || null,
        date: localDateIsoBlocked,
        timezone,
        calendarMode,
        durationMinutes,
        windows,
        busyRanges,
        availableSlots: [],
        ruleBlockReason: "daily_limit_reached"
      };
    }
  }

  const localDateIso = toIsoDateInTimezone(
    new Date(`${input.date}T12:00:00Z`),
    timezone
  );
  const availableSlots = calculateAvailableSlots(
    localDateIso,
    durationMinutes,
    windows,
    busyRanges,
    {
      minNoticeMinutes,
      maxDaysAhead,
      slotCapacity
    }
  );

  return {
    businessId: input.businessId,
    serviceId: input.serviceId || null,
    date: localDateIso,
    timezone,
    calendarMode,
    durationMinutes,
    windows,
    busyRanges,
    availableSlots
  };
}
