/**
 * AI column-mapping for bulk lead import — looks at a spreadsheet's headers + a few
 * sample rows and figures out which column is name/email/company/value/source/notes,
 * so a rep can drop in whatever CSV/Excel their lead source exports without manually
 * mapping columns. Judgment only; never invents data — falls back to a conservative
 * "first column is name, nothing else mapped" guess if the model's response can't be parsed.
 */
import { claude, MODEL } from "@/ai/claude";
import { LEAD_SOURCES } from "@/lib/types";

export interface LeadColumnMapping {
  name: string | null;
  email: string | null;
  company: string | null;
  value: string | null;
  source: string | null;
  notes: string | null;
  currency: "INR" | "USD";
  valueUnit: "whole" | "minor";
}

export async function detectLeadColumnMapping(
  headers: string[],
  sampleRows: Record<string, string>[],
): Promise<LeadColumnMapping> {
  const fallback: LeadColumnMapping = {
    name: headers[0] ?? null,
    email: null,
    company: null,
    value: null,
    source: null,
    notes: null,
    currency: "INR",
    valueUnit: "whole",
  };
  if (headers.length === 0) return fallback;

  const prompt = `You are mapping a spreadsheet's columns onto CRM lead fields for bulk import.

Columns: ${JSON.stringify(headers)}
Sample rows: ${JSON.stringify(sampleRows.slice(0, 5))}

For each CRM field below, name the EXACT column (copied from the Columns list above) that best
matches it, or null if none fits:
- name: the lead/contact/person's name (required — pick the closest column even if imperfect)
- email: email address
- company: company/organization name
- value: deal size / revenue / price (a number, possibly with currency symbols/commas)
- source: how the lead came in (ideally one of: ${LEAD_SOURCES.join(", ")} — or a free-text column to normalize)
- notes: any free-text remarks/description column

Also state:
- currency: "INR" or "USD" — infer from symbols or the column name/values, default "INR"
- valueUnit: "whole" if the value column looks like whole rupees/dollars (e.g. 45000), "minor" only
  if it's clearly already in paise/cents

Return ONLY a JSON object, no other text:
{"name": "<column or null>", "email": "<column or null>", "company": "<column or null>", "value": "<column or null>", "source": "<column or null>", "notes": "<column or null>", "currency": "INR|USD", "valueUnit": "whole|minor"}`;

  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");

  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text) as Partial<Record<keyof LeadColumnMapping, unknown>>;
    const col = (v: unknown): string | null => (typeof v === "string" && headers.includes(v) ? v : null);
    return {
      name: col(parsed.name) ?? fallback.name,
      email: col(parsed.email),
      company: col(parsed.company),
      value: col(parsed.value),
      source: col(parsed.source),
      notes: col(parsed.notes),
      currency: parsed.currency === "USD" ? "USD" : "INR",
      valueUnit: parsed.valueUnit === "minor" ? "minor" : "whole",
    };
  } catch {
    return fallback;
  }
}
