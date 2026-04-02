import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePhoneDigits } from "@/lib/phone";

type Body = {
  businessId: string;
  /** Telefone do titular (mesmo cadastrado no negócio). */
  phone: string;
  /** true = opt-in com registro de data; false = revogação (LGPD). */
  accept: boolean;
};

/**
 * Consentimento/revogação de marketing pelo titular, sem painel do negócio.
 * Uso típico: link em e-mail/WhatsApp ou página pública com confirmação do telefone.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!body.businessId || !body.phone || typeof body.accept !== "boolean") {
      return NextResponse.json(
        { error: "businessId, phone e accept (boolean) sao obrigatorios." },
        { status: 400 }
      );
    }
    const phoneNormalized = normalizePhoneDigits(body.phone);
    if (phoneNormalized.length < 10) {
      return NextResponse.json({ error: "Telefone invalido." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: customer, error: selErr } = await supabase
      .from("customers")
      .select("id, marketing_opt_in")
      .eq("business_id", body.businessId)
      .eq("phone_normalized", phoneNormalized)
      .maybeSingle();

    if (selErr || !customer?.id) {
      return NextResponse.json(
        { error: "Cliente nao encontrado para este telefone e negocio." },
        { status: 404 }
      );
    }

    if (body.accept && customer.marketing_opt_in) {
      return NextResponse.json({
        message: "Consentimento para comunicacoes de marketing ja estava ativo.",
        data: { id: customer.id, marketing_opt_in: true }
      });
    }

    if (!body.accept && !customer.marketing_opt_in) {
      return NextResponse.json({
        message: "Comunicacoes de marketing ja estavam desativadas.",
        data: { id: customer.id, marketing_opt_in: false }
      });
    }

    const nowIso = new Date().toISOString();
    const patch = body.accept
      ? { marketing_opt_in: true, marketing_opt_in_at: nowIso }
      : { marketing_opt_in: false, marketing_opt_in_at: null };

    const { data: updated, error: updErr } = await supabase
      .from("customers")
      .update(patch)
      .eq("id", customer.id)
      .eq("business_id", body.businessId)
      .select("id, marketing_opt_in, marketing_opt_in_at")
      .maybeSingle();

    if (updErr || !updated) {
      return NextResponse.json(
        { error: "Falha ao atualizar preferencia de comunicacao." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: body.accept
        ? "Consentimento para comunicacoes de marketing registrado."
        : "Preferencia atualizada. Voce nao recebera comunicacoes de marketing.",
      data: updated
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
