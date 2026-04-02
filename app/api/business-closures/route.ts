import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const CLOSURE_KINDS = ["vacation", "emergency", "travel", "other"] as const;
type ClosureKind = (typeof CLOSURE_KINDS)[number];

function isClosureKind(v: string): v is ClosureKind {
  return (CLOSURE_KINDS as readonly string[]).includes(v);
}

export async function GET(request: NextRequest) {
  try {
    const businessId = request.nextUrl.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json(
        { error: "Parametro businessId e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("business_closure_periods")
      .select("id, business_id, starts_at, ends_at, kind, note, created_at, updated_at")
      .eq("business_id", businessId)
      .order("starts_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Falha ao listar bloqueios." }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      businessId?: string;
      startsAt?: string;
      endsAt?: string;
      kind?: string;
      note?: string | null;
    };

    if (!body.businessId) {
      return NextResponse.json({ error: "businessId e obrigatorio." }, { status: 400 });
    }
    const startsAt = (body.startsAt || "").trim();
    const endsAt = (body.endsAt || "").trim();
    if (!startsAt || !endsAt) {
      return NextResponse.json(
        { error: "startsAt e endsAt sao obrigatorios (ISO 8601)." },
        { status: 400 }
      );
    }

    const starts = new Date(startsAt);
    const ends = new Date(endsAt);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
      return NextResponse.json(
        { error: "Datas invalidas. Use formato ISO 8601." },
        { status: 400 }
      );
    }
    if (ends <= starts) {
      return NextResponse.json(
        { error: "endsAt deve ser posterior a startsAt." },
        { status: 400 }
      );
    }

    const kind = (body.kind || "other").trim();
    if (!isClosureKind(kind)) {
      return NextResponse.json(
        { error: "kind invalido (vacation, emergency, travel, other)." },
        { status: 400 }
      );
    }

    const note =
      body.note == null || String(body.note).trim() === ""
        ? null
        : String(body.note).trim().slice(0, 2000);

    const supabase = getSupabaseAdmin();
    const { data: ins, error: insErr } = await supabase
      .from("business_closure_periods")
      .insert({
        business_id: body.businessId,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        kind,
        note
      })
      .select("id, business_id, starts_at, ends_at, kind, note, created_at, updated_at")
      .single();

    if (insErr || !ins) {
      return NextResponse.json(
        { error: insErr?.message || "Falha ao criar bloqueio." },
        { status: 500 }
      );
    }

    const { data: conflicting } = await supabase
      .from("appointments")
      .select("id, starts_at, ends_at, status, customer_name, customer_phone")
      .eq("business_id", body.businessId)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", ins.ends_at as string)
      .gt("ends_at", ins.starts_at as string);

    return NextResponse.json({
      data: ins,
      conflictingAppointments: conflicting || []
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
