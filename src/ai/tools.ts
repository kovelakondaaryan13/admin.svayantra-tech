/**
 * AI tool catalog. Each tool is a thin wrapper over a service function — never
 * new business logic — so the AI and human paths share rules, audit, and events.
 *
 * Safety boundary (v1): read tools and low-risk creates execute; mutations to
 * revenue data (advancing a deal's stage) REQUIRE HUMAN APPROVAL and return a
 * `pendingApproval` action instead of executing.
 * Guide: .claude/skills/ai/write-ai-tool.md
 */
import type Anthropic from "@anthropic-ai/sdk";
import { assertPermission } from "@/lib/iam";
import { leadService } from "@/services/lead-service";
import { taskService } from "@/services/task-service";
import { meetingService } from "@/services/meeting-service";
import { proposalService } from "@/services/proposal-service";
import { knowledgeService } from "@/services/knowledge-service";
import { retrieveKnowledge } from "@/lib/knowledge/retrieve";
import { orgUnitService } from "@/services/org-unit-service";
import { objectDefinitionService } from "@/services/object-definition-service";
import { policyService } from "@/services/policy-service";
import { employeeService } from "@/services/employee-service";
import { dossierService } from "@/services/dossier-service";
import type { OrgUnit } from "@/lib/platform/entities";
import type { LeadStage, User } from "@/lib/types";

export interface ToolContext {
  user: User;
}

/** A proposed-but-unexecuted action awaiting a human click. */
export type PendingApproval =
  | { type: "advance_lead_stage"; leadId: string; to: LeadStage; summary: string }
  | {
      type: "bulk_reassign_leads";
      assignments: { leadId: string; leadName: string; toUserId: string; toName: string }[];
      summary: string;
    }
  | {
      type: "assign_task";
      title: string;
      assigneeId: string;
      assigneeName: string;
      dueAt?: string;
      priority?: "low" | "medium" | "high";
      leadId?: string;
      summary: string;
    }
  | {
      type: "assign_task_to_role";
      roleKey: string;
      title: string;
      dueAt?: string;
      priority?: "low" | "medium" | "high";
      summary: string;
    };

export interface ToolRunResult {
  /** Structured, compact result returned to the model. */
  output: unknown;
  /** If set, surfaced to the UI as an approval prompt; not yet executed. */
  pendingApproval?: PendingApproval;
}

interface ToolDef {
  schema: Anthropic.Tool;
  run: (input: Record<string, unknown>, ctx: ToolContext) => Promise<ToolRunResult>;
}

