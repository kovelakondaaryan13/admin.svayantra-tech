/**
 * Dynamic organization engine. Org units form a tree (department/team/division/
 * region/branch/…) — fully configurable, no hardcoded structure. Read is available
 * to any authenticated member; mutations require `org.manage`. Every structural
 * change is audited (feeds the Organization Timeline).
 */
import { repo, toDTO } from "@/data/collection";
import { db } from "@/lib/mongo";
import * as audit from "@/lib/audit";
import { assertPermission } from "@/lib/iam";
import { NotFound, BusinessRule } from "@/lib/errors";
import type { OrgUnit } from "@/lib/platform/entities";
import type { Employee } from "@/lib/org-entities";
import type { DTO } from "@/lib/entities";
import type { User } from "@/lib/types";

const units = repo<OrgUnit>("orgUnits");

export interface OrgUnitInput {
  name: string;
  type: OrgUnit["type"];
  description?: string;
  parentId?: string | null;
  managerUserId?: string | null;
  aiVisible?: boolean;
  headcountCapacity?: number;
  metadata?: Record<string, unknown>;
}

/** An org unit enriched with live headcount stats for the admin console. */
export interface OrgUnitStats extends DTO<OrgUnit> {
  memberCount: number;
  vacancies: number | null; // null when no capacity is set
  managerName?: string;
}

export const orgUnitService = {
  async list(user: User): Promise<DTO<OrgUnit>[]> {
    return (await units.list(user.orgId, {}, 1000)).map(toDTO);
  },

  /**
   * Org units enriched with headcount stats. Members are employees assigned to the
   * unit (as department OR team); vacancies = capacity − members. Manager name is
   * resolved from the employee directory. Read-only; safe for any member to view.
   */
  async listWithStats(user: User): Promise<OrgUnitStats[]> {
    const list = (await units.list(user.orgId, {}, 1000)).map(toDTO);
    const employees = await (await db())
      .collection<Employee>("employees")
      .find({ orgId: user.orgId, deletedAt: { $exists: false } })
      .toArray();

    const nameByUserId = new Map(employees.map((e) => [e.userId, e.name]));
    const memberCount = (unitId: string) =>
      employees.filter((e) => e.departmentId === unitId || e.teamId === unitId).length;

    return list.map((u) => {
      const members = memberCount(u.id);
      return {
        ...u,
        memberCount: members,
        vacancies:
          typeof u.headcountCapacity === "number"
            ? Math.max(0, u.headcountCapacity - members)
            : null,
        managerName: u.managerUserId ? nameByUserId.get(u.managerUserId) : undefined,
      };
    });
  },

  async create(user: User, input: OrgUnitInput): Promise<DTO<OrgUnit>> {
    assertPermission(user, "org.manage");
    if (input.parentId && !(await units.findById(user.orgId, input.parentId))) {
      throw new NotFound("parent org unit not found");
    }
    const doc = await units.insert(user.orgId, {
      name: input.name,
      type: input.type,
      description: input.description,
      parentId: input.parentId ?? undefined,
      managerUserId: input.managerUserId ?? undefined,
      aiVisible: input.aiVisible ?? true,
      headcountCapacity: input.headcountCapacity,
      metadata: input.metadata,
    });
    await audit.record({ actor: user, action: "orgunit.create", entity: doc._id.toHexString(), meta: { name: input.name, type: input.type } });
    return toDTO(doc);
  },

  async update(user: User, id: string, patch: Partial<OrgUnitInput>): Promise<DTO<OrgUnit>> {
    assertPermission(user, "org.manage");
    const before = await units.findById(user.orgId, id);
    if (!before) throw new NotFound("org unit not found");
    // Cycle guard: a unit cannot be moved under itself or any of its descendants.
    if (patch.parentId) {
      if (patch.parentId === id) throw new BusinessRule("a unit cannot be its own parent");
      const all = await units.list(user.orgId, {}, 1000);
      const descendants = new Set<string>();
      const collect = (pid: string) => {
        for (const u of all) {
          const uid = u._id.toHexString();
          if ((u.parentId ?? null) === pid && !descendants.has(uid)) {
            descendants.add(uid);
            collect(uid);
          }
        }
      };
      collect(id);
      if (descendants.has(patch.parentId)) {
        throw new BusinessRule("cannot move a unit under one of its own sub-units");
      }
    }
    const updated = await units.update(user.orgId, id, patch as Partial<OrgUnit>);
    const moved = patch.parentId !== undefined && patch.parentId !== before.parentId;
    await audit.record({
      actor: user,
      action: moved ? "orgunit.move" : "orgunit.update",
      entity: id,
      meta: moved ? { from: before.parentId ?? null, to: patch.parentId ?? null } : undefined,
    });
    return toDTO(updated!);
  },

  async remove(user: User, id: string): Promise<void> {
    assertPermission(user, "org.manage");
    const children = await units.list(user.orgId, { parentId: id } as never);
    if (children.length) throw new BusinessRule("reassign or remove child units first");
    if (!(await units.softDelete(user.orgId, id))) throw new NotFound("org unit not found");
    await audit.record({ actor: user, action: "orgunit.delete", entity: id });
  },
};
