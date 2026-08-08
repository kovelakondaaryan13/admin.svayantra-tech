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

const PlaybookStageSchema = z.object({
  key: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  slaHours: z.number().nonnegative().max(100000).optional(),
  ownerRole: z.string().max(60).optional(),
  entryCriteria: z.string().max(2000).optional(),
  exitCriteria: z.string().max(2000).optional(),
  aiPrompt: z.string().max(4000).optional(),
  artifacts: z.array(z.string().max(200)).optional(),
});

export const PlaybookCreateSchema = z.object({
  key: z.string().min(2).max(60).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1).max(120),
  model: z.enum(["individual", "conveyor"]),
  description: z.string().max(2000).optional(),
  stages: z.array(PlaybookStageSchema),
  kpis: z.array(z.string().max(120)).optional(),
  enabled: z.boolean().optional(),
});

export const ConveyorIcpSchema = z.object({
  industries: z.array(z.string().max(60)).max(20).optional(),
  minCompanySize: z.number().int().nonnegative().optional(),
  minBudgetMinor: z.number().int().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
});

export const ConveyorMemberRolesSchema = z
  .array(z.object({ userId: z.string().max(64), stageKeys: z.array(z.string().max(60)).max(20) }))
  .max(50);

export const ConveyorTeamCreateSchema = z.object({
  name: z.string().min(1).max(120),
  model: z.enum(["individual", "conveyor"]).optional(),
  memberUserIds: z.array(z.string().max(64)).max(50),
  memberRoles: ConveyorMemberRolesSchema.optional(),
  playbookKey: z.string().max(60).optional(),
  icp: ConveyorIcpSchema.optional(),
});
export const ConveyorTeamUpdateSchema = ConveyorTeamCreateSchema.partial();

export const OrgSettingsPatchSchema = z.object({
  companyName: z.string().max(200).optional(),
  website: z.string().max(300).optional(),
  industry: z.string().max(80).optional(),
  companySize: z.string().max(20).optional(),
  timezone: z.string().max(60).optional(),
  currency: z.string().max(10).optional(),
  dateFormat: z.string().max(20).optional(),
  workingHoursStart: z.string().max(10).optional(),
  workingHoursEnd: z.string().max(10).optional(),
  workingDays: z.array(z.string().max(10)).optional(),
  autoApproveThreshold: z.enum(["never", "low-risk", "all"]).optional(),
});
