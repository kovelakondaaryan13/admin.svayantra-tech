# Skill — Write Tests

## Purpose
Write tests that prove behavior and prevent regressions, focused where the risk actually is,
without chasing coverage numbers.

## When to use
Every feature (test the service + critical paths), every bug fix (regression test first).

## Best practices
- **Test the service layer hardest** — that's where business rules, guards, and audit live and
  it's framework-free/easy to test.
- **Test failure paths, not just happy paths:** invalid input, unauthorized, not found,
  conflict, business-rule violation.
- **Integration-test route handlers** for the auth/validate/authorize wiring (401/403/400/404).
- **Bug fix = failing test first**, then fix, then green.
- **Deterministic tests:** no real network, no real Claude/Notion calls — mock external
  clients at the wrapper boundary. Seed a test DB or mock the DAL.
- **Test AI tools** by asserting they call the right service with the right actor and respect
  approval gating — not by asserting model output.

## Common mistakes
- Only happy-path tests.
- Testing implementation details instead of behavior → brittle tests.
- Hitting real external APIs → flaky, slow, costly.
- Coverage theater (100% lines, 0 edge cases).

## Code conventions
- Unit tests next to code or under `__tests__/`; integration under `tests/integration/`.
- Mock external clients (`claude`, `notion`, `resend`, `cloudinary`) at their wrapper.
- Name tests by behavior: `it("rejects a stage skip from new to won")`.

## Example
```ts
it("requires approval before marking a deal won via AI", async () => {
  const res = await tools.moveStage.run({ leadId, to: "won" }, { actor: aiActor });
  expect(res).toEqual({ pendingApproval: true });      // AI cannot self-approve revenue writes
  expect(await leads.findById(leadId)).toHaveProperty("stage", "negotiation"); // unchanged
});
```

## Checklist
- [ ] Service business rules + guards covered
- [ ] Failure paths tested (400/401/403/404/409/422)
- [ ] Bug fix includes a regression test
- [ ] External clients mocked; tests deterministic
- [ ] AI tools tested for service call + approval gating
