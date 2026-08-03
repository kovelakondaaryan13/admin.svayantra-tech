/**
 * Audit-log writer. Every revenue-data mutation is recorded, attributable to a
 * human or an AI-on-behalf-of-human actor. See .claude/patterns/service-pattern.md
 */
import { db } from "@/lib/mongo";
import type { AuditEntry, User } from "@/lib/types";

export interface AuditInput {
  actor: User;
  action: string;
  entity: string;
  meta?: Record<string, unknown>;
  /** When the AI performed the action on the user's behalf. */
  viaAi?: boolean;
}

export async function record(input: AuditInput): Promise<void> {
  const database = await db();
  const entry: Omit<AuditEntry, "_id"> = {
    orgId: input.actor.orgId,
    actorId: input.viaAi ? `ai:${input.actor.id}` : input.actor.id,
    action: input.action,
    entity: input.entity,
    meta: input.meta,
    at: new Date(),
  };
  await database.collection("auditLogs").insertOne(entry);
}
