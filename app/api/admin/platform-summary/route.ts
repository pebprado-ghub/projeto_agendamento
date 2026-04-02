import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeSessionRole } from "@/lib/authRoles";

type BusinessRow = {
  id: string;
  name: string;
  slug: string;
  calendar_mode: string | null;
};

type BusinessMetrics = {
  id: string;
  name: string;
  slug: string;
  calendarMode: "internal" | "google" | null;
  customerCount: number;
  serviceCount: number;
  appointmentCount: number;
  appointmentsThisMonth: number;
  upcomingAppointmentCount: number;
};

export async function GET(_request: NextRequest) {
  const raw = _request.cookies.get("session_role")?.value;
  if (normalizeSessionRole(raw) !== "developer") {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)
    );
    const monthStartIso = monthStart.toISOString();
    const monthEndIso = monthEnd.toISOString();
    const nowIso = now.toISOString();

    const [
      bizResult,
      businessesGoogle,
      appointmentsAll,
      appointmentsMonth,
      customersAll,
      servicesAll,
      upcoming,
      customerRows,
      serviceRows,
      appointmentRows
    ] = await Promise.all([
      supabase
        .from("businesses")
        .select("id, name, slug, calendar_mode")
        .order("name", { ascending: true }),
      supabase
        .from("businesses")
        .select("*", { count: "exact", head: true })
        .eq("calendar_mode", "google"),
      supabase.from("appointments").select("*", { count: "exact", head: true }),
      supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .gte("starts_at", monthStartIso)
        .lte("starts_at", monthEndIso),
      supabase.from("customers").select("*", { count: "exact", head: true }),
      supabase.from("services").select("*", { count: "exact", head: true }),
      supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .gte("starts_at", nowIso)
        .not("status", "eq", "cancelled"),
      supabase.from("customers").select("business_id"),
      supabase.from("services").select("business_id"),
      supabase.from("appointments").select("business_id, starts_at, status")
    ]);

    if (bizResult.error) {
      return NextResponse.json(
        { error: "Falha ao listar empresas." },
        { status: 500 }
      );
    }

    const firstHeadError =
      businessesGoogle.error ||
      appointmentsAll.error ||
      appointmentsMonth.error ||
      customersAll.error ||
      servicesAll.error ||
      upcoming.error;

    if (firstHeadError) {
      return NextResponse.json(
        { error: "Falha ao agregar dados da plataforma." },
        { status: 500 }
      );
    }

    if (customerRows.error || serviceRows.error || appointmentRows.error) {
      return NextResponse.json(
        { error: "Falha ao carregar detalhamento por empresa." },
        { status: 500 }
      );
    }

    const businesses = (bizResult.data || []) as BusinessRow[];
    const byId = new Map<string, BusinessMetrics>();

    for (const b of businesses) {
      const mode =
        b.calendar_mode === "google"
          ? "google"
          : b.calendar_mode === "internal"
            ? "internal"
            : null;
      byId.set(b.id, {
        id: b.id,
        name: b.name,
        slug: b.slug,
        calendarMode: mode,
        customerCount: 0,
        serviceCount: 0,
        appointmentCount: 0,
        appointmentsThisMonth: 0,
        upcomingAppointmentCount: 0
      });
    }

    for (const r of customerRows.data || []) {
      const row = byId.get((r as { business_id: string }).business_id);
      if (row) row.customerCount += 1;
    }
    for (const r of serviceRows.data || []) {
      const row = byId.get((r as { business_id: string }).business_id);
      if (row) row.serviceCount += 1;
    }
    for (const r of appointmentRows.data || []) {
      const ar = r as { business_id: string; starts_at: string; status: string };
      const row = byId.get(ar.business_id);
      if (!row) continue;
      row.appointmentCount += 1;
      if (ar.starts_at >= monthStartIso && ar.starts_at <= monthEndIso) {
        row.appointmentsThisMonth += 1;
      }
      if (ar.starts_at >= nowIso && ar.status !== "cancelled") {
        row.upcomingAppointmentCount += 1;
      }
    }

    const byBusiness = businesses
      .map((b) => byId.get(b.id))
      .filter((x): x is BusinessMetrics => x != null);

    const businessCount = byBusiness.length;
    const googleModeCount = businessesGoogle.count ?? 0;

    return NextResponse.json({
      data: {
        businessCount,
        internalModeCount: Math.max(0, businessCount - googleModeCount),
        googleModeCount,
        appointmentCount: appointmentsAll.count ?? 0,
        appointmentsThisMonth: appointmentsMonth.count ?? 0,
        upcomingAppointmentCount: upcoming.count ?? 0,
        customerCount: customersAll.count ?? 0,
        serviceCount: servicesAll.count ?? 0,
        byBusiness
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
