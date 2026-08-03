/**
 * Typed data-access layer for the `leads` collection. Nothing outside this
 * module touches the driver. Canonical pattern: .claude/patterns/database-pattern.md
 */
import { ObjectId, type Collection, type Filter } from "mongodb";
import { db } from "@/lib/mongo";
import { activeWorkspace } from "@/lib/workspace";
import type { Lead, LeadDTO, LeadStage, StageChange } from "@/lib/types";

async function col(): Promise<Collection<Lead>> {
  return (await db()).collection<Lead>("leads");
}

/** Only non-deleted docs, scoped to the caller's org AND active workspace (demo/production). */
async function scope(orgId: string, extra: Filter<Lead> = {}): Promise<Filter<Lead>> {
  return { orgId, deletedAt: { $exists: false }, workspace: await activeWorkspace(), ...extra };
}

export function toDTO(lead: Lead): LeadDTO {
  const { _id, ...rest } = lead;
  return { id: _id.toHexString(), ...rest };
}

export const leads = {
  async insert(
    doc: Omit<Lead, "_id" | "createdAt" | "updatedAt" | "stage" | "stageHistory">,
  ): Promise<Lead> {
    const now = new Date();
    const full: Omit<Lead, "_id"> = {
      ...doc,
      stage: "new",
      stageHistory: [],
      workspace: await activeWorkspace(),
      createdAt: now,
      updatedAt: now,
    };
    const c = await col();
    const { insertedId } = await c.insertOne(full as Lead);
    return { ...full, _id: insertedId } as Lead;
  },

  async findById(orgId: string, id: string): Promise<Lead | null> {
    if (!ObjectId.isValid(id)) return null;
    const c = await col();
    return c.findOne(await scope(orgId, { _id: new ObjectId(id) }));
  },

  async listForOrg(orgId: string, limit = 100): Promise<Lead[]> {
    const c = await col();
    return c
      .find(await scope(orgId))
      .sort({ updatedAt: -1 })
      .limit(Math.min(limit, 500))
      .toArray();
  },

  async listLean(orgId: string, limit = 500): Promise<Lead[]> {
    const c = await col();
    return c
      .find(await scope(orgId))
      .project({
        _id: 1, orgId: 1, name: 1, email: 1, company: 1, stage: 1, ownerId: 1,
        source: 1, value: 1, health: 1, probability: 1, touchCount: 1,
        lastTouchAt: 1, createdAt: 1, updatedAt: 1,
        executionModel: 1, conveyorTeamId: 1, playbookKey: 1,
        currentStageOwnerId: 1, stageDeadline: 1,
        ownerHistory: 1, stageHistory: 1,
      })
      .sort({ updatedAt: -1 })
      .limit(Math.min(limit, 500))
      .toArray() as Promise<Lead[]>;
  },

  async search(orgId: string, query: string, limit = 20): Promise<Lead[]> {
    const c = await col();
    const rx = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    return c
      .find(await scope(orgId, { $or: [{ name: rx }, { company: rx }, { email: rx }] }))
      .sort({ updatedAt: -1 })
      .limit(Math.min(limit, 50))
      .toArray();
  },

  async update(
    orgId: string,
    id: string,
    patch: Partial<
      Pick<
        Lead,
        | "name" | "email" | "company" | "companyId" | "value" | "notes"
        | "source" | "campaign"
        | "score" | "intentScore" | "health" | "probability" | "estimatedCloseAt" | "nextAction"
        | "painPoints" | "competitors" | "buyingCommittee" | "aiSummary" | "aiSummaryAt"
        | "executionModel" | "conveyorTeamId" | "playbookKey" | "currentStageOwnerId" | "stageDeadline"
      >
    >,
  ): Promise<Lead | null> {
    if (!ObjectId.isValid(id)) return null;
    const c = await col();
    return c.findOneAndUpdate(
      await scope(orgId, { _id: new ObjectId(id) }),
      { $set: { ...patch, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
  },

  /** Conveyor handoff: set the current-stage SLA deadline and append owner history. */
  async recordHandoff(
    orgId: string,
    id: string,
    fields: { stageDeadline?: Date; currentStageOwnerId?: string; entry?: { ownerId: string; stage: LeadStage; at: Date } },
  ): Promise<Lead | null> {
    if (!ObjectId.isValid(id)) return null;
    const c = await col();
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (fields.stageDeadline !== undefined) set.stageDeadline = fields.stageDeadline;
    if (fields.currentStageOwnerId !== undefined) set.currentStageOwnerId = fields.currentStageOwnerId;
    const update: Record<string, unknown> = { $set: set };
    if (fields.entry) update.$push = { ownerHistory: fields.entry };
    return c.findOneAndUpdate(await scope(orgId, { _id: new ObjectId(id) }), update, { returnDocument: "after" });
  },

  /** Reassign a lead to a new owner (rep). */
  async setOwner(orgId: string, id: string, ownerId: string): Promise<Lead | null> {
    if (!ObjectId.isValid(id)) return null;
    const c = await col();
    return c.findOneAndUpdate(
      await scope(orgId, { _id: new ObjectId(id) }),
      { $set: { ownerId, updatedAt: new Date() } },
      { returnDocument: "after" },
    );
  },

  /** Record an outbound touch: increment the counter and stamp last-touch. */
  async logTouch(orgId: string, id: string): Promise<Lead | null> {
    if (!ObjectId.isValid(id)) return null;
    const c = await col();
    const now = new Date();
    return c.findOneAndUpdate(
      await scope(orgId, { _id: new ObjectId(id) }),
      { $inc: { touchCount: 1 }, $set: { lastTouchAt: now, updatedAt: now } },
      { returnDocument: "after" },
    );
  },

  async setStage(
    orgId: string,
    id: string,
    to: LeadStage,
    change: StageChange,
  ): Promise<Lead | null> {
    if (!ObjectId.isValid(id)) return null;
    const c = await col();
    return c.findOneAndUpdate(
      await scope(orgId, { _id: new ObjectId(id) }),
      {
        $set: { stage: to, updatedAt: new Date() },
        $push: { stageHistory: change },
      },
      { returnDocument: "after" },
    );
  },

  async softDelete(orgId: string, id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const c = await col();
    const res = await c.updateOne(await scope(orgId, { _id: new ObjectId(id) }), {
      $set: { deletedAt: new Date(), updatedAt: new Date() },
    });
    return res.modifiedCount === 1;
  },
};
