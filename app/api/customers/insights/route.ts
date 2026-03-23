import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    const inactiveDays = Math.max(
      30,
      Number(request.nextUrl.searchParams.get("inactiveDays") || 60)
    );
    if (!businessId) {
      return NextResponse.json({ error: "Parametro businessId e obrigatorio." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const month = new Date().getMonth() + 1;
    const [{ data: customers }, { data: appointments }, { data: payments }] = await Promise.all([
      supabase
        .from("customers")
        .select("id, full_name, birth_date, is_vip, tags, phone_normalized, marketing_opt_in")
        .eq("business_id", businessId)
        .limit(5000),
      supabase
        .from("appointments")
        .select("customer_id, customer_phone, starts_at, status")
        .eq("business_id", businessId)
        .neq("status", "cancelled")
        .limit(10000),
      supabase
        .from("customer_payments")
        .select("customer_id, amount_cents, status")
        .eq("business_id", businessId)
        .eq("status", "paid")
        .limit(10000)
    ]);

    const byCustomerId = new Map((customers || []).map((c) => [c.id, c]));
    const lastVisitByCustomerId = new Map<string, string>();
    for (const appt of appointments || []) {
      if (!appt.customer_id) continue;
      const prev = lastVisitByCustomerId.get(appt.customer_id);
      if (!prev || appt.starts_at > prev) {
        lastVisitByCustomerId.set(appt.customer_id, appt.starts_at);
      }
    }

    const ltvByCustomerId = new Map<string, number>();
    for (const p of payments || []) {
      const cid = p.customer_id;
      if (!cid) continue;
      ltvByCustomerId.set(cid, (ltvByCustomerId.get(cid) || 0) + Number(p.amount_cents || 0));
    }

    const birthdaysThisMonth = (customers || [])
      .filter((c) => c.birth_date)
      .filter((c) => new Date(`${c.birth_date}T00:00:00`).getMonth() + 1 === month)
      .map((c) => ({
        customerId: c.id,
        fullName: c.full_name,
        birthDate: c.birth_date,
        phone: c.phone_normalized
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    const cutoffTs = Date.now() - inactiveDays * 24 * 60 * 60_000;
    const inactiveCustomers = (customers || [])
      .map((c) => {
        const lastVisitAt = lastVisitByCustomerId.get(c.id) || null;
        return {
          customerId: c.id,
          fullName: c.full_name,
          lastVisitAt,
          daysSinceLastVisit: lastVisitAt
            ? Math.floor((Date.now() - new Date(lastVisitAt).getTime()) / (24 * 60 * 60_000))
            : null,
          lifetimeValueCents: ltvByCustomerId.get(c.id) || 0,
          tags: c.tags || [],
          isVip: Boolean(c.is_vip),
          marketingOptIn: Boolean(c.marketing_opt_in)
        };
      })
      .filter((item) => !item.lastVisitAt || new Date(item.lastVisitAt).getTime() < cutoffTs)
      .sort((a, b) => (b.daysSinceLastVisit || 99999) - (a.daysSinceLastVisit || 99999))
      .slice(0, 300);

    const vipCount = (customers || []).filter((c) => c.is_vip).length;

    return NextResponse.json({
      data: {
        month,
        inactiveDays,
        birthdaysThisMonth,
        inactiveCustomers,
        totals: {
          customers: (customers || []).length,
          vip: vipCount
        }
      }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
