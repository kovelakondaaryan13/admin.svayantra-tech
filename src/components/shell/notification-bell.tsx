"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtRelativeTime } from "@/lib/format";
import { Modal } from "@/components/ds";

interface Notification {
  id: string;
  type: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  approval: "🔔",
  assignment: "📌",
  mention: "💬",
  ai: "✦",
  alert: "⚠️",
  meeting: "📅",
  system: "🔧",
};

const relTime = (iso: string) => fmtRelativeTime(iso, { granularity: "minute" });

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const b = await res.json();
      if (res.ok) setItems(b.data ?? []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  function handleClick(n: Notification) {
    if (!n.read) markRead(n.id);
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        title="Notifications"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        className="relative rounded-lg px-1.5 py-1 text-sm text-muted transition-colors hover:text-fg"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-action px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="flex items-center justify-between border-b border-overlay/5 px-4 py-3">
            <h3 className="text-sm font-semibold text-fg">Notifications</h3>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <button
                  onClick={async () => {
                    await Promise.all(items.filter((n) => !n.read).map((n) => markRead(n.id)));
                  }}
                  className="text-[11px] text-accent hover:underline"
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-fg">
                ✕
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">No notifications yet.</p>
            ) : (
              items.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-overlay/[0.04] ${
                    n.read ? "opacity-60" : ""
                  }`}
                >
                  <span className="mt-0.5 shrink-0 text-sm">{TYPE_ICON[n.type] ?? "🔔"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-fg">{n.message}</p>
                    <span className="t-micro">{relTime(n.createdAt)}</span>
                  </div>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                </button>
              ))
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
