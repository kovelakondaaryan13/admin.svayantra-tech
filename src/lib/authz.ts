/**
 * Legacy authorization shim. The existing routes call `assertCan(user, "lead:create")`
 * (resource:action). Those strings are mapped to the centralized IAM catalog
 * (domain.action) and checked by the ONE engine (lib/iam). New code should import
 * `assertPermission` / `can` from `@/lib/iam` directly with dotted permissions.
 */
import { assertPermission } from "@/lib/iam/authorize";
import { legacyToDotted } from "@/lib/iam/legacy";
import type { User } from "@/lib/types";

type Resource =
  | "lead"
  | "company"
  | "contact"
  | "task"
  | "meeting"
  | "proposal"
  | "quotation"
  | "activity"
  | "notification"
  | "audit"
  | "dashboard"
  | "knowledge"
  | "document"
  | "connector"
  | "calendar"
  | "settings"
  | "ai";

type Action =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "advance"
  | "approve"
  | "send"
  | "view"
  | "search"
  | "ask"
  | "chat"
  | "prep"
  | "manage"
  | "write";

export type Permission = `${Resource}:${Action}`;

export function assertCan(user: User, permission: Permission): void {
  assertPermission(user, legacyToDotted(permission));
}
