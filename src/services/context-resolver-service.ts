/**
 * ContextResolverService — turns the raw references on a message into a fully-assembled context
 * package the orchestrator can hand to the LLM. The model NEVER sees bare attachmentIds and never
 * touches GridFS/Qdrant/Mongo directly: it receives resolved documents (name, ingestion status,
 * Knowledge id, extracted text) as a structured block. This is what makes "summarize this",
 * "extract the lead", "what's the pricing" work on a freshly-uploaded file.
 *
 * Design notes:
 * - Text is injected whenever it exists, regardless of final status. The pipeline persists
 *   `extractedText` at the `extracted` step (before embedding), so a doc whose Qdrant embedding
 *   later failed STILL yields usable text — the model can extract a lead even if RAG indexing broke.
 * - If a doc is genuinely still processing (no text yet) or failed with no text, the block says so
 *   explicitly, so the assistant explains the state instead of claiming "there is no document".
 */
import { uploadedFiles } from "@/services/ingestion-service";
import type { AttachmentReference } from "@/lib/chat-entities";
import type { User } from "@/lib/types";

const PER_DOC_CHARS = 8000;   // cap per document
const TOTAL_CHARS = 20000;    // cap across all attachments in one message

export interface ResolvedAttachment {
  fileId: string;
  name: string;
  status: string;
  documentId?: string;
  ready: boolean;
  text?: string;         // extracted text (may be truncated by buildBlock)
  totalChars?: number;   // full extracted length, for a truncation note
  error?: string;
  missing?: boolean;
}

export const contextResolverService = {
  /** Resolve each attachment reference into its uploaded-file record + extracted text. Never throws. */
  async resolveAttachments(user: User, attachments?: AttachmentReference[]): Promise<ResolvedAttachment[]> {
    if (!attachments?.length) return [];
    const out: ResolvedAttachment[] = [];
    for (const a of attachments) {
      const meta = await uploadedFiles.findById(user.orgId, a.fileId).catch(() => null);
      if (!meta) {
        out.push({ fileId: a.fileId, name: a.name, status: "missing", ready: false, missing: true });
        continue;
      }
      out.push({
        fileId: a.fileId,
        name: meta.name,
        status: meta.status,
        documentId: meta.documentId,
        ready: meta.status === "ready",
        text: meta.extractedText || undefined,
        totalChars: meta.extractedChars ?? meta.extractedText?.length,
        error: meta.errorReason,
      });
    }
    return out;
  },

  /**
   * Render resolved attachments as an "ATTACHED DOCUMENTS" block for the prompt. Applies a global
   * character budget so a huge document can't blow the context window.
   */
  buildBlock(resolved: ResolvedAttachment[]): string {
    if (!resolved.length) return "";
    let budget = TOTAL_CHARS;

    const parts = resolved.map((r, i) => {
      const head = [
        `Document ${i + 1}`,
        `Name: ${r.name}`,
        `Ingestion status: ${r.status}`,
        r.documentId ? `Knowledge ID: ${r.documentId}` : undefined,
      ].filter(Boolean).join("\n");

      let body: string;
      if (r.text && budget > 0) {
        const cap = Math.min(PER_DOC_CHARS, budget);
        const slice = r.text.slice(0, cap);
        budget -= slice.length;
        const truncated = (r.totalChars ?? slice.length) > slice.length;
        body = `Extracted text:\n${slice}${truncated ? `\n…[truncated — ${r.totalChars} characters total]` : ""}`;
      } else if (r.text && budget <= 0) {
        body = "Extracted text omitted — the combined attachment context exceeded the budget. Ask a narrower question or reference this document by name to fetch it.";
      } else if (r.missing) {
        body = "This attachment could not be found in storage. Tell the user the file is missing — do NOT proceed as if it were attached.";
      } else if (r.status === "failed") {
        // Upload SUCCEEDED; a later stage (text extraction / indexing) failed. Never tell the user
        // to re-upload — the file is stored. Offer extraction-stage recovery only.
        body = `The file UPLOADED SUCCESSFULLY, but automatic text extraction failed${r.error ? ` (${r.error})` : ""}. The document is stored and safe — this is NOT an upload problem, so do NOT tell the user to re-upload. Explain that extraction failed and offer to: (1) retry extraction, (2) convert the file to PDF/plain text and re-attach, or (3) have the user paste the key details so you can proceed now. If they paste the content, continue with the task.`;
      } else {
        body = `The file uploaded successfully and is still being processed (status: ${r.status}) — text isn't ready yet. Tell the user it's still extracting and to try again in a moment. Do NOT claim there is no document and do NOT tell them to re-upload.`;
      }
      return `${head}\n\n${body}`;
    });

    return [
      "ATTACHED DOCUMENTS",
      `The user attached ${resolved.length} document(s) to this message. When they say "this document", "this file", "it", "the attachment", or refer implicitly, they mean these. Use them directly — extract leads/contacts, summarize, answer questions, or create tasks as asked. Never say you cannot see an attached document when one is listed here.`,
      "",
      parts.join("\n\n---\n\n"),
    ].join("\n");
  },

  /** Convenience: resolve + render in one call. Returns "" when there are no attachments. */
  async buildAttachmentContext(user: User, attachments?: AttachmentReference[]): Promise<string> {
    return this.buildBlock(await this.resolveAttachments(user, attachments));
  },
};
