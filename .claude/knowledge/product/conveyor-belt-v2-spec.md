# Conveyor Belt System v2 — Sales Operations Spec

**Status:** Proposed. Nothing in this document is built yet except where marked `[BUILT TODAY]`.
**Origin:** founder notes, structured 2026-08-05. Source of truth for what to build next in Sales Ops.

---

## 0. What exists today vs. what this spec adds

`[BUILT TODAY]`, verified against the current codebase:
- A `Lead.executionModel` toggle: `"individual"` (one owner, full cycle) or `"conveyor"` (team-shared, SLA-timed stages).
- A `Playbook` (stages + per-stage SLA hours) and a `ConveyorTeam` (member list, one playbook).
- Assigning a lead to a conveyor team stamps an SLA deadline and records a handoff in `ownerHistory`.
- Conveyor analytics: SLA compliance %, average handoff time, average cycle time, bottleneck-stage detection (`conveyor-metrics-service.ts`), shown on `/work/conveyor`.
- Team permissions: `Deblina` and `Saicharan` are now `sales_head` + a `workflows.manage` grant, so they can create conveyor teams, move stages, assign members, and create/edit playbooks. `Kanishka` already has full owner access.
- **New today:** a lead's Context tab shows **Contributors** — every employee who has actually touched the deal (owner, past owners, everyone who advanced a stage, everyone with a task on it), not just whoever currently owns it, with human vs. AI-driven actions shown separately.

What this spec proposes adding, none of it built yet:
1. A **dynamic per-conveyor-team configuration** so "individual" isn't just a global toggle but something a team's playbook can express per-stage (see §2).
2. A distinct **top-of-funnel pipeline** before a lead is "conveyor-ready" (see §3), so leads can't silently disappear before they're properly in the system.
3. **Per-stage ownership metadata**: backup owner, checklist, exit criteria, AI prompt (see §5) — today a playbook stage only has a label + SLA hours.
4. **Fully automatic handoff** — today, moving into conveyor mode stamps an SLA deadline once; it does not auto-create the next stage's task, notify the new owner, or archive the old one on every stage change (see §6).
5. A **visual conveyor dashboard** (bottleneck bars) and a **personal handoff queue** (incoming/outgoing, color-coded SLA timers) — today's `/work/conveyor` is metrics-only, not a working queue UI (see §7–8).
6. A **drag-and-drop Kanban view** per conveyor team (see §11).
7. An **AI Supervisor** — proactive, not just reactive: watches bottlenecks and workload imbalance and *tells* a manager what to do, unprompted (see §12).
8. **Docs/SOPs attached per conveyor team or per playbook stage** (see §13).
9. Moving this whole area out from under Administration into its own top-level **Sales Operations** workspace (see §14).

---

## 1. Framing

This is not "another CRM view." It's a workflow engine that sits on top of Work — the same leads, the same stage machine, but with **ownership that moves automatically** instead of staying fixed to one person.

## 2. Execution models — and making the choice dynamic

**Individual Funnel.** One person owns a lead end to end — sourcing through close. Nobody else touches it unless the owner is explicitly changed. This is the simple, default case, and it's fully built today.

**Conveyor Belt.** Ownership changes automatically as the lead moves through stages. Example flow:

```
Lead → Research → Outbound → Qualification → Meeting → Discovery → Proposal → Negotiation → Close
```

Each stage belongs to a specific person by default (example roster mapping — illustrative, not fixed):

| Stage | Owner |
|---|---|
| Research | Suraj |
| Qualification | Deblina |
| Discovery | Gaurav |
| Proposal | Varshik |
| Closing | Kanishka |

**Making this dynamic (the ask):** rather than a single global `individual`/`conveyor` switch on a lead, the *team* a lead belongs to should be able to define, per stage, whether that stage is single-owner or shared/pooled — so a conveyor team can have some stages that behave like a mini individual-funnel (e.g., "Closing" always goes to one senior closer) and others that rotate. Concretely: extend `PlaybookStage` with an optional `ownerMode: "fixed" | "pooled"` and a `defaultOwnerRole`/`defaultOwnerUserId`; a "fixed" stage always hands off to the same person; a "pooled" stage hands off to whoever on the team has the most SLA headroom (see §6). This keeps "individual" and "conveyor" as ends of the same spectrum instead of two disconnected systems.

## 3. Top-of-funnel pipeline — so leads don't leak before they're "in the system"

