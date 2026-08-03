# knowledge/architecture

The system's structure and the reasoning behind it. The durable companion to `DECISIONS.md`
(which is the chronological log) — this folder holds the current, coherent picture.

## What lives here
- `overview.md` — layered architecture diagram + description (route handler → service → data;
  AI orchestrator + tool catalog; event bus; background jobs).
- `ai-orchestration.md` — how the Claude orchestrator, tools, approvals, and memory fit.
- `knowledge-layer.md` — MongoDB (operational) + Notion (knowledge) unified search, with Notion
  behind a swappable interface.
- `security-model.md`, `authz-model.md` — roles, policies, tenant isolation.

## Source of truth
Blueprint Part 4 (System Design) + Part 6 (AI Architecture) — pending. Extract the stable
picture here as those parts are finalized and as the code makes them real.

## Seeded principles
- Layered, deterministic-first; AI orchestrates, humans approve revenue-data writes (v1).
- Multi-tenant: everything scoped by `orgId`.
- Notion never on the AI critical path without a fallback.
- Simplest design that survives the next 2 milestones — not the enterprise version.
