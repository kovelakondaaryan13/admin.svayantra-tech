# memory/technical-debt.md

> Debt we're knowingly taking on, so it's visible and payable — not silently accrued. Record
> what shortcut was taken, why, the risk it carries, and the trigger for paying it down.

**Last updated:** 2026-07-19

| ID | Debt | Why taken | Risk if unpaid | Pay-down trigger |
|----|------|-----------|----------------|------------------|
| TD-000 | Blueprint Parts 1–8 not yet written | Part 9 + M1 code prioritized | Downstream docs reference sections that don't exist yet | Generate Parts 1–8 |
| TD-001 | AI orchestrator omits `thinking` (no adaptive thinking) | Pinned `@anthropic-ai/sdk@0.68` doesn't type `thinking:{type:"adaptive"}` for opus-4-8 | Slightly weaker reasoning on complex chat/tool decisions | Bump `@anthropic-ai/sdk`, then set `thinking:{type:"adaptive"}` in `src/ai/orchestrator.ts` |
| TD-002 | AI chat is non-streaming | Simpler for M1 walking skeleton | Long answers feel like a pause; no token-by-token UX | Add streaming in the AI-tools milestone (M4) |
| TD-003 | List endpoints not paginated | Fast v1 build; capped at 200–500 server-side | Slow/large payloads once a collection grows | Add cursor+limit to every list endpoint before production scale (see `knowledge/api/endpoints.md`) |
| TD-004 | Thin UI (only Dashboard/Leads/AI screens) | Prioritized full API surface | Companies/Contacts/Tasks/etc. are API-only, no screens yet | Build screens per object in UI milestones |

## Anticipated debt (flagged pre-emptively from planning)
- **Notion on the AI critical path** — plan to wrap it behind a knowledge interface so it's
  swappable; skipping that wrapper early would be debt.
- **Comprehensive-v1 scope** — building most modules in v1 risks shallow implementations;
  track which modules are "thin" so they can be deepened later.
- **Three dashboards vs one** — if three code paths ship, converging them later is debt.
