import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = { params: { token: string } };

export async function POST(_: Request, { params }: Params) {
  try {
    const token = (params.token || "").trim();
    if (!token) {
      return NextResponse.json({ error: "Token invalido." }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("appointments")
      .update({ checked_in_at: nowIso, status: "confirmed" })
      .eq("checkin_token", token)
      .in("status", ["pending", "confirmed"])
      .select("id, business_id, customer_name, starts_at, checked_in_at, status")
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: "Check-in nao encontrado ou ja processado." },
        { status: 404 }
      );
    }
    return NextResponse.json({
      message: "Check-in realizado com sucesso.",
      data
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
