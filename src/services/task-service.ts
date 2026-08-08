import { repo, toDTO } from "@/data/collection";
import { db } from "@/lib/mongo";
import * as audit from "@/lib/audit";
import { activityService } from "@/services/activity-service";
import { notificationService } from "@/services/notification-service";
import { employeeService } from "@/services/employee-service";
import { calendarService } from "@/services/calendar-service";
import { connectorStatuses } from "@/lib/connectors/credentials";
import { can, isOwner } from "@/lib/iam";
import { NotFound, Forbidden } from "@/lib/errors";
import type { Task, TaskComment, DTO } from "@/lib/entities";
import type { Employee } from "@/lib/org-entities";
import type { User } from "@/lib/types";

export type WorkScope = "mine" | "team" | "all";
import type { z } from "zod";
import type { TaskCreateSchema, TaskUpdateSchema } from "@/lib/schemas/entities";

const tasks = repo<Task>("tasks", { workspaceScoped: true });

/**
 * Object-level access check for a single task, mirroring listScoped's scoping so a
 * user can never read/edit/delete-by-id a task that "mine"/"team" would never have
 * shown them: the assignee, the creator, their manager (direct report), or the owner.
 */
async function assertTaskAccess(user: User, task: Task): Promise<void> {
  if (isOwner(user)) return;
  if (task.assigneeId === user.id || task.createdById === user.id) return;
  if (can(user, "users.read")) {
    const manager = await (await db())
      .collection<Employee>("employees")
      .findOne({ orgId: user.orgId, userId: task.assigneeId, managerUserId: user.id, deletedAt: { $exists: false } });
    if (manager) return;
  }
  throw new Forbidden("you don't have access to this task");
}

type CreateInput = z.infer<typeof TaskCreateSchema> & { recurrence?: Task["recurrence"] };

async function notify(orgId: string, userId: string, actorId: string, message: string) {
  if (userId && userId !== actorId) {
    await notificationService.create(orgId, userId, "task", message, "/home");
  }
}

const TASK_BLOCK_MINUTES = 30;

/**
 * Minimal actor for calendar operations scoped to a specific user id — a task's
 * assignee may not be the caller (e.g. assign_task), and the credential/calendar
 * lookups underneath only ever need id + orgId, never role/permissions.
 */
function calendarActor(userId: string, orgId: string): User {
  return { id: userId, email: "", role: "sales_rep", orgId, permissions: [], isOwner: false };
}

async function hasGoogleCalendar(userId: string, orgId: string): Promise<boolean> {
  const statuses = await connectorStatuses(calendarActor(userId, orgId));
  return statuses.some((s) => s.kind === "google_calendar" && s.status === "connected");
}