The concern raised: someone like **Mohan** works pure top-of-funnel — sourcing and first-touch — and if that work isn't itself modeled as a tracked pipeline, leads can silently die before they ever reach the conveyor belt at all (no record, no SLA, no accountability).

Proposed stages, distinct from (and feeding into) the existing `LEAD_STAGES` pipeline:

```
Scraped/Sourced → ICP-qualified (hyper-qualified against fit criteria)
  → Enrichment (contact/company data completed)
  → Engagement (outbound touches — cold LinkedIn/email/etc.)
  → Meeting booked
  → Meeting held
  → Proposal / Closing (existing pipeline takes over from here)
```

**Design decision needed:** should this be (a) new `LeadStage` values prepended to the existing 7-stage enum (simplest, but changes the meaning of "new" everywhere that reads `LEAD_STAGES`), or (b) a separate `sourcingStatus` field that exists *before* a lead formally becomes a `Lead` document at all (e.g., a lightweight `SourcedLead` collection that only gets promoted into the real `Lead` pipeline once it clears ICP-qualification) — closer to "leads don't leak" in spirit, since a half-qualified scrape isn't cluttering the real pipeline, but every scrape is still tracked so nothing vanishes without a record. Recommend (b): it keeps the existing conveyor-belt engine untouched and gives top-of-funnel its own SLA/ownership model (e.g., Mohan owns "Enrichment," someone else owns "Engagement") without overloading `LeadStage`.

## 4. Conveyor Team structure

Proposed nav grouping under Sales:
```
Sales
├── Individual Funnels
├── Conveyor Teams
    └── e.g. "Outbound Team Alpha" — members: Deblina, Gaurav, Varshik, Suraj, Kanishka
        ├── Current SLA
        ├── Pipeline
        ├── Members
        ├── Stages
        ├── KPIs
        └── Throughput
```

`[BUILT TODAY, partially]`: `ConveyorTeam` already has `name` + `memberUserIds` + one `playbookKey`; a team detail view with all of the above tabs does not exist yet as a single page — team info is currently spread across the admin sales-models page and the conveyor dashboard.

## 5. Stage ownership metadata

Every stage should carry, beyond today's `label` + `slaHours`:

| Field | Example (Qualification) |
|---|---|
| Owner | Deblina |
| Backup owner | Gaurav |
| SLA | 24 hours |
| Checklist | Company verified · Budget known · ICP score set · Contact found |
| Exit criteria | Meeting booked |
| AI prompt | (a stage-specific instruction telling the AI what "good" looks like at this stage, used both for AI Supervisor nudges and for auto-drafted stage summaries) |

`PlaybookStage` already has `ownerRole?`, `entryCriteria?`, `exitCriteria?`, `aiPrompt?`, `artifacts?[]` declared in the type — **these fields exist in the schema today but are never read by any code.** This is the fastest win in the whole spec: wiring up fields that are already there, rather than a schema migration.

## 6. Automatic handoff

Today, moving a lead into conveyor mode stamps one SLA deadline at assignment time; advancing a stage re-stamps the deadline but does **not** create a task, notify anyone, or reassign ownership beyond an audit-trail entry. The proposed flow:

```
Meeting booked (exit criteria met)
  → Lead automatically advances to Discovery
  → Assigned to that stage's owner (Gaurav, or the least-loaded pooled-mode teammate)
  → A task is created for them
  → They're notified
  → Previous owner is marked "archived" for this stage (kept in Contributors — see §0 New today)
  → Activity timeline updated
  → AI brief generated summarizing what's known so far
```

Nobody clicks "Assign." This is a real, buildable feature on top of the existing `taskService`/`notificationService`/`activityService` — the missing piece is a hook that fires exactly when a lead's stage advances *and* `executionModel === "conveyor"`.

## 7. Conveyor Dashboard (visual bottleneck view)

For managers (Deblina, Kanishka, Saicharan): a horizontal bar per stage showing how many leads are sitting there right now, so a bottleneck (e.g., Qualification piling up) is visually obvious without reading a table. `conveyor-metrics-service.ts` already computes `bottleneckStage` — this is a visualization gap, not a data gap.

## 8. Handoff Queue + SLA timers

Every employee gets a personal queue:
- **Incoming** — "4 deals waiting" (stages just handed to them).
- **Outgoing** — deals they've completed their part of, waiting on the next owner to pick up.
- **SLA timer per card**, color-coded: blue (plenty of time), amber (getting close), red (overdue) — e.g. "8h remaining," "3h overdue," "1d overdue."

## 9. Performance metrics beyond "meetings held / revenue"

