/**
 * Metadata models that make the business configurable (no hardcoded structure).
 * Org units, custom object definitions + records, workflow/approval definitions +
 * instances, and business policies. Everything is org-scoped (tenant isolation).
 */
import type { BaseDoc } from "@/lib/entities";

// --- Dynamic organization tree ---
export type OrgUnitType =
  | "department"
  | "team"
  | "business_unit"
  | "division"
  | "branch"
  | "region"
  | "location"
  | "cost_center"
  | "subsidiary";

export interface OrgUnit extends BaseDoc {
  name: string;
  description?: string;
  type: OrgUnitType;
  parentId?: string; // null/undefined = top-level under the organization
  managerUserId?: string;
  permissions?: string[]; // roles that can see this unit; empty = all
  approvalPolicyKey?: string;
  aiVisible: boolean;
  /** Planned headcount for this unit — drives capacity/vacancy reporting. */
  headcountCapacity?: number;
  metadata?: Record<string, unknown>;
}

// --- Custom object platform ---
export type FieldType = "text" | "textarea" | "number" | "boolean" | "date" | "select" | "reference";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[]; // for select
  refObject?: string; // for reference
}

export interface RelationshipDef {
  key: string;
  label: string;
  type: "has_many" | "belongs_to" | "many_to_many";
  target: string; // target object key
}

export interface ObjectDefinition extends BaseDoc {
  key: string; // e.g. "factory"
  label: string;
  labelPlural: string;
  icon?: string;
  fields: FieldDef[];
  relationships: RelationshipDef[];
  displayField: string; // which field is the record's name
  permissions: string[]; // roles allowed; empty = all
  aiSearchable: boolean;
}

export interface CustomRecord extends BaseDoc {
  objectKey: string;
  name: string; // derived from displayField
  data: Record<string, unknown>;
  createdBy: string;
}

// --- Workflow / approval engine ---
export interface WorkflowTrigger {
  objectKey?: string;
  event: "manual" | "created" | "submitted";
}

export type WorkflowNode =
  | {
      id: string;
      type: "condition";
      field: string;
      op: "gt" | "lt" | "gte" | "lte" | "eq" | "neq";
      value: number | string;
      onTrue: string;
      onFalse: string;
    }
  | {
      id: string;
      type: "approval";
      approverRole?: string;
      approverUserId?: string;
      mode: "sequential" | "parallel";
      next: string;
      onReject?: string;
      escalateToRole?: string;
      timeoutHours?: number;
    }
  | { id: string; type: "notify"; message: string; next: string }
  | { id: string; type: "end"; outcome: "approved" | "rejected" | "done" };

export interface WorkflowDefinition extends BaseDoc {
  key: string;
  label: string;
  trigger: WorkflowTrigger;
  startNodeId: string;
  nodes: WorkflowNode[];
  enabled: boolean;
}

export type InstanceStatus = "running" | "approved" | "rejected" | "done" | "cancelled";

export interface WorkflowStep {
  nodeId: string;
  at: Date;
  actorId?: string;
  decision?: "approved" | "rejected";
  note?: string;
}

export interface WorkflowInstance extends BaseDoc {
  workflowKey: string;
  subjectType?: string;
  subjectId?: string;
  context: Record<string, unknown>;
  status: InstanceStatus;
  currentNodeId?: string;
  steps: WorkflowStep[];
  startedBy: string;
}

// --- Business policy engine ---
export type PolicyEffect = "allow" | "deny" | "limit" | "threshold";

export interface Policy extends BaseDoc {
  key: string;
  label: string;
  domain: string; // e.g. "sales", "finance", "crm", "ai"
  effect: PolicyEffect;
  value?: number; // for limit/threshold (e.g. discount %, ₹ threshold in minor units)
  roles?: string[]; // roles the policy applies to; empty = all
  description?: string;
  enabled: boolean;
}
