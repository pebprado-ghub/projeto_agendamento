import { NextRequest, NextResponse } from "next/server";
import type { SessionRole } from "@/lib/authRoles";

type LoginInput = {
  username: string;
  password: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginInput;
    const username = (body.username || "").trim();
    const password = body.password || "";

    const hasExplicitDeveloper = Boolean(process.env.DEVELOPER_LOGIN_USER?.trim());
    const developerUser = hasExplicitDeveloper
      ? (process.env.DEVELOPER_LOGIN_USER || "").trim()
      : (process.env.ADMIN_LOGIN_USER || "").trim();
    const developerPass = hasExplicitDeveloper
      ? process.env.DEVELOPER_LOGIN_PASSWORD || ""
      : process.env.ADMIN_LOGIN_PASSWORD || "";

    const ownerUser = (
      process.env.OWNER_LOGIN_USER ||
      process.env.CLIENT_LOGIN_USER ||
      ""
    ).trim();
    const ownerPass =
      process.env.OWNER_LOGIN_PASSWORD || process.env.CLIENT_LOGIN_PASSWORD || "";

    let role: SessionRole | null = null;
    if (
      developerUser &&
      username === developerUser &&
      password === developerPass
    ) {
      role = "developer";
    } else if (ownerUser && username === ownerUser && password === ownerPass) {
      role = "owner";
    }

    if (!role) {
      return NextResponse.json(
        { error: "Usuario ou senha invalidos." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ message: "Login realizado.", role });
    response.cookies.set("session_role", role, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 12
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
