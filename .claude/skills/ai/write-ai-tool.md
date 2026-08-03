# Skill — Write an AI Tool

## Purpose
Add a tool the Claude orchestrator can call, safely. Tools are how the AI *does* things in
RevenueOS — they must be typed, permission-gated, auditable, and (for writes) approval-gated.

## When to use
Whenever the AI needs to read or change application state (search leads, draft a proposal,
create a task, move a pipeline stage). If a task is deterministic and doesn't need reasoning,
consider a plain workflow instead of a tool.

## Best practices
- **A tool is a thin wrapper over a service function** — never new business logic. It reuses
  `services/*` so AI and humans share the same rules, audit, and events.
- **Declare a precise schema** (name, description, typed input). Descriptions are prompts —
  write them for a model.
- **Classify every tool:** read-only vs write; and for writes, whether it requires human
  approval. **In v1, all revenue-data mutations require human approval.**
- **Always pass the actor** (the AI, on behalf of user X) so audit logs are attributable.
- **Return compact, structured results** — only what the model needs, to save tokens.
- **Fail safe:** on error, return a clear message the model can reason about; never crash the
  conversation.

## Common mistakes
- Business logic in the tool instead of the service (drift between AI and human paths).
- A write tool with no approval gate touching revenue data.
- Verbose tool outputs blowing the context/token budget.
- Losing the actor → un-attributable audit trail.

## Code conventions
- Tools registered in `ai/tools/`; each exports `{ name, description, schema, run }`.
- `run(input, ctx)` where `ctx` carries the actor + orgId; calls a `services/*` function.
- Approval-required tools return a `pendingApproval` result instead of executing.

## Example
```ts
// ai/tools/create-task.ts
export const createTask = {
  name: "create_task",
  description: "Create a follow-up task for a lead. Use when the user asks to schedule next steps.",
  schema: z.object({ leadId: z.string(), title: z.string(), dueAt: z.string().datetime() }),
  requiresApproval: false,          // creating a task is low-risk; moving a deal to 'won' is not
  async run(input, ctx) {
    const task = await taskService.create(input, ctx.actor); // reuses service = audit + events
    return { ok: true, taskId: String(task._id) };
  },
};
```

## Checklist
- [ ] Wraps a service function (no new logic)
- [ ] Typed schema + model-friendly description
- [ ] Read/write classified; revenue-data writes require approval
- [ ] Actor + orgId threaded through; audit recorded
- [ ] Compact structured output
- [ ] Fails safe with a reasoned error
- [ ] Registered in `ai/tools/` and documented in `knowledge/architecture/ai-orchestration.md`
