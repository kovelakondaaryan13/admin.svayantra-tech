/**
 * Employee directory = the org membership + role source of truth (decoupled from
 * Better Auth, which only handles authentication). Role/org/department resolve from
 * here, so changing someone's role takes effect on their next request.
 */
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/mongo";
import { repo, toDTO } from "@/data/collection";
import * as audit from "@/lib/audit";
import { assertPermission, isOwner } from "@/lib/iam";
import { env } from "@/lib/env";
import { NotFound, BusinessRule, Forbidden } from "@/lib/errors";
import type { Employee } from "@/lib/org-entities";
import type { DTO } from "@/lib/entities";
import type { User } from "@/lib/types";
import type { z } from "zod";
import type { EmployeeCreateSchema, SelfProfileUpdateSchema } from "@/lib/schemas/admin";

/** A shareable temporary password for a freshly-provisioned account. */
function tempPassword(): string {
  return "Svt-" + randomBytes(6).toString("base64url");
}

const employees = repo<Employee>("employees");

/**
 * Assigning a role is a distinct, more sensitive action than editing an employee's
 * other fields — users.edit alone (e.g. HR) must not be able to grant admin-tier
 * access or self-promote. Only roles.manage can grant super_admin/admin; only an
 * existing owner can grant owner (there is exactly one, set via bootstrap-owner).
 */
function assertCanAssignRole(actor: User, roleKey: string): void {
  if (roleKey === "owner") {
    if (!isOwner(actor)) throw new Forbidden("only an owner can grant the owner role");
    return;
  }
  if (roleKey === "super_admin" || roleKey === "admin") {
    assertPermission(actor, "roles.manage");
  }
}

/**
 * The one master/founder account (OWNER_EMAIL) is off-limits to everyone but itself —
 * even another owner cannot change its role or otherwise edit it. Multiple owners can
 * exist (e.g. a co-founder), but only the master account can touch the master account.
 * No-op if OWNER_EMAIL isn't configured.
 */
function assertNotProtectedOwner(actor: User, target: Employee): void {
  const protectedEmail = env.OWNER_EMAIL();
  if (!protectedEmail) return;
  if (target.email === protectedEmail && actor.email !== protectedEmail) {
    throw new Forbidden("this account is protected and can only be changed by signing in as it");
  }
}

export interface Membership {
  orgId: string;
  role: string;
  departmentId?: string;
  teamId?: string;
  managerUserId?: string;
}

async function coll() {
  return (await db()).collection<Employee>("employees");
}

