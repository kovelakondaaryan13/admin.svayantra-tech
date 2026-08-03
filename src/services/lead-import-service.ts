/**
 * Bulk lead import — CSV/XLSX upload → AI column detection → row-by-row lead creation.
 * Two-step (preview then commit) so a rep can eyeball/correct the detected mapping
 * before a few hundred leads get written. See src/app/api/leads/import/*.
 */
import { parseSpreadsheet } from "@/lib/import/parse-spreadsheet";
import { detectLeadColumnMapping, type LeadColumnMapping } from "@/ai/lead-import-mapper";
import { assertPermission } from "@/lib/iam";
import { leadService } from "@/services/lead-service";
import { LEAD_SOURCES } from "@/lib/types";
import type { LeadDTO, LeadSource, User } from "@/lib/types";

export interface ImportPreview {
  headers: string[];
  rows: Record<string, string>[];
  mapping: LeadColumnMapping;
  rowCount: number;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; reason: string }[];
  leads: LeadDTO[];
}

function parseAmount(raw: string): number | null {
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export const leadImportService = {
  async preview(user: User, buffer: Buffer, filename: string): Promise<ImportPreview> {
    assertPermission(user, "crm.write");
    const { headers, rows } = await parseSpreadsheet(buffer, filename);
    const mapping = await detectLeadColumnMapping(headers, rows);
    return { headers, rows, mapping, rowCount: rows.length };
  },

  async commit(user: User, rows: Record<string, string>[], mapping: LeadColumnMapping): Promise<ImportResult> {
    assertPermission(user, "crm.write");
    const created: LeadDTO[] = [];
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = mapping.name ? String(row[mapping.name] ?? "").trim() : "";
        if (!name) {
          errors.push({ row: i + 1, reason: "missing name" });
          continue;
        }

        const emailRaw = mapping.email ? String(row[mapping.email] ?? "").trim() : "";
        const email = /^\S+@\S+\.\S+$/.test(emailRaw) ? emailRaw : undefined;

        const company = mapping.company ? String(row[mapping.company] ?? "").trim() || undefined : undefined;

        let value: { amountMinor: number; currency: "INR" | "USD" } | undefined;
        if (mapping.value) {
          const amount = parseAmount(String(row[mapping.value] ?? ""));
          if (amount !== null && amount > 0) {
            value = {
              amountMinor: Math.round(mapping.valueUnit === "minor" ? amount : amount * 100),
              currency: mapping.currency,
            };
          }
        }

        const sourceRaw = mapping.source ? String(row[mapping.source] ?? "").trim().toLowerCase() : "";
        const source = (LEAD_SOURCES as readonly string[]).includes(sourceRaw) ? (sourceRaw as LeadSource) : undefined;

        const notes = mapping.notes ? String(row[mapping.notes] ?? "").trim() || undefined : undefined;

        const lead = await leadService.create({ name, email, company, source, value, notes }, { user, viaAi: true });
        created.push(lead);
      } catch (err) {
        errors.push({ row: i + 1, reason: err instanceof Error ? err.message : "unknown error" });
      }
    }

    return { created: created.length, skipped: errors.length, errors: errors.slice(0, 20), leads: created };
  },
};
