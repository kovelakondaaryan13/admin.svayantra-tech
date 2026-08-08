/** Zod input schemas for the full v1 entity surface. Validated at the route boundary. */
import { z } from "zod";

const money = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: z.enum(["INR", "USD"]),
});

export const CompanyCreateSchema = z.object({
  name: z.string().min(1).max(200),
  domain: z.string().max(200).optional(),
  industry: z.string().max(120).optional(),
  size: z.string().max(60).optional(),
  revenueEstimate: z.string().max(60).optional(),
  notes: z.string().max(5000).optional(),
});
export const CompanyUpdateSchema = CompanyCreateSchema.partial();

export const ContactCreateSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  title: z.string().max(120).optional(),
  companyId: z.string().max(64).optional(),
});
export const ContactUpdateSchema = ContactCreateSchema.partial();

export const TaskCreateSchema = z.object({
  title: z.string().min(1).max(300),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueAt: z.string().datetime().optional(),
  leadId: z.string().max(64).optional(),
  companyId: z.string().max(64).optional(),
  assigneeId: z.string().max(64).optional(),
});
export const TaskUpdateSchema = TaskCreateSchema.partial().extend({
  status: z.enum(["open", "done"]).optional(),
});

/** Confirms an AI-proposed `assign_task_to_role` action (src/ai/tools.ts). */
export const TaskAssignToRoleSchema = z.object({
  roleKey: z.string().min(1).max(60),
  title: z.string().min(1).max(300),
  dueAt: z.string().datetime().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

/** Confirms an AI-proposed `bulk_reassign_leads` action (src/ai/tools.ts). */
export const LeadBulkReassignSchema = z.object({
  assignments: z
    .array(z.object({ leadId: z.string().max(64), toUserId: z.string().max(64) }))
    .min(1)
    .max(500),
});

export const MeetingCreateSchema = z.object({
  title: z.string().min(1).max(300),
  at: z.string().datetime(),
  leadId: z.string().max(64).optional(),
  contactId: z.string().max(64).optional(),
  companyId: z.string().max(64).optional(),
  notes: z.string().max(5000).optional(),
  transcript: z.string().max(50000).optional(),
  summary: z.string().max(5000).optional(),
  attendees: z.array(z.string().max(200)).max(50).optional(),
  actionItems: z.array(z.string().max(500)).max(50).optional(),
});
export const MeetingUpdateSchema = MeetingCreateSchema.partial();

export const ProposalCreateSchema = z.object({
  leadId: z.string().min(1).max(64),
  title: z.string().min(1).max(300),
  amount: money,
  /** Optional caller-provided sections; if omitted, the service drafts them. */
  sections: z.array(z.object({ heading: z.string(), body: z.string() })).optional(),
  /** Ask the AI to draft narrative sections around the (software-set) numbers. */
  aiDraft: z.boolean().optional(),
});

export const QuotationCreateSchema = z.object({
  leadId: z.string().min(1).max(64),
  currency: z.enum(["INR", "USD"]),
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1).max(300),
        quantity: z.number().int().positive(),
        unitMinor: z.number().int().nonnegative(),
      }),
    )
    .min(1),
  /** Tax as basis points (e.g. 1800 = 18%). Applied deterministically. */
  taxBps: z.number().int().min(0).max(10000).optional(),
});

export const IssueCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
});
export const IssueUpdateSchema = z.object({
  status: z.enum(["open", "investigating", "resolved", "closed"]).optional(),
  assigneeId: z.string().max(64).optional(),
});
