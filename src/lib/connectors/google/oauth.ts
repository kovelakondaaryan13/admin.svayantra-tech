/**
 * Google OAuth 2.0 (authorization-code + offline refresh). Config-gated by
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. No API keys — refresh tokens only,
 * stored encrypted (see lib/connectors/credentials.ts).
 */
import { env } from "@/lib/env";
import type { OAuthProvider, TokenBundle } from "@/lib/connectors/types";

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
];

export const googleOAuth: OAuthProvider = {
  kind: "google_calendar",

  isConfigured() {
    return Boolean(env.GOOGLE_CLIENT_ID() && env.GOOGLE_CLIENT_SECRET());
  },

  authUrl(state: string) {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID() ?? "",
      redirect_uri: env.GOOGLE_REDIRECT_URI(),
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      scope: CALENDAR_SCOPES.join(" "),
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  async exchangeCode(code: string): Promise<TokenBundle> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID() ?? "",
        client_secret: env.GOOGLE_CLIENT_SECRET() ?? "",
        redirect_uri: env.GOOGLE_REDIRECT_URI(),
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
    const json = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };
    const accountEmail = await fetchEmail(json.access_token);
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: new Date(Date.now() + json.expires_in * 1000),
      scope: json.scope,
      accountEmail,
    };
  },

  async refresh(refreshToken: string): Promise<TokenBundle> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: env.GOOGLE_CLIENT_ID() ?? "",
        client_secret: env.GOOGLE_CLIENT_SECRET() ?? "",
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in: number; scope?: string };
    return {
      accessToken: json.access_token,
      refreshToken, // Google reuses the same refresh token
      expiresAt: new Date(Date.now() + json.expires_in * 1000),
      scope: json.scope,
    };
  },
};

async function fetchEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { email?: string };
    return json.email;
  } catch {
    return undefined;
  }
}
