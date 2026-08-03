import { z } from "zod";

const ORG_UNIT_TYPES = [
  "department",
  "team",
  "business_unit",
  "division",
  "branch",
  "region",
  "location",
  "cost_center",
  "subsidiary",
] as const;

export const OrgUnitCreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(ORG_UNIT_TYPES),
  description: z.string().max(2000).optional(),
  parentId: z.string().max(64).nullable().optional(),
  managerUserId: z.string().max(64).nullable().optional(),
  aiVisible: z.boolean().optional(),
  headcountCapacity: z.number().int().nonnegative().max(1000000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export const OrgUnitUpdateSchema = OrgUnitCreateSchema.partial();

const FIELD_TYPES = ["text", "textarea", "number", "boolean", "date", "select", "reference"] as const;

export const ObjectDefinitionSchema = z.object({
  key: z.string().min(2).max(60).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(80),
  labelPlural: z.string().min(1).max(80),
  icon: z.string().max(40).optional(),
  displayField: z.string().min(1).max(60),
  fields: z
    .array(
      z.object({
        key: z.string().min(1).max(60),
        label: z.string().min(1).max(80),
        type: z.enum(FIELD_TYPES),
        required: z.boolean().optional(),
        options: z.array(z.string()).optional(),
        refObject: z.string().optional(),
      }),
    )
    .max(60),
  relationships: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        type: z.enum(["has_many", "belongs_to", "many_to_many"]),
        target: z.string(),
      }),
    )
    .max(40)
    .optional(),
  permissions: z.array(z.string()).max(20).optional(),
  aiSearchable: z.boolean().optional(),
});
export const ObjectDefinitionUpdateSchema = ObjectDefinitionSchema.partial();

export const RecordSchema = z.object({ data: z.record(z.string(), z.unknown()) });

export const PolicyCreateSchema = z.object({
  key: z.string().min(2).max(60),
  label: z.string().min(1).max(120),
  domain: z.string().min(1).max(40),
  effect: z.enum(["allow", "deny", "limit", "threshold"]),
  value: z.number().optional(),
  roles: z.array(z.string()).optional(),
  description: z.string().max(1000).optional(),
  enabled: z.boolean().optional(),
});
export const PolicyUpdateSchema = PolicyCreateSchema.partial();

export const WorkflowDefinitionSchema = z.object({
  key: z.string().min(2).max(60),
  label: z.string().min(1).max(120),
  trigger: z.object({
    objectKey: z.string().optional(),
    event: z.enum(["manual", "created", "submitted"]),
  }),
  startNodeId: z.string(),
  nodes: z.array(z.record(z.string(), z.unknown())),
  enabled: z.boolean().optional(),
});

export const WorkflowStartSchema = z.object({
  workflowKey: z.string(),
  context: z.record(z.string(), z.unknown()),
  subject: z.object({ type: z.string(), id: z.string() }).optional(),
});

export const WorkflowActSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(1000).optional(),
});
