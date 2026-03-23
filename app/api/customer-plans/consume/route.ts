import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ConsumeBody = {
  businessId: string;
  contractId: string;
  amount?: number;
  appointmentId?: string | null;
  notes?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ConsumeBody;
    if (!body.businessId || !body.contractId) {
      return NextResponse.json(
        { error: "businessId e contractId sao obrigatorios." },
        { status: 400 }
      );
    }
    const amount = Math.max(1, Math.floor(Number(body.amount) || 1));
    const supabase = getSupabaseAdmin();
    const { data: contract } = await supabase
      .from("customer_plan_contracts")
      .select("id, status, sessions_total, sessions_used")
      .eq("id", body.contractId)
      .eq("business_id", body.businessId)
      .maybeSingle();

    if (!contract) {
      return NextResponse.json({ error: "Contrato nao encontrado." }, { status: 404 });
    }
    if (contract.status !== "active") {
      return NextResponse.json({ error: "Contrato nao esta ativo." }, { status: 400 });
    }
    if (contract.sessions_total == null) {
      return NextResponse.json(
        { error: "Consumo de sessoes disponivel apenas para pacotes." },
        { status: 400 }
      );
    }

    if (body.appointmentId) {
      const { data: appt } = await supabase
        .from("appointments")
        .select("id")
        .eq("id", body.appointmentId)
        .eq("business_id", body.businessId)
        .maybeSingle();
      if (!appt) {
        return NextResponse.json(
          { error: "Agendamento nao encontrado para vincular consumo." },
          { status: 404 }
        );
      }
    }

    const nextUsed = Number(contract.sessions_used || 0) + amount;
    if (nextUsed > Number(contract.sessions_total)) {
      return NextResponse.json({ error: "Saldo de sessoes insuficiente." }, { status: 400 });
    }

    const nextStatus = nextUsed >= Number(contract.sessions_total) ? "completed" : "active";
    const { data, error } = await supabase
      .from("customer_plan_contracts")
      .update({ sessions_used: nextUsed, status: nextStatus })
      .eq("id", contract.id)
      .select(
        "id, business_id, customer_id, offer_plan_id, status, starts_at, ends_at, sessions_total, sessions_used, next_billing_at, notes, created_at"
      )
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Falha ao registrar consumo." }, { status: 500 });
    }

    await supabase.from("customer_plan_usages").insert({
      business_id: body.businessId,
      customer_plan_contract_id: contract.id,
      appointment_id: body.appointmentId || null,
      used_sessions: amount,
      notes: body.notes?.trim() || null
    });

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
