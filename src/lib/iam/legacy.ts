/**
 * Compatibility bridge: maps the existing `resource:action` permission strings used
 * across the original 39 routes to the centralized `domain.action` catalog, so there
 * is ONE authorization engine — nothing checks permissions two different ways.
 */
import type { Permission } from "@/lib/iam/permissions";

const MAP: Record<string, Permission> = {
  // CRM objects
  "lead:read": "crm.read",
  "lead:create": "crm.write",
  "lead:update": "crm.write",
  "lead:delete": "crm.delete",
  // Route-level gate is intentionally broad (sales.write) — lead-service.advance()'s
  // assertCanModify() does the real per-lead check (lead owner, conveyor teammate, or
  // manager). Mapping this to sales.assign would block reps from advancing their own
  // leads while adding no real security (that's an approval-action permission, used
  // for proposal/quotation approve — see roles.ts's sales_head/admin/super_admin).
  "lead:advance": "sales.write",
  "company:read": "crm.read",
  "company:create": "crm.write",
  "company:update": "crm.write",
  "company:delete": "crm.delete",
  "contact:read": "crm.read",
  "contact:create": "crm.write",
  "contact:update": "crm.write",
  "contact:delete": "crm.delete",
  // Tasks
  "task:read": "crm.read",
  "task:create": "tasks.assign",
  "task:update": "tasks.assign",
  "task:delete": "tasks.close",
  // Meetings / calendar
  "meeting:read": "calendar.read",
  "meeting:create": "calendar.write",
  "meeting:update": "calendar.write",
  "meeting:delete": "calendar.write",
  "meeting:prep": "ai.use",
  "calendar:read": "calendar.read",
  "calendar:write": "calendar.write",
  "calendar:manage": "calendar.manage",
  // Sales artifacts
  "proposal:read": "sales.read",
  "proposal:create": "sales.write",
  "proposal:approve": "sales.assign",
  "proposal:send": "sales.assign",
  "quotation:read": "sales.read",
  "quotation:create": "sales.write",
  "quotation:approve": "sales.assign",
  // Misc read
  "activity:read": "crm.read",
  "notification:read": "crm.read",
  "audit:read": "audit.view",
  "dashboard:view": "analytics.view",
  // Knowledge / AI
  "knowledge:search": "ai.use",
  "knowledge:ask": "ai.use",
  "ai:chat": "ai.use",
  // Documents
  "document:read": "documents.read",
  "document:create": "documents.write",
  "document:delete": "documents.delete",
  // Connectors
  "connector:read": "integrations.read",
  "connector:manage": "integrations.manage",
  // Settings
  "settings:read": "settings.read",
  "settings:write": "settings.manage",
};

export function legacyToDotted(colon: string): Permission {
  const mapped = MAP[colon];
  if (mapped) return mapped;
  // Fail closed: an unmapped legacy string is a bug in the calling route, not a
  // grant of access. Throwing forces the map to be updated instead of silently
  // authorizing every role via a baseline permission.
  throw new Error(`legacyToDotted: no mapping for "${colon}" — add it to MAP in src/lib/iam/legacy.ts`);
}
