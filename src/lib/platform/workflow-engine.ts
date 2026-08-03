/**
 * Generic workflow/approval runtime. Advances an instance through metadata-defined
 * nodes (condition → notify → approval → end) until it needs a human or ends.
 * Supports conditional branching, sequential approvals, and reject paths — all
 * configuration, no code.
 */
import type { WorkflowDefinition, WorkflowInstance, WorkflowNode } from "@/lib/platform/entities";

function node(def: WorkflowDefinition, id: string): WorkflowNode | undefined {
  return def.nodes.find((n) => n.id === id);
}

function evalCondition(n: Extract<WorkflowNode, { type: "condition" }>, ctx: Record<string, unknown>): boolean {
  const left = Number(ctx[n.field] ?? 0);
  const right = Number(n.value);
  switch (n.op) {
    case "gt":
      return left > right;
    case "lt":
      return left < right;
    case "gte":
      return left >= right;
    case "lte":
      return left <= right;
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
  }
}

/** Auto-advance through condition/notify nodes until an approval or end node. Mutates + returns `inst`. */
export function runToNextStop(def: WorkflowDefinition, inst: WorkflowInstance): WorkflowInstance {
  let currentId = inst.currentNodeId ?? def.startNodeId;
  let guard = 0;
  while (guard++ < 200) {
    const n = node(def, currentId);
    if (!n) break;
    if (n.type === "end") {
      inst.status = n.outcome === "rejected" ? "rejected" : n.outcome === "approved" ? "approved" : "done";
      inst.currentNodeId = undefined;
      inst.steps.push({ nodeId: n.id, at: new Date() });
      return inst;
    }
    if (n.type === "condition") {
      const t = evalCondition(n, inst.context);
      inst.steps.push({ nodeId: n.id, at: new Date(), note: t ? "true" : "false" });
      currentId = t ? n.onTrue : n.onFalse;
      continue;
    }
    if (n.type === "notify") {
      inst.steps.push({ nodeId: n.id, at: new Date(), note: n.message });
      currentId = n.next;
      continue;
    }
    // approval — pause for a human decision
    inst.currentNodeId = n.id;
    inst.status = "running";
    return inst;
  }
  return inst;
}

/** Record an approval decision on the pending node and continue. Mutates + returns `inst`. */
export function applyDecision(
  def: WorkflowDefinition,
  inst: WorkflowInstance,
  actorId: string,
  decision: "approved" | "rejected",
  note?: string,
): WorkflowInstance {
  const n = inst.currentNodeId ? node(def, inst.currentNodeId) : undefined;
  if (!n || n.type !== "approval") throw new Error("no pending approval on this instance");
  inst.steps.push({ nodeId: n.id, at: new Date(), actorId, decision, note });
  if (decision === "rejected") {
    if (n.onReject) {
      inst.currentNodeId = n.onReject;
      return runToNextStop(def, inst);
    }
    inst.status = "rejected";
    inst.currentNodeId = undefined;
    return inst;
  }
  inst.currentNodeId = n.next;
  return runToNextStop(def, inst);
}

/** The role/user allowed to act on the currently-pending approval, if any. */
export function pendingApprover(def: WorkflowDefinition, inst: WorkflowInstance): { role?: string; userId?: string } | null {
  const n = inst.currentNodeId ? node(def, inst.currentNodeId) : undefined;
  if (!n || n.type !== "approval") return null;
  return { role: n.approverRole, userId: n.approverUserId };
}
