import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePhoneDigits } from "@/lib/phone";

/**
 * Garante um registro em `customers` para o telefone no negócio (upsert lógico).
 * Usado quando o agendamento vem do WhatsApp/n8n sem `customerId`.
 * - `full_name`: nome editável no CRM (inicialmente igual ao perfil ou fallback).
 * - `whatsapp_profile_name`: nome público do perfil WhatsApp (atualizado quando a API envia).
 */
export async function ensureCustomerForAppointment(params: {
  businessId: string;
  customerPhone: string;
  customerName?: string | null;
}): Promise<string | null> {
  const phoneNormalized = normalizePhoneDigits(params.customerPhone);
  if (phoneNormalized.length < 10) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const profileName = params.customerName?.trim() || null;
  const fallbackFullName = `Cliente WhatsApp (${phoneNormalized.slice(-4)})`;
  const initialFullName = profileName || fallbackFullName;

  const { data: existing, error: selErr } = await supabase
    .from("customers")
    .select("id")
    .eq("business_id", params.businessId)
    .eq("phone_normalized", phoneNormalized)
    .maybeSingle();

  if (selErr) {
    return null;
  }

  if (existing?.id) {
    if (profileName) {
      await supabase
        .from("customers")
        .update({ whatsapp_profile_name: profileName })
        .eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: created, error: insErr } = await supabase
    .from("customers")
    .insert({
      business_id: params.businessId,
      full_name: initialFullName,
      whatsapp_profile_name: profileName,
      phone_normalized: phoneNormalized,
      email: null,
      source: "whatsapp",
      marketing_opt_in: false
    })
    .select("id")
    .single();

  if (!insErr && created?.id) {
    return created.id;
  }

  if (insErr?.code === "23505") {
    const { data: retry } = await supabase
      .from("customers")
      .select("id")
      .eq("business_id", params.businessId)
      .eq("phone_normalized", phoneNormalized)
      .maybeSingle();
    if (retry?.id && profileName) {
      await supabase
        .from("customers")
        .update({ whatsapp_profile_name: profileName })
        .eq("id", retry.id);
    }
    return retry?.id ?? null;
  }

  return null;
}
