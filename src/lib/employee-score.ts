/**
 * Single comparable 0-100 performance/workload score per employee, replacing raw
 * fraction displays ("4/8", "2/8") that don't compare across people with different
 * capacities. Every input signal is normalized to 0-100 first, then weighted-averaged.
 * Different surfaces have different data on hand (the command center has full org
 * leads/meetings; the tasks workload view only has tasks+capacity) — `composeScore`
 * renormalizes over whichever signals are actually supplied, so every caller produces
 * the same *kind* of number from the same formula, not a bespoke fraction each.
 */

export interface ScoreSignal {
  key: string;
  label: string;
  value: number | null; // 0-100, or null if this signal isn't available/applicable
  weight: number;
}

export interface EmployeeScore {
  overall: number; // 0-100
  signals: { label: string; value: number }[]; // present signals only, for a detail tooltip
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Weighted average over whichever signals have a non-null value. */
export function composeScore(signals: ScoreSignal[]): EmployeeScore {
  const present = signals.filter((s): s is ScoreSignal & { value: number } => s.value !== null);
  const totalWeight = present.reduce((sum, s) => sum + s.weight, 0);
  const overall = totalWeight > 0
    ? clamp(present.reduce((sum, s) => sum + s.value * s.weight, 0) / totalWeight)
    : 0;
  return { overall, signals: present.map((s) => ({ label: s.label, value: clamp(s.value) })) };
}

/** Org-wide median task capacity, used as the fallback denominator for anyone without their own
 *  capacity set. Defaults to 5 when no employee has a capacity on record. */
export function orgMedianCapacity(capacities: number[]): number {
  return capacities.length > 0 ? [...capacities].sort((a, b) => a - b)[Math.floor(capacities.length / 2)] : 5;
}

/** How "ideally" utilized someone is — peaks at ~80% of capacity, falls off toward idle or overloaded. */
export function workloadIdealnessSignal(openCount: number, capacity: number | undefined, orgMedianCapacity: number): number {
  const cap = capacity && capacity > 0 ? capacity : (orgMedianCapacity || 1);
  const ratio = openCount / cap;
  return clamp(100 - Math.abs(ratio - 0.8) * 125);
}

/** Raw utilization, 0-100+ (can exceed 100 when overloaded) — capped for display purposes. */
export function workloadPctSignal(openCount: number, capacity: number | undefined, orgMedianCapacity: number): number {
  const cap = capacity && capacity > 0 ? capacity : (orgMedianCapacity || 1);
  return clamp((openCount / cap) * 100);
}

/** Remaining headroom before overloaded. */
export function capacityHeadroomSignal(openCount: number, capacity: number | undefined, orgMedianCapacity: number): number {
  return clamp(100 - workloadPctSignal(openCount, capacity, orgMedianCapacity));
}

/** Share of this person's work that's done vs. still open. Neutral (100) with no history yet. */
export function taskCompletionSignal(doneCount: number, openCount: number): number {
  const total = doneCount + openCount;
  return total > 0 ? clamp((doneCount / total) * 100) : 100;
}

/** How many of their open items are overdue — inverted so higher is better. Neutral (100) if none open. */
export function reliabilitySignal(openCount: number, overdueCount: number): number {
  return openCount > 0 ? clamp(100 - (overdueCount / openCount) * 100) : 100;
}

/** Normalize a raw value against the org max for the same signal (e.g. pipeline owned, meetings held). */
export function normalizedAgainstMax(value: number, orgMax: number): number | null {
  return orgMax > 0 ? clamp((value / orgMax) * 100) : null;
}
