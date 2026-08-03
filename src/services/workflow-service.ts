/** Configurable workflow/approval engine — definitions + running instances. */
import { repo, toDTO } from "@/data/collection";
import * as audit from "@/lib/audit";
import { activityService } from "@/services/activity-service";
import { assertPermission, isOwner } from "@/lib/iam";
import { NotFound, Forbidden } from "@/lib/errors";
import { runToNextStop, applyDecision, pendingApprover } from "@/lib/platform/workflow-engine";
import type { WorkflowDefinition, WorkflowInstance } from "@/lib/platform/entities";
import type { DTO } from "@/lib/entities";
import type { User } from "@/lib/types";

const defsRepo = repo<WorkflowDefinition>("workflowDefinitions");
const instRepo = repo<WorkflowInstance>("workflowInstances", { workspaceScoped: true });

async function defByKey(orgId: string, key: string): Promise<WorkflowDefinition | undefined> {
  return (await defsRepo.list(orgId, { key } as never))[0];
}

export const workflowService = {
  async listDefinitions(user: User): Promise<DTO<WorkflowDefinition>[]> {
    assertPermission(user, "workflows.manage");
    return (await defsRepo.list(user.orgId)).map(toDTO);
  },

  async createDefinition(
    user: User,
    input: Omit<WorkflowDefinition, keyof import("@/lib/entities").BaseDoc | "enabled"> & { enabled?: boolean },
  ): Promise<DTO<WorkflowDefinition>> {
    assertPermission(user, "workflows.manage");
    const doc = await defsRepo.insert(user.orgId, {
      key: input.key,
      label: input.label,
      trigger: input.trigger,
      startNodeId: input.startNodeId,
      nodes: input.nodes,
      enabled: input.enabled ?? true,
    });
    await audit.record({ actor: user, action: "workflow.define", entity: doc._id.toHexString(), meta: { key: input.key } });
    return toDTO(doc);
  },

  async start(
    user: User,
    workflowKey: string,
    context: Record<string, unknown>,
    subject?: { type: string; id: string },
  ): Promise<DTO<WorkflowInstance>> {
    const def = await defByKey(user.orgId, workflowKey);
    if (!def) throw new NotFound("workflow not found");
    const inst = await instRepo.insert(user.orgId, {
      workflowKey,
      subjectType: subject?.type,
      subjectId: subject?.id,
      context,
      status: "running",
      currentNodeId: def.startNodeId,
      steps: [],
      startedBy: user.id,
    });
    runToNextStop(def, inst);
    await instRepo.update(user.orgId, inst._id.toHexString(), {
      status: inst.status,
      currentNodeId: inst.currentNodeId ?? null,
      steps: inst.steps,
    } as never);
    await audit.record({ actor: user, action: "workflow.start", entity: inst._id.toHexString(), meta: { workflow: workflowKey } });
    return toDTO(inst);
  },

  async listInstances(user: User): Promise<DTO<WorkflowInstance>[]> {
    assertPermission(user, "workflows.approve");
    return (await instRepo.list(user.orgId)).map(toDTO);
  },

  async act(
    user: User,
    instanceId: string,
    decision: "approved" | "rejected",
    note?: string,
  ): Promise<DTO<WorkflowInstance>> {
    assertPermission(user, "workflows.approve");
    const inst = await instRepo.findById(user.orgId, instanceId);
    if (!inst) throw new NotFound("instance not found");
    const def = await defByKey(user.orgId, inst.workflowKey);
    if (!def) throw new NotFound("workflow definition not found");

    const approver = pendingApprover(def, inst);
    if (approver && !isOwner(user)) {
      const roleOk = approver.role ? user.role === approver.role : true;
      const userOk = approver.userId ? user.id === approver.userId : true;
      if (!(roleOk && userOk)) throw new Forbidden("not the designated approver for this step");
    }

    applyDecision(def, inst, user.id, decision, note);
    await instRepo.update(user.orgId, instanceId, {
      status: inst.status,
      currentNodeId: inst.currentNodeId ?? null,
      steps: inst.steps,
    } as never);
    await audit.record({ actor: user, action: `workflow.${decision}`, entity: instanceId, meta: { workflow: inst.workflowKey } });
    await activityService.log(
      user,
      "workflow",
      instanceId,
      decision,
      `${inst.workflowKey.replace(/_/g, " ")} ${decision}${inst.subjectId ? ` — ${inst.subjectId}` : ""}`,
    );
    return toDTO(inst);
  },
};
