/**
 * STOS Design System v2 — layout primitives: PageHeader (signature page top) + Section (zone).
 * These give every page the same recognizable structure. Token-only, presentational.
 * See STOS_DESIGN_SYSTEM.md §2.1–2.2, §3–4.
 */
import type { ReactNode } from "react";

/** The signature top of every page. `hero` = larger + gradient accent (Home / Command). */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  hero = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  hero?: boolean;
}) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{eyebrow}</div>}
        <h1 className={hero ? "text-3xl font-semibold tracking-tight" : "t-display"}>{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A labeled workspace zone. Compose pages from Sections — not raw glass divs. */
export function Section({
  title,
  action,
  variant = "default",
  className = "",
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  variant?: "default" | "plain" | "ai";
  className?: string;
  children: ReactNode;
}) {
  const shell =
    variant === "ai" ? "ai-surface p-5" : variant === "plain" ? "" : "glass p-5";
  return (
    <section className={`${shell} ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="t-section">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
