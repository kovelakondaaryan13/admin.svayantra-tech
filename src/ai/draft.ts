/**
 * AI drafting of NARRATIVE ONLY. Numbers/terms are never model-authored — the
 * caller passes software-computed figures in and gets prose back.
 * Guide: .claude/skills/sales/model-sales-features.md
 */
import { claude, MODEL } from "@/ai/claude";
import type { Proposal } from "@/lib/entities";

export async function draftProposalSections(
  title: string,
  company: string | undefined,
  amountLabel: string,
): Promise<Proposal["sections"]> {
  const prompt = `Draft a short B2B sales proposal narrative as JSON.
Title: ${title}
Client: ${company ?? "the client"}
Total (fixed, do not change): ${amountLabel}

Return ONLY a JSON array of {"heading","body"} objects with 3 sections:
Overview, Approach, Why Svayantra Tech. Do not mention or alter any numbers.`;

  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");

  try {
    const match = text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match ? match[0] : text) as Proposal["sections"];
    if (Array.isArray(parsed) && parsed.every((s) => s.heading && s.body)) return parsed;
  } catch {
    /* fall through to a safe default */
  }
  return [{ heading: "Overview", body: text.trim() || "Proposal narrative pending." }];
}
