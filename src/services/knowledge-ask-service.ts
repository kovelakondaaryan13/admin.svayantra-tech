/**
 * AI Knowledge Chat (RAG). Retrieve RBAC-filtered vectors → inject as grounded
 * context → answer with Claude → ALWAYS cite sources, NEVER hallucinate. If nothing
 * relevant is found, it says so instead of inventing an answer.
 */
import { claude, MODEL } from "@/ai/claude";
import { retrieveKnowledge, type RetrieveOptions } from "@/lib/knowledge/retrieve";
import { record } from "@/lib/telemetry";
import type { User } from "@/lib/types";

export interface Citation {
  index: number;
  documentId: string;
  title: string;
  documentType: string;
  chunkIndex: number;
  score: number;
  snippet: string;
}

export interface AskResult {
  answer: string;
  citations: Citation[];
  grounded: boolean;
}

const SYSTEM = `You answer questions using ONLY the company knowledge provided as numbered context.
Rules:
- Cite every claim with its source number like [1], [2].
- If the context does not contain the answer, say "I don't have that in the company knowledge base." Do NOT guess.
- Never invent numbers, dates, names, prices, or terms that are not in the context.
- Be concise and lead with the answer.`;

export async function askKnowledge(
  user: User,
  question: string,
  opts: RetrieveOptions = {},
): Promise<AskResult> {
  const hits = await retrieveKnowledge(user, question, { limit: opts.limit ?? 8, ...opts });
  record("search", hits.length === 0 ? "miss" : "hit", { q: question.slice(0, 80), hits: hits.length });

  if (hits.length === 0) {
    return {
      answer: "I don't have that in the company knowledge base yet.",
      citations: [],
      grounded: false,
    };
  }

  const context = hits
    .map((h, i) => `[${i + 1}] (${h.payload.documentType} — "${h.payload.title}")\n${h.payload.text}`)
    .join("\n\n");

  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: SYSTEM,
    messages: [{ role: "user", content: `Question: ${question}\n\nCompany knowledge:\n${context}` }],
  });

  const answer = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  const citations: Citation[] = hits.map((h, i) => ({
    index: i + 1,
    documentId: h.payload.documentId,
    title: h.payload.title,
    documentType: h.payload.documentType,
    chunkIndex: h.payload.chunkIndex,
    score: h.score,
    snippet: h.payload.text.slice(0, 220),
  }));

  return { answer, citations, grounded: true };
}
