/** Signed OAuth `state` (CSRF protection) — HMAC over the payload with the auth secret. */
import crypto from "node:crypto";
import { env } from "@/lib/env";

function sig(data: string): string {
  return crypto.createHmac("sha256", env.BETTER_AUTH_SECRET()).update(data).digest("base64url");
}

export function signState(payload: Record<string, unknown>): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sig(data)}`;
}

export function verifyState<T>(state: string): T | null {
  const [data, s] = state.split(".");
  if (!data || !s) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig(data)), Buffer.from(s))) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
