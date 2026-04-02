import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeSessionRole } from "@/lib/authRoles";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CHANNELS = new Set(["whatsapp", "email", "internal"]);
const DIRECTIONS = new Set(["inbound", "outbound", "system"]);

type MessageRow = {
  id: string;
  thread_id: string;
  channel: string;
  direction: string;
  subject: string | null;
  body: string;
  metadata: Record<string, unknown> | null;
  sender_label: string | null;
  created_at: string;
};

function mapMessage(row: MessageRow) {
  return {
    id: row.id,
    threadId: row.thread_id,
    channel: row.channel,
    direction: row.direction,
    subject: row.subject,
    body: row.body,
    metadata: row.metadata || {},
    senderLabel: row.sender_label,
    createdAt: row.created_at
  };
}

async function ensureThread(supabase: ReturnType<typeof getSupabaseAdmin>, businessId: string) {
  const existing = await supabase
    .from("developer_communication_threads")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data?.id) return existing.data.id as string;

  const inserted = await supabase
    .from("developer_communication_threads")
    .insert({ business_id: businessId })
    .select("id")
    .single();

  if (inserted.error) throw inserted.error;
  return inserted.data!.id as string;
}

export async function GET(request: NextRequest) {
  const raw = request.cookies.get("session_role")?.value;
  if (normalizeSessionRole(raw) !== "developer") {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 403 });
  }

  const businessId = request.nextUrl.searchParams.get("businessId") || "";
  if (!UUID_RE.test(businessId)) {
    return NextResponse.json({ error: "businessId invalido." }, { status: 400 });
  }

  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(100, Math.max(1, Number(limitRaw) || 50));

  try {
    const supabase = getSupabaseAdmin();
    const thread = await supabase
      .from("developer_communication_threads")
      .select("id")
      .eq("business_id", businessId)
      .maybeSingle();

    if (thread.error) throw thread.error;
    if (!thread.data?.id) {
      return NextResponse.json({ data: [], threadId: null as string | null });
    }

    const threadId = thread.data.id as string;
    const { data, error } = await supabase
      .from("developer_communication_messages")
      .select(
        "id, thread_id, channel, direction, subject, body, metadata, sender_label, created_at"
      )
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({
      threadId,
      data: ((data || []) as MessageRow[]).map(mapMessage)
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar mensagens.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const raw = request.cookies.get("session_role")?.value;
  if (normalizeSessionRole(raw) !== "developer") {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 403 });
  }

  let body: {
    businessId?: unknown;
    channel?: unknown;
    direction?: unknown;
    subject?: unknown;
    body?: unknown;
    metadata?: unknown;
    senderLabel?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const businessId = typeof body.businessId === "string" ? body.businessId : "";
  if (!UUID_RE.test(businessId)) {
    return NextResponse.json({ error: "businessId invalido." }, { status: 400 });
  }

  const channel = typeof body.channel === "string" ? body.channel : "";
  if (!CHANNELS.has(channel)) {
    return NextResponse.json({ error: "channel invalido." }, { status: 400 });
  }

  const direction =
    typeof body.direction === "string" && DIRECTIONS.has(body.direction)
      ? body.direction
      : "outbound";

  const noteText = typeof body.body === "string" ? body.body.trim().slice(0, 8000) : "";
  const subject =
    typeof body.subject === "string" ? body.subject.trim().slice(0, 500) : null;
  const senderLabel =
    typeof body.senderLabel === "string" ? body.senderLabel.trim().slice(0, 200) : null;

  let metadata: Record<string, unknown> = {};
  if (body.metadata != null && typeof body.metadata === "object" && !Array.isArray(body.metadata)) {
    metadata = body.metadata as Record<string, unknown>;
  }

  try {
    const supabase = getSupabaseAdmin();
    const threadId = await ensureThread(supabase, businessId);

    const { data, error } = await supabase
      .from("developer_communication_messages")
      .insert({
        thread_id: threadId,
        channel,
        direction,
        subject,
        body: noteText,
        metadata,
        sender_label: senderLabel
      })
      .select(
        "id, thread_id, channel, direction, subject, body, metadata, sender_label, created_at"
      )
      .single();

    if (error) throw error;

    const touch = await supabase
      .from("developer_communication_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId);

    if (touch.error) throw touch.error;

    return NextResponse.json({
      data: mapMessage(data as MessageRow)
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gravar mensagem.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
