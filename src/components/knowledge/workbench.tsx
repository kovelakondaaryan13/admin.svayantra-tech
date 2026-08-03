"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ds";
import { FileUploader } from "@/components/knowledge/file-uploader";

interface DocRow {
  id: string;
  title: string;
  documentType: string;
  status: string;
  chunkCount: number;
}
interface Citation {
  index: number;
  title: string;
  documentType: string;
  score: number;
  snippet: string;
}
interface AskResult {
  answer: string;
  citations: Citation[];
  grounded: boolean;
}

const DOC_TYPES = [
  "upload",
  "proposal",
  "quotation",
  "meeting_transcript",
  "contract",
  "email",
  "note",
  "sop",
];

export function KnowledgeWorkbench({
  documents,
  canWriteFiles = false,
  canDeleteFiles = false,
}: {
  documents: DocRow[];
  canWriteFiles?: boolean;
  canDeleteFiles?: boolean;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);

  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("upload");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function ask() {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setResult(null);
    try {
      const res = await fetch("/api/knowledge/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "request failed");
      setResult(body.data);
    } catch (err) {
      setResult({ answer: `Error: ${(err as Error).message}`, citations: [], grounded: false });
    } finally {
      setAsking(false);
    }
  }

  async function upload() {
    if (!title.trim() || !text.trim() || uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, documentType: docType, text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "upload failed");
      setTitle("");
      setText("");
      router.refresh();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow="Knowledge"
        title="Company knowledge"
        subtitle="Ask anything about clients, proposals, quotations, or meetings — answers are grounded in your documents and cited."
      />

      <FileUploader canWrite={canWriteFiles} canDelete={canDeleteFiles} />

      {/* Ask */}
      <section className="glass p-5">
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="e.g. What quote did we send Acme? What were the payment terms?"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <button
            onClick={ask}
            disabled={asking}
            className="btn-accent"
          >
            {asking ? "Thinking…" : "Ask"}
          </button>
        </div>

        {asking && <Skeleton className="mt-4 h-20 w-full" />}

        {result && !asking && (
          <div className="mt-4 space-y-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{result.answer}</p>
            {result.citations.length > 0 && (
              <div className="space-y-1.5 border-t border-border pt-3">
                <p className="text-xs uppercase tracking-wide text-muted">Sources</p>
                {result.citations.map((c) => (
                  <div key={c.index} className="rounded-lg border border-border bg-surface px-3 py-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-overlay/5 px-1.5 py-0.5 text-accent">[{c.index}]</span>
                      <span className="font-medium text-fg">{c.title}</span>
                      <span className="text-muted">· {c.documentType}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">{c.snippet}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload */}
        <section className="glass p-5">
          <h2 className="mb-3 text-sm font-semibold tracking-tight">Add a document</h2>
          <div className="space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. Acme Proposal v2)"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm capitalize outline-none focus:border-accent"
            >
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace("_", " ")}
                </option>
              ))}
            </select>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the document text…"
              rows={6}
              className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
            {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
            <button
              onClick={upload}
              disabled={uploading}
              className="btn-accent w-full"
            >
              {uploading ? "Embedding…" : "Add to knowledge base"}
            </button>
          </div>
        </section>

        {/* Documents */}
        <section className="glass p-5">
          <h2 className="mb-3 text-sm font-semibold tracking-tight">Documents ({documents.length})</h2>
          {documents.length === 0 ? (
            <EmptyState title="No documents yet" hint="Add one on the left to make it searchable by AI." />
          ) : (
            <ul className="space-y-1.5">
              {documents.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  <span className="truncate">
                    <span className="text-fg">{d.title}</span>{" "}
                    <span className="text-xs text-muted">· {d.documentType}</span>
                  </span>
                  <span
                    className={`ml-2 shrink-0 text-xs ${
                      d.status === "embedded"
                        ? "text-teal"
                        : d.status === "failed"
                          ? "text-red-400"
                          : "text-muted"
                    }`}
                  >
                    {d.status === "embedded" ? `${d.chunkCount} chunks` : d.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
