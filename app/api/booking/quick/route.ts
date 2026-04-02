import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type ConfirmBody = {
  businessId: string;
  serviceId: string;
  startsAt: string;
  customerPhone: string;
  customerName?: string;
  bookedForName?: string;
  bookedForRelationship?: string;
  bookedForPhone?: string;
  /** Checkbox de marketing (LGPD) no fluxo público. */
  marketingOptIn?: boolean;
};

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    const step = request.nextUrl.searchParams.get("step") || "service";
    if (!businessId) {
      return NextResponse.json({ error: "Parametro businessId e obrigatorio." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    if (step === "service") {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price_cents")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .limit(100);
      if (error) {
        return NextResponse.json({ error: "Falha ao listar servicos." }, { status: 500 });
      }
      return NextResponse.json({ step: "service", data: data || [] });
    }
    if (step === "slot") {
      const serviceId = request.nextUrl.searchParams.get("serviceId");
      const date = request.nextUrl.searchParams.get("date");
      if (!serviceId || !date) {
        return NextResponse.json(
          { error: "serviceId e date sao obrigatorios para step=slot." },
          { status: 400 }
        );
      }
      const availabilityUrl = new URL("/api/availability", request.nextUrl.origin);
      availabilityUrl.searchParams.set("businessId", businessId);
      availabilityUrl.searchParams.set("serviceId", serviceId);
      availabilityUrl.searchParams.set("date", date);
      const response = await fetch(availabilityUrl.toString(), { cache: "no-store" });
      const result = (await response.json()) as { slots?: Array<{ startsAt: string; endsAt: string }>; error?: string };
      if (!response.ok) {
        return NextResponse.json(
          { error: result.error || "Falha ao carregar disponibilidade." },
          { status: response.status }
        );
      }
      return NextResponse.json({ step: "slot", data: result.slots || [] });
    }
    return NextResponse.json({ error: "step invalido. Use service ou slot." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ConfirmBody;
    if (!body.businessId || !body.serviceId || !body.startsAt || !body.customerPhone) {
      return NextResponse.json(
        { error: "businessId, serviceId, startsAt e customerPhone sao obrigatorios." },
        { status: 400 }
      );
    }
    const supabase = getSupabaseAdmin();
    const { data: service } = await supabase
      .from("services")
      .select("id, duration_minutes")
      .eq("business_id", body.businessId)
      .eq("id", body.serviceId)
      .maybeSingle();
    if (!service) {
      return NextResponse.json({ error: "Servico nao encontrado." }, { status: 404 });
    }
    const startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "startsAt invalido." }, { status: 400 });
    }
    const duration = Math.max(1, Number(service.duration_minutes || 30));
    const endsAt = new Date(startsAt.getTime() + duration * 60_000);
    const createUrl = new URL("/api/appointments", request.nextUrl.origin);
    const response = await fetch(createUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: body.businessId,
        serviceId: body.serviceId,
        customerName: body.customerName || null,
        customerPhone: body.customerPhone,
        bookedForName: body.bookedForName || null,
        bookedForRelationship: body.bookedForRelationship || null,
        bookedForPhone: body.bookedForPhone || null,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        marketingOptIn: body.marketingOptIn === true,
        customerRecordSource: "other"
      })
    });
    const result = (await response.json()) as { data?: unknown; error?: string };
    if (!response.ok) {
      return NextResponse.json(
        { error: result.error || "Falha ao confirmar agendamento." },
        { status: response.status }
      );
    }
    return NextResponse.json(
      {
        message: "Agendamento confirmado em 3 passos.",
        data: result.data || null
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
