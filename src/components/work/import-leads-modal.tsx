"use client";
import { useState } from "react";
import { Modal } from "@/components/ds";
import type { Lead } from "@/components/work/leads-grid";

interface Mapping {
  name: string | null;
  email: string | null;
  company: string | null;
  value: string | null;
  source: string | null;
  notes: string | null;
  currency: "INR" | "USD";
  valueUnit: "whole" | "minor";
}

interface Preview {
  headers: string[];
  rows: Record<string, string>[];
  mapping: Mapping;
  rowCount: number;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; reason: string }[];
  leads: Lead[];
}

const FIELDS: { key: keyof Pick<Mapping, "name" | "email" | "company" | "value" | "source" | "notes">; label: string; required?: boolean }[] = [
  { key: "name", label: "Name", required: true },
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "value", label: "Deal value" },
  { key: "source", label: "Source" },
  { key: "notes", label: "Notes" },
];

/** Upload a CSV/XLSX file → AI detects which column is name/email/company/value/etc. →
 *  rep confirms (or fixes) the mapping → bulk-create leads. See src/app/api/leads/import/*. */
export function ImportLeadsModal({ onClose, onImported }: { onClose: () => void; onImported: (leads: Lead[]) => void }) {
  const [step, setStep] = useState<"pick" | "analyzing" | "preview" | "importing" | "done">("pick");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setStep("analyzing");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/leads/import", { method: "POST", body: fd });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(b?.error ?? "Could not read that file.");
        setStep("pick");
        return;
      }
      setPreview(b.data);
      setMapping(b.data.mapping);
      setStep("preview");
    } catch {
      setError("Could not read that file.");
      setStep("pick");
    }
  }

  async function doImport() {
    if (!preview || !mapping) return;
    setError(null);
    setStep("importing");
    try {
      const res = await fetch("/api/leads/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.rows, mapping }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(b?.error ?? "Import failed.");
        setStep("preview");
        return;
      }
      const data = b.data as ImportResult;
      setResult(data);
      if (data.leads.length > 0) onImported(data.leads);
      setStep("done");
    } catch {
      setError("Import failed.");
      setStep("preview");
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg">
      <div className="flex items-center justify-between border-b border-overlay/5 px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">Import leads from CSV/Excel</h3>
        <button onClick={onClose} aria-label="Close" className="text-muted hover:text-fg">✕</button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto p-4">
        {error && <p className="mb-3 text-xs text-action">{error}</p>}

        {step === "pick" && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Upload a CSV or Excel file with your leads. STOS will automatically detect which
              column is the name, email, company, deal value, and source — no manual mapping needed.
            </p>
            <label className="btn-accent inline-flex cursor-pointer items-center text-sm">
              Choose file…
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        )}

        {step === "analyzing" && (
          <p className="py-8 text-center text-sm text-muted">Reading file and detecting columns…</p>
        )}

        {step === "preview" && preview && mapping && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Found <span className="font-medium text-fg">{preview.rowCount}</span> row{preview.rowCount === 1 ? "" : "s"}.
              Confirm the detected columns below (or fix any STOS got wrong).
            </p>
            <div className="space-y-2">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">
                    {f.label}{f.required ? " *" : ""}
                  </span>
                  <select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setMapping((m) => (m ? { ...m, [f.key]: e.target.value || null } : m))}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                  >
                    <option value="">— none —</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
              {mapping.value && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">Currency</span>
                  <select
                    value={mapping.currency}
                    onChange={(e) => setMapping((m) => (m ? { ...m, currency: e.target.value as Mapping["currency"] } : m))}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                  >
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-overlay/5 pt-3">
              <button onClick={onClose} className="btn-ghost text-xs">Cancel</button>
              <button
                onClick={doImport}
                disabled={!mapping.name}
                className="btn-accent text-xs disabled:opacity-50"
              >
                Import {preview.rowCount} lead{preview.rowCount === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <p className="py-8 text-center text-sm text-muted">Creating leads…</p>
        )}

        {step === "done" && result && (
          <div className="space-y-3">
            <p className="text-sm text-fg">
              Imported <span className="font-medium text-teal">{result.created}</span> lead{result.created === 1 ? "" : "s"}.
              {result.skipped > 0 && <> Skipped <span className="font-medium text-action">{result.skipped}</span>.</>}
            </p>
            {result.errors.length > 0 && (
              <div className="rounded-lg border border-border bg-overlay/[0.02] p-2 text-xs text-muted">
                {result.errors.map((e) => (
                  <div key={e.row}>Row {e.row}: {e.reason}</div>
                ))}
              </div>
            )}
            <div className="flex justify-end border-t border-overlay/5 pt-3">
              <button onClick={onClose} className="btn-accent text-xs">Done</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
