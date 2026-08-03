# Skill — Deploy to Vercel

## Purpose
Ship RevenueOS to Vercel reliably, with serverless-safe data access and correct environment
configuration. Pairs with `../../playbooks/release.md`.

## When to use
Initial deploy, adding an environment, or diagnosing a deploy/runtime-config issue.

## Best practices
- **Serverless-safe Mongo:** reuse a single `MongoClient` promise across invocations
  (`patterns/database-pattern.md`). A new client per request exhausts Atlas connections.
- **Env vars in all environments** (Production/Preview/Development). Keep the authoritative
  name list in `knowledge/engineering/README.md`; values only in Vercel/`.env`, never committed.
- **Prefer the Node.js runtime** for routes that use the Mongo driver (the Edge runtime can't
  run it). Set `export const runtime = "nodejs"` where needed.
- **Migrations backward-compatible** (expand → migrate → contract); never a destructive schema
  change alongside dependent code.
- **Preview deploys per PR** for review; production on merge to `main`.
- **Post-deploy verify:** health check + sign-in + one core flow; watch Sentry for spikes.
- **Instant rollback** is the first response to a bad prod deploy.

## Common mistakes
- Mongo driver on the Edge runtime → runtime crash.
- Missing an env var in Preview/Prod → works locally, 500s in the cloud (classic).
- Per-request DB client → connection-limit errors under load.
- Long-running work in a request handler → function timeout; move to a background/cron job.

## Code conventions
- `runtime`/`dynamic` route flags set intentionally; secrets via `process.env`.
- Index creation runs idempotently on deploy (`data/indexes.ts`), not per request.

## Checklist
- [ ] Shared Mongo client; Node runtime where the driver is used
- [ ] All env vars set in every environment; names documented
- [ ] Migrations backward-compatible
- [ ] CI green (typecheck/lint/test/build) before deploy
- [ ] Post-deploy smoke test + Sentry watch
- [ ] Rollback path known
