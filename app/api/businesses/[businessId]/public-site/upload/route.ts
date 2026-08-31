import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRole } from "@/lib/authRoles";
import { assertPlanFeature } from "@/lib/planAccess";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Params = {
  params: {
    businessId: string;
  };
};

function getExtension(fileName: string, mimeType: string) {
  const fromName = fileName.includes(".") ? fileName.split(".").pop() || "" : "";
  if (fromName) return fromName.toLowerCase();
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "jpg";
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const raw = request.cookies.get("session_role")?.value;
    if (!isAuthenticatedRole(raw)) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const businessId = params.businessId?.trim();
    if (!businessId) {
      return NextResponse.json({ error: "businessId invalido." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Envie apenas imagens." }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Imagem maior que 5MB." }, { status: 400 });
    }

    const ext = getExtension(file.name, file.type);
    const bucket =
      process.env.SUPABASE_BUSINESS_SITE_BUCKET ||
      process.env.SUPABASE_SERVICE_IMAGES_BUCKET ||
      "service-images";
    const objectPath = `${businessId}/site/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const supabase = getSupabaseAdmin();

    const gate = await assertPlanFeature(supabase, businessId, "public_site");
    if (!gate.ok) return gate.response;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, bytes, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json(
        { error: `Falha no upload (${bucket}): ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    return NextResponse.json({ url: data.publicUrl, path: objectPath });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro no upload." },
      { status: 500 }
    );
  }
}
