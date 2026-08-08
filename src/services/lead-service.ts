/**
 * Lead business logic. The only place that composes data-access + audit + events
 * and enforces the conveyor-belt stage rules. Callable from route handlers AND
 * AI tools, so both share the same rules and audit trail.
 * Patterns: .claude/patterns/service-pattern.md, .claude/patterns/workflow-pattern.md
 */
import { leads, toDTO } from "@/data/leads";
import * as audit from "@/lib/audit";
import { activityService } from "@/services/activity-service";
import { emit } from "@/lib/events";
import { assertPermission, isOwner, can } from "@/lib/iam";
import { conveyorTeamService } from "@/services/conveyor-team-service";
import { playbookService } from "@/services/playbook-service";
import { NotFound, BusinessRule, Forbidden } from "@/lib/errors";
import type { Lead, LeadDTO, LeadStage, User } from "@/lib/types";
import type { LeadCreateInput, LeadUpdateInput } from "@/lib/schemas/lead";

export interface Contributor {
  userId: string;
  name: string;
  viaAi: boolean;
  actions: string[];
}

/**
 * Every employee who has actually touched this lead — not just its current owner —
 * derived from data already on the record (ownership handoffs, stage advances, linked
 * tasks). Pure/no I/O so callers can pass in whatever task list they already loaded.
 * Human and AI-driven actions by the same person show as separate rows (matches the
 * "ai:<id>" actor-id convention used everywhere else audit trails are attributed).
 */
export function computeContributors(
  lead: Pick<Lead, "ownerId" | "ownerHistory" | "stageHistory">,
  tasks: { assigneeId: string; title: string }[],
  nameByUser: Record<string, string>,
): Contributor[] {
  const byKey = new Map<string, Contributor>();
  const touch = (rawId: string | undefined, action: string) => {
    if (!rawId) return;
    const viaAi = rawId.startsWith("ai:");
    const userId = viaAi ? rawId.slice(3) : rawId;
    const key = `${userId}:${viaAi}`;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.actions.includes(action)) existing.actions.push(action);
    } else {
      byKey.set(key, { userId, name: nameByUser[userId] ?? userId, viaAi, actions: [action] });
    }
  };

  touch(lead.ownerId, "Current owner");
  for (const h of lead.ownerHistory ?? []) touch(h.ownerId, `Owned during ${h.stage}`);
  for (const s of lead.stageHistory ?? []) touch(s.actorId, `Advanced to ${s.to}`);
  for (const t of tasks) touch(t.assigneeId, `Working task "${t.title}"`);

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Is the caller a sales manager (can act on any lead)? */
function isManager(user: User): boolean {
  return isOwner(user) || can(user, "sales.assign") || can(user, "crm.delete");
}

/**
 * Autonomy rules:
 *  - managers may modify any lead.
 *  - individual model → only the lead owner.
 *  - conveyor model → any member of the assigned conveyor team.
 */
async function assertCanModify(user: User, lead: Lead): Promise<void> {
  if (isManager(user)) return;
  if (lead.executionModel === "conveyor" && lead.conveyorTeamId) {
    if (await conveyorTeamService.isMember(user, lead.conveyorTeamId)) return;
    throw new Forbidden("this conveyor lead belongs to another team");
  }
  if (lead.ownerId === user.id) return;
  throw new Forbidden("this lead is owned by another rep (individual funnel)");
}

/** Conveyor-belt workflow: explicit, validated stage transitions. */
const transitions: Record<LeadStage, LeadStage[]> = {
  new: ["qualified", "lost"],
  qualified: ["meeting", "lost"],
  meeting: ["proposal", "lost"],
  proposal: ["negotiation", "lost"],
  negotiation: ["won", "lost"],
  won: [],
  lost: [],
};

interface Actor {
  user: User;
  viaAi?: boolean;
}

