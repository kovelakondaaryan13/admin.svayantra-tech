/**
 * AI Executive Briefing — the Chief-of-Staff morning brief for the owner. Turns the live
 * Command Center picture into a crisp "Yesterday / Today / Recommendations" narrative.
 * Judgment + prioritization only; every fact is passed in, never invented.
 */
import { claude, MODEL } from "@/ai/claude";
import { fmtLakhCr as lakh } from "@/lib/format";
import type { CommandCenter } from "@/services/command-center-service";

export async function generateExecutiveBriefing(name: string, cc: CommandCenter, meetingsToday: string[]): Promise<string> {
  const prompt = `You are STOS, the AI Chief of Staff for ${name}, founder of Svayantra Tech.
Write this morning's executive briefing. Warm, direct, decisive — like a trusted chief of staff. Use ONLY the data below.

YESTERDAY (last 48h, ${cc.yesterday.total} events): ${cc.yesterday.items.map((i) => i.summary).slice(0, 6).join("; ") || "quiet"}
TODAY'S MEETINGS: ${meetingsToday.join("; ") || "none"}
BLOCKED: ${cc.blocked.approvalsWaiting} approvals waiting; ${cc.blocked.slaBreaches} SLA breaches. ${cc.blocked.items.join("; ")}
AT RISK: ${cc.atRisk.map((r) => `${r.name} (${r.reason})`).join("; ") || "none"}
OVERLOADED: ${cc.needHelp.map((h) => `${h.name} ${h.openCount}${h.capacity ? "/" + h.capacity : ""} open`).join("; ") || "none"}
FORECAST: booked ${lakh(cc.forecast.bookedMinor)}, weighted ${lakh(cc.forecast.weightedPipelineMinor)}, pipeline ${lakh(cc.forecast.totalPipelineMinor)}, win rate ${cc.forecast.winRate ?? "n/a"}%
BOTTLENECKS: ${cc.bottlenecks.join("; ") || "none"}

Format (plain text, hyphen bullets, under 170 words):
- One-line greeting.
- "Yesterday:" 2-4 bullets of what moved.
- "Today:" 2-4 bullets (meetings, approvals to clear, overdue).
- "Recommendations:" 2-3 sharp, specific actions (who/what).
Lead with what matters most. No filler, no hedging.`;

  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim() || "No briefing available.";
}
