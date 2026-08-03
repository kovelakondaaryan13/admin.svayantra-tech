/**
 * The centralized authorization checks. Everything — routes, services, AI, UI —
 * consults the resolved permission set on the User. Owner (`*`) bypasses all checks.
 */
import { Forbidden } from "@/lib/errors";
import type { Permission } from "@/lib/iam/permissions";
import type { User } from "@/lib/types";

export function isOwner(user: User): boolean {
  return user.role === "owner" || user.permissions.includes("*");
}

export function can(user: User, permission: Permission | string): boolean {
  return user.permissions.includes("*") || user.permissions.includes(permission);
}

/** Throws Forbidden (403) if the user lacks the permission. */
export function assertPermission(user: User, permission: Permission | string): void {
  if (!can(user, permission)) throw new Forbidden(`missing permission: ${permission}`);
}
