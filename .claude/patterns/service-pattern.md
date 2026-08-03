# Pattern — Service Layer

> The service layer owns business logic. It is the only place that composes data-access,
> emits events, writes audit logs, and enforces business rules. Route handlers and AI tools
> both call services — they never talk to the DB directly.

## Shape

```
services/<domain>-service.ts   e.g. lead-service.ts, proposal-service.ts
```

A service is a plain module of functions (or an object of functions). No framework coupling —
so it's callable from a route handler, an AI tool, a background job, or a test.

## Template

```ts
// services/lead-service.ts
import { leads } from "@/data/leads";               // typed data-access layer
import { emit } from "@/lib/events";                // event bus
import { audit } from "@/lib/audit";                // audit-log writer
import type { User } from "@/lib/types";

export const leadService = {
  async create(input: LeadCreateInput, actor: User) {
    // 1. business rules
    if (await leads.existsByEmail(input.email)) throw new Conflict("lead exists");
    // 2. persist
    const lead = await leads.insert({ ...input, ownerId: actor.id, stage: "new" });
    // 3. side effects (audit + events, fire after successful write)
    await audit.record({ actor, action: "lead.create", entity: lead._id });
    await emit("lead.created", { leadId: lead._id, actorId: actor.id });
    return lead;
  },
};
```

## Rules
- **One responsibility per function**; compose small functions.
- **Business rules live here**, not in handlers or the DB layer.
- **Side effects last:** persist first, then audit + emit events. Never emit an event for a
  write that failed.
- **Actor is explicit:** every mutating function takes the acting `User` (or `system`) so
  audit and authorization are always attributable — critical because AI can be the actor.
- **Errors are typed** (`Conflict`, `NotFound`, `Forbidden`, `BusinessRule`) and mapped to
  HTTP by `lib/http`.
- **Deterministic by default.** Only call the AI layer when the task genuinely needs it.

## Common mistakes
- Duplicating a rule in both the handler and the service.
- Emitting events before the write is confirmed.
- Forgetting the `actor`, breaking the audit trail for AI-initiated actions.

See also: `api-pattern.md`, `database-pattern.md`, `workflow-pattern.md`.
