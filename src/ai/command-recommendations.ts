/**
 * AI recommendations for the Owner Command Center. Turns the aggregated operating picture
 * into a short, prioritized set of "what you should do about it" recommendations. Judgment
 * only — every fact is passed in, never invented.
 */
import { claude, MODEL } from "@/ai/claude";
import { fmtLakhCr as lakh } from "@/lib/format";
import type { CommandCenter } from "@/services/command-center-service";

export async function generateRecommendations(cc: CommandCenter): Promise<string> {
  const prompt = `You are STOS, an AI Chief of Staff briefing the founder of Svayantra Tech.
Using ONLY the operating data below, give the founder a short, prioritized set of recommendations.

Yesterday: ${cc.yesterday.total} events. Highlights: ${cc.yesterday.items.map((i) => i.summary).slice(0, 5).join("; ") || "none"}
Blocked: ${cc.blocked.approvalsWaiting} approvals waiting, ${cc.blocked.slaBreaches} SLA breaches. ${cc.blocked.items.join("; ") || ""}
People needing help: ${cc.needHelp.map((h) => `${h.name} (${h.openCount} open${h.capacity ? `/${h.capacity}` : ""}, ${h.overdue} overdue)`).join("; ") || "none"}
Deals at risk: ${cc.atRisk.map((r) => `${r.name} — ${r.reason}`).join("; ") || "none"}
Forecast: booked ${lakh(cc.forecast.bookedMinor)}, weighted pipeline ${lakh(cc.forecast.weightedPipelineMinor)}, total pipeline ${lakh(cc.forecast.totalPipelineMinor)}, win rate ${cc.forecast.winRate ?? "n/a"}%
Bottlenecks: ${cc.bottlenecks.join("; ") || "none"}

Format (plain text, hyphen bullets, under 160 words):
- "Do first:" 2-4 bullets, most urgent first (unblock approvals, rescue at-risk deals, rebalance overloaded people).
- "Watch:" 1-2 bullets on bottlenecks or forecast risk.
- One-sentence closing focus.`;

  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 700,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim() || "No recommendations available.";
}
