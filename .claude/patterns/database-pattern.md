# Pattern — Data Access Layer (MongoDB)

> All MongoDB access goes through a typed data-access layer (DAL) in `data/`. Services call
> the DAL; nothing else touches the driver. This keeps queries testable, indexed, and
> consistent, and makes the official `mongodb` driver's connection reuse safe on Vercel.

## Connection (serverless-safe)

```ts
// lib/mongo.ts — reuse the client across invocations (Vercel/serverless)
import { MongoClient } from "mongodb";
const uri = process.env.MONGODB_URI!;
let clientPromise: Promise<MongoClient>;
declare global { var _mongo: Promise<MongoClient> | undefined; }
clientPromise = global._mongo ??= new MongoClient(uri).connect();
export const db = async () => (await clientPromise).db(process.env.MONGODB_DB);
```

## DAL module

```ts
// data/leads.ts
import { db } from "@/lib/mongo";
import type { Lead } from "@/lib/types";
const col = async () => (await db()).collection<Lead>("leads");

export const leads = {
  async insert(doc: Omit<Lead, "_id" | "createdAt" | "updatedAt">) {
    const now = new Date();
    const full = { ...doc, createdAt: now, updatedAt: now };
    const { insertedId } = await (await col()).insertOne(full as Lead);
    return { ...full, _id: insertedId } as Lead;
  },
  async findById(id: ObjectId) { return (await col()).findOne({ _id: id }); },
  async existsByEmail(email: string) { return !!(await (await col()).findOne({ email }, { projection: { _id: 1 } })); },
};
```

## Rules
- **Every collection has a DAL module** in `data/`; typed with the driver's generics.
- **Every document has** `_id`, `createdAt`, `updatedAt`; mutating writes bump `updatedAt`.
- **Indexes are declared in code** (a `data/indexes.ts` that runs on deploy) and documented in
  `knowledge/database/`. Never rely on an un-indexed query in a hot path.
- **Projections:** fetch only needed fields, especially for existence checks and lists.
- **Multi-tenancy:** every query is scoped by `orgId` (or `ownerId`) — never a global find.
- **No cross-collection joins in app code beyond simple `$lookup`** in a defined aggregation;
  prefer explicit references and small, indexed follow-up queries.
- **Audit + soft delete:** prefer `deletedAt` soft deletes for revenue data; hard-delete only
  via an explicit, audited path.

## Common mistakes
- New `MongoClient` per request (exhausts connections on Vercel) → use the shared promise.
- Un-indexed filter/sort on a growing collection.
- Forgetting `orgId` scoping → data leak across tenants.

See also: `skills/database/design-schema.md`, `service-pattern.md`.
