import { NextRequest, NextResponse } from "next/server";
import { assertPlanFeature } from "@/lib/planAccess";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { start, end };
}

function previousMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    const month = request.nextUrl.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    if (!businessId) {
      return NextResponse.json({ error: "Parametro businessId e obrigatorio." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Parametro month invalido (use YYYY-MM)." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const gate = await assertPlanFeature(supabase, businessId, "finance_payments");
    if (!gate.ok) return gate.response;

    const { start, end } = monthBounds(month);
    const prev = previousMonth(month);
    const { start: prevStart, end: prevEnd } = monthBounds(prev);

    const [{ data: payments }, { data: prevPayments }, { data: appointments }, { data: services }] =
      await Promise.all([
        supabase
          .from("customer_payments")
          .select("amount_cents, paid_at, status")
          .eq("business_id", businessId)
          .eq("status", "paid")
          .gte("paid_at", start.toISOString())
          .lte("paid_at", end.toISOString())
          .limit(5000),
        supabase
          .from("customer_payments")
          .select("amount_cents")
          .eq("business_id", businessId)
          .eq("status", "paid")
          .gte("paid_at", prevStart.toISOString())
          .lte("paid_at", prevEnd.toISOString())
          .limit(5000),
        supabase
          .from("appointments")
          .select("service_id, status, starts_at")
          .eq("business_id", businessId)
          .neq("status", "cancelled")
          .gte("starts_at", start.toISOString())
          .lte("starts_at", end.toISOString())
          .limit(5000),
        supabase.from("services").select("id, name").eq("business_id", businessId).limit(2000)
      ]);

    const dailyMap = new Map<string, number>();
    let monthRevenueCents = 0;
    for (const p of payments || []) {
      const date = (p.paid_at || "").slice(0, 10);
      monthRevenueCents += Number(p.amount_cents || 0);
      dailyMap.set(date, (dailyMap.get(date) || 0) + Number(p.amount_cents || 0));
    }
    const prevRevenueCents = (prevPayments || []).reduce(
      (sum, item) => sum + Number(item.amount_cents || 0),
      0
    );

    const serviceNameById = new Map((services || []).map((s) => [s.id, s.name]));
    const soldMap = new Map<string, number>();
    for (const a of appointments || []) {
      const key = a.service_id || "without-service";
      soldMap.set(key, (soldMap.get(key) || 0) + 1);
    }

    const topServices = Array.from(soldMap.entries())
      .map(([serviceId, count]) => ({
        serviceId,
        serviceName:
          serviceId === "without-service" ? "Sem serviço vinculado" : serviceNameById.get(serviceId) || "Serviço removido",
        soldCount: count
      }))
      .sort((a, b) => b.soldCount - a.soldCount)
      .slice(0, 10);

    const dailyRevenue = Array.from(dailyMap.entries())
      .map(([date, amountCents]) => ({ date, amountCents }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      data: {
        month,
        previousMonth: prev,
        monthRevenueCents,
        previousMonthRevenueCents: prevRevenueCents,
        comparisonDeltaCents: monthRevenueCents - prevRevenueCents,
        dailyRevenue,
        topServices
      }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
