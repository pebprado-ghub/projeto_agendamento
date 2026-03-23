import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    const month = request.nextUrl.searchParams.get("month") || new Date().toISOString().slice(0, 7);
    if (!businessId) {
      return NextResponse.json({ error: "Parametro businessId e obrigatorio." }, { status: 400 });
    }
    const [yearStr, monthStr] = month.split("-");
    const year = Number(yearStr);
    const monthNum = Number(monthStr);
    if (!Number.isFinite(year) || !Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json({ error: "Parametro month invalido. Use YYYY-MM." }, { status: 400 });
    }
    const start = new Date(Date.UTC(year, monthNum - 1, 1));
    const end = new Date(Date.UTC(year, monthNum, 1) - 1);
    const supabase = getSupabaseAdmin();
    const { data: business, error: bErr } = await supabase
      .from("businesses")
      .select(
        "subscription_plan_code, subscription_status, monthly_appointment_limit, professional_limit, automations_enabled, multi_unit_enabled"
      )
      .eq("id", businessId)
      .maybeSingle();
    if (bErr || !business) {
      return NextResponse.json({ error: "Negocio nao encontrado." }, { status: 404 });
    }
    const { count, error: cErr } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("starts_at", start.toISOString())
      .lte("starts_at", end.toISOString())
      .not("status", "eq", "cancelled");
    if (cErr) {
      return NextResponse.json({ error: "Falha ao calcular consumo mensal." }, { status: 500 });
    }
    return NextResponse.json({
      data: {
        month,
        currentAppointments: Number(count || 0),
        planCode: business.subscription_plan_code || "free",
        planStatus: business.subscription_status || "active",
        monthlyAppointmentLimit: business.monthly_appointment_limit ?? null,
        professionalLimit: business.professional_limit ?? null,
        automationsEnabled: business.automations_enabled === true,
        multiUnitEnabled: business.multi_unit_enabled === true
      }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
