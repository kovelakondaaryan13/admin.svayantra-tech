"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Logo } from "@/components/shell/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { NotificationBell } from "@/components/shell/notification-bell";
import { SystemStatus } from "@/components/shell/system-status";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Founder",
  super_admin: "Super Admin",
  admin: "Admin",
  sales_head: "Sales Head",
  sales_rep: "Sales",
  finance_head: "Finance Head",
  finance_exec: "Finance",
  ops_manager: "Operations",
  hr: "People",
  project_manager: "Projects",
};

export function Sidebar({
  items,
  user,
  workspace = "production",
}: {
  items: NavItem[];
  user: { name?: string; email: string; role: string; isOwner: boolean };
  workspace?: "demo" | "production";
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-overlay/5 bg-overlay/[0.02] px-3 py-5 backdrop-blur-xl md:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <Logo />
        {workspace === "demo" && (
          <span
            title="Demo workspace — synthetic data"
            className="ml-auto rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent"
          >
            Demo
          </span>
        )}
      </div>

      <button
        onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
        className="mb-3 flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted transition-colors hover:border-overlay/20 hover:text-fg"
      >
        <span className="opacity-70">🔍</span>
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px]">⌘K</kbd>
      </button>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-all duration-200 ease-emphasized ${
                active
                  ? "bg-brand-soft text-fg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.18)]"
                  : "text-muted hover:bg-overlay/[0.04] hover:text-fg"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent shadow-glow" />
              )}
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[15px] leading-none transition-all duration-200 ease-emphasized ${
                  active ? "bg-brand text-surface shadow-glow" : "bg-overlay/[0.04] group-hover:bg-overlay/[0.09]"
                }`}
              >
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-1">
        <SystemStatus />
      </div>

      <div className="mt-4 border-t border-overlay/5 pt-4">
        <div className="flex items-center gap-2.5 px-1">
          <Link
            href="/account"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 transition-colors hover:bg-overlay/[0.04]"
            title="Account settings"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-overlay/[0.06] text-xs font-medium">
              {(user.name ?? user.email).slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-fg">{user.name ?? user.email}</div>
              <div className="text-[11px] text-muted">{ROLE_LABEL[user.role] ?? user.role}</div>
            </div>
          </Link>
          <NotificationBell />
          <ThemeToggle />
          <button
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="rounded-lg px-1.5 py-1 text-xs text-muted transition-colors hover:text-fg"
          >
            ⏻
          </button>
        </div>
      </div>
    </aside>
  );
}
