/**
 * Resolve a user's EFFECTIVE permissions = system/custom role permissions, plus
 * per-user grant overrides, minus per-user deny overrides. Owner → all (`*`).
 * Called once per request (memoized in getUser) and attached to the User.
 */
import { repo } from "@/data/collection";
import { SYSTEM_ROLES, isSystemRole } from "@/lib/iam/roles";
import type { CustomRole, UserPermissionOverride } from "@/lib/org-entities";

const rolesRepo = repo<CustomRole>("roles");
const overridesRepo = repo<UserPermissionOverride>("userPermissions");

export async function resolveEffectivePermissions(
  orgId: string,
  userId: string,
  roleKey: string,
): Promise<string[]> {
  if (roleKey === "owner") return ["*"];

  const set = new Set<string>();
  if (isSystemRole(roleKey)) {
    for (const p of SYSTEM_ROLES[roleKey].permissions) set.add(p);
  } else {
    const custom = (await rolesRepo.list(orgId, { key: roleKey } as never))[0];
    if (custom) for (const p of custom.permissions) set.add(p);
  }

  const override = (await overridesRepo.list(orgId, { userId } as never))[0];
  if (override) {
    for (const p of override.grants ?? []) set.add(p);
    for (const p of override.denies ?? []) set.delete(p);
  }

  return [...set];
}
