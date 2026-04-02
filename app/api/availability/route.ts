import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { computeAvailableSlotsForDate } from "@/lib/computeAvailableSlotsForDate";

type AvailabilityInput = {
  businessId: string;
  serviceId?: string;
  date: string;
  timezone?: string;
  slotDurationMinutes?: number;
};

export async function POST(request: NextRequest) {
  try {
    const internalSecret = process.env.N8N_WEBHOOK_SECRET;
    if (internalSecret) {
      const secretHeader = request.headers.get("x-internal-secret");
      if (secretHeader !== internalSecret) {
        return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
      }
    }

    const body = (await request.json()) as AvailabilityInput;

    if (!body.businessId || !body.date) {
      return NextResponse.json(
        { error: "businessId e date sao obrigatorios." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const payload = await computeAvailableSlotsForDate(supabase, {
      businessId: body.businessId,
      date: body.date,
      serviceId: body.serviceId,
      timezone: body.timezone,
      slotDurationMinutes: body.slotDurationMinutes
    });

    return NextResponse.json(payload);
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === "Empresa nao encontrada.") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
