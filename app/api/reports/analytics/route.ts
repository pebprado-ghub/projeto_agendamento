import { NextRequest, NextResponse } from "next/server";
import { formatSupabaseRouteError } from "@/lib/formatSupabaseRouteError";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveScheduleIdForDate } from "@/lib/resolveBusinessHourSchedule";

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end };
}

function countWeekdayOccurrences(year: number, month1to12: number, weekday0to6: number) {
  const daysInMonth = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const wd = new Date(Date.UTC(year, month1to12 - 1, day)).getUTCDay();
    if (wd === weekday0to6) count++;
  }
  return count;
}

function toHour(iso: string) {
  const d = new Date(iso);
  return d.getUTCHours();
}

function toWeekday(iso: string) {
  const d = new Date(iso);
  return d.getUTCDay();
}

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    const month = request.nextUrl.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    const inactiveDays = Math.max(
      30,
      Number(request.nextUrl.searchParams.get("inactiveDays") || 60)
    );
    const problematicRate = Math.max(
      0.2,
      Number(request.nextUrl.searchParams.get("problematicRate") || 0.4)
    );
    const problematicMinNoShow = Math.max(
      1,
      Number(request.nextUrl.searchParams.get("problematicMinNoShow") || 2)
    );

    if (!businessId) {
      return NextResponse.json({ error: "Parametro businessId e obrigatorio." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Parametro month invalido (use YYYY-MM)." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { start, end } = monthBounds(month);
    const [year, monthNumber] = month.split("-").map(Number);
    const midMonthIso = `${month}-15`;

    const [{ data: appts }, { data: services }, { data: customers }, { data: campaignEvents }] =
      await Promise.all([
        supabase
          .from("appointments")
          .select("id, service_id, customer_id, starts_at, status")
          .eq("business_id", businessId)
          .gte("starts_at", start.toISOString())
          .lte("starts_at", end.toISOString())
          .limit(10000),
        supabase.from("services").select("id, name, duration_minutes").eq("business_id", businessId).limit(2000),
        supabase
          .from("customers")
          .select("id, full_name, is_blocked")
          .eq("business_id", businessId)
          .limit(5000),
        supabase
          .from("campaign_events")
          .select("campaign_type, event_type, customer_id, happened_at")
          .eq("business_id", businessId)
          .gte("happened_at", start.toISOString())
          .lte("happened_at", end.toISOString())
          .limit(20000)
      ]);

    const analyticsScheduleId = await resolveScheduleIdForDate(
      supabase,
      businessId,
      midMonthIso
    );

    let hours: Array<{
      weekday: number;
      start_time: string;
      end_time: string;
      is_active: boolean;
    }> | null = null;
    if (analyticsScheduleId) {
      const { data: hourRows } = await supabase
        .from("business_hours")
        .select("weekday, start_time, end_time, is_active")
        .eq("business_id", businessId)
        .eq("schedule_id", analyticsScheduleId)
        .in("weekday", [0, 1, 2, 3, 4, 5, 6])
        .eq("is_active", true)
        .limit(200);
      hours = hourRows;
    }

    const servicesById = new Map((services || []).map((s) => [s.id, s]));
    const appointments = appts || [];
    const nonCancelled = appointments.filter((a) => a.status !== "cancelled");
    const concluded = nonCancelled.filter((a) => a.status === "completed" || a.status === "no_show");
    const noShows = nonCancelled.filter((a) => a.status === "no_show");

    const avgDuration =
      (services || []).length > 0
        ? Math.max(
            10,
            Math.round(
              (services || []).reduce((sum, s) => sum + Number(s.duration_minutes || 30), 0) /
                (services || []).length
            )
          )
        : 30;
    const slotStep = Math.max(15, Math.min(60, avgDuration));

    let availableSlots = 0;
    for (const h of hours || []) {
      const [sh, sm] = String(h.start_time).slice(0, 5).split(":").map(Number);
      const [eh, em] = String(h.end_time).slice(0, 5).split(":").map(Number);
      const mins = Math.max(0, eh * 60 + em - (sh * 60 + sm));
      const slotsPerDay = Math.floor(mins / slotStep);
      const occurrences = countWeekdayOccurrences(year, monthNumber, Number(h.weekday));
      availableSlots += slotsPerDay * occurrences;
    }
    const occupancyRate = availableSlots > 0 ? nonCancelled.length / availableSlots : 0;

    const peakByHour = new Map<number, number>();
    for (const a of nonCancelled) {
      const hour = toHour(a.starts_at);
      peakByHour.set(hour, (peakByHour.get(hour) || 0) + 1);
    }
    const peakHours = Array.from(peakByHour.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topServiceMap = new Map<string, number>();
    for (const a of nonCancelled) {
      const key = a.service_id || "without-service";
      topServiceMap.set(key, (topServiceMap.get(key) || 0) + 1);
    }
    const topServices = Array.from(topServiceMap.entries())
      .map(([serviceId, count]) => ({
        serviceId,
        serviceName:
          serviceId === "without-service"
            ? "Sem serviço vinculado"
            : servicesById.get(serviceId)?.name || "Serviço removido",
        soldCount: count
      }))
      .sort((a, b) => b.soldCount - a.soldCount)
      .slice(0, 10);

    const noShowByCustomer = new Map<string, { total: number; noShow: number }>();
    const noShowByWeekday = new Map<number, { total: number; noShow: number }>();
    const noShowByHour = new Map<number, { total: number; noShow: number }>();
    for (const a of concluded) {
      const cid = a.customer_id || "unknown";
      const wd = toWeekday(a.starts_at);
      const hr = toHour(a.starts_at);
      const isNoShow = a.status === "no_show";
      const c = noShowByCustomer.get(cid) || { total: 0, noShow: 0 };
      c.total += 1;
      if (isNoShow) c.noShow += 1;
      noShowByCustomer.set(cid, c);
      const w = noShowByWeekday.get(wd) || { total: 0, noShow: 0 };
      w.total += 1;
      if (isNoShow) w.noShow += 1;
      noShowByWeekday.set(wd, w);
      const h = noShowByHour.get(hr) || { total: 0, noShow: 0 };
      h.total += 1;
      if (isNoShow) h.noShow += 1;
      noShowByHour.set(hr, h);
    }

    const customerById = new Map((customers || []).map((c) => [c.id, c]));
    const problematicCustomers = Array.from(noShowByCustomer.entries())
      .map(([customerId, info]) => ({
        customerId,
        customerName: customerById.get(customerId)?.full_name || "Cliente sem vínculo",
        totalAppointments: info.total,
        noShowCount: info.noShow,
        noShowRate: info.total > 0 ? info.noShow / info.total : 0,
        isBlocked: Boolean(customerById.get(customerId)?.is_blocked)
      }))
      .filter((item) => item.noShowCount >= problematicMinNoShow && item.noShowRate >= problematicRate)
      .sort((a, b) => b.noShowRate - a.noShowRate)
      .slice(0, 100);

    const noShowByWeekdayList = Array.from(noShowByWeekday.entries())
      .map(([weekday, info]) => ({
        weekday,
        noShowRate: info.total > 0 ? info.noShow / info.total : 0,
        noShowCount: info.noShow,
        total: info.total
      }))
      .sort((a, b) => b.noShowRate - a.noShowRate);
    const noShowByHourList = Array.from(noShowByHour.entries())
      .map(([hour, info]) => ({
        hour,
        noShowRate: info.total > 0 ? info.noShow / info.total : 0,
        noShowCount: info.noShow,
        total: info.total
      }))
      .sort((a, b) => b.noShowRate - a.noShowRate);

    const demandByWeekdayHour = new Map<string, number>();
    for (const a of nonCancelled) {
      const key = `${toWeekday(a.starts_at)}-${toHour(a.starts_at)}`;
      demandByWeekdayHour.set(key, (demandByWeekdayHour.get(key) || 0) + 1);
    }
    const promoSuggestions = Array.from(demandByWeekdayHour.entries())
      .map(([key, count]) => {
        const [weekday, hour] = key.split("-").map(Number);
        return { weekday, hour, demandCount: count };
      })
      .sort((a, b) => a.demandCount - b.demandCount)
      .slice(0, 8)
      .map((item) => ({
        ...item,
        suggestion: "Baixa demanda detectada: considerar promoção ou pacote especial neste horário."
      }));

    const events = campaignEvents || [];
    const remarketingSent = events.filter(
      (e) => e.campaign_type === "remarketing" && e.event_type === "sent"
    ).length;
    const remarketingConverted = events.filter(
      (e) => e.campaign_type === "remarketing" && e.event_type === "converted"
    ).length;
    const newCustomerConverted = events.filter(
      (e) => e.campaign_type === "new_customer" && e.event_type === "converted"
    ).length;

    return NextResponse.json({
      data: {
        period: month,
        performance: {
          occupancyRate,
          availableSlots,
          bookedSlots: nonCancelled.length,
          peakHours,
          topServices
        },
        noShow: {
          overallRate: concluded.length > 0 ? noShows.length / concluded.length : 0,
          totalNoShow: noShows.length,
          totalConcluded: concluded.length,
          byCustomer: Array.from(noShowByCustomer.entries())
            .map(([customerId, info]) => ({
              customerId,
              customerName: customerById.get(customerId)?.full_name || "Cliente sem vínculo",
              noShowRate: info.total > 0 ? info.noShow / info.total : 0,
              noShowCount: info.noShow,
              total: info.total
            }))
            .sort((a, b) => b.noShowRate - a.noShowRate)
            .slice(0, 50),
          byWeekday: noShowByWeekdayList,
          byHour: noShowByHourList,
          problematicCustomers,
          preventionSuggestion:
            "Clientes com taxa alta de no-show podem ser bloqueados para novos agendamentos até contato manual."
        },
        demandForecast: {
          promoSuggestions
        },
        campaignRoi: {
          remarketing: {
            sent: remarketingSent,
            converted: remarketingConverted,
            conversionRate: remarketingSent > 0 ? remarketingConverted / remarketingSent : 0
          },
          newCustomers: {
            converted: newCustomerConverted
          },
          n8nReady: true,
          n8nExpectedEventEndpoint: "/api/campaign-events"
        },
        config: {
          inactiveDays,
          problematicRate,
          problematicMinNoShow
        }
      }
    });
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseRouteError(error) }, { status: 500 });
  }
}
