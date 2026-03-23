import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedRole } from "@/lib/authRoles";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const raw = request.cookies.get("session_role")?.value;
  const isAuthenticated = isAuthenticatedRole(raw);

  const publicPaths = ["/login", "/api/auth/login", "/api/auth/me", "/api/auth/logout"];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  if (!isAuthenticated && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
