import { NextRequest, NextResponse } from "next/server";
import { hasPlanFeature } from "@/lib/planAccess";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64").toString("utf8");
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const error = request.nextUrl.searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        new URL(`/?google=error&reason=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/?google=error&reason=missing_params", request.url)
      );
    }

    const parsedState = JSON.parse(fromBase64Url(state)) as {
      businessId?: string;
      returnTo?: string;
    };
    const businessId = parsedState.businessId;
    const returnTo = parsedState.returnTo || "/";

    if (!businessId) {
      return NextResponse.redirect(
        new URL("/?google=error&reason=invalid_state", request.url)
      );
    }

    const supabaseEarly = getSupabaseAdmin();
    if (!(await hasPlanFeature(supabaseEarly, businessId, "google_calendar"))) {
      return NextResponse.redirect(
        new URL("/?google=error&reason=plan_feature_required", request.url)
      );
    }

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(
        new URL("/?google=error&reason=oauth_env_missing", request.url)
      );
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      }).toString()
    });

    const tokenJson = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (!tokenResponse.ok || !tokenJson.access_token) {
      return NextResponse.redirect(
        new URL(
          `/?google=error&reason=${encodeURIComponent(
            tokenJson.error || "token_exchange_failed"
          )}`,
          request.url
        )
      );
    }

    const expiresAt = new Date(
      Date.now() + (tokenJson.expires_in ?? 3600) * 1000
    ).toISOString();

    const supabase = getSupabaseAdmin();
    const { error: upsertError } = await supabase
      .from("calendar_connections")
      .upsert(
        {
          business_id: businessId,
          provider: "google",
          calendar_id: "primary",
          access_token: tokenJson.access_token,
          refresh_token: tokenJson.refresh_token ?? null,
          token_expires_at: expiresAt
        },
        { onConflict: "business_id,provider" }
      );

    if (upsertError) {
      return NextResponse.redirect(
        new URL("/?google=error&reason=db_upsert_failed", request.url)
      );
    }

    const destination = new URL(returnTo, request.url);
    destination.searchParams.set("google", "connected");
    return NextResponse.redirect(destination);
  } catch {
    return NextResponse.redirect(
      new URL("/?google=error&reason=unexpected_error", request.url)
    );
  }
}
