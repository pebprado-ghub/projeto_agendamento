import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = { params: { appointmentId: string } };
type Body = { businessId: string };

async function sendWhatsappTextMessage(to: string, text: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return { sent: false as const, reason: "Credenciais do WhatsApp nao configuradas." };
  }
  const response = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/[^\d]/g, ""),
        type: "text",
        text: { body: text }
      })
    }
  );
  if (!response.ok) {
    return { sent: false as const, reason: "Falha ao enviar mensagem de feedback." };
  }
  return { sent: true as const };
}

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
      .select("name, auto_feedback_enabled, google_reviews_enabled, google_reviews_url")
      .eq("id", body.businessId)
      .maybeSingle();
    if (!business || business.auto_feedback_enabled === false) {
      return NextResponse.json(
        { error: "Feedback automatico desabilitado para este negocio." },
        { status: 403 }
      );
    }
    const { data: appt } = await supabase
      .from("appointments")
      .select("id, customer_name, customer_phone, status, feedback_sent_at")
      .eq("id", appointmentId)
      .eq("business_id", body.businessId)
      .maybeSingle();
    if (!appt) {
      return NextResponse.json({ error: "Agendamento nao encontrado." }, { status: 404 });
    }
    if (appt.feedback_sent_at) {
      return NextResponse.json({ message: "Feedback ja enviado anteriormente." });
    }

    const googlePart =
      business.google_reviews_enabled && business.google_reviews_url
        ? `\n\nSe puder, avalie tambem no Google: ${business.google_reviews_url}`
        : "";
    const text =
      `Oi ${appt.customer_name || "cliente"}! Como foi seu atendimento em ${
        business.name
      }?\nResponda com uma nota: ⭐⭐⭐⭐⭐` + googlePart;
    const result = await sendWhatsappTextMessage(appt.customer_phone, text);
    if (!result.sent) {
      return NextResponse.json({ error: result.reason }, { status: 500 });
    }
    await supabase
      .from("appointments")
      .update({ feedback_sent_at: new Date().toISOString() })
      .eq("id", appointmentId)
      .eq("business_id", body.businessId);

    return NextResponse.json({ message: "Mensagem de feedback enviada com sucesso." });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
