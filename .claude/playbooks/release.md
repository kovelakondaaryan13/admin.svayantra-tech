# Playbook — Release

> Ship to production (Vercel) safely and reversibly. RevenueOS handles revenue data — a bad
> release is a business incident, so bias toward small, reversible releases.

## Pre-flight
- [ ] All PRs merged to the release branch; CI green (typecheck, lint, tests, build).
- [ ] `memory/project-state.md` and `../ROADMAP.md` reflect what's shipping.
- [ ] Migrations (if any) are backward-compatible (expand → migrate → contract). Never a
      destructive schema change in the same release as the code that depends on it.
- [ ] New env vars present in Vercel (all environments). See `knowledge/engineering/` env list.
- [ ] Feature flags default safe (new risky features off).

## Deploy
- Merge to `main` → Vercel builds & deploys. Prefer deploying during low-traffic windows.
- Verify the production deployment: health check, sign-in, one core flow (e.g. create lead →
  AI chat), and that Sentry shows no new error spike.

## Post-release
- Watch Sentry + PostHog for ~30 min. Compare error rate to baseline.
- If broken: **roll back first** (Vercel instant rollback to previous deployment), then
  root-cause via `fix-bug.md`. Don't debug forward on a broken prod.

## Record
- Note the release (what shipped, date) in `memory/completed-features.md`.
- Any incident → `memory/known-issues.md` with cause + prevention.
- Any deploy-time decision (flag, migration approach) → `DECISIONS.md`.
