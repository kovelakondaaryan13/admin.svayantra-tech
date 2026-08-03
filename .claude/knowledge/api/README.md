# knowledge/api

The API contract catalog — the durable record of every endpoint's shape. Keep this in sync
with the route handlers (Documentation Rules); it's how humans and AI discover the API without
reading every file.

## What lives here
- `endpoints.md` — the catalog. One row/section per endpoint.
- `conventions.md` — shared API conventions (mirrors `../../patterns/api-pattern.md`).

## Catalog format (per endpoint)
```
### <METHOD> /api/<path>
- Purpose:
- Auth: <required?>  Authz: <permission, e.g. lead:create>
- Request: <zod schema ref / body shape / query params>
- Response: { data: <shape> } | { error }
- Status codes: 200/201, 400, 401, 403, 404, 409, 422, 500 (which apply)
- Idempotent: <yes/no>  Emits events: <event names>
- Notes / edge cases:
```

## Seeded conventions
- Thin handlers; envelope `{ data } | { error }`; validation via zod; tenant-scoped by
  `orgId`. See `../../patterns/api-pattern.md` and `../../playbooks/write-api.md`.

_(No endpoints yet — app code pending. Add each endpoint here as it's built.)_
