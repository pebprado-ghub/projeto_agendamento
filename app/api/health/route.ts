import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "projeto-agendamento",
    timestamp: new Date().toISOString()
  });
}
