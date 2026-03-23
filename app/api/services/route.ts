import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type CreateServiceInput = {
  businessId: string;
  name: string;
  durationMinutes: number;
  priceCents?: number | null;
  category?: string | null;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  isActive?: boolean;
  displayOrder?: number | null;
  imageUrls?: string[] | null;
};

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
      .from("services")
      .select(
        "id, business_id, name, category, description, icon, color, image_urls, display_order, duration_minutes, price_cents, is_active"
      )
      .eq("business_id", businessId)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Falha ao listar servicos." },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateServiceInput;

    if (!body.businessId || !body.name?.trim()) {
      return NextResponse.json(
        { error: "businessId e nome do servico sao obrigatorios." },
        { status: 400 }
      );
    }

    if (!body.durationMinutes || body.durationMinutes <= 0) {
      return NextResponse.json(
        { error: "durationMinutes deve ser maior que zero." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("services")
      .insert({
        business_id: body.businessId,
        name: body.name.trim(),
        duration_minutes: body.durationMinutes,
        price_cents: body.priceCents ?? null,
        category: body.category?.trim() || null,
        description: body.description?.trim() || null,
        icon: body.icon?.trim() || "✂️",
        color: body.color?.trim() || "#3B82F6",
        image_urls: Array.isArray(body.imageUrls) ? body.imageUrls.slice(0, 5) : [],
        is_active: typeof body.isActive === "boolean" ? body.isActive : true,
        display_order:
          typeof body.displayOrder === "number" ? Math.max(0, body.displayOrder) : null
      })
      .select(
        "id, business_id, name, category, description, icon, color, image_urls, display_order, duration_minutes, price_cents, is_active"
      )
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Falha ao criar servico." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Servico criado com sucesso.", service: data },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
