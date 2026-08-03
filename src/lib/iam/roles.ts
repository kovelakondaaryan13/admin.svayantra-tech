/**
 * Predefined system roles with least-privilege default permission sets.
 * Organizations may also define custom roles (stored in the `roles` collection);
 * both resolve through the same engine. Owner is special — it holds `*` and cannot
 * be restricted by normal permission checks.
 */
import type { Permission } from "@/lib/iam/permissions";
import { can, isOwner } from "@/lib/iam/authorize";
import type { User } from "@/lib/types";

export type SystemRoleKey =
  | "owner"
  | "super_admin"
  | "admin"
  | "sales_head"
  | "sales_rep"
  | "finance_head"
  | "finance_exec"
  | "ops_manager"
  | "hr"
  | "marketing"
  | "project_manager"
  | "developer"
  | "support"
  | "viewer";

export interface RoleDefinition {
  key: SystemRoleKey;
  label: string;
  permissions: Permission[] | ["*"];
}

const BASELINE: Permission[] = ["settings.read", "ai.use"];

export const SYSTEM_ROLES: Record<SystemRoleKey, RoleDefinition> = {
  owner: { key: "owner", label: "Owner", permissions: ["*"] },
  super_admin: {
    key: "super_admin",
    label: "Super Admin",
    permissions: [
      "crm.read", "crm.write", "crm.delete", "crm.export",
      "sales.read", "sales.write", "sales.assign",
      "finance.read", "finance.edit", "finance.export",
      "documents.read", "documents.write", "documents.delete",
      "calendar.read", "calendar.write", "calendar.manage",
      "users.read", "users.create", "users.edit", "users.delete", "roles.manage",
      "tasks.assign", "tasks.close",
      "ai.use", "ai.admin", "analytics.view",
      "settings.read", "settings.manage", "integrations.read", "integrations.manage",
      "org.manage", "departments.manage", "audit.view",
      "objects.read", "objects.write", "objects.delete", "objects.manage",
      "workflows.manage", "workflows.approve", "policies.manage",
    ],
  },
  admin: {
    key: "admin",
    label: "Admin",
    permissions: [
      ...BASELINE,
      "crm.read", "crm.write", "crm.delete", "crm.export",
      "sales.read", "sales.write", "sales.assign",
      "documents.read", "documents.write", "documents.delete",
      "calendar.read", "calendar.write", "calendar.manage",
      "users.read", "users.create", "users.edit", "roles.manage",
      "tasks.assign", "tasks.close", "analytics.view",
      "settings.manage", "integrations.read", "integrations.manage",
      "departments.manage", "audit.view",
      "objects.read", "objects.write", "objects.delete", "objects.manage",
      "workflows.manage", "workflows.approve", "policies.manage",
    ],
  },
  sales_head: {
    key: "sales_head",
    label: "Sales Head",
    permissions: [
      ...BASELINE,
      "crm.read", "crm.write", "crm.delete", "crm.export",
      "sales.read", "sales.write", "sales.assign",
      "documents.read", "documents.write",
      "calendar.read", "calendar.write",
      "users.read", "tasks.assign", "tasks.close", "analytics.view", "integrations.read",
      "objects.read", "objects.write", "workflows.approve",
    ],
  },
  sales_rep: {
    key: "sales_rep",
    label: "Sales Representative",
    permissions: [
      ...BASELINE,
      "crm.read", "crm.write",
      "sales.read", "sales.write",
      "documents.read", "documents.write",
      "calendar.read", "calendar.write",
      "tasks.assign", "tasks.close", "analytics.view", "integrations.read",
      "objects.read", "objects.write",
    ],
  },
  finance_head: {
    key: "finance_head",
    label: "Finance Head",
    permissions: [
      ...BASELINE,
      "finance.read", "finance.edit", "finance.export",
      "crm.read", "documents.read", "analytics.view", "audit.view", "workflows.approve",
    ],
  },
  finance_exec: {
    key: "finance_exec",
    label: "Finance Executive",
    permissions: [...BASELINE, "finance.read", "crm.read", "documents.read", "analytics.view"],
  },
  ops_manager: {
    key: "ops_manager",
    label: "Operations Manager",
    permissions: [
      ...BASELINE,
      "crm.read", "crm.write",
      "documents.read", "documents.write",
      "calendar.read", "calendar.write",
      "tasks.assign", "tasks.close", "users.read", "analytics.view",
    ],
  },
  hr: {
    key: "hr",
    label: "HR",
    permissions: [...BASELINE, "users.read", "users.create", "users.edit", "documents.read", "calendar.read", "analytics.view"],
  },
  marketing: {
    key: "marketing",
    label: "Marketing",
    permissions: [...BASELINE, "crm.read", "documents.read", "documents.write", "analytics.view"],
  },
  project_manager: {
    key: "project_manager",
    label: "Project Manager",
    permissions: [...BASELINE, "crm.read", "documents.read", "documents.write", "calendar.read", "calendar.write", "tasks.assign", "tasks.close", "analytics.view"],
  },
  developer: {
    key: "developer",
    label: "Developer",
    permissions: [...BASELINE, "documents.read", "tasks.close", "integrations.read"],
  },
  support: {
    key: "support",
    label: "Support",
    permissions: [...BASELINE, "crm.read", "documents.read", "calendar.read"],
  },
  viewer: { key: "viewer", label: "Viewer", permissions: [...BASELINE, "crm.read", "analytics.view"] },
};

export const SYSTEM_ROLE_LIST = Object.values(SYSTEM_ROLES);

export function isSystemRole(key: string): key is SystemRoleKey {
  return key in SYSTEM_ROLES;
}

/**
 * Roles a given actor is allowed to grant — mirrors employeeService's
 * assertCanAssignRole policy so the UI never offers a choice the backend will reject.
 * Only an owner can grant "owner"; only roles.manage can grant super_admin/admin.
 */
export function assignableRoles(actor: User): RoleDefinition[] {
  return SYSTEM_ROLE_LIST.filter((r) => {
    if (r.key === "owner") return isOwner(actor);
    if (r.key === "super_admin" || r.key === "admin") return can(actor, "roles.manage");
    return true;
  });
}
