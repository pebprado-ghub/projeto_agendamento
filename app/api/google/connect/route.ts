import { NextRequest, NextResponse } from "next/server";

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_REDIRECT_URI precisam estar configurados."
      },
      { status: 500 }
    );
  }

  const businessId = request.nextUrl.searchParams.get("businessId");
  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/";

  if (!businessId) {
    return NextResponse.json(
      { error: "Parametro businessId e obrigatorio." },
      { status: 400 }
    );
  }

  const state = toBase64Url(
    JSON.stringify({
      businessId,
      returnTo
    })
  );

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "https://www.googleapis.com/auth/calendar");
  googleAuthUrl.searchParams.set("access_type", "offline");
  googleAuthUrl.searchParams.set("prompt", "consent");
  googleAuthUrl.searchParams.set("include_granted_scopes", "true");
  googleAuthUrl.searchParams.set("state", state);

  return NextResponse.redirect(googleAuthUrl);
}
