/**
 * AI lead intelligence. Summarizes a deal from its real data (stage history,
 * tasks, meetings, activity, proposals) and proposes health / win-probability /
 * next action. Narrative + judgment only — it never invents figures; the caller
 * passes the real numbers in.
 */
import { claude, MODEL } from "@/ai/claude";
import type { LeadHealth } from "@/lib/types";

export interface LeadSummaryContext {
  name: string;
  company?: string;
  stage: string;
  valueLabel?: string;
  notes?: string;
  stageHistory: { from: string; to: string; at: string }[];
  tasks: { title: string; status: string }[];
  meetings: { title: string; at: string }[];
  activity: { summary: string; kind: string }[];
  proposals: { title: string; status: string }[];
}

export interface LeadSummaryResult {
  summary: string;
  health: LeadHealth;
  probability: number; // 0–100
  nextAction: string;
}

export async function summarizeLead(ctx: LeadSummaryContext): Promise<LeadSummaryResult> {
  const prompt = `You are a sales operations analyst. Summarize this deal for a busy founder and
assess it. Base everything ONLY on the data below — do not invent facts or numbers.

Lead: ${ctx.name}${ctx.company ? ` (${ctx.company})` : ""}
Current stage: ${ctx.stage}
Value: ${ctx.valueLabel ?? "unknown"}
Notes: ${ctx.notes ?? "—"}
Stage history: ${ctx.stageHistory.map((s) => `${s.from}→${s.to}`).join(", ") || "none"}
Open/closed tasks: ${ctx.tasks.map((t) => `${t.title} [${t.status}]`).join("; ") || "none"}
Meetings: ${ctx.meetings.map((m) => m.title).join("; ") || "none"}
Recent activity: ${ctx.activity.map((a) => a.summary).slice(0, 8).join("; ") || "none"}
Proposals: ${ctx.proposals.map((p) => `${p.title} [${p.status}]`).join("; ") || "none"}

Return ONLY a JSON object:
{
  "summary": "2-4 sentence plain-English status of where this deal stands and the key risk/opportunity",
  "health": "green | yellow | red",
  "probability": <integer 0-100 win probability>,
  "nextAction": "the single most valuable next action the rep should take"
}`;

  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 700,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");

  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text) as Partial<LeadSummaryResult>;
    const health: LeadHealth =
      parsed.health === "green" || parsed.health === "red" ? parsed.health : "yellow";
    const probability = Math.max(0, Math.min(100, Math.round(Number(parsed.probability ?? 50))));
    return {
      summary: String(parsed.summary ?? text).trim() || "No summary available.",
      health,
      probability,
      nextAction: String(parsed.nextAction ?? "Follow up with the prospect.").trim(),
    };
  } catch {
    return {
      summary: text.trim() || "No summary available.",
      health: "yellow",
      probability: 50,
      nextAction: "Follow up with the prospect.",
    };
  }
}
