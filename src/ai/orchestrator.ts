/**
 * AI orchestrator: a manual tool-use loop over the Claude Messages API.
 * The AI orchestrates work; deterministic services execute it; humans approve
 * revenue-data mutations. Guide: .claude/knowledge/architecture (ai-orchestration).
 *
 * M1 is non-streaming (returns a final message + any pending approvals).
 * Streaming is a later enhancement — see ROADMAP M4.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { claude, MODEL } from "@/ai/claude";
import { toolSchemas, runTool, type PendingApproval, type ToolContext } from "@/ai/tools";
import { can } from "@/lib/iam";
import { leadService } from "@/services/lead-service";
import { taskService } from "@/services/task-service";
import { workflowService } from "@/services/workflow-service";
import { meetingService } from "@/services/meeting-service";
import { employeeService } from "@/services/employee-service";
import { orgUnitService } from "@/services/org-unit-service";
import { contextResolverService } from "@/services/context-resolver-service";
import { connectorStatuses } from "@/lib/connectors/credentials";
import type { AttachmentReference, RelatedObject } from "@/lib/chat-entities";
import type { User } from "@/lib/types";

const SYSTEM = `You are STOS — the AI Chief of Staff for Svayantra Tech. You ACT on requests using your tools.

## #1 RULE: ACT FIRST, NEVER ASK UNNECESSARY QUESTIONS
When the user gives an instruction, DO NOT ask clarifying questions if you can figure it out.
- The BUSINESS CONTEXT block has the team list with names, emails, roles, and userIds. USE IT.
- If the user mentions a person by first name (e.g., "Priya"), match it to the team list. Do NOT
  ask "who is Priya?" when Priya Sharma is right there in your context.
- If the user says "reduce workload for X" → IMMEDIATELY call list_leads or list_my_open_tasks to
  see what X has, then propose or execute reassignments. Do NOT ask 5 questions first.
- If the request is vague, make a REASONABLE assumption, act on it, and state what you did.
  Wrong assumption? The user will correct you. That's faster than a 3-message Q&A.
- ONLY ask a question when there are genuinely multiple conflicting interpretations AND you cannot
  determine which one is right from context. One question max, never a bulleted list of options.

## Core rules
- The BUSINESS CONTEXT block contains the current user, role, permissions, pipeline snapshot, open
  tasks, team roster, approvals, meetings, and org structure. ALWAYS reference it before asking.
- Call tools to fetch or modify data. Never guess numbers or facts.
- Stage changes require human approval via advance_lead_stage. Everything else executes directly.
- Be concise. Lead with the answer or action taken. No filler, no preamble.

## How to handle common requests
- "Reduce workload for X" / "Help X" → search_leads to find X's leads, list_my_open_tasks for
  tasks. Then reassign some to other team members with lighter loads using assign_leads/assign_task.
- "What should I focus on?" → Read BUSINESS CONTEXT. Summarize overdue tasks, at-risk deals, pending
  approvals, upcoming meetings. No tool call needed if context already has it.
- "Create a lead/deal for X" → Call create_lead immediately with available info. Don't ask for
  fields the user didn't mention — use sensible defaults.
- "Search/Find X" → Call search_leads for deals, search_knowledge for docs. Pick the right tool.
- "Create a task" → create_task with title, assigneeId (from team list), priority, dueAt.
- "Assign leads" → assign_leads with leadIds and target ownerId from team list.
- "What's the status of X?" → entity_dossier for deep lookup, search_leads for quick match.
- "Summarize this document" → Read the ATTACHED DOCUMENTS block directly. Don't say you can't see it.
- "Stale leads" / "SLA breaches" → find_stale_leads or find_sla_breaches.
- "Schedule a meeting" / "Book a call" → create_meeting with title, at (resolve to ISO 8601 against
  Current date above), and leadName if tied to a deal. This actually creates the meeting — never
  claim a meeting was scheduled without calling this tool. Check the "Google Calendar" line in
  BUSINESS CONTEXT: if connected, you may say it was added to their Google Calendar too (it syncs
  automatically); if not connected, don't claim it did — mention connecting at /account instead.
  The same applies to create_task/assign_task when a dueAt is given.
- "Generate a proposal" / "Send a quote" → create_proposal with leadName, title, amount. This
  actually creates the proposal — never claim one was generated without calling this tool. No
  dedicated proposal card exists yet; use type "success" for the confirmation.

## Response format
- For created/found objects, return a JSON code block with "type" field for rich card rendering.
  Types: lead_created, lead, company, task, meeting, employee, success, error.
- NEVER announce that something was created, scheduled, or sent unless you actually called the
  tool that creates it. If no tool exists for what the user asked, say so plainly instead of
  inventing a success message or substituting an unrelated action.
  Example: \`\`\`json\\n{"type":"success","title":"Done","message":"Reassigned 3 leads from Priya to Deblina"}\\n\`\`\`
- For analysis, use markdown with headers and bullets. Keep it scannable.
- Never wrap the entire response in a code block.

## Attachments
If ATTACHED DOCUMENTS block exists, those files ARE available. "This document" = the attachment.

## Scope
Business assistant for Svayantra Tech operations ONLY. Refuse personal, homework, creative writing,
coding, entertainment, or off-topic requests with: "I'm focused on Svayantra Tech operations —
sales, tasks, meetings, docs, and org management. How can I help with your work?"
Exception: business-adjacent requests (client emails, meeting prep, industry context) ARE in scope.`;

const MAX_ITERATIONS = 8;

/** Build a live business-context block so the AI understands the situation without asking. */
async function buildContext(user: User): Promise<string> {
  const lines: string[] = [];
  lines.push(`Current date: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(
    `User: ${user.name ?? user.email} (${user.email}) — role "${user.role}"${user.isOwner ? " (Owner, full access)" : ""}.`,
  );

  const results = await Promise.allSettled([
    can(user, "crm.read") ? leadService.list(user) : Promise.resolve([]),
    taskService.listOpenForUser(user),
    can(user, "workflows.approve") ? workflowService.listInstances(user) : Promise.resolve([]),
    can(user, "calendar.read") ? meetingService.list(user) : Promise.resolve([]),
    can(user, "users.read") ? employeeService.list(user) : Promise.resolve([]),
    orgUnitService.list(user),
    connectorStatuses(user),
  ]);
  const val = <T,>(i: number, d: T): T =>
    results[i].status === "fulfilled" ? ((results[i] as PromiseFulfilledResult<T>).value as T) : d;

  const leads = val(0, [] as Awaited<ReturnType<typeof leadService.list>>);
  if (leads.length) {
    const byStage: Record<string, number> = {};
    for (const l of leads) byStage[l.stage] = (byStage[l.stage] ?? 0) + 1;
    lines.push(
      `Pipeline: ${leads.length} leads — ${Object.entries(byStage).map(([s, n]) => `${n} ${s}`).join(", ")}.`,
    );
  }

  const tasks = val(1, [] as Awaited<ReturnType<typeof taskService.listOpenForUser>>);
  lines.push(`Your open tasks: ${tasks.length}.`);

  const instances = val(2, [] as Awaited<ReturnType<typeof workflowService.listInstances>>);
  const running = instances.filter((i) => i.status === "running").length;
  if (can(user, "workflows.approve")) lines.push(`Approvals awaiting action: ${running}.`);

  const meetings = val(3, [] as Awaited<ReturnType<typeof meetingService.list>>);
  const upcoming = meetings.filter((m) => new Date(m.at).getTime() > Date.now()).length;
  if (can(user, "calendar.read")) lines.push(`Upcoming meetings: ${upcoming}.`);

  const employees = val(4, [] as Awaited<ReturnType<typeof employeeService.list>>);
  if (employees.length) {
    lines.push(
      `Team (name — email — role): ${employees
        .map((e) => `${e.name} — ${e.email} — ${e.roleKey}`)
        .join("; ")}.`,
    );
  }

  const units = val(5, [] as Awaited<ReturnType<typeof orgUnitService.list>>);
  if (units.length) {
    lines.push(`Org units: ${units.map((u) => `${u.name} (${u.type})`).join(", ")}.`);
  }

  const connectors = val(6, [] as Awaited<ReturnType<typeof connectorStatuses>>);
  const googleConnected = connectors.some((c) => c.kind === "google_calendar" && c.status === "connected");
  lines.push(
    googleConnected
      ? "Google Calendar: connected — meetings you book and tasks with due dates sync there automatically."
      : "Google Calendar: not connected — meetings/tasks are saved but won't appear on Google Calendar until the user connects it at /account.",
  );

  return `BUSINESS CONTEXT (live):\n${lines.join("\n")}`;
}

export interface ChatResult {
  text: string;
  pendingApprovals: PendingApproval[];
  usage?: { inputTokens: number; outputTokens: number };
}

export type StreamEvent =
  | { type: "status"; label: string }
  | { type: "tool_start"; tool: string; label: string }
  | { type: "tool_done"; tool: string }
  | { type: "text"; text: string }
  | { type: "done"; text: string; pendingApprovals: PendingApproval[] }
  | { type: "error"; message: string };

const TOOL_LABEL: Record<string, string> = {
  search_leads: "Searching leads…",
  create_lead: "Creating lead…",
  log_touch: "Logging touch…",
  list_leads: "Listing leads…",
  find_stale_leads: "Finding stale leads…",
  find_sla_breaches: "Checking SLA…",
  assign_leads: "Assigning leads…",
  entity_dossier: "Building dossier…",
  search_knowledge: "Searching knowledge…",
  search_company_knowledge: "Searching documents…",
  create_task: "Creating task…",
  assign_task: "Assigning task…",
  assign_task_to_role: "Assigning to role…",
  create_meeting: "Scheduling meeting…",
  create_proposal: "Drafting proposal…",
  advance_lead_stage: "Proposing stage change…",
  create_org_unit: "Creating org unit…",
  set_employee_role: "Updating role…",
  move_org_unit: "Moving org unit…",
  rename_org_unit: "Renaming unit…",
  assign_org_manager: "Assigning manager…",
  set_employee_manager: "Setting report line…",
  create_object_definition: "Creating object type…",
  set_policy: "Setting policy…",
  list_my_open_tasks: "Checking tasks…",
};

export interface ChatOptions {
  attachments?: AttachmentReference[];
  objectContext?: RelatedObject[];
  onEvent?: (event: StreamEvent) => void;
}

/** "ACTIVE OBJECT" block — the conversation is about a specific object, so don't ask which one. */
function buildObjectContext(objects?: RelatedObject[]): string {
  if (!objects?.length) return "";
  const lines = objects.map((o) => `- ${o.type} "${o.label ?? o.id}" (id: ${o.id})`).join("\n");
  return `ACTIVE OBJECT(S):\nThis conversation is scoped to the following object(s):\n${lines}\n\nWhen the user refers to "this deal/company/person", "it", or asks you to act without naming an object, they mean the object(s) above. Use these ids directly in tool calls. Do NOT ask the user which object they mean — you already know.`;
}

export async function chat(user: User, userMessage: string, opts: ChatOptions = {}): Promise<ChatResult> {
  const ctx: ToolContext = { user };
  const pendingApprovals: PendingApproval[] = [];
  const emit = opts.onEvent ?? (() => {});
  let totalInput = 0;
  let totalOutput = 0;

  emit({ type: "status", label: "Thinking…" });

  // Resolve attachments into a structured document block — the model never sees bare ids.
  const attachmentBlock = await contextResolverService
    .buildAttachmentContext(user, opts.attachments)
    .catch(() => "");
  const userContent = attachmentBlock ? `${attachmentBlock}\n\n---\n\nUser's instruction:\n${userMessage}` : userMessage;
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userContent }];

  // Live context so the AI understands the user's situation without asking.
  const context = await buildContext(user).catch(() => "");
  const objectContext = buildObjectContext(opts.objectContext);
  const system = [SYSTEM, objectContext, context].filter(Boolean).join("\n\n");

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await claude.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system,
      tools: toolSchemas,
      messages,
    });

    totalInput += response.usage?.input_tokens ?? 0;
    totalOutput += response.usage?.output_tokens ?? 0;

    if (response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { text, pendingApprovals, usage: { inputTokens: totalInput, outputTokens: totalOutput } };
    }

    // Preserve the full assistant turn (including tool_use blocks) in history.
    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      emit({ type: "tool_start", tool: block.name, label: TOOL_LABEL[block.name] ?? `Running ${block.name}…` });
      const result = await runTool(
        block.name,
        (block.input ?? {}) as Record<string, unknown>,
        ctx,
      );
      emit({ type: "tool_done", tool: block.name });
      if (result.pendingApproval) pendingApprovals.push(result.pendingApproval);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result.output),
      });
    }
    emit({ type: "status", label: "Thinking…" });
    messages.push({ role: "user", content: toolResults });
  }

  return {
    text: "I wasn't able to finish that within the step limit. Please try narrowing the request.",
    pendingApprovals,
    usage: { inputTokens: totalInput, outputTokens: totalOutput },
  };
}
