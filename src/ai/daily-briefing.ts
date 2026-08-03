/**
 * AI daily work briefing. Turns a person's real work state (tasks, overdue items,
 * owned pipeline, at-risk deals) into a short, prioritized "here's your day" note.
 * Judgment + prioritization only — the numbers/items are passed in, never invented.
 */
import { claude, MODEL } from "@/ai/claude";

export interface BriefingContext {
  name: string;
  openTasks: { title: string; priority?: string; dueAt?: string; overdue: boolean }[];
  meetingsToday: { title: string; at: string }[];
  atRisk: { name: string; reason: string }[];
  pipelineNote: string;
}

export async function generateBriefing(ctx: BriefingContext): Promise<string> {
  const prompt = `You are STOS, an AI Chief of Staff. Write a short morning work briefing for ${ctx.name}.
Base it ONLY on the data below. Be concrete and prioritized; no filler.

Open tasks: ${ctx.openTasks.map((t) => `${t.title}${t.overdue ? " (OVERDUE)" : t.dueAt ? ` (due ${t.dueAt.slice(0, 10)})` : ""}${t.priority ? ` [${t.priority}]` : ""}`).join("; ") || "none"}
Meetings today: ${ctx.meetingsToday.map((m) => `${m.title} @ ${m.at.slice(11, 16)}`).join("; ") || "none"}
Deals needing attention: ${ctx.atRisk.map((r) => `${r.name} — ${r.reason}`).join("; ") || "none"}
Pipeline: ${ctx.pipelineNote}

Format:
- One-line greeting.
- "Today's priorities:" a short bullet list (most important first; lead with overdue items).
- "Needs attention:" bullets only if there are at-risk deals.
- "Suggested focus:" one sentence.
Keep it under 150 words. Plain text with simple hyphen bullets.`;

  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim() || "No briefing available.";
}
