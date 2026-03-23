import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function getExtension(fileName: string, mimeType: string) {
  const fromName = fileName.includes(".") ? fileName.split(".").pop() || "" : "";
  if (fromName) return fromName.toLowerCase();
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "jpg";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const businessId = String(formData.get("businessId") || "").trim();
    const file = formData.get("file");

    if (!businessId) {
      return NextResponse.json({ error: "businessId e obrigatorio." }, { status: 400 });
    }
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
    const bucket = process.env.SUPABASE_SERVICE_IMAGES_BUCKET || "service-images";
    const objectPath = `${businessId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const supabase = getSupabaseAdmin();

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
