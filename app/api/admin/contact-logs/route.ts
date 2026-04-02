import { NextRequest, NextResponse } from "next/server";
import { normalizeSessionRole } from "@/lib/authRoles";

/**
 * Legado: use /api/admin/communication/messages.
 * Mantido como proxy para compatibilidade.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const raw = request.cookies.get("session_role")?.value;
  if (normalizeSessionRole(raw) !== "developer") {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 403 });
  }

  const businessId = request.nextUrl.searchParams.get("businessId") || "";
  if (!UUID_RE.test(businessId)) {
    return NextResponse.json({ error: "businessId invalido." }, { status: 400 });
  }

  const limit = request.nextUrl.searchParams.get("limit") || "15";
  const url = new URL("/api/admin/communication/messages", request.nextUrl.origin);
  url.searchParams.set("businessId", businessId);
  url.searchParams.set("limit", limit);

  const cookie = request.headers.get("cookie") || "";
  const res = await fetch(url.toString(), {
    headers: { cookie }
  });
  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      body: string;
      createdAt: string;
    }>;
    error?: string;
  };

  if (!res.ok) {
    return NextResponse.json({ error: json.error || "Erro ao listar." }, { status: res.status });
  }

  const mapped = (json.data || []).map((m) => ({
    id: m.id,
    note: m.body,
    createdAt: m.createdAt
  }));

  return NextResponse.json({ data: mapped });
}

export async function POST(request: NextRequest) {
  const raw = request.cookies.get("session_role")?.value;
  if (normalizeSessionRole(raw) !== "developer") {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 403 });
  }

  let body: { businessId?: unknown; note?: unknown };
  try {
    body = (await request.json()) as { businessId?: unknown; note?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
  }

  const url = new URL("/api/admin/communication/messages", request.nextUrl.origin);
  const cookie = request.headers.get("cookie") || "";

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie
    },
    body: JSON.stringify({
      businessId: body.businessId,
      channel: "internal",
      direction: "outbound",
      body: typeof body.note === "string" ? body.note : "",
      metadata: { source: "legacy_contact_logs" }
    })
  });

  const json = (await res.json()) as {
    data?: { id: string; body: string; createdAt: string };
    error?: string;
  };

  if (!res.ok) {
    return NextResponse.json({ error: json.error || "Erro ao salvar." }, { status: res.status });
  }

  if (!json.data) {
    return NextResponse.json({ error: "Resposta invalida." }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      id: json.data.id,
      note: json.data.body,
      createdAt: json.data.createdAt
    }
  });
}
