import { NextRequest, NextResponse } from "next/server";
import { appointmentOverlapsBusinessClosure } from "@/lib/businessClosureOverlap";
import { assertPlanFeature } from "@/lib/planAccess";
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
    const gate = await assertPlanFeature(supabase, body.businessId, "auto_return");
    if (!gate.ok) return gate.response;

    const { data: business } = await supabase
      .from("businesses")
      .select("auto_return_enabled, auto_return_days")
      .eq("id", body.businessId)
      .maybeSingle();
    if (!business) {
      return NextResponse.json({ error: "Empresa nao encontrada." }, { status: 404 });
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
    let autoReturnOk = business.auto_return_enabled !== false;
    let defaultReturnDays = Number(business.auto_return_days ?? 30);
    const sid = source.service_id as string | null;
    if (sid) {
      const { data: svc } = await supabase
        .from("services")
        .select("auto_return_enabled, auto_return_days")
        .eq("id", sid)
        .eq("business_id", body.businessId)
        .maybeSingle();
      if (svc) {
        autoReturnOk = svc.auto_return_enabled !== false;
        defaultReturnDays = Number(svc.auto_return_days ?? 30);
      }
    }
    if (!autoReturnOk) {
      return NextResponse.json(
        { error: "Auto-agendamento de retorno desabilitado para este servico." },
        { status: 403 }
      );
    }
    const days = Math.max(
      7,
      Math.min(120, Math.floor(Number(body.daysAhead ?? defaultReturnDays ?? 30)))
    );
    const start = new Date(source.starts_at);
    const end = new Date(source.ends_at);
    const durationMs = Math.max(15 * 60_000, end.getTime() - start.getTime());
    const nextStart = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    const nextEnd = new Date(nextStart.getTime() + durationMs);
    const closureCheck = await appointmentOverlapsBusinessClosure(
      supabase,
      body.businessId,
      nextStart,
      nextEnd
    );
    if (!closureCheck.ok) {
      return NextResponse.json({ error: closureCheck.error }, { status: 500 });
    }
    if (closureCheck.blocked) {
      return NextResponse.json(
        {
          error:
            "A data sugerida para o retorno esta em periodo bloqueado. Ajuste manualmente ou remova o bloqueio antes de tentar de novo."
        },
        { status: 409 }
      );
    }
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
