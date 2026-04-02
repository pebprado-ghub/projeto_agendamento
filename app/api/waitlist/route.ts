import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type JoinWaitlistInput = {
  businessId: string;
  serviceId?: string | null;
  customerName?: string;
  customerPhone: string;
  startsAt: string;
  endsAt: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as JoinWaitlistInput;
    if (!body.businessId || !body.customerPhone || !body.startsAt || !body.endsAt) {
      return NextResponse.json(
        { error: "businessId, customerPhone, startsAt e endsAt sao obrigatorios." },
        { status: 400 }
      );
    }
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt >= endsAt) {
      return NextResponse.json({ error: "Intervalo de horario invalido." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: business } = await supabase
      .from("businesses")
      .select("waitlist_enabled")
      .eq("id", body.businessId)
      .single();

    if (!business || business.waitlist_enabled === false) {
      return NextResponse.json({ error: "Fila de espera desativada para esta empresa." }, { status: 400 });
    }

    if (body.serviceId) {
      const { data: svc } = await supabase
        .from("services")
        .select("waitlist_enabled")
        .eq("id", body.serviceId)
        .eq("business_id", body.businessId)
        .maybeSingle();
      if (svc && svc.waitlist_enabled === false) {
        return NextResponse.json(
          { error: "Fila de espera desativada para este servico." },
          { status: 400 }
        );
      }
    }

    const dateIso = startsAt.toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("appointment_waitlist")
      .insert({
        business_id: body.businessId,
        service_id: body.serviceId ?? null,
        customer_name: body.customerName?.trim() || null,
        customer_phone: body.customerPhone.trim(),
        date_iso: dateIso,
        requested_start_at: startsAt.toISOString(),
        requested_end_at: endsAt.toISOString(),
        status: "waiting"
      })
      .select("id, business_id, service_id, customer_name, customer_phone, status, date_iso")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Falha ao entrar na fila de espera." }, { status: 500 });
    }

    return NextResponse.json(
      { message: "Cliente adicionado(a) na fila de espera.", data },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
