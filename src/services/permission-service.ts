/** Per-user permission overrides (grants/denies) layered on top of the role. */
import { db } from "@/lib/mongo";
import { repo } from "@/data/collection";
import * as audit from "@/lib/audit";
import { assertPermission, isPermission } from "@/lib/iam";
import { BusinessRule } from "@/lib/errors";
import type { UserPermissionOverride } from "@/lib/org-entities";
import type { User } from "@/lib/types";

const overrides = repo<UserPermissionOverride>("userPermissions");

function validate(perms: string[]): void {
  const bad = perms.filter((p) => !isPermission(p));
  if (bad.length) throw new BusinessRule(`unknown permissions: ${bad.join(", ")}`);
}

export const permissionService = {
  async setOverrides(
    user: User,
    targetUserId: string,
    grants: string[],
    denies: string[],
  ): Promise<void> {
    assertPermission(user, "roles.manage");
    validate(grants);
    validate(denies);
    const c = (await db()).collection<UserPermissionOverride>("userPermissions");
    const existing = await c.findOne({ orgId: user.orgId, userId: targetUserId });
    if (existing) {
      await c.updateOne({ _id: existing._id }, { $set: { grants, denies, updatedAt: new Date() } });
    } else {
      await overrides.insert(user.orgId, { userId: targetUserId, grants, denies });
    }
    await audit.record({
      actor: user,
      action: "permission.override",
      entity: targetUserId,
      meta: { grants, denies },
    });
  },
};
