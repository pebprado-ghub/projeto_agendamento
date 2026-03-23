import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("subscription_plans")
      .select(
        "code, name, monthly_price_cents, monthly_appointment_limit, professional_limit, allows_automations, allows_multi_unit, is_active"
      )
      .eq("is_active", true)
      .order("monthly_price_cents", { ascending: true });
    if (error) {
      return NextResponse.json({ error: "Falha ao listar planos." }, { status: 500 });
    }
    return NextResponse.json({ data: data || [] });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
