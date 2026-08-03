# memory/project-state.md

> The single, always-current snapshot of the project. Update this at the end of every major
> feature (see `../CLAUDE.md` → Documentation Rules). If this file disagrees with reality,
> the file is wrong — fix it.

**Last updated:** 2026-07-19
**Phase:** 1 — Implementation (M1 walking skeleton, built)
**App code exists:** Yes (M1 vertical slice)

## Current architecture (as-built)
Next.js App Router (`src/`) → route handlers (`src/app/api/*`) → services
(`src/services/*`) → typed Mongo data layer (`src/data/*`). Serverless-safe Mongo client
(`src/lib/mongo.ts`). Better Auth email/password (`src/lib/auth.ts`) + explicit authz policy
(`src/lib/authz.ts`). Claude orchestrator (`src/ai/orchestrator.ts`, `claude-opus-4-8`) with a
permission-gated tool catalog (`src/ai/tools.ts`); revenue-stage mutations require human
approval. In-process event bus + audit writer. Deterministic conveyor-belt stage engine in
`src/services/lead-service.ts`.

## What exists right now
- `.claude/` development environment (Part 9) + architecture review (ADR-003).
- **M1 code**: auth, Leads CRUD + stage engine, AI chat with approval-gated tools, sign-in UI,
  leads screen, index/seed scripts. See `README.md`.
- `REVENUEOS_BLUEPRINT.md` — still not generated (Parts 1–8 deferred; not needed for M1).

## Conventions in force
- TypeScript strict; route handler → service → data layer; typed Mongo DAL.
- `@/*` path alias → `src/*`. Node runtime on routes using the Mongo driver / Better Auth.
- Naming: `camelCase` vars/functions, `PascalCase` components/types, `kebab-case` files,
  plural `camelCase` collections.
- Every feature updates `memory/`, `DECISIONS.md`, and (if patterns repeat) `patterns/`.

## Immediate next step
Verify M1 runs end-to-end against real MongoDB Atlas + Anthropic credentials (`npm install`,
`npm run typecheck`, `npm run dev`). Then M2 (Companies/Contacts/Tasks + activity timeline)
per `../ROADMAP.md`.

## Known verification gap
The scaffold has **not** been executed here — no cloud credentials (`MONGODB_URI`,
`ANTHROPIC_API_KEY`) and no dependency install were available in the build environment. First
task before M2: install deps, typecheck, and drive the flow. Better Auth symbol names in
`src/lib/auth.ts` should be confirmed against the installed version.

## Pointers
- Roadmap → `../ROADMAP.md` · Decisions → `../DECISIONS.md`
- Active work → `active-features.md` · Done → `completed-features.md`
- Problems → `known-issues.md` · Debt → `technical-debt.md`
