/**
 * "Raise Issue" — a lightweight in-app support/feedback loop. The AI attempts to resolve
 * the issue first (ai/classify-issue.ts); if it can't, the issue is auto-assigned to the
 * Owner, notified, and tracked through open → investigating → resolved → closed.
 */
import { repo, toDTO } from "@/data/collection";
import { db } from "@/lib/mongo";
import * as audit from "@/lib/audit";
import { activityService } from "@/services/activity-service";
import { notificationService } from "@/services/notification-service";
import { classifyIssue } from "@/ai/classify-issue";
import { isOwner } from "@/lib/iam";
import { NotFound, Forbidden } from "@/lib/errors";
import type { Issue, DTO } from "@/lib/entities";
import type { Employee } from "@/lib/org-entities";
import type { User } from "@/lib/types";
import type { z } from "zod";
import type { IssueCreateSchema, IssueUpdateSchema } from "@/lib/schemas/entities";

const issues = repo<Issue>("issues", { workspaceScoped: true });

/** The org's Owner, to auto-assign issues the AI can't resolve — prefers someone other
 *  than the reporter (an owner reporting an issue shouldn't get assigned to themselves). */
async function findAnOwner(orgId: string, excludeUserId: string): Promise<string | undefined> {
  const col = (await db()).collection<Employee>("employees");
  const other = await col.findOne({ orgId, roleKey: "owner", userId: { $ne: excludeUserId }, deletedAt: { $exists: false } });
  if (other) return other.userId;
  const any = await col.findOne({ orgId, roleKey: "owner", deletedAt: { $exists: false } });
  return any?.userId;
}

export const issueService = {
  async create(user: User, input: z.infer<typeof IssueCreateSchema>): Promise<DTO<Issue>> {
    const classification = await classifyIssue(input).catch(() => null);
    const canResolve = classification?.canResolve ?? false;
    const assigneeId = canResolve ? undefined : await findAnOwner(user.orgId, user.id);

    const doc = await issues.insert(user.orgId, {
      title: input.title,
      description: input.description,
      reporterId: user.id,
      status: canResolve ? "resolved" : "open",
      assigneeId,
      aiResponse: classification?.response,
      aiResolved: canResolve,
      resolvedAt: canResolve ? new Date() : undefined,
    });
    const id = doc._id.toHexString();
    await audit.record({ actor: user, action: "issue.create", entity: id, meta: { aiResolved: canResolve } });
    await activityService.log(user, "issue", id, "created", `Raised issue "${input.title}"`);
    if (!canResolve && assigneeId) {
      await notificationService.create(user.orgId, assigneeId, "issue", `New issue assigned to you: "${input.title}"`, "/account");
    }
    return toDTO(doc);
  },

  /** Owner sees every issue; everyone else sees what they reported or were assigned. */
  async list(user: User): Promise<DTO<Issue>[]> {
    const all = await issues.list(user.orgId, {}, 500);
    const scoped = isOwner(user) ? all : all.filter((i) => i.reporterId === user.id || i.assigneeId === user.id);
    return scoped.map(toDTO);
  },

  async get(user: User, id: string): Promise<DTO<Issue>> {
    const doc = await issues.findById(user.orgId, id);
    if (!doc) throw new NotFound("issue not found");
    if (!isOwner(user) && doc.reporterId !== user.id && doc.assigneeId !== user.id) {
      throw new Forbidden("you don't have access to this issue");
    }
    return toDTO(doc);
  },

  async update(user: User, id: string, input: z.infer<typeof IssueUpdateSchema>): Promise<DTO<Issue>> {
    const existing = await issues.findById(user.orgId, id);
    if (!existing) throw new NotFound("issue not found");
    if (!isOwner(user) && existing.reporterId !== user.id && existing.assigneeId !== user.id) {
      throw new Forbidden("you don't have access to this issue");
    }
    // Reassignment is an administrative action — reporters/assignees may update status
    // on their own issue, but only an Owner may hand it to someone else.
    if (input.assigneeId !== undefined && !isOwner(user)) {
      throw new Forbidden("only an owner can reassign an issue");
    }
    const patch: Partial<Issue> = { ...input };
    if (input.status === "resolved" || input.status === "closed") patch.resolvedAt = new Date();
    const doc = await issues.update(user.orgId, id, patch);
    if (!doc) throw new NotFound("issue not found");
    await audit.record({ actor: user, action: "issue.update", entity: id, meta: { status: input.status } });
    if (input.status) {
      await activityService.log(user, "issue", id, "status_changed", `Issue "${existing.title}" → ${input.status}`);
    }
    if (input.status && existing.reporterId !== user.id) {
      await notificationService.create(user.orgId, existing.reporterId, "issue", `Your issue "${existing.title}" is now ${input.status}`, "/account");
    }
    return toDTO(doc);
  },
};
