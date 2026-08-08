/**
 * Deterministic, locale-INDEPENDENT date formatting. Client components must use these instead of
 * `toLocale*` — Node (server) and the browser format locales differently (e.g. "PM" vs "pm"),
 * which breaks React hydration. These produce identical output on server and client.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "YYYY-MM" (e.g. metrics bucket keys) → 3-letter month abbreviation, e.g. "2026-08" → "Aug". */
export function monthLabel(yyyyMm: string): string {
  const [, mo] = yyyyMm.split("-");
  return MONTHS[Number(mo) - 1] ?? yyyyMm;
}

export function fmtDate(input: Date | string | number): string {
  const d = new Date(input);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtClock(input: Date | string | number): string {
  const d = new Date(input);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h < 12 ? "AM" : "PM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

export function fmtDateTime(input: Date | string | number): string {
  return `${fmtDate(input)}, ${fmtClock(input)}`;
}

/** "Now"/"1h"/"3d" style relative time. `granularity` controls the finest unit shown. */
export function fmtRelativeTime(
  input: Date | string | number,
  opts: { suffix?: string; granularity?: "minute" | "hour" | "day"; zeroLabel?: string } = {},
): string {
  const { suffix = "", granularity = "hour", zeroLabel = "now" } = opts;
  const ms = Date.now() - new Date(input).getTime();
  const days = Math.floor(ms / 86400000);

  if (granularity === "minute") {
    const m = Math.floor(ms / 60000);
    if (m < 1) return zeroLabel;
    if (m < 60) return `${m}m${suffix}`;
    const h = Math.floor(m / 60);
    return h < 24 ? `${h}h${suffix}` : `${Math.floor(h / 24)}d${suffix}`;
  }
  if (granularity === "day") {
    return days >= 1 ? `${days}d${suffix}` : zeroLabel;
  }
  if (days >= 1) return `${days}d${suffix}`;
  const h = Math.floor(ms / 3600000);
  return h >= 1 ? `${h}h${suffix}` : zeroLabel;
}

/** Deal-value display: minor units (paise) → ₹L / ₹Cr, the sales/CRM convention. */
export function fmtLakhCr(minor: number): string {
  const l = minor / 1e7;
  return l >= 100 ? `₹${(l / 100).toFixed(2)}Cr` : `₹${l.toFixed(1)}L`;
}

/** Whole-rupee display: minor units (paise) → ₹ with thousands separators. */
export function fmtINR(minor: number): string {
  return "₹" + (minor / 100).toLocaleString("en-IN");
}
