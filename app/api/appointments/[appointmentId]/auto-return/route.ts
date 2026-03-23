import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = { params: { appointmentId: string } };
type Body = { businessId: string; daysAhead?: number };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const appointmentId = params.appointmentId;
    const body = (await request.json()) as Body;
    if (!appointmentId || !body.businessId) {
      return NextResponse.json(
        { error: "appointmentId e businessId sao obrigatorios." },
        { status: 400 }
      );
    }
    const supabase = getSupabaseAdmin();
    const { data: business } = await supabase
      .from("businesses")
      .select("auto_return_enabled, auto_return_days")
      .eq("id", body.businessId)
      .maybeSingle();
    if (!business || business.auto_return_enabled === false) {
      return NextResponse.json(
        { error: "Auto-agendamento de retorno desabilitado para este negocio." },
        { status: 403 }
      );
    }
    const { data: source } = await supabase
      .from("appointments")
      .select(
        "id, business_id, service_id, customer_id, customer_name, customer_phone, starts_at, ends_at"
      )
      .eq("id", appointmentId)
      .eq("business_id", body.businessId)
      .maybeSingle();
    if (!source) {
      return NextResponse.json({ error: "Agendamento nao encontrado." }, { status: 404 });
    }
    const days = Math.max(
      7,
      Math.min(120, Math.floor(Number(body.daysAhead ?? business.auto_return_days ?? 30)))
    );
    const start = new Date(source.starts_at);
    const end = new Date(source.ends_at);
    const durationMs = Math.max(15 * 60_000, end.getTime() - start.getTime());
    const nextStart = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    const nextEnd = new Date(nextStart.getTime() + durationMs);
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        business_id: source.business_id,
        service_id: source.service_id,
        customer_id: source.customer_id,
        customer_name: source.customer_name,
        customer_phone: source.customer_phone,
        starts_at: nextStart.toISOString(),
        ends_at: nextEnd.toISOString(),
        status: "pending",
        notes: `Retorno sugerido automaticamente (${days} dias).`
      })
      .select(
        "id, business_id, service_id, customer_id, customer_name, customer_phone, starts_at, ends_at, status, notes"
      )
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: "Nao foi possivel criar retorno automatico." },
        { status: 500 }
      );
    }
    return NextResponse.json({
      message: "Retorno criado com sucesso em 1 clique.",
      data
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
