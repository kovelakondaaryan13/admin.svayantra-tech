/**
 * First line of support for "Raise Issue" — a single classification call, no tools/data
 * access. Only resolves questions answerable from general knowledge of how STOS works
 * (navigation, common flows); anything data-specific, account-specific, or bug-shaped is
 * conservatively routed to a human. Never claims to have fixed something it can't verify.
 */
import { claude, MODEL } from "@/ai/claude";

export interface IssueClassification {
  canResolve: boolean;
  response: string;
}

const PRODUCT_CONTEXT = `STOS (RevenueOS) is an AI-native sales operating system. Top-level areas: Home
(daily briefing), Assistant (AI chat), Calendar, Work (leads/tasks/conveyor pipeline), Companies,
People, Knowledge (documents + RAG search), Organization/Admin (roles, employees, settings,
sales models, audit log). Leads move through stages (new → qualified → meeting → proposal →
negotiation → won/lost) either individually or via a Conveyor Belt team with automatic handoffs.
Tasks, meetings, and proposals link to leads/companies. The ⌘K command palette jumps anywhere
and can switch Demo/Production workspace (owner only).`;

export async function classifyIssue(input: { title: string; description: string }): Promise<IssueClassification> {
  const prompt = `You are the first line of support for STOS, triaging a user-submitted issue.

${PRODUCT_CONTEXT}

Decide whether you can directly and confidently resolve this yourself using ONLY the product
knowledge above, or whether it needs a human (bugs, data problems, permission/account changes,
anything you cannot verify without access to their actual data).

Default to needing a human when uncertain — a wrong confident answer is worse than routing it.

Issue title: ${input.title}
Issue description: ${input.description}

Return ONLY a JSON object:
{
  "canResolve": <true only if you are confident and it's a general how-do-I / where-is question>,
  "response": "<if canResolve: the direct answer. If not: a short, reassuring note that this has been routed to the team>"
}`;

  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");

  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text) as Partial<IssueClassification>;
    return {
      canResolve: parsed.canResolve === true,
      response: String(parsed.response ?? "This has been routed to the team.").trim(),
    };
  } catch {
    return { canResolve: false, response: "This has been routed to the team." };
  }
}
