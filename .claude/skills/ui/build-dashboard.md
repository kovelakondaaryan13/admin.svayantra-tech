# Skill — Build a Dashboard

## Purpose
Build a fast, legible dashboard (Executive / Sales / Manager views) that answers a question at
a glance — "pipeline health", "why are deals slowing down?" — without becoming three codebases.

## When to use
Any analytics/overview screen. **Prefer one composable, role-scoped dashboard** over separate
Exec/Sales/Manager implementations (see the `DECISIONS.md` open item).

## Best practices
- **One dashboard, role-scoped widgets.** Compose from a widget registry; show/hide by role +
  permission. Don't fork three code paths.
- **Answer a question per widget.** Each tile has a clear job (win rate, cycle time, stalled
  deals). Cut vanity metrics.
- **Aggregate server-side** with indexed Mongo aggregations; don't ship raw rows to the client
  to compute in the browser. Cache expensive aggregates.
- **Follow the dataviz skill** for chart/color/layout choices (read it before writing chart
  code). Handle empty/loading/error per tile.
- **Drill-down over density:** a clean summary that links to detail beats a wall of numbers.
- **Time-in-stage / pipeline analytics** come from `stageHistory` (see workflow pattern).

## Common mistakes
- Three separate dashboards diverging over time.
- Computing aggregates client-side from big payloads.
- Un-indexed aggregation pipelines (slow at scale).
- Vanity metrics that don't drive a decision.

## Code conventions
- `components/dashboard/widgets/*`, a `widgetRegistry` mapping widget → required permission.
- Aggregations in `services/analytics-service.ts`; cached where costly.

## Example
```ts
// role-scoped composition
const widgets = widgetRegistry.filter(w => can(user, w.permission));
// each widget fetches its own pre-aggregated data server-side
```

## Checklist
- [ ] Single dashboard, role/permission-scoped widgets (not 3 code paths)
- [ ] Each widget answers one decision-driving question
- [ ] Server-side indexed aggregation; expensive results cached
- [ ] Followed the `dataviz` skill for charts/colors/layout
- [ ] Per-tile empty/loading/error states
- [ ] Drill-down links to detail