export const employeeService = {
  /** JIT-provision + return the membership for an authenticated user. */
  async getOrCreateMembership(
    userId: string,
    seed: { email: string; name?: string; orgId: string },
  ): Promise<Membership> {
    const c = await coll();
    let doc = await c.findOne({ userId, deletedAt: { $exists: false } });
    if (!doc) {
      doc = await employees.insert(seed.orgId, {
        userId,
        name: seed.name ?? seed.email,
        email: seed.email,
        roleKey: "sales_rep",
        status: "active",
        joinedAt: new Date(),
      });
    }
    return {
      orgId: doc.orgId,
      role: doc.roleKey,
      departmentId: doc.departmentId,
      teamId: doc.teamId,
      managerUserId: doc.managerUserId,
    };
  },

  /** Bootstrap/admin: set a user's role directly (used by the owner seed script). */
  async setRole(userId: string, roleKey: string, seed?: { email: string; name?: string; orgId: string }): Promise<void> {
    const c = await coll();
    const existing = await c.findOne({ userId });
    if (existing) {
      await c.updateOne({ userId }, { $set: { roleKey, updatedAt: new Date() } });
    } else if (seed) {
      await employees.insert(seed.orgId, {
        userId,
        name: seed.name ?? seed.email,
        email: seed.email,
        roleKey,
        status: "active",
        joinedAt: new Date(),
      });
    }
  },

  /**
   * Create a new employee — provisions a Better Auth account (or links an existing one),
   * then writes the directory record. Returns a temp password to share when a fresh
   * account was created (email invites require Resend; this keeps onboarding self-serve).
   * This is what makes the team *data*, not code — no redeploy to add a hire.
   */
  async create(
    user: User,
    input: z.infer<typeof EmployeeCreateSchema>,
  ): Promise<{ employee: DTO<Employee>; tempPassword?: string }> {
    assertPermission(user, "users.edit");
    assertCanAssignRole(user, input.roleKey);
    const c = await coll();
    const dupe = await c.findOne({ email: input.email, orgId: user.orgId, deletedAt: { $exists: false } });
    if (dupe) throw new BusinessRule("an employee with that email already exists");

    const users = (await db()).collection<{ _id: unknown; id?: string; email: string }>("user");
    let authUser = await users.findOne({ email: input.email });
    let userId: string;
    let pwd: string | undefined;
    if (authUser) {
      userId = authUser.id ?? String(authUser._id);
    } else {
      pwd = tempPassword();
      const res = (await auth.api.signUpEmail({
        body: { email: input.email, password: pwd, name: input.name },
      })) as { user?: { id?: string } };
      userId = res.user?.id ?? "";
      if (!userId) {
        authUser = await users.findOne({ email: input.email });
        userId = authUser?.id ?? String(authUser?._id ?? "");
      }
      if (!userId) throw new BusinessRule("could not provision an account for that email");
    }

    const doc = await employees.insert(user.orgId, {
      userId,
      name: input.name,
      email: input.email,
      roleKey: input.roleKey,
      title: input.title,
      departmentId: input.departmentId,
      managerUserId: input.managerUserId,
      capacity: input.capacity,
      skills: input.skills,
      defaultExecutionModel: input.defaultExecutionModel,
      availability: "available",
      status: "active",
      joinedAt: new Date(),
    });
    await audit.record({
      actor: user,
      action: "employee.create",
      entity: doc._id.toHexString(),
      meta: { email: input.email, role: input.roleKey },
    });
    return { employee: toDTO(doc), tempPassword: pwd };
  },

  async list(user: User): Promise<DTO<Employee>[]> {
    assertPermission(user, "users.read");
    return (await employees.list(user.orgId)).map(toDTO);
  },

  async get(user: User, id: string): Promise<DTO<Employee>> {
    assertPermission(user, "users.read");
    const doc = await employees.findById(user.orgId, id);
    if (!doc) throw new NotFound("employee not found");
    return toDTO(doc);
  },

  async update(
    user: User,
    id: string,
    patch: Partial<
      Pick<
        Employee,
        | "roleKey" | "departmentId" | "teamId" | "managerUserId" | "phone" | "status" | "name"
        | "title" | "skills" | "capacity" | "availability" | "defaultExecutionModel"
      >
    >,
  ): Promise<DTO<Employee>> {
    assertPermission(user, "users.edit");
    if (patch.roleKey) assertCanAssignRole(user, patch.roleKey);
    const before = await employees.findById(user.orgId, id);
    if (!before) throw new NotFound("employee not found");
    assertNotProtectedOwner(user, before);
    const updated = await employees.update(user.orgId, id, patch);
    // Role changes are high-signal — record them explicitly and immutably.
    if (patch.roleKey && patch.roleKey !== before.roleKey) {
      await audit.record({
        actor: user,
        action: "role.change",
        entity: before.userId,
        meta: { from: before.roleKey, to: patch.roleKey },
      });
    } else {
      await audit.record({ actor: user, action: "employee.update", entity: id });
    }
    return toDTO(updated!);
  },

  /** The caller's own directory record — no users.read needed, everyone can see their own profile. */
  async getSelf(user: User): Promise<DTO<Employee>> {
    const c = await coll();
    const doc = await c.findOne({ userId: user.id, orgId: user.orgId, deletedAt: { $exists: false } });
    if (!doc) throw new NotFound("employee not found");
    return toDTO(doc);
  },

  /**
   * Self-service profile edit — name/personal email/phone only, always scoped to the
   * caller's OWN record (found by userId, never a passed-in id), so it needs no
   * users.edit permission and can never touch anyone else's record.
   */
  async updateSelf(user: User, patch: z.infer<typeof SelfProfileUpdateSchema>): Promise<DTO<Employee>> {
    const c = await coll();
    const before = await c.findOne({ userId: user.id, orgId: user.orgId, deletedAt: { $exists: false } });
    if (!before) throw new NotFound("employee not found");
    const updated = await employees.update(user.orgId, before._id.toHexString(), patch);
    await audit.record({ actor: user, action: "employee.update_self", entity: before._id.toHexString() });
    return toDTO(updated!);
  },
};
