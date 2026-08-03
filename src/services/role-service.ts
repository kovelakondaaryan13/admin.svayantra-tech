/** Role management — system roles (read-only defaults) + org custom roles. */
import { repo, toDTO } from "@/data/collection";
import * as audit from "@/lib/audit";
import { assertPermission, SYSTEM_ROLE_LIST, isPermission } from "@/lib/iam";
import { NotFound, BusinessRule } from "@/lib/errors";
import type { CustomRole } from "@/lib/org-entities";
import type { DTO } from "@/lib/entities";
import type { User } from "@/lib/types";

const roles = repo<CustomRole>("roles");

function validatePermissions(perms: string[]): void {
  const bad = perms.filter((p) => p !== "*" && !isPermission(p));
  if (bad.length) throw new BusinessRule(`unknown permissions: ${bad.join(", ")}`);
}

export const roleService = {
  async list(user: User): Promise<{ system: typeof SYSTEM_ROLE_LIST; custom: DTO<CustomRole>[] }> {
    assertPermission(user, "roles.manage");
    return { system: SYSTEM_ROLE_LIST, custom: (await roles.list(user.orgId)).map(toDTO) };
  },

  async create(
    user: User,
    input: { key: string; label: string; permissions: string[] },
  ): Promise<DTO<CustomRole>> {
    assertPermission(user, "roles.manage");
    validatePermissions(input.permissions);
    const doc = await roles.insert(user.orgId, {
      key: input.key,
      label: input.label,
      permissions: input.permissions,
    });
    await audit.record({ actor: user, action: "role.create", entity: doc._id.toHexString(), meta: { key: input.key } });
    return toDTO(doc);
  },

  async update(
    user: User,
    id: string,
    patch: { label?: string; permissions?: string[] },
  ): Promise<DTO<CustomRole>> {
    assertPermission(user, "roles.manage");
    if (patch.permissions) validatePermissions(patch.permissions);
    const doc = await roles.update(user.orgId, id, patch as Partial<CustomRole>);
    if (!doc) throw new NotFound("role not found");
    await audit.record({ actor: user, action: "role.update", entity: id });
    return toDTO(doc);
  },
};
