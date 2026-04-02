import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeSessionRole } from "@/lib/authRoles";

type SummaryRow = {
  thread_id: string;
  business_id: string;
  thread_updated_at: string;
  business_name: string;
  business_slug: string;
  last_message_body: string | null;
  last_message_channel: string | null;
  last_message_direction: string | null;
  last_message_at: string | null;
};

export async function GET(request: NextRequest) {
  const raw = request.cookies.get("session_role")?.value;
  if (normalizeSessionRole(raw) !== "developer") {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 403 });
  }

  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(500, Math.max(1, Number(limitRaw) || 200));

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("developer_communication_thread_summaries")
      .select("*")
      .order("thread_updated_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = (data || []) as SummaryRow[];
    return NextResponse.json({
      data: rows.map((r) => ({
        threadId: r.thread_id,
        businessId: r.business_id,
        threadUpdatedAt: r.thread_updated_at,
        businessName: r.business_name,
        businessSlug: r.business_slug,
        lastMessageBody: r.last_message_body,
        lastMessageChannel: r.last_message_channel,
        lastMessageDirection: r.last_message_direction,
        lastMessageAt: r.last_message_at
      }))
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar conversas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