export const leadService = {
  async create(input: LeadCreateInput, actor: Actor): Promise<LeadDTO> {
    const lead = await leads.insert({
      orgId: actor.user.orgId,
      ownerId: actor.user.id,
      name: input.name,
      email: input.email,
      company: input.company,
      companyId: input.companyId,
      source: input.source as import("@/lib/types").LeadSource | undefined,
      campaign: input.campaign,
      value: input.value,
      notes: input.notes,
    });
    await audit.record({
      actor: actor.user,
      action: "lead.create",
      entity: lead._id.toHexString(),
      viaAi: actor.viaAi,
    });
    await emit({
      name: "lead.created",
      leadId: lead._id.toHexString(),
      orgId: actor.user.orgId,
      actorId: actor.user.id,
    });
    return toDTO(lead);
  },

  async list(user: User): Promise<LeadDTO[]> {
    const docs = await leads.listForOrg(user.orgId);
    return docs.map(toDTO);
  },

  async listLean(user: User): Promise<LeadDTO[]> {
    const docs = await leads.listLean(user.orgId);
    return docs.map(toDTO);
  },

  async search(user: User, query: string): Promise<LeadDTO[]> {
    const docs = await leads.search(user.orgId, query);
    return docs.map(toDTO);
  },

  async get(user: User, id: string): Promise<LeadDTO> {
    const lead = await leads.findById(user.orgId, id);
    if (!lead) throw new NotFound("lead not found");
    return toDTO(lead);
  },

  async update(user: User, id: string, patch: LeadUpdateInput): Promise<LeadDTO> {
    const existing = await leads.findById(user.orgId, id);
    if (!existing) throw new NotFound("lead not found");
    await assertCanModify(user, existing);
    // estimatedCloseAt arrives as an ISO string from the API; store it as a Date.
    const { estimatedCloseAt, ...rest } = patch;
    const normalized = {
      ...rest,
      ...(estimatedCloseAt !== undefined ? { estimatedCloseAt: new Date(estimatedCloseAt) } : {}),
    } as Parameters<typeof leads.update>[2];
    const updated = await leads.update(user.orgId, id, normalized);
    if (!updated) throw new NotFound("lead not found");
    await audit.record({ actor: user, action: "lead.update", entity: id });
    return toDTO(updated);
  },

  async remove(user: User, id: string): Promise<void> {
    const deleted = await leads.softDelete(user.orgId, id);
    if (!deleted) throw new NotFound("lead not found");
    await audit.record({ actor: user, action: "lead.delete", entity: id });
  },

  /** Reassign a lead to a different rep. Manager action — requires crm.write. */
  async reassign(user: User, id: string, newOwnerId: string): Promise<LeadDTO> {
    assertPermission(user, "crm.write");
    const updated = await leads.setOwner(user.orgId, id, newOwnerId);
    if (!updated) throw new NotFound("lead not found");
    await audit.record({ actor: user, action: "lead.reassign", entity: id, meta: { to: newOwnerId } });
    return toDTO(updated);
  },

  /** Log an outbound touch (call/email/etc.) — bumps engagement + writes the timeline. */
  async logTouch(user: User, id: string, channel: string, note?: string): Promise<LeadDTO> {
    const existing = await leads.findById(user.orgId, id);
    if (!existing) throw new NotFound("lead not found");
    await assertCanModify(user, existing);
    const updated = await leads.logTouch(user.orgId, id);
    if (!updated) throw new NotFound("lead not found");
    const leadId = updated._id.toHexString();
    await audit.record({ actor: user, action: "lead.touch", entity: leadId, meta: { channel } });
    await activityService.log(
      user,
      "lead",
      leadId,
      "touch",
      `${channel[0].toUpperCase()}${channel.slice(1)} touch${note ? ` — ${note}` : ""}`,
    );
    return toDTO(updated);
  },

  /** Persist an AI-generated summary + intelligence (not user-editable via the API). */
  async saveSummary(
    user: User,
    id: string,
    data: { summary: string; health: LeadDTO["health"]; probability: number; nextAction: string },
  ): Promise<LeadDTO> {
    const updated = await leads.update(user.orgId, id, {
      aiSummary: data.summary,
      aiSummaryAt: new Date(),
      health: data.health,
      probability: data.probability,
      nextAction: data.nextAction,
    });
    if (!updated) throw new NotFound("lead not found");
    await audit.record({ actor: user, action: "lead.ai_summary", entity: id, viaAi: true });
    await activityService.log(user, "lead", id, "ai_summary", "AI summary generated", true);
    return toDTO(updated);
  },

  /**
   * Advance a lead to a new stage. Validates the transition against the
   * conveyor-belt map, records history, audits, and emits an event.
   */
  async advance(id: string, to: LeadStage, actor: Actor): Promise<LeadDTO> {
    const lead = await leads.findById(actor.user.orgId, id);
    if (!lead) throw new NotFound("lead not found");
    await assertCanModify(actor.user, lead);
    if (!transitions[lead.stage].includes(to)) {
      throw new BusinessRule(`cannot move stage ${lead.stage} → ${to}`);
    }
    let updated = await leads.setStage(actor.user.orgId, id, to, {
      from: lead.stage,
      to,
      at: new Date(),
      actorId: actor.viaAi ? `ai:${actor.user.id}` : actor.user.id,
    });
    if (!updated) throw new NotFound("lead not found");

    // Conveyor belt: stamp the SLA deadline for the new stage + record the handoff.
    if (lead.executionModel === "conveyor" && lead.playbookKey) {
      const pb = await playbookService.getByKey(actor.user, lead.playbookKey);
      const stageDef = pb?.stages.find((s) => s.key === to);
      const stageDeadline = stageDef?.slaHours
        ? new Date(Date.now() + stageDef.slaHours * 3600000)
        : undefined;
      const handed = await leads.recordHandoff(actor.user.orgId, id, {
        stageDeadline,
        entry: { ownerId: lead.currentStageOwnerId ?? lead.ownerId, stage: to, at: new Date() },
      });
      if (handed) updated = handed;
    }

    await audit.record({
      actor: actor.user,
      action: "lead.stage_changed",
      entity: id,
      meta: { from: lead.stage, to },
      viaAi: actor.viaAi,
    });
    await activityService.log(
      actor.user,
      "lead",
      id,
      to === "won" ? "won" : to === "lost" ? "lost" : "stage_changed",
      `Stage ${lead.stage} → ${to}`,
      actor.viaAi,
    );
    await emit({
      name: "lead.stage_changed",
      leadId: id,
      orgId: actor.user.orgId,
      from: lead.stage,
      to,
      actorId: actor.user.id,
    });
    return toDTO(updated);
  },

  /**
   * Set/switch a lead's execution model. Manager action (sales.assign). For conveyor,
   * initializes the SLA deadline from the playbook's current stage and records ownership.
   */
  async setExecutionModel(
    user: User,
    id: string,
    input: { model: "individual" | "conveyor"; conveyorTeamId?: string; playbookKey?: string },
  ): Promise<LeadDTO> {
    assertPermission(user, "sales.assign");
    const lead = await leads.findById(user.orgId, id);
    if (!lead) throw new NotFound("lead not found");
    if (input.model === "conveyor" && !input.conveyorTeamId) {
      throw new BusinessRule("a conveyor lead needs a conveyor team");
    }
    let stageDeadline: Date | undefined;
    if (input.model === "conveyor" && input.playbookKey) {
      const pb = await playbookService.getByKey(user, input.playbookKey);
      const stageDef = pb?.stages.find((s) => s.key === lead.stage);
      if (stageDef?.slaHours) stageDeadline = new Date(Date.now() + stageDef.slaHours * 3600000);
    }
    const updated = await leads.update(user.orgId, id, {
      executionModel: input.model,
      conveyorTeamId: input.model === "conveyor" ? input.conveyorTeamId : undefined,
      playbookKey: input.playbookKey,
      currentStageOwnerId: input.model === "conveyor" ? user.id : undefined,
      stageDeadline,
    });
    if (!updated) throw new NotFound("lead not found");
    await leads.recordHandoff(user.orgId, id, {
      entry: { ownerId: lead.ownerId, stage: lead.stage, at: new Date() },
    });
    await audit.record({ actor: user, action: "lead.set_model", entity: id, meta: { model: input.model } });
    return toDTO(updated);
  },
};