Average handoff time, average qualification time, acceptance rate, SLA compliance, touches, conversion — `conveyor-metrics-service.ts` already computes most of these org/team-wide; per-person breakdowns are the gap.

## 10. Team permissions — implemented today

| Role | Can |
|---|---|
| Owner (Aryan, Kanishka) | Everything |
| Sales Head (Deblina, Saicharan) | Manage conveyor teams, move stages, assign members, create/edit playbooks, view metrics |
| Everyone else | Only their own stages/leads |

This matches exactly what's described above and is live as of this spec being written — see §0.

## 11. Conveyor (Kanban) View

A per-team board, one column per stage, leads as cards:
```
Research ── Lead A, Lead B, Lead C
Qualification ── Lead D, Lead E
Discovery ── Lead F, Lead G
```
Dragging a card to another column should trigger the exact same automatic-handoff chain as §6 (owner change, task, notification, timeline, AI summary) — drag-and-drop is just an alternate trigger for `leadService.advance`, not a separate code path.

## 12. AI Supervisor — the actual differentiator

Today's AI reads pipeline data when asked. The proposed AI Supervisor *watches continuously* and proactively surfaces things like:

> "Qualification has become today's bottleneck. Move Gaurav from Discovery to Qualification for the next 6 hours."

> "Suraj has 23 pending outbound leads while Deblina has only 5. Rebalance the queue?"

> "Discovery conversion dropped from 62% to 38% over the last 10 days. Review call recordings."

This is a different *kind* of AI feature than anything currently built — today's AI tools all execute a specific request; this would need a scheduled/background job (not a chat turn) that periodically runs `conveyor-metrics-service.summary()`-style aggregation, compares against thresholds/trends, and pushes a notification or a Command Center card. This is the single largest net-new piece of infrastructure in this whole spec (it's a background job system, which doesn't exist in any form today) and should be scoped as its own project, not a sub-task of the rest.

## 13. Docs / SOPs per conveyor team or playbook

Every conveyor team (or playbook) should be able to have reference documents/SOPs attached — "how we qualify," "our discovery call script," etc. — visible to whoever's working a stage in that team. The Knowledge/document system already supports linking an uploaded document to an arbitrary related object (`related: [{type, id}]`); the only gap is that `"conveyor_team"`/`"playbook"` aren't currently valid `RelatedObjectType` values, and there's no UI slot on the team/playbook page to show "Docs for this team." This is a small, well-scoped addition on top of existing infrastructure — not a new system.

## 14. Information architecture — a real workspace, not an admin subsection

Recommendation: don't bury this under Administration. Sales managers will live here daily; they shouldn't navigate through admin settings to run the revenue engine. Proposed top-level nav item:

```
Sales Operations
├── Overview
├── Individual Funnels
├── Conveyor Teams
├── Playbooks
├── Queue
├── Analytics
└── Experiments
```

This is a real navigation/IA change (new top-level nav item, moving/renaming existing pages) and should happen once the underlying features it hosts (dashboard, queue, Kanban) actually exist — building the empty shell first isn't valuable on its own.

---

## Suggested build order

This is too large for one pass. Roughly in order of (value ÷ effort), cheapest/highest-value first:

1. **Wire up the already-declared-but-dead `PlaybookStage` fields** (§5) — owner/backup/checklist/exit-criteria/AI-prompt are already in the schema; showing and using them is mostly UI + a few read paths, no new data model.
2. **Automatic handoff** (§6) — the highest leverage feature ("nobody clicks Assign"), buildable entirely on existing services (`taskService`, `notificationService`, `activityService`, `leadService.advance`).
3. **Handoff Queue** (§8) — a personal "what's waiting on me" view, which becomes far more useful once #2 exists to populate it.
4. **Conveyor Dashboard visualization** (§7) — mostly a UI layer on metrics that already exist.
5. **Docs/SOPs per team** (§13) — small, additive, reuses the existing document/related-object system.
6. **Dynamic per-stage ownership mode** (§2) and **top-of-funnel pipeline** (§3) — real data-model decisions, worth a short design pass each before coding.
7. **Kanban drag-and-drop view** (§11) — a real UI project once #2 (automatic handoff) exists to drive it.
8. **Sales Operations top-level workspace** (§14) — do this once the pages it would host actually exist; otherwise it's an empty shell.
9. **AI Supervisor** (§12) — the biggest, most novel piece (needs a background/scheduled job system that doesn't exist yet). Recommend scoping this as its own project once 1–5 are live and there's real usage data for it to reason about.
