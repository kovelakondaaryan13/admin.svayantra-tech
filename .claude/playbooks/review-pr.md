# Playbook — Review a Pull Request

> How to review a PR in RevenueOS. Reviews protect correctness, conventions, and the living
> knowledge base. Be direct and specific; approve only when the checklist passes.

## Review order (fastest signal first)
1. **Does it do what it claims?** Read the PR description and the Definition of Done.
2. **Correctness:** logic, edge cases, failure states, race conditions. For each concern, name
   a concrete failing input/scenario — don't hand-wave.
3. **Security:** authz check present (not just auth), input validated, no secrets, tenant
   scoping (`orgId`) on every query, AI writes gated by approval.
4. **Conventions:** follows `patterns/*`; naming; TS strict; error envelope; no DB in handlers.
5. **Tests:** happy path + failure paths; a bug fix includes a regression test.
6. **Living docs (mandatory):** did the PR run the Documentation Rules? `memory/*` updated?
   `DECISIONS.md` for architectural changes? patterns/skills updated if reasoning repeated?

## Checklist (block merge if any unchecked)
- [ ] Behavior matches description & DoD
- [ ] Correctness & edge cases sound
- [ ] Auth **and** authz enforced; tenant-scoped; AI writes approval-gated
- [ ] Input validated; errors mapped to status codes; no leaked internals
- [ ] Matches `patterns/*`; TS strict-clean; lint/format pass
- [ ] Tests cover happy + failure paths
- [ ] `memory/`, `DECISIONS.md`, `patterns/`, `skills/` updated as required
- [ ] No unexplained new dependency (record in `DECISIONS.md` if added)

## Tone
Comment with the reason and a suggested fix. Distinguish blocking issues from nits (prefix
nits with `nit:`). Prefer a short call over a long thread.
