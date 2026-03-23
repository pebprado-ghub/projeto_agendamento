import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ message: "Logout realizado." });
  response.cookies.set("session_role", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 0
  });
  return response;
}
