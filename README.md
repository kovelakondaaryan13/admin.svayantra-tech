# RevenueOS

AI-native operating system for sales orgs — the first module of Svayantra Tech's **ABOS**
vision. This repo is a **living knowledge base**: read `.claude/CLAUDE.md` first.

> **Status:** Milestone **M1 — walking skeleton** (Auth + Leads + AI Chat). This is a
> runnable vertical slice, not the full product. See `.claude/ROADMAP.md`.

## What's here (M1)

- **Auth** — Better Auth (email/password) on MongoDB. Sign in/up at `/sign-in`.
- **Leads** — Companies-of-one CRUD object with a deterministic **conveyor-belt** stage
  engine (`new → qualified → meeting → proposal → negotiation → won/lost`).
- **AI Chat** — Claude orchestrator (`claude-opus-4-8`) with a tool catalog. Read/create
  tools execute; **advancing a deal's stage requires human approval** (v1 safety boundary).

## Architecture (frozen — see `.claude/`)

Route handler → service → typed Mongo data layer. AI tools wrap the same services humans use,
so audit + rules are shared. Multi-tenant via `orgId`. Patterns in `.claude/patterns/`,
decisions in `.claude/DECISIONS.md`.

## Run it

1. **Install** (Node 20+): `npm install`
2. **Configure**: `cp .env.example .env.local` and fill in `MONGODB_URI`,
   `BETTER_AUTH_SECRET`, `ANTHROPIC_API_KEY`. (Names: `.claude/knowledge/engineering/`.)
3. **Indexes**: `npm run ensure-indexes`
4. **(optional) Seed demo leads**: `npm run seed`
5. **Dev**: `npm run dev` → http://localhost:3000
6. Sign up, then you're redirected to `/leads`. Ask the assistant *"add a lead named Acme"*,
   then *"move Acme to qualified"* → approve the proposed action.

## Verify a change end-to-end

- `npm run typecheck` — no type errors.
- Drive the flow: sign in → create a lead (UI/AI) → advance a stage → confirm the leads table
  and the `auditLogs` collection both reflect it.

## Deploy

Vercel. Set all env vars in every environment. Node runtime is used for routes that touch the
Mongo driver / Better Auth. See `.claude/skills/deployment/deploy-to-vercel.md` and
`.claude/playbooks/release.md`.

## Notes / honest caveats

- Better Auth's API surface can shift across minor versions; if a symbol in `src/lib/auth.ts`
  doesn't resolve, check its docs — the shape is stable, field names may need a tweak.
- AI chat is non-streaming in M1 (returns final message + pending approvals). Streaming is a
  later milestone.
