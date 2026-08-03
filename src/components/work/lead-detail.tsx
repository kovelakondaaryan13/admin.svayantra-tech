"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtDate, fmtDateTime } from "@/lib/format";

export interface Intelligence {
  score?: number;
  intentScore?: number;
  health?: "green" | "yellow" | "red";
  probability?: number;
  estimatedCloseAt?: string; // ISO
  nextAction?: string;
  painPoints?: string[];
  competitors?: string[];
  buyingCommittee?: string[];
}

const HEALTH_DOT: Record<string, string> = { green: "bg-teal", yellow: "bg-action", red: "bg-red-400" };

/** AI summary card — shows the cached summary and (re)generates it. */
export function LeadSummaryCard({
  id,
  summary,
  summaryAt,
}: {
  id: string;
  summary?: string;
  summaryAt?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${id}/summary`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? "failed");
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">AI summary</h2>
        <button onClick={generate} disabled={busy} className="btn-ghost text-xs">
          {busy ? "Analyzing…" : summary ? "Regenerate" : "Generate"}
        </button>
      </div>
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      {summary ? (
        <>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{summary}</p>
          {summaryAt && (
            <p className="mt-2 text-xs text-muted">Updated {fmtDateTime(summaryAt)}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">
          No summary yet. STOS will read this deal&apos;s stage history, tasks, meetings, and
          activity to assess health, win probability, and the best next action.
        </p>
      )}
    </section>
  );
}

interface HistoryEntry { ownerName: string; stage: string; at: string }
/** Execution model panel: Individual Funnel vs Conveyor Belt + SLA + ownership history. */
export function LeadExecutionModel({
  id,
  model,
  teamName,
  playbookKey,
  stageDeadline,
  currentOwnerName,
  history,
  teams,
  playbooks,
  canManage,
}: {
  id: string;
  model?: "individual" | "conveyor";
  teamName?: string;
  playbookKey?: string;
  stageDeadline?: string;
  currentOwnerName?: string;
  history: HistoryEntry[];
  teams: { id: string; name: string }[];
  playbooks: { key: string; label: string; model: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [m, setM] = useState<"individual" | "conveyor">(model ?? "individual");
  const [teamId, setTeamId] = useState("");
  const [pb, setPb] = useState(playbookKey ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function apply() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/leads/${id}/model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: m, conveyorTeamId: m === "conveyor" ? teamId || undefined : undefined, playbookKey: pb || undefined }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b?.error ?? "failed");
      setEditing(false);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const relevantPlaybooks = playbooks.filter((p) => p.model === m);
  const overdue = stageDeadline && new Date(stageDeadline).getTime() < Date.now();
  const field = "w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent";

  return (
    <section className="glass space-y-2 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Execution model</h2>
        {canManage && !editing && (
          <button onClick={() => setEditing(true)} className="btn-ghost text-xs">Change</button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs ${model === "conveyor" ? "bg-accent/15 text-accent" : "bg-teal/15 text-teal"}`}>
              {model === "conveyor" ? "Conveyor Belt" : "Individual Funnel"}
            </span>
            {teamName && <span className="text-xs text-muted">Team: {teamName}</span>}
          </div>
          {playbookKey && <p className="text-xs text-muted">Playbook: {playbookKey}</p>}
          {model === "conveyor" && currentOwnerName && (
            <p className="text-xs text-muted">Current stage owner: <span className="text-fg">{currentOwnerName}</span></p>
          )}
          {stageDeadline && (
            <p className="text-xs">
              SLA: <span className={overdue ? "text-action" : "text-muted"}>
                {overdue ? "overdue — " : "by "}{fmtDateTime(stageDeadline)}
              </span>
            </p>
          )}
          {history.length > 0 && (
            <div className="mt-2 border-t border-overlay/5 pt-2">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted">Ownership history</p>
              {history.map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted">
                  <span className="h-1 w-1 rounded-full bg-accent/70" />
                  <span className="text-fg">{h.ownerName}</span> · {h.stage} · {fmtDate(h.at)}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <select value={m} onChange={(e) => setM(e.target.value as "individual" | "conveyor")} className={field}>
            <option value="individual">Individual Funnel</option>
            <option value="conveyor">Conveyor Belt</option>
          </select>
          {m === "conveyor" && (
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={field}>
              <option value="">— select team —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <select value={pb} onChange={(e) => setPb(e.target.value)} className={field}>
            <option value="">— playbook (optional) —</option>
            {relevantPlaybooks.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <div className="flex gap-2">
            <button onClick={apply} disabled={busy} className="btn-accent">{busy ? "Applying…" : "Apply"}</button>
            <button onClick={() => setEditing(false)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Log an outbound touch (call/email/LinkedIn/WhatsApp…) — bumps engagement. */
export function LogTouch({ id }: { id: string }) {
  const router = useRouter();
  const [channel, setChannel] = useState("call");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function log() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${id}/touch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, note: note || undefined }),
      });
      if (res.ok) {
        setNote("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={channel}
        onChange={(e) => setChannel(e.target.value)}
        className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm capitalize outline-none focus:border-accent"
      >
        {["call", "email", "linkedin", "whatsapp", "meeting", "other"].map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && log()}
        placeholder="Optional note…"
        className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
      />
      <button onClick={log} disabled={busy} className="btn-action px-3 py-1.5 text-xs">
        {busy ? "Logging…" : "Log touch"}
      </button>
    </div>
  );
}

/** Editable lead-intelligence sidebar. */
export function LeadIntelligence({ id, initial }: { id: string; initial: Intelligence }) {
  const router = useRouter();
  const [v, setV] = useState<Intelligence>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const csv = (a?: string[]) => (a ?? []).join(", ");
  const toArr = (s: string) =>
    s.split(",").map((x) => x.trim()).filter(Boolean);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      const body: Record<string, unknown> = {
        score: v.score,
        intentScore: v.intentScore,
        health: v.health,
        probability: v.probability,
        nextAction: v.nextAction || undefined,
        painPoints: v.painPoints,
        competitors: v.competitors,
        buyingCommittee: v.buyingCommittee,
      };
      if (v.estimatedCloseAt) body.estimatedCloseAt = new Date(v.estimatedCloseAt).toISOString();
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent";
  const label = "text-xs text-muted";

  return (
    <section className="glass space-y-3 p-5">
      <h2 className="text-sm font-semibold tracking-tight">Intelligence</h2>

      <div className="grid grid-cols-3 gap-3">
        <label className="space-y-1">
          <span className={label}>ICP fit</span>
          <input type="number" min={0} max={100} value={v.score ?? ""}
            onChange={(e) => setV({ ...v, score: e.target.value ? Number(e.target.value) : undefined })}
            className={field} />
        </label>
        <label className="space-y-1">
          <span className={label}>Intent</span>
          <input type="number" min={0} max={100} value={v.intentScore ?? ""}
            onChange={(e) => setV({ ...v, intentScore: e.target.value ? Number(e.target.value) : undefined })}
            className={field} />
        </label>
        <label className="space-y-1">
          <span className={label}>Win %</span>
          <input type="number" min={0} max={100} value={v.probability ?? ""}
            onChange={(e) => setV({ ...v, probability: e.target.value ? Number(e.target.value) : undefined })}
            className={field} />
        </label>
      </div>

      <label className="space-y-1 block">
        <span className={label}>Health</span>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${HEALTH_DOT[v.health ?? "yellow"]}`} />
          <select value={v.health ?? ""} onChange={(e) => setV({ ...v, health: (e.target.value || undefined) as Intelligence["health"] })} className={field}>
            <option value="">—</option>
            <option value="green">On track</option>
            <option value="yellow">At risk</option>
            <option value="red">Stalled</option>
          </select>
        </div>
      </label>

      <label className="space-y-1 block">
        <span className={label}>Estimated close</span>
        <input type="date" value={v.estimatedCloseAt ? v.estimatedCloseAt.slice(0, 10) : ""}
          onChange={(e) => setV({ ...v, estimatedCloseAt: e.target.value || undefined })}
          className={field} />
      </label>

      <label className="space-y-1 block">
        <span className={label}>Next action</span>
        <input value={v.nextAction ?? ""} onChange={(e) => setV({ ...v, nextAction: e.target.value })}
          placeholder="e.g. Send revised quote" className={field} />
      </label>

      <label className="space-y-1 block">
        <span className={label}>Pain points (comma-separated)</span>
        <input value={csv(v.painPoints)} onChange={(e) => setV({ ...v, painPoints: toArr(e.target.value) })} className={field} />
      </label>

      <label className="space-y-1 block">
        <span className={label}>Competitors</span>
        <input value={csv(v.competitors)} onChange={(e) => setV({ ...v, competitors: toArr(e.target.value) })} className={field} />
      </label>

      <label className="space-y-1 block">
        <span className={label}>Buying committee</span>
        <input value={csv(v.buyingCommittee)} onChange={(e) => setV({ ...v, buyingCommittee: toArr(e.target.value) })} className={field} />
      </label>

      <div className="flex items-center gap-2 pt-1">
        <button onClick={save} disabled={busy} className="btn-accent">
          {busy ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-xs text-teal">Saved</span>}
      </div>
    </section>
  );
}
