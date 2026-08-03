/**
 * Proposal generation. Deterministic status flow + software-set amount; AI drafts
 * only narrative. draft → pending_approval → approved → sent. Sending/approving
 * are gated by authz (proposal:approve) at the route.
 * Patterns: .claude/patterns/service-pattern.md, .claude/skills/sales/model-sales-features.md
 */
import { repo, toDTO } from "@/data/collection";
import * as audit from "@/lib/audit";
import { activityService } from "@/services/activity-service";
import { draftProposalSections } from "@/ai/draft";
import { leads } from "@/data/leads";
import { NotFound, BusinessRule } from "@/lib/errors";
import type { Proposal, DTO } from "@/lib/entities";
import type { User } from "@/lib/types";
import type { z } from "zod";
import type { ProposalCreateSchema } from "@/lib/schemas/entities";

const proposals = repo<Proposal>("proposals", { workspaceScoped: true });

function label(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toFixed(2)}`;
}

export const proposalService = {
  async create(user: User, input: z.infer<typeof ProposalCreateSchema>): Promise<DTO<Proposal>> {
    const lead = await leads.findById(user.orgId, input.leadId);
    if (!lead) throw new NotFound("lead not found");

    let sections = input.sections ?? [];
    if (input.aiDraft && sections.length === 0) {
      sections = await draftProposalSections(
        input.title,
        lead.company,
        label(input.amount.amountMinor, input.amount.currency),
      );
    }

    const doc = await proposals.insert(user.orgId, {
      leadId: input.leadId,
      title: input.title,
      status: "draft",
      sections,
      amount: input.amount, // software-set, never model-authored
      ownerId: user.id,
    });
    const id = doc._id.toHexString();
    await audit.record({ actor: user, action: "proposal.create", entity: id });
    await activityService.log(user, "proposal", id, "created", `Proposal "${input.title}"`);
    return toDTO(doc);
  },

  async list(user: User): Promise<DTO<Proposal>[]> {
    return (await proposals.list(user.orgId)).map(toDTO);
  },
  async get(user: User, id: string): Promise<DTO<Proposal>> {
    const doc = await proposals.findById(user.orgId, id);
    if (!doc) throw new NotFound("proposal not found");
    return toDTO(doc);
  },

  /** Requires proposal:approve (enforced at route). */
  async approve(user: User, id: string): Promise<DTO<Proposal>> {
    const doc = await proposals.findById(user.orgId, id);
    if (!doc) throw new NotFound("proposal not found");
    if (doc.status === "sent") throw new BusinessRule("proposal already sent");
    const updated = await proposals.update(user.orgId, id, { status: "approved" });
    await audit.record({ actor: user, action: "proposal.approve", entity: id });
    return toDTO(updated!);
  },

  async send(user: User, id: string): Promise<DTO<Proposal>> {
    const doc = await proposals.findById(user.orgId, id);
    if (!doc) throw new NotFound("proposal not found");
    if (doc.status !== "approved") throw new BusinessRule("proposal must be approved before sending");
    const updated = await proposals.update(user.orgId, id, { status: "sent" });
    await audit.record({ actor: user, action: "proposal.send", entity: id });
    await activityService.log(user, "proposal", id, "sent", `Proposal "${doc.title}" sent`);
    // NOTE: real email delivery via Resend is a later milestone.
    return toDTO(updated!);
  },
};
