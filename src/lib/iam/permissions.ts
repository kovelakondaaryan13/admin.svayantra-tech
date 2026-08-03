/**
 * The permission catalog — the single vocabulary of access in RevenueOS/ABOS.
 * Format: `domain.action`. Granular and individually assignable. The `*` wildcard
 * means "all permissions" and is reserved for the Owner.
 */
export const PERMISSIONS = [
  // CRM
  "crm.read",
  "crm.write",
  "crm.delete",
  "crm.export",
  // Sales
  "sales.read",
  "sales.write",
  "sales.assign",
  // Finance
  "finance.read",
  "finance.edit",
  "finance.export",
  // Documents / knowledge
  "documents.read",
  "documents.write",
  "documents.delete",
  // Calendar
  "calendar.read",
  "calendar.write",
  "calendar.manage",
  // Users / roles
  "users.read",
  "users.create",
  "users.edit",
  "users.delete",
  "roles.manage",
  // Tasks
  "tasks.assign",
  "tasks.close",
  // AI
  "ai.use",
  "ai.admin",
  // Platform
  "analytics.view",
  "settings.read",
  "settings.manage",
  "billing.manage",
  "integrations.read",
  "integrations.manage",
  "org.manage",
  "departments.manage",
  "audit.view",
  // Configurable platform (metadata-driven)
  "objects.read",
  "objects.write",
  "objects.delete",
  "objects.manage",
  "workflows.manage",
  "workflows.approve",
  "policies.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export const ALL_PERMISSIONS = "*" as const;

/** Grouped for the permission-matrix UI. */
export const PERMISSION_DOMAINS: Record<string, Permission[]> = {
  CRM: ["crm.read", "crm.write", "crm.delete", "crm.export"],
  Sales: ["sales.read", "sales.write", "sales.assign"],
  Finance: ["finance.read", "finance.edit", "finance.export"],
  Documents: ["documents.read", "documents.write", "documents.delete"],
  Calendar: ["calendar.read", "calendar.write", "calendar.manage"],
  Tasks: ["tasks.assign", "tasks.close"],
  "Users & Roles": ["users.read", "users.create", "users.edit", "users.delete", "roles.manage"],
  AI: ["ai.use", "ai.admin"],
  Platform: [
    "analytics.view",
    "settings.read",
    "settings.manage",
    "billing.manage",
    "integrations.read",
    "integrations.manage",
    "org.manage",
    "departments.manage",
    "audit.view",
  ],
  "Configurable Platform": [
    "objects.read",
    "objects.write",
    "objects.delete",
    "objects.manage",
    "workflows.manage",
    "workflows.approve",
    "policies.manage",
  ],
};

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
