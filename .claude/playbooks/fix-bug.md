# Playbook — Fix a Bug

> Reproduce → isolate → fix → prove → prevent. Don't fix what you can't reproduce.

## 1. Reproduce
- Get a deterministic repro (steps, inputs, environment). If you can't reproduce it, gather
  more data (Sentry event, logs, PostHog session) before touching code.
- Capture the expected vs actual behavior in one sentence.

## 2. Isolate
- Find the smallest failing unit. Use the debugger prompt (`../prompts/debugger.md`) if useful.
- Check `memory/known-issues.md` — is this already known or related to existing debt?

## 3. Write a failing test first
- Encode the repro as an automated test that fails now. This proves the bug and prevents
  regression. See `skills/testing/write-tests.md`.

## 4. Fix
- Fix the **root cause**, not the symptom. If a true fix is too large now, apply a scoped
  mitigation and log the real fix in `memory/technical-debt.md`.
- Keep the change minimal and match surrounding conventions.

## 5. Prove
- The new test passes; the full suite passes; exercise the real flow.

## 6. Prevent & document
- Add/After-action: record cause + fix in `memory/known-issues.md` (Lessons learned).
- If the bug reveals a missing convention, update the relevant `skills/*` or `patterns/*`.
- If it was a design flaw, add a `DECISIONS.md` entry.

## Severity triage
- **P0 (prod down / data loss):** mitigate first (rollback via `release.md`), then root-cause.
- **P1/P2:** normal flow above. Always leave a test behind.
