/** Zod schemas for lead API input. Validated at the route boundary. */
import { z } from "zod";
import { LEAD_STAGES, LEAD_SOURCES } from "@/lib/types";

export const LeadCreateSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  company: z.string().max(200).optional(),
  companyId: z.string().max(64).optional(),
  source: z.enum(LEAD_SOURCES as [string, ...string[]]).optional(),
  campaign: z.string().max(200).optional(),
  value: z
    .object({
      amountMinor: z.number().int().nonnegative(),
      currency: z.enum(["INR", "USD"]),
    })
    .optional(),
  notes: z.string().max(5000).optional(),
});
export type LeadCreateInput = z.infer<typeof LeadCreateSchema>;

export const LeadUpdateSchema = LeadCreateSchema.partial().extend({
  score: z.number().int().min(0).max(100).optional(),
  intentScore: z.number().int().min(0).max(100).optional(),
  health: z.enum(["green", "yellow", "red"]).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  estimatedCloseAt: z.string().datetime().optional(),
  nextAction: z.string().max(500).optional(),
  painPoints: z.array(z.string().max(200)).max(20).optional(),
  competitors: z.array(z.string().max(120)).max(20).optional(),
  buyingCommittee: z.array(z.string().max(120)).max(30).optional(),
});
export type LeadUpdateInput = z.infer<typeof LeadUpdateSchema>;

export const StageChangeSchema = z.object({
  to: z.enum(LEAD_STAGES as [string, ...string[]]),
});
export type StageChangeInput = z.infer<typeof StageChangeSchema>;
