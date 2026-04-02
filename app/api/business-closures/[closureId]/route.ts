import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function DELETE(
  request: NextRequest,
  context: { params: { closureId: string } }
) {
  try {
    const { closureId } = context.params;
    const businessId = request.nextUrl.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json(
        { error: "Parametro businessId e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("business_closure_periods")
      .delete()
      .eq("id", closureId)
      .eq("business_id", businessId);

    if (error) {
      return NextResponse.json({ error: "Falha ao remover bloqueio." }, { status: 500 });
    }

    return NextResponse.json({ message: "Bloqueio removido." });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
