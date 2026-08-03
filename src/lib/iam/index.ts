/** Centralized IAM — the single authorization system for RevenueOS/ABOS. */
export { PERMISSIONS, PERMISSION_DOMAINS, ALL_PERMISSIONS, isPermission } from "@/lib/iam/permissions";
export type { Permission } from "@/lib/iam/permissions";
export { SYSTEM_ROLES, SYSTEM_ROLE_LIST, isSystemRole, assignableRoles } from "@/lib/iam/roles";
export type { SystemRoleKey, RoleDefinition } from "@/lib/iam/roles";
export { resolveEffectivePermissions } from "@/lib/iam/resolve";
export { can, assertPermission, isOwner } from "@/lib/iam/authorize";
export { legacyToDotted } from "@/lib/iam/legacy";
