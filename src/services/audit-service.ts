/** Read-only access to the audit trail (managers/founders). */
import { db } from "@/lib/mongo";
import type { AuditEntry } from "@/lib/types";
import type { User } from "@/lib/types";

export interface AuditDTO {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  meta?: Record<string, unknown>;
  at: Date;
}

export const auditService = {
  async list(user: User, limit = 100): Promise<AuditDTO[]> {
    const database = await db();
    const docs = await database
      .collection<AuditEntry>("auditLogs")
      .find({ orgId: user.orgId })
      .sort({ at: -1 })
      .limit(Math.min(limit, 500))
      .toArray();
    return docs.map((d) => ({
      id: d._id.toHexString(),
      actorId: d.actorId,
      action: d.action,
      entity: d.entity,
      meta: d.meta,
      at: d.at,
    }));
  },
};
