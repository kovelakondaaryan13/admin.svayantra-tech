/**
 * Quotation generation. ALL money is computed by software (integer minor units),
 * never by the model. draft → pending_approval → approved.
 * Guide: .claude/skills/sales/model-sales-features.md
 */
import { repo, toDTO } from "@/data/collection";
import * as audit from "@/lib/audit";
import { activityService } from "@/services/activity-service";
import { leads } from "@/data/leads";
import { NotFound, BusinessRule } from "@/lib/errors";
import type { Quotation, DTO } from "@/lib/entities";
import type { User } from "@/lib/types";
import type { z } from "zod";
import type { QuotationCreateSchema } from "@/lib/schemas/entities";

const quotations = repo<Quotation>("quotations", { workspaceScoped: true });

export const quotationService = {
  async create(user: User, input: z.infer<typeof QuotationCreateSchema>): Promise<DTO<Quotation>> {
    const lead = await leads.findById(user.orgId, input.leadId);
    if (!lead) throw new NotFound("lead not found");

    const subtotalMinor = input.lineItems.reduce((sum, li) => sum + li.quantity * li.unitMinor, 0);
    const taxMinor = Math.round((subtotalMinor * (input.taxBps ?? 0)) / 10000);
    const totalMinor = subtotalMinor + taxMinor;

    const doc = await quotations.insert(user.orgId, {
      leadId: input.leadId,
      currency: input.currency,
      lineItems: input.lineItems,
      subtotalMinor,
      taxMinor,
      totalMinor,
      status: "draft",
      ownerId: user.id,
    });
    const id = doc._id.toHexString();
    await audit.record({ actor: user, action: "quotation.create", entity: id, meta: { totalMinor } });
    await activityService.log(user, "quotation", id, "created", `Quotation ${input.currency} ${(totalMinor / 100).toFixed(2)}`);
    return toDTO(doc);
  },

  async list(user: User): Promise<DTO<Quotation>[]> {
    return (await quotations.list(user.orgId)).map(toDTO);
  },
  async get(user: User, id: string): Promise<DTO<Quotation>> {
    const doc = await quotations.findById(user.orgId, id);
    if (!doc) throw new NotFound("quotation not found");
    return toDTO(doc);
  },
  async approve(user: User, id: string): Promise<DTO<Quotation>> {
    const doc = await quotations.findById(user.orgId, id);
    if (!doc) throw new NotFound("quotation not found");
    if (doc.status === "approved") throw new BusinessRule("quotation already approved");
    const updated = await quotations.update(user.orgId, id, { status: "approved" });
    await audit.record({ actor: user, action: "quotation.approve", entity: id });
    return toDTO(updated!);
  },
};
