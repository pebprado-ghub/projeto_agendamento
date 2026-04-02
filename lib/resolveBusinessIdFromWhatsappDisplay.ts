import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Associa `metadata.display_phone_number` do webhook ao negócio cadastrado.
 * Se não houver match, usa OWNER_BUSINESS_ID / CLIENT_BUSINESS_ID (single-tenant).
 */
export async function resolveBusinessIdFromWhatsappDisplay(
  supabase: SupabaseClient,
  displayPhoneNumber?: string | null
): Promise<string | null> {
  const envId = (
    process.env.OWNER_BUSINESS_ID ||
    process.env.CLIENT_BUSINESS_ID ||
    ""
  ).trim();
  const normalizedDisplay = String(displayPhoneNumber || "").replace(/\D/g, "");
  if (!normalizedDisplay) {
    return envId || null;
  }

  const { data: rows } = await supabase
    .from("businesses")
    .select("id, whatsapp_number")
    .not("whatsapp_number", "is", null);

  for (const row of rows || []) {
    const w = String(row.whatsapp_number || "").replace(/\D/g, "");
    if (!w) continue;
    if (
      normalizedDisplay === w ||
      normalizedDisplay.endsWith(w) ||
      w.endsWith(normalizedDisplay)
    ) {
      return row.id;
    }
  }

  return envId || null;
}
