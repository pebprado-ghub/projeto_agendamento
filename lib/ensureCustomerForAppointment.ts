import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePhoneDigits } from "@/lib/phone";

const CUSTOMER_SOURCES = ["manual", "whatsapp", "import", "campaign", "other"] as const;

function resolveCustomerSource(raw?: string | null): (typeof CUSTOMER_SOURCES)[number] {
  const s = (raw || "").trim();
  if (CUSTOMER_SOURCES.includes(s as (typeof CUSTOMER_SOURCES)[number])) {
    return s as (typeof CUSTOMER_SOURCES)[number];
  }
  return "whatsapp";
}

/**
 * Garante um registro em `customers` para o telefone no negócio (upsert lógico).
 * Usado quando o agendamento vem do WhatsApp/n8n sem `customerId`.
 * - `full_name`: nome editável no CRM (inicialmente igual ao perfil ou fallback).
 * - `whatsapp_profile_name`: nome público do perfil WhatsApp (atualizado quando a API envia).
 * - `marketingOptIn`: quando `true`, registra consentimento explícito do titular (fluxo público).
 *   `false` ou omitido não remove um consentimento já existente.
 * - `customerRecordSource`: origem do cadastro (`other` em reserva web; padrão `whatsapp`).
 */
export async function ensureCustomerForAppointment(params: {
  businessId: string;
  customerPhone: string;
  customerName?: string | null;
  marketingOptIn?: boolean;
  customerRecordSource?: string | null;
}): Promise<string | null> {
  const phoneNormalized = normalizePhoneDigits(params.customerPhone);
  if (phoneNormalized.length < 10) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const profileName = params.customerName?.trim() || null;
  const fallbackFullName = `Cliente WhatsApp (${phoneNormalized.slice(-4)})`;
  const initialFullName = profileName || fallbackFullName;
  const wantsMarketing = params.marketingOptIn === true;
  const recordSource = resolveCustomerSource(params.customerRecordSource);

  const { data: existing, error: selErr } = await supabase
    .from("customers")
    .select("id, marketing_opt_in")
    .eq("business_id", params.businessId)
    .eq("phone_normalized", phoneNormalized)
    .maybeSingle();

  if (selErr) {
    return null;
  }

  if (existing?.id) {
    const updates: Record<string, unknown> = {};
    if (profileName) {
      updates.whatsapp_profile_name = profileName;
    }
    if (wantsMarketing && !existing.marketing_opt_in) {
      updates.marketing_opt_in = true;
      updates.marketing_opt_in_at = new Date().toISOString();
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from("customers").update(updates).eq("id", existing.id);
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
      source: recordSource,
      marketing_opt_in: wantsMarketing,
      marketing_opt_in_at: wantsMarketing ? new Date().toISOString() : null
    })
    .select("id")
    .single();

  if (!insErr && created?.id) {
    return created.id;
  }

  if (insErr?.code === "23505") {
    const { data: retry } = await supabase
      .from("customers")
      .select("id, marketing_opt_in")
      .eq("business_id", params.businessId)
      .eq("phone_normalized", phoneNormalized)
      .maybeSingle();
    if (retry?.id) {
      const updates: Record<string, unknown> = {};
      if (profileName) {
        updates.whatsapp_profile_name = profileName;
      }
      if (wantsMarketing && !retry.marketing_opt_in) {
        updates.marketing_opt_in = true;
        updates.marketing_opt_in_at = new Date().toISOString();
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from("customers").update(updates).eq("id", retry.id);
      }
    }
    return retry?.id ?? null;
  }

  return null;
}
