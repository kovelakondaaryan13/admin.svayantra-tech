/**
 * Generic tenant-scoped repository over a MongoDB collection. Every entity that
 * extends BaseDoc gets typed, orgId-scoped, soft-delete-aware CRUD without
 * per-object boilerplate. Canonical pattern: .claude/patterns/database-pattern.md
 */
import {
  ObjectId,
  type Collection,
  type Filter,
  type OptionalUnlessRequiredId,
  type UpdateFilter,
} from "mongodb";
import { db } from "@/lib/mongo";
import { activeWorkspace } from "@/lib/workspace";
import type { BaseDoc, DTO } from "@/lib/entities";

export function toDTO<T extends BaseDoc>(doc: T): DTO<T> {
  const { _id, ...rest } = doc;
  return { id: _id.toHexString(), ...rest } as unknown as DTO<T>;
}

/** Fields the repository manages; callers never set them directly. */
type NewDoc<T extends BaseDoc> = Omit<
  T,
  "_id" | "orgId" | "createdAt" | "updatedAt" | "deletedAt"
>;

export interface RepoOptions {
  /** When true, this collection is a CONTENT collection: reads are filtered by the active
   *  workspace and writes are tagged with it (demo/production data isolation). */
  workspaceScoped?: boolean;
}

export function repo<T extends BaseDoc>(name: string, opts: RepoOptions = {}) {
  const col = async (): Promise<Collection<T>> => (await db()).collection<T>(name);

  // Workspace-scoped reads add `workspace: <active>`; unscoped collections (identity/config)
  // are shared across modes. Async because the active workspace comes from org settings.
  const scope = async (orgId: string, extra: Filter<T> = {}): Promise<Filter<T>> => {
    const base: Record<string, unknown> = { orgId, deletedAt: { $exists: false }, ...extra };
    if (opts.workspaceScoped) base.workspace = await activeWorkspace();
    return base as Filter<T>;
  };

  return {
    col,

    async insert(orgId: string, doc: NewDoc<T>): Promise<T> {
      const now = new Date();
      const full = {
        ...doc,
        orgId,
        ...(opts.workspaceScoped ? { workspace: await activeWorkspace() } : {}),
        createdAt: now,
        updatedAt: now,
      };
      const c = await col();
      const { insertedId } = await c.insertOne(full as OptionalUnlessRequiredId<T>);
      return { ...(full as object), _id: insertedId } as unknown as T;
    },

    async findById(orgId: string, id: string): Promise<T | null> {
      if (!ObjectId.isValid(id)) return null;
      const c = await col();
      return (await c.findOne(await scope(orgId, { _id: new ObjectId(id) } as Filter<T>))) as T | null;
    },

    async list(orgId: string, filter: Filter<T> = {}, limit = 200): Promise<T[]> {
      const c = await col();
      return c
        .find(await scope(orgId, filter))
        .sort({ updatedAt: -1 } as never)
        .limit(Math.min(limit, 500))
        .toArray() as Promise<T[]>;
    },

    async update(orgId: string, id: string, patch: Partial<T>): Promise<T | null> {
      if (!ObjectId.isValid(id)) return null;
      const c = await col();
      return (await c.findOneAndUpdate(
        await scope(orgId, { _id: new ObjectId(id) } as Filter<T>),
        { $set: { ...patch, updatedAt: new Date() } } as UpdateFilter<T>,
        { returnDocument: "after" },
      )) as T | null;
    },

    async softDelete(orgId: string, id: string): Promise<boolean> {
      if (!ObjectId.isValid(id)) return false;
      const c = await col();
      const res = await c.updateOne(
        await scope(orgId, { _id: new ObjectId(id) } as Filter<T>),
        { $set: { deletedAt: new Date(), updatedAt: new Date() } } as UpdateFilter<T>,
      );
      return res.modifiedCount === 1;
    },
  };
}
