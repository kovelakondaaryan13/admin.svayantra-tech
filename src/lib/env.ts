/**
 * Central, validated access to environment variables.
 * Fail fast at startup rather than deep in a request. See
 * .claude/knowledge/engineering/README.md for the authoritative name list.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  // Required for the M1 walking skeleton.
  MONGODB_URI: () => required("MONGODB_URI"),
  MONGODB_DB: () => process.env.MONGODB_DB || "revenueos",
  BETTER_AUTH_SECRET: () => required("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: () => process.env.BETTER_AUTH_URL || "http://localhost:3000",
  ANTHROPIC_API_KEY: () => required("ANTHROPIC_API_KEY"),

  // Optional integrations (deferred past M1).
  NOTION_API_KEY: () => optional("NOTION_API_KEY"),
  RESEND_API_KEY: () => optional("RESEND_API_KEY"),
  SENTRY_DSN: () => optional("SENTRY_DSN"),

  // Knowledge engine — semantic memory (Qdrant) + embeddings (Voyage).
  QDRANT_URL: () => optional("QDRANT_URL"),
  QDRANT_API_KEY: () => optional("QDRANT_API_KEY"),
  VOYAGE_API_KEY: () => optional("VOYAGE_API_KEY"),
  EMBEDDING_MODEL: () => process.env.EMBEDDING_MODEL || "voyage-3-large",
  EMBEDDING_DIM: () => Number(process.env.EMBEDDING_DIM || 1024),

  // Application-level secret encryption (AES-256-GCM). 32-byte key, hex or base64.
  APP_ENCRYPTION_KEY: () => optional("APP_ENCRYPTION_KEY"),

  // Google connector (OAuth 2.0).
  GOOGLE_CLIENT_ID: () => optional("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: () => optional("GOOGLE_CLIENT_SECRET"),
  GOOGLE_REDIRECT_URI: () =>
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/api/connectors/google/oauth/callback`,

  // DNS override (see lib/database/dns.ts).
  DNS_SERVERS: () => optional("DNS_SERVERS"),

  // The one master/founder account — set once via `npm run bootstrap-owner`. Used to
  // protect that specific account from being role-changed or removed by anyone else,
  // even another owner. See employee-service.ts's assertNotProtectedOwner().
  OWNER_EMAIL: () => optional("OWNER_EMAIL"),

  // Extra origins Better Auth should trust beyond BETTER_AUTH_URL (comma-separated),
  // e.g. a production domain fronting the same deploy, or Vercel preview URLs.
  // BETTER_AUTH_URL itself must still match whatever origin most traffic comes from.
  TRUSTED_ORIGINS: () =>
    (process.env.TRUSTED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
};
