# Skill — Build a CRUD Module

## Purpose
Stand up a complete create/read/update/delete module for a domain object (lead, company,
contact, task…) end-to-end, consistently, and fast.

## When to use
Introducing a new first-class object in RevenueOS that users list, create, edit, and delete.

## Best practices
- **Build the vertical slice in order:** type → DAL (`data/`) → service (`services/`) → routes
  (`app/api/`) → UI (`app/(app)/`). Get one path working before adding breadth.
- **Reuse the patterns:** `database-pattern.md`, `service-pattern.md`, `api-pattern.md`,
  `ui-pattern.md`. A CRUD module is mostly assembling these.
- **Authorization per action** (`resource:create|read|update|delete`), tenant-scoped.
- **List endpoints paginate** and are indexed on the sort field.
- **Soft-delete** revenue objects; audit every mutation.
- **UI covers four states** (loading/empty/error/data) and optimistic feedback where safe.

## Common mistakes
- Copy-pasting a previous module and leaving stale field names / wrong collection.
- Unpaginated list endpoints (fine in dev, slow in prod).
- Forgetting authz on update/delete (the dangerous ones).
- Skipping the empty state.

## Code conventions
- One DAL module, one service, `route.ts` + `[id]/route.ts`, feature components under
  `components/<domain>/`.
- Shared list/detail/edit components composed from shadcn primitives.

## Example (module shape)
```
lib/types.ts                 → Lead
lib/schemas/lead.ts          → LeadCreateSchema, LeadUpdateSchema (zod)
data/leads.ts                → insert/find/update/softDelete/list
services/lead-service.ts     → business rules + audit + events
app/api/leads/route.ts       → GET list, POST create
app/api/leads/[id]/route.ts  → GET, PATCH, DELETE
app/(app)/leads/page.tsx     → list + empty state
components/leads/*            → table, form, detail
```

## Checklist
- [ ] Type + zod schemas defined
- [ ] DAL, service, routes, UI all built and wired
- [ ] Authz on every action; tenant-scoped; list paginated + indexed
- [ ] Soft-delete + audit on mutations
- [ ] UI four states handled
- [ ] Tests for service + routes; end-to-end exercised
- [ ] Docs: `knowledge/api/`, `knowledge/database/`, `memory/` updated
