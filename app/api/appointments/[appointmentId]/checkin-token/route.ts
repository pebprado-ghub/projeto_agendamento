import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = { params: { appointmentId: string } };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const appointmentId = params.appointmentId;
    const businessId = request.nextUrl.searchParams.get("businessId");
    if (!appointmentId || !businessId) {
      return NextResponse.json(
        { error: "appointmentId e businessId sao obrigatorios." },
        { status: 400 }
      );
    }
    const supabase = getSupabaseAdmin();
    const { data: business } = await supabase
      .from("businesses")
      .select("checkin_qr_enabled")
      .eq("id", businessId)
      .maybeSingle();
    if (!business) {
      return NextResponse.json({ error: "Empresa nao encontrada." }, { status: 404 });
    }
    const { data: apptRow } = await supabase
      .from("appointments")
      .select("service_id")
      .eq("id", appointmentId)
      .eq("business_id", businessId)
      .maybeSingle();
    let checkinOk = business.checkin_qr_enabled !== false;
    const sid = apptRow?.service_id as string | null;
    if (sid) {
      const { data: svc } = await supabase
        .from("services")
        .select("checkin_qr_enabled")
        .eq("id", sid)
        .eq("business_id", businessId)
        .maybeSingle();
      if (svc) {
        checkinOk = svc.checkin_qr_enabled !== false;
      }
    }
    if (!checkinOk) {
      return NextResponse.json(
        { error: "Check-in por QR esta desabilitado para este servico." },
        { status: 403 }
      );
    }
    const token = crypto.randomUUID().replace(/-/g, "");
    const { data, error } = await supabase
      .from("appointments")
      .update({ checkin_token: token })
      .eq("id", appointmentId)
      .eq("business_id", businessId)
      .select("id, checkin_token")
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Agendamento nao encontrado." }, { status: 404 });
    }
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;
    return NextResponse.json({
      data: {
        appointmentId: data.id,
        token: data.checkin_token,
        checkinUrl: `${baseUrl}/api/checkin/${data.checkin_token}`
      }
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
