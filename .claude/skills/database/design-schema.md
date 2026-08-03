# Skill — Design a MongoDB Schema

## Purpose
Design a MongoDB collection that is correct, indexed, tenant-safe, and shaped for its real
access patterns — reusable across any SVT product on the MongoDB stack.

## When to use
Adding a new collection, or reshaping an existing one, in RevenueOS (or any SVT MongoDB app).

## Best practices
- **Model for access patterns, not for normalization.** List the queries first; design the
  document to serve them with indexed reads.
- **Embed what's read together; reference what's large, shared, or independently mutated.**
- **Every document has** `_id`, `createdAt`, `updatedAt`, and a tenant scope (`orgId`).
- **Index every field you filter or sort on** in a hot path; use compound indexes matching the
  query shape (equality → sort → range order). Record indexes in `knowledge/database/`.
- **Prefer soft delete** (`deletedAt`) for revenue data; keep an audit trail.
- **Validate at the app boundary** (zod) and optionally with MongoDB schema validation.
- **Plan growth:** estimate document count/size; avoid unbounded arrays inside a document
  (use a child collection once an array can grow without limit).

## Common mistakes
- Un-indexed query on a growing collection (fine at 100 docs, dies at 100k).
- Unbounded embedded arrays (activities inside a lead) → hit the 16MB doc limit.
- Forgetting `orgId` → cross-tenant leaks.
- Storing derived data you can't keep consistent.

## Code conventions
- Collection names: plural `camelCase` (`leads`, `auditLogs`).
- Access only through a `data/<collection>.ts` DAL module (`patterns/database-pattern.md`).
- Timestamps `Date`; ids `ObjectId`; enums as string unions typed in `lib/types`.

## Example
```ts
// lib/types.ts
export interface Lead {
  _id: ObjectId;
  orgId: ObjectId;              // tenant scope — on every collection
  ownerId: ObjectId;            // assigned rep
  companyId?: ObjectId;         // reference (queried separately)
  name: string;
  email: string;
  stage: "new" | "qualified" | "meeting" | "proposal" | "negotiation" | "won" | "lost";
  stageHistory: { from: string; to: string; at: Date; actorId: ObjectId }[]; // bounded
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
// indexes: { orgId:1, stage:1, updatedAt:-1 }, { orgId:1, ownerId:1 }, { orgId:1, email:1 } unique
```

## Checklist
- [ ] Access patterns listed before schema written
- [ ] `_id`, `createdAt`, `updatedAt`, `orgId` present
- [ ] Indexes cover every hot-path filter/sort; declared in `data/indexes.ts` + documented
- [ ] No unbounded embedded arrays
- [ ] Soft-delete strategy decided
- [ ] Validation (zod) at the boundary
- [ ] Growth estimated; example document written to `knowledge/database/collections.md`
