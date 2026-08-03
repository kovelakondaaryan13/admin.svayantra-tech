"use client";
import { Logo } from "@/components/shell/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { NotificationBell } from "@/components/shell/notification-bell";

/**
 * Mobile/tablet top bar (hidden ≥ md). The desktop sidebar is hidden on small screens; navigation
 * on mobile is the ⌘K palette (the primary interaction layer) opened via the Search button.
 */
export function MobileTopBar({ workspace }: { workspace?: "demo" | "production" }) {
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-2 border-b border-border bg-surface/85 px-4 py-2.5 backdrop-blur-xl md:hidden">
      <Logo size="sm" />
      {workspace === "demo" && <span className="badge badge-brand">Demo</span>}
      <button
        onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
        aria-label="Open command palette"
        className="btn-ghost ml-auto flex items-center gap-2 text-xs"
      >
        <span aria-hidden>🔍</span> Search
      </button>
      <NotificationBell />
      <ThemeToggle />
    </div>
  );
}
