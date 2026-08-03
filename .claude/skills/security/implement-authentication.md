# Skill — Implement Authentication & Authorization

## Purpose
Wire up Better Auth for authentication and a small explicit policy layer for authorization,
safely on Vercel's serverless runtime.

## When to use
Setting up auth initially, adding a protected route/endpoint, or adding a new role/permission.

## Best practices
- **Authentication (who you are):** Better Auth with the MongoDB adapter. Sessions handled
  server-side; guard server components/handlers with `requireUser()`.
- **Authorization (what you may do):** a **single explicit policy layer** (`lib/authz.ts`),
  not scattered `if (user.role === ...)` checks. Permissions are `resource:action`
  (`lead:create`, `proposal:approve`).
- **Roles → permissions** mapping in one place; RevenueOS is multi-role from day one
  (Founder, Head of Sales, Sales Rep, Operations).
- **Every handler checks authz after auth.** Authenticated ≠ authorized.
- **Tenant isolation:** resolve the user's `orgId` and scope every query by it. Never trust an
  `orgId` from the client.
- **Secrets:** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` from env; never commit.
- **Serverless:** reuse the Mongo client (see `patterns/database-pattern.md`); don't create
  per-request connections in the auth adapter.

## Common mistakes
- Checking auth but forgetting authz on mutating endpoints.
- Role checks sprinkled across the codebase → inconsistent, unauditable.
- Trusting a client-supplied `orgId`/`userId`.
- Session logic assuming a long-lived server process (it isn't, on Vercel).

## Code conventions
- `lib/auth.ts` → `requireUser()`, `getSession()`. `lib/authz.ts` → `can(user, permission)`
  + role→permission map. Protected routes call both.

## Example
```ts
// lib/authz.ts
const rolePerms: Record<Role, Permission[]> = {
  founder:      ["*"],
  head_of_sales:["lead:*","proposal:approve","dashboard:view"],
  sales_rep:    ["lead:create","lead:read","lead:update","proposal:create"],
  operations:   ["lead:read","quotation:create","task:*"],
};
export const can = (u: User, p: Permission) =>
  rolePerms[u.role].some(g => g === "*" || g === p || g === p.split(":")[0] + ":*");
```

## Checklist
- [ ] Better Auth configured with Mongo adapter; secrets from env
- [ ] `requireUser()` guards protected server code
- [ ] `can()` authz check on every mutating endpoint/tool
- [ ] Roles→permissions centralized in `lib/authz.ts`
- [ ] Every query scoped by server-resolved `orgId`
- [ ] Serverless-safe (shared Mongo client)
- [ ] Documented in `knowledge/architecture/authz-model.md`
