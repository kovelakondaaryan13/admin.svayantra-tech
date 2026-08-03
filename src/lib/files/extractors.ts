/**
 * Pluggable extractor registry. Each extractor declares what it handles + how to pull text.
 * Adding OCR / HTML / email / zip later = add an extractor, no pipeline change.
 *
 * Rich formats (PDF/DOCX/XLSX) load their parser via dynamic import. The specifiers are LITERAL
 * (not a variable) so Next matches them against `serverExternalPackages` in next.config.mjs and
 * resolves them natively from node_modules at runtime instead of bundling them — bundling breaks
 * the dynamic import and makes extraction wrongly report "parser not installed". Plain text
 * (TXT/MD/CSV/JSON/…) works with zero dependencies, everywhere.
 */
export interface ExtractResult {
  text: string;
  unavailable?: boolean; // parser genuinely not available (e.g. lib not installed / not resolvable)
  error?: string; // parser IS available but extraction failed (corrupt file, unexpected format…)
}

export interface Extractor {
  name: string;
  canHandle(ext: string, mime?: string): boolean;
  extract(buffer: Buffer): Promise<ExtractResult>;
}

/**
 * Split a thrown error into "parser missing" vs "extraction failed". Only a module-resolution
 * failure is genuinely `unavailable`; everything else is a real extraction error we must surface
 * truthfully (never blame a missing parser for a corrupt-file error).
 */
function classifyFailure(e: unknown): ExtractResult {
  const msg = (e as Error)?.message ?? String(e);
  const code = (e as { code?: string })?.code;
  const missing = code === "MODULE_NOT_FOUND" || code === "ERR_MODULE_NOT_FOUND" || /cannot find module/i.test(msg);
  return missing ? { text: "", unavailable: true } : { text: "", error: msg };
}

const TEXT_EXT = new Set(["txt", "text", "md", "markdown", "csv", "tsv", "json", "log", "yaml", "yml", "html", "htm"]);

const textExtractor: Extractor = {
  name: "text",
  canHandle: (ext, mime) => TEXT_EXT.has(ext) || (mime?.startsWith("text/") ?? false),
  extract: async (buf) => ({ text: buf.toString("utf8") }),
};

const pdfExtractor: Extractor = {
  name: "pdf",
  canHandle: (ext, mime) => ext === "pdf" || mime === "application/pdf",
  extract: async (buf) => {
    try {
      const lib = (await import("pdf-parse")) as unknown as {
        default?: (b: Buffer) => Promise<{ text?: string }>;
      } & ((b: Buffer) => Promise<{ text?: string }>);
      const pdf = lib.default ?? lib;
      const r = await pdf(buf);
      return { text: (r?.text ?? "").trim() };
    } catch (e) {
      return classifyFailure(e);
    }
  },
};

const docxExtractor: Extractor = {
  name: "docx",
  canHandle: (ext) => ext === "docx",
  extract: async (buf) => {
    try {
      const mammoth = (await import("mammoth")) as unknown as {
        extractRawText?: (o: { buffer: Buffer }) => Promise<{ value?: string }>;
        default?: { extractRawText?: (o: { buffer: Buffer }) => Promise<{ value?: string }> };
      };
      const extract = mammoth.extractRawText ?? mammoth.default?.extractRawText;
      if (!extract) throw new Error("mammoth.extractRawText is not a function");
      const r = await extract({ buffer: buf });
      return { text: (r?.value ?? "").trim() };
    } catch (e) {
      return classifyFailure(e);
    }
  },
};

const spreadsheetExtractor: Extractor = {
  name: "spreadsheet",
  canHandle: (ext) => ext === "xlsx" || ext === "xls",
  extract: async (buf) => {
    try {
      const XLSX = (await import("xlsx")) as unknown as {
        read: (b: Buffer, o: { type: string }) => { SheetNames: string[]; Sheets: Record<string, unknown> };
        utils: { sheet_to_csv: (s: unknown) => string };
      };
      const wb = XLSX.read(buf, { type: "buffer" });
      const text = wb.SheetNames
        .map((n) => `# ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`)
        .join("\n\n");
      return { text: text.trim() };
    } catch (e) {
      return classifyFailure(e);
    }
  },
};

const REGISTRY: Extractor[] = [textExtractor, pdfExtractor, docxExtractor, spreadsheetExtractor];

export function findExtractor(filename: string, mime?: string): Extractor | undefined {
  const ext = (filename.toLowerCase().split(".").pop() ?? "").trim();
  return REGISTRY.find((e) => e.canHandle(ext, mime));
}
