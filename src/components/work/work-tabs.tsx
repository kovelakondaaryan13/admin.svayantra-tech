"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/work", label: "Leads" },
  { href: "/work/tasks", label: "Tasks" },
];

export function WorkTabs({ showConveyor = false }: { showConveyor?: boolean }) {
  const pathname = usePathname();
  const tabs = showConveyor ? [...TABS, { href: "/work/conveyor", label: "Conveyor" }] : TABS;
  return (
    <div className="flex items-center gap-1 border-b border-overlay/5">
      {tabs.map((t) => {
        const active = t.href === "/work" ? pathname === "/work" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              active
                ? "border-accent text-fg"
                : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