export const taskService = {
  async create(user: User, input: CreateInput, viaAi = false): Promise<DTO<Task>> {
    const assigneeId = input.assigneeId ?? user.id;
    const doc = await tasks.insert(user.orgId, {
      title: input.title,
      status: "open",
      priority: input.priority,
      dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
      assigneeId,
      createdById: user.id,
      leadId: input.leadId,
      companyId: input.companyId,
      followers: [user.id],
      comments: [],
      recurrence: input.recurrence ?? "none",
    });
    const id = doc._id.toHexString();
    await audit.record({ actor: user, action: "task.create", entity: id, viaAi });
    await activityService.log(user, "task", id, "created", `Task "${input.title}"`, viaAi);
    await notify(user.orgId, assigneeId, user.id, `You were assigned a task: "${input.title}"`);

    // Best-effort Google Calendar sync onto the ASSIGNEE's calendar — never blocks or
    // fails task creation.
    if (doc.dueAt && (await hasGoogleCalendar(assigneeId, user.orgId))) {
      try {
        const end = new Date(doc.dueAt.getTime() + TASK_BLOCK_MINUTES * 60_000);
        const event = await calendarService.create(calendarActor(assigneeId, user.orgId), {
          title: `Task: ${doc.title}`,
          description: doc.leadId ? `Linked to lead ${doc.leadId}. Created by STOS.` : "Created by STOS.",
          start: doc.dueAt.toISOString(),
          end: end.toISOString(),
        });
        await tasks.update(user.orgId, id, { googleEventId: event.id });
      } catch { /* calendar sync is best-effort; the task itself is already saved */ }
    }
    return toDTO(doc);
  },

  /** Assign the same task to every employee with a given role. Returns how many. */
  async assignToRole(user: User, roleKey: string, input: CreateInput): Promise<number> {
    const employees = await employeeService.list(user);
    const targets = employees.filter((e) => e.roleKey === roleKey && e.status === "active");
    for (const e of targets) await this.create(user, { ...input, assigneeId: e.userId });
    return targets.length;
  },

  /** Assign to every employee in an org unit (as department OR team). */
  async assignToUnit(user: User, unitId: string, input: CreateInput): Promise<number> {
    const employees = await employeeService.list(user);
    const targets = employees.filter(
      (e) => (e.departmentId === unitId || e.teamId === unitId) && e.status === "active",
    );
    for (const e of targets) await this.create(user, { ...input, assigneeId: e.userId });
    return targets.length;
  },

  async addComment(user: User, id: string, text: string): Promise<DTO<Task>> {
    const existing = await tasks.findById(user.orgId, id);
    if (!existing) throw new NotFound("task not found");
    await assertTaskAccess(user, existing);
    const comment: TaskComment = {
      authorId: user.id,
      authorName: user.name ?? user.email,
      text,
      at: new Date(),
    };
    const col = await tasks.col();
    const { ObjectId } = await import("mongodb");
    await col.updateOne(
      { _id: new ObjectId(id), orgId: user.orgId } as never,
      { $push: { comments: comment }, $set: { updatedAt: new Date() } } as never,
    );
    await audit.record({ actor: user, action: "task.comment", entity: id });
    // Notify assignee + followers (except the author).
    const recipients = new Set<string>([existing.assigneeId, ...(existing.followers ?? [])]);
    for (const r of recipients) await notify(user.orgId, r, user.id, `New comment on "${existing.title}"`);
    const updated = await tasks.findById(user.orgId, id);
    return toDTO(updated!);
  },

  async toggleFollower(user: User, id: string): Promise<DTO<Task>> {
    const existing = await tasks.findById(user.orgId, id);
    if (!existing) throw new NotFound("task not found");
    await assertTaskAccess(user, existing);
    const isFollowing = (existing.followers ?? []).includes(user.id);
    const col = await tasks.col();
    const { ObjectId } = await import("mongodb");
    await col.updateOne(
      { _id: new ObjectId(id), orgId: user.orgId } as never,
      isFollowing
        ? ({ $pull: { followers: user.id }, $set: { updatedAt: new Date() } } as never)
        : ({ $addToSet: { followers: user.id }, $set: { updatedAt: new Date() } } as never),
    );
    const updated = await tasks.findById(user.orgId, id);
    return toDTO(updated!);
  },

  async list(user: User): Promise<DTO<Task>[]> {
    return (await tasks.list(user.orgId)).map(toDTO);
  },

  /**
   * Work visibility, RBAC-enforced:
   *  - mine: only the caller's assigned work.
   *  - team: a manager's direct reports (+ self); requires users.read.
   *  - all: the whole org; owner only.
   */
  async listScoped(user: User, scope: WorkScope): Promise<DTO<Task>[]> {
    const all = await tasks.list(user.orgId, {}, 500);
    if (scope === "all") {
      if (!isOwner(user)) throw new Forbidden("only the owner can view all work");
      return all.map(toDTO);
    }
    if (scope === "team") {
      if (!can(user, "users.read")) throw new Forbidden("managers only");
      const employees = await (await db())
        .collection<Employee>("employees")
        .find({ orgId: user.orgId, deletedAt: { $exists: false } })
        .toArray();
      const reports = new Set<string>([user.id]);
      for (const e of employees) if (e.managerUserId === user.id) reports.add(e.userId);
      // Owner/heads with users.read but no direct reports see everyone (flat orgs).
      const scopeIds = reports.size > 1 ? reports : new Set(employees.map((e) => e.userId));
      return all.filter((t) => scopeIds.has(t.assigneeId)).map(toDTO);
    }
    return all.filter((t) => t.assigneeId === user.id).map(toDTO);
  },
  async listOpenForUser(user: User): Promise<DTO<Task>[]> {
    const docs = await tasks.list(user.orgId, { assigneeId: user.id, status: "open" } as never);
    return docs.map(toDTO);
  },
  async get(user: User, id: string): Promise<DTO<Task>> {
    const doc = await tasks.findById(user.orgId, id);
    if (!doc) throw new NotFound("task not found");
    await assertTaskAccess(user, doc);
    return toDTO(doc);
  },
  async update(
    user: User,
    id: string,
    input: z.infer<typeof TaskUpdateSchema>,
  ): Promise<DTO<Task>> {
    const before = await tasks.findById(user.orgId, id);
    if (!before) throw new NotFound("task not found");
    await assertTaskAccess(user, before);
    const patch: Partial<Task> = { ...(input as Partial<Task>) };
    if (input.dueAt) patch.dueAt = new Date(input.dueAt);
    const doc = await tasks.update(user.orgId, id, patch);
    if (!doc) throw new NotFound("task not found");
    await audit.record({ actor: user, action: "task.update", entity: id });
    if (input.status === "done" && before.status !== "done") {
      await activityService.log(user, "task", id, "completed", `Completed "${before.title}"`);
      if (before.createdById) {
        await notify(user.orgId, before.createdById, user.id, `"${before.title}" was completed`);
      }
    }

    // Recurring tasks: on completion, spawn the next occurrence.
    if (input.status === "done" && before.status !== "done" && before.recurrence && before.recurrence !== "none") {
      const shift = before.recurrence === "daily" ? 1 : before.recurrence === "weekly" ? 7 : 30;
      const nextDue = before.dueAt ? new Date(new Date(before.dueAt).getTime() + shift * 86400000) : undefined;
      await this.create(user, {
        title: before.title,
        priority: before.priority,
        assigneeId: before.assigneeId,
        leadId: before.leadId,
        companyId: before.companyId,
        dueAt: nextDue?.toISOString(),
        recurrence: before.recurrence,
      });
    }

    // Google Calendar sync — remove the event if it's no longer needed (done, or the
    // due date was cleared) or the assignee changed (stale on the old assignee's
    // calendar either way); (re)create/update on the current assignee's calendar if
    // the task is still open with a due date. All best-effort.
    let googleEventId = before.googleEventId ?? "";
    const assigneeChanged = input.assigneeId !== undefined && input.assigneeId !== before.assigneeId;
    if (googleEventId && (assigneeChanged || doc.status !== "open" || !doc.dueAt)) {
      if (await hasGoogleCalendar(before.assigneeId, user.orgId)) {
        try {
          await calendarService.remove(calendarActor(before.assigneeId, user.orgId), googleEventId);
        } catch { /* best-effort */ }
      }
      googleEventId = "";
    }
    if (doc.status === "open" && doc.dueAt && (await hasGoogleCalendar(doc.assigneeId, user.orgId))) {
      try {
        const end = new Date(doc.dueAt.getTime() + TASK_BLOCK_MINUTES * 60_000);
        if (googleEventId) {
          await calendarService.update(calendarActor(doc.assigneeId, user.orgId), googleEventId, {
            title: `Task: ${doc.title}`,
            start: doc.dueAt.toISOString(),
            end: end.toISOString(),
          });
        } else {
          const event = await calendarService.create(calendarActor(doc.assigneeId, user.orgId), {
            title: `Task: ${doc.title}`,
            description: doc.leadId ? `Linked to lead ${doc.leadId}. Created by STOS.` : "Created by STOS.",
            start: doc.dueAt.toISOString(),
            end: end.toISOString(),
          });
          googleEventId = event.id;
        }
      } catch { /* best-effort */ }
    }
    if (googleEventId !== (before.googleEventId ?? "")) {
      await tasks.update(user.orgId, id, { googleEventId });
    }

    return toDTO(doc);
  },
  async remove(user: User, id: string): Promise<void> {
    const existing = await tasks.findById(user.orgId, id);
    if (!existing) throw new NotFound("task not found");
    await assertTaskAccess(user, existing);
    if (existing.googleEventId && (await hasGoogleCalendar(existing.assigneeId, user.orgId))) {
      try {
        await calendarService.remove(calendarActor(existing.assigneeId, user.orgId), existing.googleEventId);
      } catch { /* best-effort */ }
    }
    if (!(await tasks.softDelete(user.orgId, id))) throw new NotFound("task not found");
    await audit.record({ actor: user, action: "task.delete", entity: id });
  },
};
