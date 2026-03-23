import { NextRequest, NextResponse } from "next/server";
import { getBrHolidaysForYears } from "@/lib/holidaysBr";

/**
 * Feriados BR (nacionais + estaduais + municipais quando cidade/UF batem com regiões suportadas).
 * GET ?years=2025,2026&uf=SP&city=São Paulo
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const yearsRaw = searchParams.get("years") || searchParams.get("year");
    if (!yearsRaw) {
      return NextResponse.json(
        { error: "Informe years (ex.: 2025,2026) ou year." },
        { status: 400 }
      );
    }
    const years = yearsRaw
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= 1900 && n <= 2200);
    if (years.length === 0) {
      return NextResponse.json({ error: "Ano(s) invalido(s)." }, { status: 400 });
    }
    const uf = searchParams.get("uf")?.trim().toUpperCase() || undefined;
    const city = searchParams.get("city")?.trim() || undefined;

    const data = getBrHolidaysForYears(years, uf || null, city || null);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Erro ao calcular feriados." },
      { status: 500 }
    );
  }
}
