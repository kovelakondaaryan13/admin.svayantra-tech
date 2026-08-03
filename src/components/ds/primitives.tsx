/**
 * STOS Design System v2 — atoms.
 * Badge (one status system) + Avatar (initials → photo). Token-only, presentational.
 * See STOS_DESIGN_SYSTEM.md §2.8.
 */
import type { ReactNode } from "react";

export type BadgeVariant = "brand" | "success" | "warning" | "danger" | "info" | "neutral";

export function Badge({ variant = "neutral", children }: { variant?: BadgeVariant; children: ReactNode }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

/** Lead-stage → Badge variant, shared by every page that renders a stage pill. */
export const STAGE_BADGE: Record<string, BadgeVariant> = { won: "success", lost: "danger", negotiation: "warning", proposal: "info" };

const AVATAR_SIZE = { sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-sm" };

export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string;
  size?: keyof typeof AVATAR_SIZE;
}) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className={`${AVATAR_SIZE[size]} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span
      className={`${AVATAR_SIZE[size]} grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent/30 to-violet/30 font-semibold text-fg`}
      aria-hidden
    >
      {initials}
    </span>
  );
}
