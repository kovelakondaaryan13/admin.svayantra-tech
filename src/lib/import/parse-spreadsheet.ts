/**
 * Parses CSV/XLSX/XLS bytes into a header + row-object array for bulk-import features
 * (e.g. lead import). SheetJS parses raw CSV text the same way it parses a worksheet,
 * so one code path covers all three formats. Dynamic import with a literal specifier —
 * see src/lib/files/extractors.ts for why (serverExternalPackages + Next bundling).
 */
import { BusinessRule } from "@/lib/errors";

export interface ParsedSpreadsheet {
  headers: string[];
  rows: Record<string, string>[];
}

const MAX_ROWS = 2000;

export async function parseSpreadsheet(buffer: Buffer, filename: string): Promise<ParsedSpreadsheet> {
  const XLSX = (await import("xlsx")) as unknown as {
    read: (data: Buffer | string, opts: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
    utils: { sheet_to_json: <T>(sheet: unknown, opts?: { defval?: string; raw?: boolean }) => T[] };
  };
  const ext = (filename.toLowerCase().split(".").pop() ?? "").trim();
  const isCsv = ext === "csv" || ext === "tsv";
  const wb = isCsv
    ? XLSX.read(buffer.toString("utf8"), { type: "string" })
    : XLSX.read(buffer, { type: "buffer" });

  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };

  // raw: false → every cell comes back as a display string, so numbers/dates/currency
  // are uniform strings the caller can parse itself (and safe to round-trip as JSON).
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[sheetName], { defval: "", raw: false });
  if (rows.length > MAX_ROWS) {
    throw new BusinessRule(`file has ${rows.length} rows — the import limit is ${MAX_ROWS}. Split it into smaller files.`);
  }

  const headers = Object.keys(rows[0] ?? {});
  return { headers, rows };
}
