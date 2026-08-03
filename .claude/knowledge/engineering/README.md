# knowledge/engineering

Durable engineering knowledge: conventions, environment, tooling, and the "how we build"
that isn't specific to one feature.

## What lives here
- `conventions.md` — coding/naming/folder conventions (source of truth; `CLAUDE.md`
  summarizes).
- `environment.md` — env vars & secrets inventory (names + purpose; **never actual values**).
- `tooling.md` — lint/format/test/CI setup.
- `error-handling.md`, `logging.md` — cross-cutting standards.

## Seeded conventions
- TypeScript strict everywhere.
- Layering: route handler → service → typed Mongo data-access layer.
- Naming: `camelCase` vars/functions, `PascalCase` components/types, `kebab-case` files,
  plural `camelCase` collections (`leads`, `auditLogs`).
- Response envelope `{ data } | { error }`; errors mapped to HTTP status by `lib/http`.
- Every query scoped by `orgId`. AI writes to revenue data require human approval (v1).

## Env vars (names only — values live in Vercel / local `.env`, never committed)
`MONGODB_URI`, `MONGODB_DB`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ANTHROPIC_API_KEY`,
`NOTION_API_KEY`, `RESEND_API_KEY`, `CLOUDINARY_URL`, `SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`,
`NEXT_PUBLIC_POSTHOG_HOST`. Keep this list current as integrations are added.
