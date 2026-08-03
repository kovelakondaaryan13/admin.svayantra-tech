# Skill — Model Sales-Domain Features

## Purpose
Build RevenueOS's sales-specific features (pipeline, proposals, quotations, meeting prep,
follow-ups) with the right correctness and liability guardrails — because these touch money
and customer trust.

## When to use
Any feature in the revenue domain: lead pipeline, conveyor-belt workflow, proposal/quotation
generation, meeting preparation, follow-up automation.

## Best practices
- **Pipeline = deterministic state machine** (`../workflows/build-workflow-engine.md`). Stages,
  guarded transitions, retained history for cycle-time analytics.
- **Proposals & quotations = deterministic template + AI drafting + human approval.** The
  **numbers, terms, and totals are computed by software**, never invented by the model; the AI
  drafts narrative/positioning around them. A human approves before it's sent. This is the
  single most important guardrail in the product.
- **Meeting prep = retrieval + summarization:** pull the lead/company/activity history
  (Mongo) + relevant knowledge (Notion) and summarize; don't fabricate facts about the client.
- **Follow-ups (AR / next-step):** deterministic scheduling; AI drafts the message, human or
  approved automation sends. Track outcomes for the "moat = verified outcome data" thesis.
- **Everything attributable + audited:** who/what advanced a deal, sent a proposal, changed a
  number. Revenue actions are audit-first.
- **Currency & locale:** amounts stored as integer minor units + currency code; format at the
  edge. India-first (₹) per `../../knowledge/business/svt-context.md`.

## Common mistakes
- Letting the model produce or alter prices/totals (liability + trust risk).
- AI auto-sending proposals/quotations without human approval in v1.
- Losing pipeline history → can't answer "why are deals slowing down?".
- Floating-point money.

## Code conventions
- Proposal/quotation generation: `services/proposal-service.ts` composes a typed template with
  software-computed line items; AI fills only narrative fields; status flow `draft → pending_
  approval → approved → sent`.
- Amounts: `{ amountMinor: number, currency: "INR" | "USD" }`.

## Checklist
- [ ] Pipeline is a guarded state machine with history
- [ ] Proposal/quotation numbers computed by software, not the model
- [ ] Human approval before any proposal/quotation is sent (v1)
- [ ] Meeting prep grounded in retrieved data, no fabrication
- [ ] Money as integer minor units + currency; ₹ default
- [ ] Revenue actions audited + attributable (incl. AI actor)
