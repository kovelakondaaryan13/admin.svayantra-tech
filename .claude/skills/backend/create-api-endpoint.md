# Skill — Create an API Endpoint

## Purpose
Build a Next.js Route Handler that is thin, validated, authorized, and consistent with the
rest of RevenueOS.

## When to use
Any new HTTP endpoint under `app/api/`. Pairs with `../../patterns/api-pattern.md` (shape) and
`../../playbooks/write-api.md` (procedure).

## Best practices
- **Contract first:** method, path, request schema (zod), response envelope, auth + authz,
  idempotency. Record it in `knowledge/api/`.
- **Handler order:** auth → validate → authorize → delegate to service → respond.
- **No business logic or DB access in the handler.** Delegate to a service.
- **Consistent envelope:** `{ data }` / `{ error, code? }`. Never leak internals.
- **Right status codes:** 200/201, 400 (validation), 401, 403, 404, 409, 422 (business rule),
  500. 
- **Idempotency** for retry-prone POSTs (AI-invoked endpoints especially).

## Common mistakes
- Authenticated but not authorized (missing `can(...)` check).
- Validation skipped → garbage into the service.
- Returning raw `ObjectId`/Mongo errors to the client.
- Logic duplicated between handler and service.

## Code conventions
- Files: `app/api/<resource>/route.ts` (collection), `app/api/<resource>/[id]/route.ts` (item).
- Schemas in `lib/schemas/`; errors mapped by `lib/http`; session via `requireUser`.

## Example
See the full template in `../../patterns/api-pattern.md`. Minimal item GET:
```ts
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(req);
    const lead = await leadService.getForUser(params.id, user); // throws NotFound/Forbidden
    return NextResponse.json({ data: lead });
  } catch (err) { return handleError(err); }
}
```

## Checklist
- [ ] Contract documented in `knowledge/api/`
- [ ] auth → validate → authorize → service → respond
- [ ] zod validation; correct status codes; safe error envelope
- [ ] Tenant-scoped (`orgId`); AI-write endpoints approval-gated
- [ ] Tests: happy + 401 + 403 + 400 + 404
- [ ] `memory/` + pattern/skill updated if anything new emerged
