import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type UpdateServiceInput = {
  name?: string;
  durationMinutes?: number;
  priceCents?: number | null;
  isActive?: boolean;
  category?: string | null;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  displayOrder?: number | null;
  imageUrls?: string[] | null;
};

type Params = {
  params: {
    serviceId: string;
  };
};

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const body = (await request.json()) as UpdateServiceInput;
    const serviceId = params.serviceId;

    if (!serviceId) {
      return NextResponse.json(
        { error: "serviceId e obrigatorio." },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body.durationMinutes === "number" && body.durationMinutes > 0) {
      updates.duration_minutes = body.durationMinutes;
    }
    if (typeof body.priceCents === "number" || body.priceCents === null) {
      updates.price_cents = body.priceCents;
    }
    if (typeof body.isActive === "boolean") {
      updates.is_active = body.isActive;
    }
    if (typeof body.category === "string" || body.category === null) {
      updates.category = body.category?.trim() || null;
    }
    if (typeof body.description === "string" || body.description === null) {
      updates.description = body.description?.trim() || null;
    }
    if (typeof body.icon === "string" && body.icon.trim()) {
      updates.icon = body.icon.trim();
    }
    if (typeof body.color === "string" && body.color.trim()) {
      updates.color = body.color.trim();
    }
    if (typeof body.displayOrder === "number" || body.displayOrder === null) {
      updates.display_order =
        typeof body.displayOrder === "number" ? Math.max(0, body.displayOrder) : null;
    }
    if (Array.isArray(body.imageUrls)) {
      updates.image_urls = body.imageUrls.slice(0, 5);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo valido informado para atualizacao." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("services")
      .update(updates)
      .eq("id", serviceId)
      .select(
        "id, business_id, name, category, description, icon, color, image_urls, display_order, duration_minutes, price_cents, is_active"
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Falha ao atualizar servico." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Servico atualizado.", service: data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const serviceId = params.serviceId;
    if (!serviceId) {
      return NextResponse.json(
        { error: "serviceId e obrigatorio." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("services").delete().eq("id", serviceId);

    if (error) {
      return NextResponse.json(
        { error: "Falha ao remover servico." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Servico removido com sucesso." });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