const tools: Record<string, ToolDef> = {
  search_leads: {
    schema: {
      name: "search_leads",
      description:
        "Search the user's leads by name, company, or email. Use this when the user " +
        "asks about specific leads, pipeline contents, or 'what should I work on'.",
      input_schema: {
        type: "object",
        properties: { query: { type: "string", description: "Search text" } },
        required: ["query"],
      },
    },
    async run(input, ctx) {
      assertPermission(ctx.user, "crm.read");
      const results = await leadService.search(ctx.user, String(input.query ?? ""));
      return {
        output: results.map((l) => ({
          id: l.id,
          name: l.name,
          company: l.company,
          stage: l.stage,
        })),
      };
    },
  },

  create_lead: {
    schema: {
      name: "create_lead",
      description:
        "Create a new lead. Low-risk, so it executes immediately. Use when the user " +
        "asks to add or capture a new lead/prospect.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          company: { type: "string" },
          companyId: {
            type: "string",
            description:
              "Company record id to link this lead to. If the conversation's ACTIVE OBJECT is a " +
              "company, use its id here (not just the free-text company name).",
          },
          email: { type: "string" },
          source: {
            type: "string",
            enum: ["apollo", "linkedin", "website", "referral", "email", "whatsapp", "conference", "manual", "other"],
            description: "Where the lead came from (attribution)",
          },
          campaign: { type: "string" },
        },
        required: ["name"],
      },
    },
    async run(input, ctx) {
      assertPermission(ctx.user, "crm.write");
      const lead = await leadService.create(
        {
          name: String(input.name),
          company: input.company ? String(input.company) : undefined,
          email: input.email ? String(input.email) : undefined,
          source: input.source ? (String(input.source) as never) : undefined,
          campaign: input.campaign ? String(input.campaign) : undefined,
        },
        { user: ctx.user, viaAi: true },
      );
      if (input.companyId) {
        await leadService.update(ctx.user, lead.id, { companyId: String(input.companyId) });
      }
      return { output: { id: lead.id, name: lead.name, stage: lead.stage } };
    },
  },

  log_touch: {
    schema: {
      name: "log_touch",
      description:
        "Log an outbound touch (call/email/linkedin/whatsapp/meeting) on a lead, by lead name. " +
        "Bumps engagement and writes the activity timeline. Use for 'I just called Acme'.",
      input_schema: {
        type: "object",
        properties: {
          leadName: { type: "string" },
          channel: { type: "string", enum: ["call", "email", "linkedin", "whatsapp", "meeting", "other"] },
          note: { type: "string" },
        },
        required: ["leadName", "channel"],
      },
    },
    async run(input, ctx) {
      assertPermission(ctx.user, "crm.write");
      const results = await leadService.search(ctx.user, String(input.leadName));
      const lead = results[0];
      if (!lead) return { output: { error: `no lead matching ${input.leadName}` } };
      const updated = await leadService.logTouch(
        ctx.user,
        lead.id,
        String(input.channel),
        input.note ? String(input.note) : undefined,
      );
      return { output: { lead: updated.name, touchCount: updated.touchCount } };
    },
  },

  advance_lead_stage: {
    schema: {
      name: "advance_lead_stage",
      description:
        "Propose advancing a lead to a new pipeline stage. This mutates revenue data, " +
        "so it does NOT execute — it returns a proposal for the human to approve.",
      input_schema: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          to: {
            type: "string",
            enum: ["qualified", "meeting", "proposal", "negotiation", "won", "lost"],
          },
        },
        required: ["leadId", "to"],
      },
    },
    async run(input) {
      const leadId = String(input.leadId);
      const to = String(input.to) as LeadStage;
      // v1 boundary: never execute a revenue-data mutation from the AI directly.
      return {
        output: {
          status: "pending_approval",
          note: "This action needs the user to approve it in the UI before it happens.",
        },
        pendingApproval: {
          type: "advance_lead_stage",
          leadId,
          to,
          summary: `Advance lead ${leadId} to "${to}"`,
        },
      };
    },
  },

  list_leads: {
    schema: {
      name: "list_leads",
      description:
        "List leads with optional filters. Use for 'show all clients from LinkedIn', " +
        "'list won deals', 'leads in negotiation'. Returns id, name, company, stage, source, owner.",
      input_schema: {
        type: "object",
        properties: {
          stage: { type: "string", enum: ["new", "qualified", "meeting", "proposal", "negotiation", "won", "lost"] },
          source: { type: "string", enum: ["apollo", "linkedin", "website", "referral", "email", "whatsapp", "conference", "manual", "other"] },
        },
      },
    },
    async run(input, ctx) {
      assertPermission(ctx.user, "crm.read");
      const all = await leadService.list(ctx.user);
      const filtered = all.filter(
        (l) =>
          (!input.stage || l.stage === input.stage) &&
          (!input.source || l.source === input.source),
      );
      return {
        output: filtered.map((l) => ({
          id: l.id, name: l.name, company: l.company, stage: l.stage,
          source: l.source, touchCount: l.touchCount ?? 0,
        })),
      };
    },
  },

  find_stale_leads: {
    schema: {
      name: "find_stale_leads",
      description:
        "Find leads that have been touched at least minTouches times but had no touch in the " +
        "last minDaysSinceTouch days — i.e. 'who hasn't replied after N follow-ups'. Open stages only.",
      input_schema: {
        type: "object",
        properties: {
          minTouches: { type: "number", description: "Minimum touches logged (default 2)" },
          minDaysSinceTouch: { type: "number", description: "Days since last touch (default 3)" },
        },
      },
    },
    async run(input, ctx) {
      assertPermission(ctx.user, "crm.read");
      const minTouches = typeof input.minTouches === "number" ? input.minTouches : 2;
      const minDays = typeof input.minDaysSinceTouch === "number" ? input.minDaysSinceTouch : 3;
      const cutoff = Date.now() - minDays * 86400000;
      const open = ["new", "qualified", "meeting", "proposal", "negotiation"];
      const all = await leadService.list(ctx.user);
      const stale = all.filter(
        (l) =>
          open.includes(l.stage) &&
          (l.touchCount ?? 0) >= minTouches &&
          (!l.lastTouchAt || new Date(l.lastTouchAt).getTime() < cutoff),
      );
      return {
        output: stale.map((l) => ({
          id: l.id, name: l.name, company: l.company, stage: l.stage,
          touchCount: l.touchCount ?? 0,
          lastTouchAt: l.lastTouchAt ? new Date(l.lastTouchAt).toISOString() : null,
        })),
      };
    },
  },

  find_sla_breaches: {
    schema: {
      name: "find_sla_breaches",
      description:
        "Find conveyor-belt leads whose current stage SLA deadline has passed (missed SLA). " +
        "Use for 'who missed today's SLA?' or 'which handoffs are overdue?'.",
      input_schema: { type: "object", properties: {} },
    },
    async run(_input, ctx) {
      assertPermission(ctx.user, "crm.read");
      const now = Date.now();
      const open = ["new", "qualified", "meeting", "proposal", "negotiation"];
      const all = await leadService.list(ctx.user);
      const breached = all.filter(
        (l) => l.executionModel === "conveyor" && open.includes(l.stage) && l.stageDeadline && new Date(l.stageDeadline).getTime() < now,
      );
      return {
        output: breached.map((l) => ({
          id: l.id, name: l.name, stage: l.stage,
          deadline: l.stageDeadline ? new Date(l.stageDeadline).toISOString() : null,
          teamId: l.conveyorTeamId,
        })),
      };
    },
  },

  assign_leads: {
    schema: {
      name: "assign_leads",
      description:
        "Propose reassigning leads evenly (round-robin) among a set of reps, by their emails. " +
        "Optionally filter which leads by stage/source. Use for 'split qualified leads between " +
        "Priya and Arjun'. This mutates revenue data, so it does NOT execute — it returns a " +
        "proposal for the human to approve. Requires crm.write.",
      input_schema: {
        type: "object",
        properties: {
          assigneeEmails: { type: "array", items: { type: "string" } },
          stage: { type: "string", enum: ["new", "qualified", "meeting", "proposal", "negotiation", "won", "lost"] },
          source: { type: "string" },
        },
        required: ["assigneeEmails"],
      },
    },
    async run(input, ctx) {
      assertPermission(ctx.user, "crm.write");
      const emails = (Array.isArray(input.assigneeEmails) ? input.assigneeEmails : []).map((e) => String(e));
      if (!emails.length) return { output: { error: "no assignees provided" } };
      const employees = await employeeService.listDirectory(ctx.user);
      const reps = emails
        .map((em) => employees.find((e) => e.email.toLowerCase() === em.toLowerCase()))
        .filter((e): e is NonNullable<typeof e> => Boolean(e));
      if (!reps.length) return { output: { error: "no matching employees for those emails" } };

      const all = await leadService.list(ctx.user);
      const targets = all.filter(
        (l) =>
          (!input.stage || l.stage === input.stage) &&
          (!input.source || l.source === String(input.source)),
      );
      if (!targets.length) return { output: { error: "no leads matched those filters" } };

      const assignments = targets.map((lead, idx) => {
        const rep = reps[idx % reps.length];
        return { leadId: lead.id, leadName: lead.name, toUserId: rep.userId, toName: rep.name };
      });
      const perRep = new Map<string, number>();
      for (const a of assignments) perRep.set(a.toName, (perRep.get(a.toName) ?? 0) + 1);
      const summary = `Reassign ${assignments.length} lead${assignments.length === 1 ? "" : "s"} — ` +
        [...perRep.entries()].map(([name, n]) => `${n} to ${name}`).join(", ");

      // v1 boundary: never execute a revenue-data mutation from the AI directly.
      return {
        output: {
          status: "pending_approval",
          note: "This action needs the user to approve it in the UI before it happens.",
          proposedCount: assignments.length,
        },
        pendingApproval: { type: "bulk_reassign_leads", assignments, summary },
      };
    },
  },

  entity_dossier: {
    schema: {
      name: "entity_dossier",
      description:
        "Get the FULL history of a lead/client by name — a chronological, source-attributed " +
        "dossier spanning stage changes, activity, meetings, proposals, tasks, and the audit " +
        "trail (who did/approved what). Use for 'show everything about NCR', 'when did " +
        "negotiations begin?', 'who approved pricing?', 'what meetings happened before the " +
        "quote?'. Ground your answer in the returned events and cite them (type + date).",
      input_schema: {
        type: "object",
        properties: { name: { type: "string", description: "Lead or client name" } },
        required: ["name"],
      },
    },
    async run(input, ctx) {
      assertPermission(ctx.user, "crm.read");
      const dossier = await dossierService.forName(ctx.user, String(input.name ?? ""));
      return { output: dossier };
    },
  },

  search_knowledge: {
    schema: {
      name: "search_knowledge",
      description:
        "Search across leads, companies, contacts, and knowledge docs. Use for broad " +
        "'find X' questions spanning multiple object types.",
      input_schema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
    async run(input, ctx) {
      assertPermission(ctx.user, "crm.read");
      const hits = await knowledgeService.search(ctx.user, String(input.query ?? ""));
      return { output: hits };
    },
  },

  list_my_open_tasks: {
    schema: {
      name: "list_my_open_tasks",
      description:
        "List the current user's open tasks. Use to answer 'what should I work on?'.",
      input_schema: { type: "object", properties: {} },
    },
    async run(_input, ctx) {
      const tasks = await taskService.listOpenForUser(ctx.user);
      return { output: tasks.map((t) => ({ id: t.id, title: t.title, priority: t.priority })) };
    },
  },

  search_company_knowledge: {
    schema: {
      name: "search_company_knowledge",
      description:
        "Semantic search over company documents (proposals, quotations, meeting notes, " +
        "contracts, SOPs). Use to answer 'what did we send/discuss/agree' questions. Returns " +
        "cited snippets — ground your answer in them and cite the source titles.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string" },
          companyId: { type: "string" },
        },
        required: ["query"],
      },
    },
    async run(input, ctx) {
      assertPermission(ctx.user, "documents.read");
      const hits = await retrieveKnowledge(ctx.user, String(input.query ?? ""), {
        companyId: input.companyId ? String(input.companyId) : undefined,
        limit: 6,
      });
      return {
        output: hits.map((h) => ({
          title: h.payload.title,
          documentType: h.payload.documentType,
          snippet: h.payload.text.slice(0, 300),
          score: h.score,
        })),
      };
    },
  },

  create_task: {
    schema: {
      name: "create_task",
      description: "Create a follow-up task for the user. Low-risk, executes immediately.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          dueAt: { type: "string", description: "ISO datetime" },
          leadId: { type: "string" },
        },
        required: ["title"],
      },
    },
    async run(input, ctx) {
      assertPermission(ctx.user, "tasks.assign");
      const task = await taskService.create(
        ctx.user,
        {
          title: String(input.title),
          dueAt: input.dueAt ? String(input.dueAt) : undefined,
          leadId: input.leadId ? String(input.leadId) : undefined,
        },
        true,
      );
      return { output: { id: task.id, title: task.title } };
    },
  },

  assign_task: {
    schema: {
      name: "assign_task",
      description:
        "Propose assigning a task to another employee by their email. Use for 'ask Priya to " +
        "follow up with Acme'. This does NOT execute — it returns a proposal for the human to " +
        "approve, since it creates work and notifies someone else on the assigner's behalf.",
      input_schema: {
        type: "object",
        properties: {
          email: { type: "string" },
          title: { type: "string" },
          dueAt: { type: "string", description: "ISO datetime" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          leadName: { type: "string", description: "Optional lead to link" },
        },
        required: ["email", "title"],
      },
    },
    async run(input, ctx) {
      assertPermission(ctx.user, "tasks.assign");
      const employees = await employeeService.listDirectory(ctx.user);
      const emp = employees.find((e) => e.email.toLowerCase() === String(input.email).toLowerCase());
      if (!emp) return { output: { error: `no employee with email ${input.email}` } };
      let leadId: string | undefined;
      if (input.leadName) {
        const hits = await leadService.search(ctx.user, String(input.leadName));
        leadId = hits[0]?.id;
      }
      const title = String(input.title);
      const dueAt = input.dueAt ? String(input.dueAt) : undefined;
      const priority = input.priority as "low" | "medium" | "high" | undefined;

      // v1 boundary: never execute a mutation that acts on someone else's behalf directly.
      return {
        output: {
          status: "pending_approval",
          note: "This action needs the user to approve it in the UI before it happens.",
          assignedTo: emp.name,
          title,
        },
        pendingApproval: {
          type: "assign_task",
          title,
          assigneeId: emp.userId,
          assigneeName: emp.name,
          dueAt,
          priority,
          leadId,
          summary: `Assign "${title}" to ${emp.name}`,
        },
      };
    },
  },

  assign_task_to_role: {
    schema: {
      name: "assign_task_to_role",
      description:
        "Propose the same task for every active employee with a given role key (e.g. sales_rep). " +
        "Use for 'ask all sales reps to update their pipeline by Friday'. This does NOT execute " +
        "— it returns a proposal for the human to approve.",
      input_schema: {
        type: "object",
        properties: {
          roleKey: { type: "string" },
          title: { type: "string" },
          dueAt: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["roleKey", "title"],
      },
    },
    async run(input, ctx) {
      assertPermission(ctx.user, "tasks.assign");
      const roleKey = String(input.roleKey);
      const employees = await employeeService.listDirectory(ctx.user);
      const count = employees.filter((e) => e.roleKey === roleKey && e.status === "active").length;
      if (!count) return { output: { error: `no active employees with role ${roleKey}` } };
      const title = String(input.title);
      const dueAt = input.dueAt ? String(input.dueAt) : undefined;
      const priority = input.priority as "low" | "medium" | "high" | undefined;

      // v1 boundary: never execute a mutation that acts on someone else's behalf directly.
      return {
        output: {
          status: "pending_approval",
          note: "This action needs the user to approve it in the UI before it happens.",
          affectedCount: count,
          title,
        },
        pendingApproval: { type: "assign_task_to_role", roleKey, title, dueAt, priority, summary: `Assign "${title}" to ${count} ${roleKey}(s)` },
      };
    },
  },

  create_meeting: {
    schema: {
      name: "create_meeting",
      description:
        "Schedule a real meeting on the calendar, optionally linked to a lead/client by name. " +
        "Low-risk, executes immediately. Use when the user asks to schedule/book a meeting or call.",
      input_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          at: {
            type: "string",
            description:
              "ISO 8601 datetime, e.g. 2026-07-23T15:00:00.000Z. Resolve relative times " +
              "('tomorrow at 3pm') against the current date given in context.",
          },
          leadName: { type: "string", description: "Optional lead/client name to link this meeting to" },
          notes: { type: "string" },
        },
        required: ["title", "at"],
      },
    },
    async run(input, ctx) {
      assertPermission(ctx.user, "calendar.write");
      let leadId: string | undefined;
      if (input.leadName) {
        const hits = await leadService.search(ctx.user, String(input.leadName));
        leadId = hits[0]?.id;
      }
      const meeting = await meetingService.create(ctx.user, {
        title: String(input.title),
        at: String(input.at),
        leadId,
        notes: input.notes ? String(input.notes) : undefined,
      });
      return { output: { id: meeting.id, title: meeting.title, at: meeting.at } };
    },
  },

  create_proposal: {
    schema: {
      name: "create_proposal",
      description:
        "Generate a real proposal for a lead/client, with AI-drafted narrative sections around a " +
        "software-set amount. Low-risk, executes immediately. Use when the user asks to generate " +
        "or create a proposal/quote document for a client.",
      input_schema: {
        type: "object",
        properties: {
          leadName: { type: "string", description: "Lead/client this proposal is for" },
          title: { type: "string" },
          amount: { type: "number", description: "Proposal amount in whole currency units (e.g. 500000 for five lakh rupees)" },
          currency: { type: "string", enum: ["INR", "USD"], description: "Defaults to INR" },
        },
        required: ["leadName", "title", "amount"],
      },
    },
    async run(input, ctx) {
      assertPermission(ctx.user, "sales.write");
      const hits = await leadService.search(ctx.user, String(input.leadName));
      const lead = hits[0];
      if (!lead) return { output: { error: `no lead matching ${input.leadName}` } };
      const currency = (input.currency ? String(input.currency) : "INR") as "INR" | "USD";
      const amountMinor = Math.round(Number(input.amount) * 100);
      const proposal = await proposalService.create(ctx.user, {
        leadId: lead.id,
        title: String(input.title),
        amount: { amountMinor, currency },
        aiDraft: true,
      });
      return { output: { id: proposal.id, title: proposal.title, status: proposal.status } };
    },
  },

  // --- AI Organization Administrator (RBAC-gated + audited via the services) ---
  create_org_unit: {
    schema: {
      name: "create_org_unit",
      description:
        "Create an organizational unit (department, team, division, region, branch, etc.). " +
        "Requires the user to have org.manage. Use for 'create a Legal department'.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: {
            type: "string",
            enum: ["department", "team", "business_unit", "division", "branch", "region", "location", "cost_center", "subsidiary"],
          },
          parentName: { type: "string", description: "Optional parent unit name to nest under" },
        },
        required: ["name", "type"],
      },
    },
    async run(input, ctx) {
      let parentId: string | undefined;
      if (input.parentName) {
        const units = await orgUnitService.list(ctx.user);
        parentId = units.find((u) => u.name.toLowerCase() === String(input.parentName).toLowerCase())?.id;
      }
      const unit = await orgUnitService.create(ctx.user, {
        name: String(input.name),
        type: String(input.type) as OrgUnit["type"],
        parentId,
      });
      return { output: { id: unit.id, name: unit.name, type: unit.type } };
    },
  },

  set_employee_role: {
    schema: {
      name: "set_employee_role",
      description:
        "Change an employee's role by email. Requires users.edit. Use for 'Rahul is now Finance Head' " +
        "(map to roleKey like finance_head).",
      input_schema: {
        type: "object",
        properties: { email: { type: "string" }, roleKey: { type: "string" } },
        required: ["email", "roleKey"],
      },
    },
    async run(input, ctx) {
      const employees = await employeeService.list(ctx.user);
      const emp = employees.find((e) => e.email.toLowerCase() === String(input.email).toLowerCase());
      if (!emp) return { output: { error: `no employee with email ${input.email}` } };
      const updated = await employeeService.update(ctx.user, emp.id, { roleKey: String(input.roleKey) });
      return { output: { email: updated.email, roleKey: updated.roleKey } };
    },
  },

  move_org_unit: {
    schema: {
      name: "move_org_unit",
      description:
        "Move an org unit under a new parent (reparent). Requires org.manage. Use for " +
        "'move Sales under India'. Omit newParentName to move it to the top level.",
      input_schema: {
        type: "object",
        properties: {
          unitName: { type: "string" },
          newParentName: { type: "string", description: "Parent unit name; omit for top level" },
        },
        required: ["unitName"],
      },
    },
    async run(input, ctx) {
      const list = await orgUnitService.list(ctx.user);
      const unit = list.find((u) => u.name.toLowerCase() === String(input.unitName).toLowerCase());
      if (!unit) return { output: { error: `no org unit named ${input.unitName}` } };
      let parentId: string | null = null;
      if (input.newParentName) {
        const parent = list.find((u) => u.name.toLowerCase() === String(input.newParentName).toLowerCase());
        if (!parent) return { output: { error: `no org unit named ${input.newParentName}` } };
        parentId = parent.id;
      }
      const updated = await orgUnitService.update(ctx.user, unit.id, { parentId });
      return { output: { id: updated.id, name: updated.name, parentId: updated.parentId ?? null } };
    },
  },

  rename_org_unit: {
    schema: {
      name: "rename_org_unit",
      description: "Rename an org unit. Requires org.manage. Use for 'rename Sales to Revenue'.",
      input_schema: {
        type: "object",
        properties: { unitName: { type: "string" }, newName: { type: "string" } },
        required: ["unitName", "newName"],
      },
    },
    async run(input, ctx) {
      const list = await orgUnitService.list(ctx.user);
      const unit = list.find((u) => u.name.toLowerCase() === String(input.unitName).toLowerCase());
      if (!unit) return { output: { error: `no org unit named ${input.unitName}` } };
      const updated = await orgUnitService.update(ctx.user, unit.id, { name: String(input.newName) });
      return { output: { id: updated.id, name: updated.name } };
    },
  },

  assign_org_manager: {
    schema: {
      name: "assign_org_manager",
      description:
        "Set the manager of an org unit by the manager's email. Requires org.manage. Use for " +
        "'make Anita the manager of Finance'.",
      input_schema: {
        type: "object",
        properties: { unitName: { type: "string" }, managerEmail: { type: "string" } },
        required: ["unitName", "managerEmail"],
      },
    },
    async run(input, ctx) {
      const [list, employees] = await Promise.all([
        orgUnitService.list(ctx.user),
        employeeService.list(ctx.user),
      ]);
      const unit = list.find((u) => u.name.toLowerCase() === String(input.unitName).toLowerCase());
      if (!unit) return { output: { error: `no org unit named ${input.unitName}` } };
      const mgr = employees.find((e) => e.email.toLowerCase() === String(input.managerEmail).toLowerCase());
      if (!mgr) return { output: { error: `no employee with email ${input.managerEmail}` } };
      const updated = await orgUnitService.update(ctx.user, unit.id, { managerUserId: mgr.userId });
      return { output: { unit: updated.name, manager: mgr.name } };
    },
  },

  set_employee_manager: {
    schema: {
      name: "set_employee_manager",
      description:
        "Set who an employee reports to (their manager), both by email. Requires users.edit. " +
        "Use for 'Rahul reports to Anita'.",
      input_schema: {
        type: "object",
        properties: { email: { type: "string" }, managerEmail: { type: "string" } },
        required: ["email", "managerEmail"],
      },
    },
    async run(input, ctx) {
      const employees = await employeeService.list(ctx.user);
      const emp = employees.find((e) => e.email.toLowerCase() === String(input.email).toLowerCase());
      const mgr = employees.find((e) => e.email.toLowerCase() === String(input.managerEmail).toLowerCase());
      if (!emp) return { output: { error: `no employee with email ${input.email}` } };
      if (!mgr) return { output: { error: `no manager with email ${input.managerEmail}` } };
      const updated = await employeeService.update(ctx.user, emp.id, { managerUserId: mgr.userId });
      return { output: { employee: updated.name, reportsTo: mgr.name } };
    },
  },

  create_object_definition: {
    schema: {
      name: "create_object_definition",
      description:
        "Define a new custom object type (e.g. Asset, Factory, Machine, Patient). Requires objects.manage. " +
        "Fields are [{key,label,type}]; type ∈ text|textarea|number|boolean|date|select|reference.",
      input_schema: {
        type: "object",
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          labelPlural: { type: "string" },
          displayField: { type: "string" },
          fields: { type: "array", items: { type: "object" } },
        },
        required: ["key", "label", "labelPlural", "displayField"],
      },
    },
    async run(input, ctx) {
      const fields = (Array.isArray(input.fields) ? input.fields : []) as {
        key: string;
        label: string;
        type: string;
      }[];
      const def = await objectDefinitionService.create(ctx.user, {
        key: String(input.key),
        label: String(input.label),
        labelPlural: String(input.labelPlural),
        displayField: String(input.displayField),
        fields: fields.map((f) => ({ key: f.key, label: f.label, type: f.type as never })),
      });
      return { output: { key: def.key, label: def.label } };
    },
  },

  set_policy: {
    schema: {
      name: "set_policy",
      description:
        "Create/replace a business policy (e.g. 'Finance approves quotes above ₹2 lakh'). Requires policies.manage. " +
        "effect ∈ allow|deny|limit|threshold; value is a number (e.g. threshold in minor units, or discount %).",
      input_schema: {
        type: "object",
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          domain: { type: "string" },
          effect: { type: "string", enum: ["allow", "deny", "limit", "threshold"] },
          value: { type: "number" },
        },
        required: ["key", "label", "domain", "effect"],
      },
    },
    async run(input, ctx) {
      const policy = await policyService.create(ctx.user, {
        key: String(input.key),
        label: String(input.label),
        domain: String(input.domain),
        effect: String(input.effect) as never,
        value: typeof input.value === "number" ? input.value : undefined,
      });
      return { output: { key: policy.key, effect: policy.effect, value: policy.value } };
    },
  },
};

export const toolSchemas: Anthropic.Tool[] = Object.values(tools).map((t) => t.schema);

export async function runTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolRunResult> {
  const tool = tools[name];
  if (!tool) return { output: { error: `unknown tool: ${name}` } };
  try {
    return await tool.run(input, ctx);
  } catch (err) {
    // Fail safe — hand the model a reasoned error, never crash the conversation.
    return { output: { error: err instanceof Error ? err.message : "tool failed" } };
  }
}
