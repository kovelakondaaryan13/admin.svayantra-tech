# Pattern — Workflow / Stage Engine

> RevenueOS's "conveyor-belt sales workflow" is a **deterministic state machine**, not an AI
> free-for-all. AI *suggests* and *drafts*; the workflow engine *enforces* stage rules and
> transitions. This pattern is the canonical shape for any staged process (lead pipeline,
> proposal approval, onboarding).

## Model

```ts
// A workflow = ordered stages + allowed transitions + entry/exit rules + side effects.
type Stage = "new" | "qualified" | "meeting" | "proposal" | "negotiation" | "won" | "lost";

const transitions: Record<Stage, Stage[]> = {
  new:         ["qualified", "lost"],
  qualified:   ["meeting", "lost"],
  meeting:     ["proposal", "lost"],
  proposal:    ["negotiation", "lost"],
  negotiation: ["won", "lost"],
  won:         [],
  lost:        [],
};
```

## Rules
- **Transitions are explicit and validated.** A move to a stage not in `transitions[current]`
  is rejected (422). No skipping stages unless a rule allows it.
- **Guards:** each transition can require preconditions (e.g. `proposal` requires an attached
  proposal doc). Guards are pure functions, easy to test.
- **Side effects on transition** run through the service layer: audit entry, event emit
  (`lead.stage_changed`), notification, task creation ("next action"). Persist first, then
  side effects.
- **AI's role is advisory:** the AI can *recommend* a transition or *prepare* its
  prerequisites (draft proposal, suggest next task), but a human (or an explicitly approved
  automation) commits the transition. Record who/what actioned it (`actor`).
- **Every transition is auditable and reversible-by-record** (append a new state, keep
  history) — never silently overwrite stage history.
- **Time-in-stage is tracked** for pipeline-health analytics ("why are deals slowing down?").

## Template

```ts
// services/pipeline-service.ts
export async function moveStage(leadId, to: Stage, actor: User) {
  const lead = await leads.findById(leadId);
  if (!transitions[lead.stage].includes(to)) throw new BusinessRule(`cannot move ${lead.stage}→${to}`);
  await guards[to](lead);                                 // precondition check
  const updated = await leads.setStage(leadId, to, { from: lead.stage, at: new Date() });
  await audit.record({ actor, action: "lead.stage_changed", entity: leadId, meta: { from: lead.stage, to } });
  await emit("lead.stage_changed", { leadId, from: lead.stage, to });
  return updated;
}
```

## Common mistakes
- Letting the AI mutate stage directly without a guard/approval.
- Storing only the current stage (losing history needed for cycle-time analytics).
- Firing notifications before the transition write succeeds.

See also: `skills/workflows/build-workflow-engine.md`, `service-pattern.md`,
`knowledge/architecture/`.
