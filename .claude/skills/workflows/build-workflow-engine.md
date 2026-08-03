# Skill — Build a Workflow / Stage Engine

## Purpose
Implement a deterministic staged process (sales pipeline, proposal approval, onboarding) as a
validated state machine — the "conveyor belt" that AI advises but does not control.

## When to use
Any multi-stage process with rules about what can move where and what happens on transition.

## Best practices
- **Explicit stages + allowed transitions** as data (see `../../patterns/workflow-pattern.md`).
  Reject any transition not permitted.
- **Guards as pure functions:** preconditions for entering a stage (e.g. `proposal` needs an
  attached proposal). Easy to test.
- **Side effects through the service layer:** audit, event emit, notification, next-task
  creation — after the transition write succeeds.
- **Keep stage history**, not just the current stage — needed for cycle-time and "why are
  deals slowing down?" analytics.
- **AI is advisory:** it can recommend or prepare prerequisites; a human (or explicitly
  approved automation) commits. Record the actor.
- **Deterministic-first:** the engine is plain software. Don't ask a model to enforce rules.

## Common mistakes
- Free-text/implicit stages → impossible to reason about or report on.
- AI mutating stage directly with no guard/approval.
- Storing only current stage (losing history).
- Firing notifications before the write commits.

## Code conventions
- Transitions + guards in `workflows/<name>/`; committed via a `services/*` function.
- Events: `<entity>.stage_changed`. Time-in-stage derived from `stageHistory`.

## Example
See `../../patterns/workflow-pattern.md` for the full `moveStage` implementation and the
transition map.

## Checklist
- [ ] Stages + allowed transitions defined as data
- [ ] Pure-function guards per transition
- [ ] Transition committed via service; audit + event + next-task on success
- [ ] Stage history retained
- [ ] AI advisory only; human/approved-automation commits; actor recorded
- [ ] Documented in `knowledge/architecture/`
