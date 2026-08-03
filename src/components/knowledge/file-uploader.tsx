"use client";
import { useCallback, useEffect, useState } from "react";

interface Up {
  id: string;
  name: string;
  status: string;
  errorReason?: string;
  chunkCount?: number;
  version: number;
  extractedChars?: number;
}

const PROCESSING = ["stored", "extracting", "extracted", "chunking", "embedding", "indexing"];
function statusClass(s: string) {
  if (s === "ready") return "badge-success";
  if (s === "failed") return "badge-danger";
  return "badge-info";
}

export function FileUploader({
  related,
  canWrite = false,
  canDelete = false,
}: {
  related?: { type: string; id: string };
  canWrite?: boolean;
  canDelete?: boolean;
}) {
  const [ups, setUps] = useState<Up[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const qs = related ? `?relatedType=${related.type}&relatedId=${encodeURIComponent(related.id)}` : "";
    const r = await fetch(`/api/uploads${qs}`);
    const b = await r.json();
    if (r.ok) setUps(b.data ?? []);
  }, [related]);

  useEffect(() => { load(); }, [load]);

  // Poll while anything is still ingesting so status advances live.
  useEffect(() => {
    if (!ups.some((u) => PROCESSING.includes(u.status))) return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [ups, load]);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("file", f);
    if (related) fd.append("related", JSON.stringify([related]));
    try {
      await fetch("/api/uploads", { method: "POST", body: fd });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function reprocess(id: string) {
    const r = await fetch(`/api/uploads/${id}/reprocess`, { method: "POST" });
    if (r.ok) load();
  }
  async function remove(id: string) {
    const r = await fetch(`/api/uploads/${id}`, { method: "DELETE" });
    if (r.ok) setUps((u) => u.filter((x) => x.id !== id));
  }

  return (
    <section className="glass p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="t-section">{related ? "Files & documents" : "Upload documents"}</h2>
        {canWrite && (
          <label className="btn-accent cursor-pointer text-sm">
            {busy ? "Uploading…" : "+ Upload files"}
            <input type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
          </label>
        )}
      </div>
      <p className="t-meta mb-3">
        PDF, DOCX, XLSX, CSV, TXT, MD — stored in MongoDB, then extracted → embedded → searchable. Ingestion runs in the background.
      </p>
      {ups.length === 0 ? (
        <p className="text-sm text-muted">No uploads yet.</p>
      ) : (
        <div className="space-y-1">
          {ups.map((u) => (
            <div key={u.id} className="group flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-overlay/[0.03]">
              <span className="flex min-w-0 items-center gap-2">
                <span>📄</span>
                <a href={`/api/uploads/${u.id}`} target="_blank" rel="noreferrer" className="truncate text-sm text-fg hover:text-accent">{u.name}</a>
                {u.version > 1 && <span className="t-micro">v{u.version}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {u.status === "ready" && u.chunkCount ? <span className="t-micro">{u.chunkCount} chunks</span> : null}
                <span className={`badge ${statusClass(u.status)}`} title={u.errorReason ?? ""}>{u.status}</span>
                {u.status === "failed" && canWrite && <button onClick={() => reprocess(u.id)} className="t-micro hover:text-accent">retry</button>}
                {canDelete && (
                  <button onClick={() => remove(u.id)} className="t-micro opacity-0 transition-opacity hover:text-action group-hover:opacity-100">✕</button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
