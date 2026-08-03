"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { intentService, type IntentContext } from "@/services/intent-service";
import { AiMessage } from "@/components/assistant/ai-message";
import { fmtRelativeTime } from "@/lib/format";

interface PendingApproval { type: string; leadId: string; to: string; summary: string }
interface Attachment { fileId: string; name: string; documentId?: string }
interface RelatedObject { type: string; id: string; label?: string }
interface Turn { role: "user" | "assistant"; text: string; pendingApprovals?: PendingApproval[]; attachments?: Attachment[]; working?: boolean; status?: string }
interface ConvRef { id: string; title: string; lastMessageAt?: string; messageCount: number; pinned?: boolean }

const OBJECT_HREF: Record<string, (id: string) => string> = {
  company: (id) => `/companies/${id}`,
  person: (id) => `/people/${id}`,
  lead: (id) => `/work/${id}`,
};

const STARTERS = [
  "What should I focus on today?",
  "Create a Legal department",
  "Summarize everything about MoneyPal",
  "Which deals are at risk?",
  "Assign today's qualified leads",
  "Add a lead for Acme Corp",
];

const relTime = (iso?: string) => (iso ? fmtRelativeTime(iso) : "");

export function AssistantConsole({
  initial,
  intent,
  conversations = [],
  current,
}: {
  initial?: string;
  intent?: IntentContext;
  conversations?: ConvRef[];
  current?: {
    id: string;
    title: string;
    messages: { role: "user" | "assistant"; text: string; attachments?: Attachment[] }[];
    relatedObjects?: RelatedObject[];
  };
}) {
  const router = useRouter();
  const [list, setList] = useState<ConvRef[]>(conversations);
  const [q, setQ] = useState("");
  const [convId, setConvId] = useState<string | null>(current?.id ?? null);
  const [turns, setTurns] = useState<Turn[]>(current?.messages ?? []);
  // Seed the "linked" chips from an intent immediately, before the conversation is created.
  const [related] = useState<RelatedObject[]>(
    current?.relatedObjects ?? (intent ? [{ type: intent.objectType, id: intent.objectId, label: intent.objectName }] : []),
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<(Attachment & { uploading?: boolean })[]>([]);
  const [dragging, setDragging] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function ensureConversation(firstMessage: string): Promise<string> {
    if (convId) return convId;
    // When launched from an object (Action Bar / ⌘K intent), scope + title the thread up front.
    const smartTitle = intent ? intentService.title(intent) : undefined;
    const body = intent
      ? {
          firstMessage,
          title: smartTitle,
          intentKey: intent.intent,
          relatedObject: { type: intent.objectType, id: intent.objectId, label: intent.objectName },
        }
      : { firstMessage };
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const b = await res.json();
    const id: string = b.data.id;
    setConvId(id);
    setList((l) => [{ id, title: smartTitle ?? firstMessage.slice(0, 60), messageCount: 0, lastMessageAt: new Date().toISOString() }, ...l]);
    window.history.replaceState(null, "", `/assistant?c=${id}`);
    return id;
  }

  // Upload dropped/selected files → /api/uploads. Each file becomes a pending attachment chip;
  // once stored, it is available for the next message and its content is ingested for RAG.
  async function attachFiles(files: FileList | File[]) {
    const arr = Array.from(files).slice(0, 10);
    for (const file of arr) {
      const placeholder: Attachment & { uploading?: boolean } = { fileId: `tmp-${file.name}-${file.size}`, name: file.name, uploading: true };
      setPending((p) => [...p, placeholder]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "upload failed");
        const u = body.data.files?.[0];
        if (!u?.id) throw new Error("upload failed");
        setPending((p) => p.map((x) => (x.fileId === placeholder.fileId ? { fileId: u.id, name: u.name, documentId: u.documentId } : x)));
      } catch {
        setPending((p) => p.filter((x) => x.fileId !== placeholder.fileId));
      }
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) attachFiles(e.dataTransfer.files);
  }

  async function send(message: string) {
    const m = message.trim();
    const ready = pending.filter((p) => !p.uploading).map(({ fileId, name, documentId }) => ({ fileId, name, documentId }));
    if ((!m && ready.length === 0) || busy) return;
    setInput("");
    setPending([]);
    setTurns((t) => [...t, { role: "user", text: m, attachments: ready.length ? ready : undefined }, { role: "assistant", text: "", working: true }]);
    setBusy(true);
    try {
      const id = await ensureConversation(m || ready[0]?.name || "Attachment");
      const res = await fetch(`/api/conversations/${id}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: m || `Shared ${ready.length} file(s).`, attachments: ready }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as Record<string, string>)?.error ?? "request failed");
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("no response body");
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as { type: string; label?: string; tool?: string; text?: string; pendingApprovals?: PendingApproval[]; message?: string };
            if (evt.type === "status" || evt.type === "tool_start") {
              setTurns((t) => [...t.slice(0, -1), { ...t[t.length - 1], status: evt.label }]);
            } else if (evt.type === "tool_done") {
              setTurns((t) => [...t.slice(0, -1), { ...t[t.length - 1], status: "Thinking…" }]);
            } else if (evt.type === "done") {
              setTurns((t) => [...t.slice(0, -1), { role: "assistant", text: evt.text ?? "", pendingApprovals: evt.pendingApprovals }]);
            } else if (evt.type === "error") {
              setTurns((t) => [...t.slice(0, -1), { role: "assistant", text: `Error: ${evt.message ?? "Unknown error"}` }]);
            }
          } catch { /* malformed SSE line — skip */ }
        }
      }
    } catch (err) {
      setTurns((t) => [...t.slice(0, -1), { role: "assistant", text: `Error: ${(err as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const text = intent?.instruction || initial;
    if (!text || sentInitial.current) return;
    sentInitial.current = true;
    // An instruction ending in ":" is a fill-in-the-blank (Add task:, Create deal:) — prefill the
    // composer and let the user finish it. A complete instruction (Advance stage, Ask AI) auto-sends.
    if (text.trim().endsWith(":")) setInput(text.endsWith(" ") ? text : text + " ");
    else send(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, intent]);

  async function approve(a: PendingApproval) {
    const res = await fetch(`/api/leads/${a.leadId}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: a.to }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      alert(b?.error ?? "Could not advance that lead.");
      return;
    }
    router.refresh();
  }

  function newChat() {
    setConvId(null);
    setTurns([]);
    setInput("");
    window.history.replaceState(null, "", "/assistant");
  }

  async function reloadList(query?: string) {
    const res = await fetch(`/api/conversations${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    const b = await res.json();
    if (res.ok) setList(b.data ?? []);
  }

  // Debounced search over titles, summaries, and message content.
  useEffect(() => {
    const t = setTimeout(() => reloadList(q), 200);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  async function patchConv(id: string, body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/conversations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await reloadList(q);
    return res.ok;
  }
  function pin(id: string, pinned: boolean, e: React.MouseEvent) { e.stopPropagation(); patchConv(id, { pinned: !pinned }); }
  async function archive(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if ((await patchConv(id, { archived: true })) && id === convId) newChat();
  }
  function rename(id: string, curr: string, e: React.MouseEvent) {
    e.stopPropagation();
    const t = typeof window !== "undefined" ? window.prompt("Rename conversation", curr) : null;
    if (t && t.trim()) patchConv(id, { title: t.trim() });
  }

  async function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setList((l) => l.filter((c) => c.id !== id));
    if (id === convId) newChat();
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-5xl gap-4">
      {/* Conversation rail */}
      <aside className="hidden w-64 shrink-0 flex-col md:flex">
        <button onClick={newChat} className="btn-accent mb-2 w-full text-sm">+ New chat</button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search conversations…"
          className="inp mb-2 py-1.5 text-xs"
        />
        <div className="flex-1 space-y-0.5 overflow-y-auto">
          {list.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted">{q ? "No matches." : "No conversations yet."}</p>
          ) : (
            list.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-1 rounded-lg pl-1 pr-1.5 text-sm transition-colors ${
                  c.id === convId ? "bg-brand-soft text-fg" : "text-muted hover:bg-overlay/[0.04] hover:text-fg"
                }`}
              >
                <button
                  type="button"
                  onClick={() => router.push(`/assistant?c=${c.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 py-2 text-left"
                >
                  {c.pinned && <span className="shrink-0 text-[10px] text-accent" aria-hidden>📌</span>}
                  <span className="min-w-0 flex-1 truncate">{c.title || "New conversation"}</span>
                  <span className="shrink-0 text-[10px] text-faint group-hover:hidden group-focus-within:hidden">{relTime(c.lastMessageAt)}</span>
                </button>
                <span className="hidden shrink-0 items-center gap-1.5 group-hover:flex group-focus-within:flex">
                  <button type="button" onClick={(e) => pin(c.id, !!c.pinned, e)} aria-label={c.pinned ? "Unpin conversation" : "Pin conversation"} className="hover:text-accent">📌</button>
                  <button type="button" onClick={(e) => rename(c.id, c.title, e)} aria-label="Rename conversation" className="hover:text-fg">✎</button>
                  <button type="button" onClick={(e) => archive(c.id, e)} aria-label="Archive conversation" className="hover:text-fg">🗄</button>
                  <button type="button" onClick={(e) => remove(c.id, e)} aria-label="Delete conversation" className="hover:text-action">✕</button>
                </span>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        {related.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-faint">Linked</span>
            {related.map((o) => {
              const href = OBJECT_HREF[o.type]?.(o.id);
              const label = o.label || o.id;
              return href ? (
                <button key={`${o.type}-${o.id}`} onClick={() => router.push(href)} className="badge-info hover:opacity-80" title={`Open ${o.type}`}>
                  {o.type === "company" ? "🏢" : o.type === "person" ? "👤" : "💼"} {label} →
                </button>
              ) : (
                <span key={`${o.type}-${o.id}`} className="badge-neutral">{label}</span>
              );
            })}
          </div>
        )}
        <div ref={scroller} className="flex-1 space-y-5 overflow-y-auto pb-4">
          {turns.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand text-2xl text-white shadow-glow animate-pulse-glow">✦</div>
              <h1 className="mt-4 text-xl font-semibold tracking-tight">Your AI <span className="text-gradient">Chief of Staff</span></h1>
              <p className="mt-1 max-w-md text-sm text-muted">
                Tell STOS what you want to happen. It plans, checks permissions, executes, and updates the
                business — with a full audit trail. Conversations are saved.
              </p>
              <div className="mt-5 grid w-full max-w-md grid-cols-2 gap-2">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="glass glass-hover rounded-xl px-3 py-2.5 text-left text-xs text-muted hover:text-fg">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn, i) => (
            <div key={i} className={turn.role === "user" ? "flex justify-end" : ""}>
              {turn.role === "user" ? (
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent/15 px-4 py-2.5 text-sm text-fg">
                  {turn.text && <span className="whitespace-pre-wrap">{turn.text}</span>}
                  {turn.attachments && turn.attachments.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                      {turn.attachments.map((a) => (
                        <a
                          key={a.fileId}
                          href={`/api/uploads/${a.fileId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="badge-neutral hover:opacity-80"
                          title={a.documentId ? "Open file — ingested into Knowledge" : "Open file"}
                        >
                          📎 {a.name}{a.documentId ? " ✓" : ""}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-[90%]">
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted">
                    <span>STOS</span>
                    {turn.working && (
                      <span className="flex items-center gap-1 text-accent" role="status" aria-live="polite">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden /> {turn.status || "working…"}
                      </span>
                    )}
                  </div>
                  {turn.text && <AiMessage content={turn.text} />}
                  {turn.pendingApprovals?.map((a, j) => (
                    <div key={j} className="mt-2 flex items-center justify-between rounded-xl border border-action/30 bg-action/10 px-3 py-2">
                      <span className="text-xs text-fg">Needs your approval: {a.summary}</span>
                      <button onClick={() => approve(a)} className="btn-action px-2.5 py-1 text-xs">Approve</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Return-to-origin — close the loop back to the object the intent came from. */}
        {intent?.returnUrl && !busy && turns.some((t) => t.role === "assistant" && t.text && !t.working) && (
          <div className="mb-2 flex items-center justify-between rounded-xl border border-teal/25 bg-teal/10 px-3.5 py-2.5">
            <span className="text-sm text-fg">✓ Done — this is saved to <b>{intent.objectName}</b>.</span>
            <button onClick={() => router.push(intent.returnUrl!)} className="btn-ghost text-sm">← Back to {intent.objectName}</button>
          </div>
        )}

        <div
          className={`glass p-2 shadow-glow transition-colors ${dragging ? "ring-2 ring-accent/60" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {pending.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1.5 px-1">
              {pending.map((a) => (
                <span key={a.fileId} className="badge-neutral flex items-center gap-1.5">
                  {a.uploading ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> : "📎"}
                  <span className="max-w-[12rem] truncate">{a.name}</span>
                  {!a.uploading && (
                    <button onClick={() => setPending((p) => p.filter((x) => x.fileId !== a.fileId))} title="Remove" className="hover:text-action">✕</button>
                  )}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) attachFiles(e.target.files); e.target.value = ""; }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              title="Attach files"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-overlay/[0.06] hover:text-fg"
            >
              📎
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              placeholder={dragging ? "Drop files to attach…" : "Ask STOS to do anything…"}
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-muted/70"
            />
            <button onClick={() => send(input)} disabled={busy} className="btn-action">{busy ? "…" : "Send"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
