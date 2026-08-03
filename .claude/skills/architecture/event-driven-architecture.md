# Skill — Implement Event-Driven Architecture

## Purpose
Decouple side effects (notifications, analytics, follow-up tasks, AI triggers) from the action
that caused them, using a simple event bus — without over-engineering into a distributed
queue before it's needed.

## When to use
When an action has multiple downstream effects, or effects that may grow over time (e.g.
`lead.stage_changed` → notify manager + create next task + update analytics). Start simple.

## Best practices
- **Emit after the write succeeds**, from the service layer. Never emit for a failed write.
- **Events are facts, past tense:** `lead.created`, `lead.stage_changed`, `proposal.sent`.
  Payload carries ids + minimal data, not whole documents.
- **Handlers are idempotent** — the same event may be delivered more than once.
- **Start in-process** (a typed emitter) for v1 on Vercel; upgrade to a durable queue
  (e.g. a jobs collection + cron, or a managed queue) only when you need retries/durability.
  Record that upgrade in `DECISIONS.md`.
- **Never let a handler failure break the user action** — handlers run after the response or
  in a background job; log failures to Sentry.

## Common mistakes
- Emitting before the DB write is confirmed.
- Fat event payloads (whole documents) → coupling + token/bandwidth waste.
- Non-idempotent handlers → double emails, double tasks.
- Reaching for Kafka/queues on day one. Don't.

## Code conventions
- `lib/events.ts` exposes `emit(name, payload)` and `on(name, handler)`.
- Event names `namespace.pastTense`; payloads typed in `lib/events-types.ts`.
- Handlers live in `events/handlers/` and are registered centrally.

## Example
```ts
// in a service, after a successful write:
await emit("lead.stage_changed", { leadId, orgId, from, to, actorId: actor.id });

// events/handlers/notify-on-stage-change.ts
on("lead.stage_changed", async (e) => {
  if (e.to === "won") await notify.managers(e.orgId, `Deal won: ${e.leadId}`); // idempotent
});
```

## Checklist
- [ ] Emitted from service, after write success
- [ ] Past-tense name; minimal typed payload
- [ ] Handlers idempotent and Sentry-logged on failure
- [ ] In-process for now; durability upgrade only when justified (+ ADR)
- [ ] Documented in `knowledge/architecture/`
