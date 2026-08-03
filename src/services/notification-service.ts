/** In-app notifications. Created by the system (events); read by the owner. */
import { repo, toDTO } from "@/data/collection";
import { NotFound } from "@/lib/errors";
import type { Notification, DTO } from "@/lib/entities";
import type { User } from "@/lib/types";

const notifications = repo<Notification>("notifications", { workspaceScoped: true });

export const notificationService = {
  async create(
    orgId: string,
    userId: string,
    type: string,
    message: string,
    link?: string,
  ): Promise<void> {
    await notifications.insert(orgId, { userId, type, message, link, read: false });
  },

  async listForUser(user: User): Promise<DTO<Notification>[]> {
    const docs = await notifications.list(user.orgId, { userId: user.id } as never);
    return docs.map(toDTO);
  },

  async markRead(user: User, id: string): Promise<void> {
    const doc = await notifications.findById(user.orgId, id);
    if (!doc || doc.userId !== user.id) throw new NotFound("notification not found");
    await notifications.update(user.orgId, id, { read: true } as never);
  },
};
