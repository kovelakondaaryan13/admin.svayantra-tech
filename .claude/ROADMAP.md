# ROADMAP.md

> Mirrors **Part 8** of `../REVENUEOS_BLUEPRINT.md`. This is the mutable, always-current view
> of where the build is going. Update it whenever scope or sequencing changes, and mark
> milestones done as they ship. Keep milestones small enough to build, test, and demo
> independently.

## Status legend
`⬜ planned` · `🟨 in progress` · `✅ done` · `🅿️ parked`

## Milestones

> The blueprint (Parts 1–8) is not yet generated, so the milestone list below is a
> **placeholder skeleton** to be replaced/expanded from blueprint Part 8. It is sequenced
> from a thin walking-skeleton outward.

| # | Milestone | Status | Goal (one line) |
|---|-----------|--------|------------------|
| M0 | Dev environment (`.claude/`) | ✅ done | Living knowledge base scaffolded (Part 9) + architecture review. |
| M1 | Walking skeleton | 🟨 in progress | Auth + Leads + stage engine + AI chat (approval-gated). Code built; pending run against real creds + Vercel deploy. |
| M2 | Core CRM objects | 🟨 backend done | Companies, Contacts, Leads, Tasks (+Meetings) CRUD + activity timeline. UI screens pending. |
| M3 | Conveyor-belt workflow | 🟨 backend done | Stage engine + "what should I work on?" orchestration (AI tools). |
| M4 | AI tools + approvals | 🟨 backend done | Tool catalog, permission gating, human-approval flow, audit log. Streaming pending. |
| M5 | Proposals & quotations | 🟨 backend done | Deterministic templating + AI narrative + human approval. PDF export pending. |
| M6 | Dashboards | 🟨 backend + 1 screen | Single composable role-scoped dashboard (aggregation + page). |
| M7 | Knowledge search | 🟨 backend done | Unified Mongo search; Notion behind interface (stub); vector = Atlas (ADR-003). |
| M8 | Meeting prep | 🟨 backend done | "Prepare me for today's meeting" AI brief endpoint. |
| M9 | Notifications + settings + hardening | 🟨 partial | Notifications + settings APIs done. Resend email, Sentry/PostHog, pagination, security pass pending. |

> For each milestone the blueprint records: Goals · Features · Estimated Complexity ·
> Dependencies · Risks · Expected Outcome. Copy that detail here as Part 8 is finalized.

## Change log
- **M0 completed** — `.claude/` development environment created (Part 9). All Parts 1–8
  still pending.
