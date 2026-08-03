/**
 * STOS Design System v2 — page templates. Pages compose these instead of bespoke layouts.
 * Reuse-first: these are thin compositions of PageHeader + Section — no new visual patterns.
 * See STOS_DESIGN_SYSTEM.md §3.
 */
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ds/layout";

/** Collection page: header + optional tabs + toolbar (search/filters/views) + body. */
export function CollectionPage({
  title,
  subtitle,
  eyebrow,
  actions,
  tabs,
  toolbar,
  children,
  max = "max-w-6xl",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  max?: string;
}) {
  return (
    <div className={`mx-auto ${max} space-y-5`}>
      <PageHeader title={title} subtitle={subtitle} eyebrow={eyebrow} actions={actions} />
      {tabs}
      {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      {children}
    </div>
  );
}

/** Workspace/Admin/Settings page: header + zones (Sections). AdminPage/SettingsPage are this. */
export function WorkspacePage({
  title,
  subtitle,
  eyebrow,
  actions,
  hero = false,
  children,
  max = "max-w-5xl",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  hero?: boolean;
  children: ReactNode;
  max?: string;
}) {
  return (
    <div className={`mx-auto ${max} space-y-6`}>
      <PageHeader title={title} subtitle={subtitle} eyebrow={eyebrow} actions={actions} hero={hero} />
      {children}
    </div>
  );
}
