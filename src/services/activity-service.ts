/** Append-only activity timeline. Every entity mutation logs one entry. */
import { repo, toDTO } from "@/data/collection";
import type { Activity, DTO } from "@/lib/entities";
import type { User } from "@/lib/types";

const activities = repo<Activity>("activities", { workspaceScoped: true });

export const activityService = {
  async log(
    user: User,
    entityType: Activity["entityType"],
    entityId: string,
    kind: string,
    summary: string,
    viaAi = false,
  ): Promise<void> {
    await activities.insert(user.orgId, {
      entityType,
      entityId,
      kind,
      summary,
      actorId: viaAi ? `ai:${user.id}` : user.id,
    });
  },

  async listForEntity(
    user: User,
    entityType: Activity["entityType"],
    entityId: string,
  ): Promise<DTO<Activity>[]> {
    const docs = await activities.list(user.orgId, { entityType, entityId } as never);
    return docs.map(toDTO);
  },

  async recent(user: User, limit = 50, since?: Date): Promise<DTO<Activity>[]> {
    const filter = since ? { createdAt: { $gte: since } } as never : {};
    const docs = await activities.list(user.orgId, filter, limit);
    return docs.map(toDTO);
  },
};
