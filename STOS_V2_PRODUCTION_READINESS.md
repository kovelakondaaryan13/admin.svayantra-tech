# STOS v2 — Production Readiness Review (RC gate)

> **Report only — no code changed.** Reviewer lens: Staff Product Designer + Staff FE + QA Lead +
> A11y Specialist + Enterprise PM. Grounded in the actual codebase (Sprints 11–12D + v2 rollout
> Phases 1–3), verified live on :4100.
> **Severity:** 🔴 Critical (blocks deploy) · 🟠 High · 🟡 Medium · ⚪ Low.
> **Category:** Visual · UX · A11y · Perf · Arch.

---

## Verdict (read this first)

STOS v2 is **demo-ready and close to dogfood-ready, but not yet team-deployment-ready.** The
design system exists and Phases 1–3 landed, so the app now largely reads as one product. The gaps
that remain are **consistency debt** (a second object-page pattern, emoji icons, duplicate
KPI/badge implementations), **enterprise hardening** (error states, mobile, a11y polish), and one
**data-model 360 inconsistency**. None are architectural rewrites; most are finishing work.

**Would I ask the whole team to switch tomorrow? Not quite** — see §12. **One week of founder-only
dogfooding on an RC-1 freeze is the right next step**, fixing only what this review + real usage
surface.

---

## Pass 1 — Visual consistency

| # | Sev | Page/area | Finding | Root cause | Fix | Cat |
|---|-----|-----------|---------|-----------|-----|-----|
| 1.1 | 🟠 | Deal detail `/work/[id]` | Uses a **bespoke lead-detail layout**, not the `ObjectPage` template like Company/Person 360 → different header, tab, spacing language | Predates the object template (Sprint 3) | Migrate Deal to `ObjectPage` | Visual/Arch |
| 1.2 | 🟠 | App-wide | **Emoji icons** for nav, KPI tiles, object logos → inconsistent sizing/weight/baseline, reads unprofessional at enterprise scale | No icon set adopted yet | Swap to one line-icon set (Lucide); keep tile sizes | Visual |
| 1.3 | 🟡 | command-center, conveyor-dashboard | Local `Kpi`/`Panel`/`StatTile` implementations differ from the DS `StatTile`/`Section` (padding, label case, delta) | Built before DS primitives | Replace with DS `KpiRow`/`StatTile`/`Section` | Visual/Arch |
| 1.4 | 🟡 | Tables (audit, employees, leads-grid) | Row padding, header casing, hairline treatment differ slightly table-to-table; no shared `Table` primitive | No canonical `Table` component | Add DS `Table`; migrate | Visual |
| 1.5 | 🟡 | Badges/chips | Two systems in use — the `.badge` CSS class (inline in many files) and the `<Badge>` component; a few raw `rounded-full border` chips remain | Class predates component | Standardize on `<Badge>`; grep out raw chips | Visual |
| 1.6 | ⚪ | Titles | Page titles inconsistent ("Pipeline" vs "My Work" vs "Work"); Work tab still labeled "Leads" while nav is object-first | Naming drift | Decide canonical labels | UX |

## Pass 2 — Component audit
| # | Sev | Finding | Fix | Cat |
|---|-----|---------|-----|-----|
| 2.1 | 🟡 | **Duplicate KPI/Panel/TypingDots** across `command-center.tsx`, `conveyor-dashboard.tsx`, `home/executive-dashboard.tsx` (some now on DS, some not) | Consolidate on `@/components/ds` | Arch |
| 2.2 | 🟡 | Hardcoded styling remains inside big components (leads-grid, tasks-workspace, org-console, roles-matrix, objects-panel) — raw `bg-white/[0.03]`, custom radii vs tokens | Migrate to `Section`/tokens during final QA | Visual |
| 2.3 | ⚪ | `Avatar` exists in DS but sidebar + some rows still compute initials inline | Reuse `<Avatar>` | Arch |
| 2.4 | ✅ | Good: tokens are centralized; `@apply` guards prevent unknown tokens; DS primitives exist + documented | — | — |

## Pass 3 — Interaction audit
| # | Sev | Finding | Fix | Cat |
|---|-----|---------|-----|-----|
| 3.1 | 🟡 | **Approvals have no dedicated destination** — surfaced on Home/Command but you can't go to "Approvals" and act in a list | Add an Approvals view under Work (later — feature-ish) | UX |
| 3.2 | 🟡 | Work uses tabs (Leads/Tasks/Conveyor) **and** an internal view switcher (List/Board/Calendar/Workload) → two nav layers | Consider promoting views into the tab bar | UX |
| 3.3 | ⚪ | ⌘K is strong (search/create/navigate/mode). Tab order + `:focus-visible` present. ObjectPage tabs have arrow-key nav | Keep | UX/A11y |
| 3.4 | 🟡 | Perceived responsiveness: async actions (briefing, AI ask, search) show text ("Thinking…") not skeletons; brief layout shift when content lands | Use shimmer skeletons + reserve space | UX |

## Pass 4 — Object consistency
| Object | Header | Sections | Timeline | AI section | Metrics | Actions | Nav | Verdict |
|---|---|---|---|---|---|---|---|---|
| **Company** | ObjectPage ✅ | ✅ | ✅ | AI summary ✅ | KpiRow ✅ | quick actions ✅ | tabs ✅ | ✅ canonical |
| **Person** | ObjectPage ✅ | ✅ | via meetings | AI summary ✅ | KpiRow ✅ | ✅ | tabs ✅ | ✅ canonical |
| **Deal** (`/work/[id]`) | ❌ bespoke | partial | ✅ | AI summary card (diff style) | inline | inline | no tabs | 🟠 **inconsistent** |
| **Work/Knowledge/Org** | collection/workspace | ✅ | n/a | n/a | n/a | — | — | ✅ (collections, not objects) |
**4.1 🟠:** Deal is the one first-class object not on `ObjectPage`. Highest-value consistency fix.

## Pass 5 — Responsive review
| # | Sev | Finding | Fix | Cat |
|---|-----|---------|-----|-----|
| 5.1 | 🟠 | **Sidebar is fixed `w-60`, no mobile/tablet collapse** → on narrow screens it eats the viewport; no bottom-bar | Add responsive shell (collapse < lg, bottom bar on mobile) | UX |
| 5.2 | 🟠 | **Wide tables overflow** on mobile (audit, employees, leads-grid) — horizontal scroll only, no card fallback | Card/stacked layout < md | Visual |
| 5.3 | 🟡 | KPI rows (`grid-cols-2 lg:grid-cols-4`) OK; some 3-col grids get cramped on tablet | Audit breakpoints | Visual |
| 5.4 | ⚪ | ⌘K, dialogs, ObjectPage tabs wrap acceptably | Keep | — |
> Desktop-first was the stated priority and desktop is solid; **mobile is a real gap** for "installed in a 100-person company."

## Pass 6 — Accessibility
| # | Sev | Finding | Fix | Cat |
|---|-----|---------|-----|-----|
| 6.1 | 🟠 | **Icon-only buttons lack labels** — e.g., sidebar sign-out `⏻`, some row actions → screen-reader opaque | Add `aria-label` | A11y |
| 6.2 | 🟡 | **Emoji used as meaningful icons** without `aria-hidden`/label → announced literally ("house") | `aria-hidden` + text label, or real icons | A11y |
| 6.3 | 🟡 | **Contrast risk:** `faint #64708C` on `panel/elevated` for 11–12px meta text likely < 4.5:1 | Verify + lighten faint or enlarge | A11y |
| 6.4 | 🟡 | Some **status by color alone** (health dots, KPI tone) | Pair with icon/label (Badge already does; extend) | A11y |
| 6.5 | ⚪ | Good: global `:focus-visible`, ARIA tablist on ObjectPage, `aria-live` on AI callout, semantic headings on migrated pages | Keep | — |
| 6.6 | 🟡 | **Touch targets** — some 24px icon controls < 44px min | Enlarge hit area | A11y |

## Pass 7 — Performance (report only)
| # | Sev | Finding | Note |
|---|-----|---------|------|
| 7.1 | 🟡 | **Duplicate data fetching per request:** owner Home calls `commandCenterService.summary` (which internally calls `metricsService` + `conveyorMetricsService` + tasks + employees) **and** separately fetches metrics/tasks/meetings/finance → `leadService.list` runs several times per load | Memoize `leadService.list`/`employeeService.list` with React `cache` (like `getUser`/`activeWorkspace`) | Perf |
| 7.2 | 🟡 | `commandCenterService` + `conveyorMetricsService` + `metricsService` each re-scan all leads | Compute once, share | Perf |
| 7.3 | ⚪ | Mostly Server Components (good); bundle sizes reasonable (~103–111 kB first load) | Fine |
| 7.4 | ⚪ | Minor layout shift when async AI content lands (see 3.4) | Skeletons |
> Recommendation: **do not optimize now** — React-`cache` on the two hot service reads is the one trivial, high-value win; the rest is post-RC.

## Pass 8 — Empty states
| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 8.1 | 🟡 | Many inline empties are generic `<p>` ("Nothing yet.", "No recent activity.") — don't answer *why empty / what next / can AI help* | Route them through the DS `EmptyState` (icon + hint + action; add an "Ask STOS" action) |
| 8.2 | ⚪ | The DS `EmptyState` is good (icon + hint + action) but under-used | Adopt everywhere |

## Pass 9 — Error states
| # | Sev | Finding | Fix | Cat |
|---|-----|---------|-----|-----|
| 9.1 | 🟠 | **Generic API errors**: failures surface as `{"error":"internal error"}` / raw text (seen earlier on knowledge-ask before the Qdrant index fix) — no user-friendly message or recovery | Standard error toast/inline with retry; map known errors | UX |
| 9.2 | 🟡 | **Client fetch failures** in components (briefing, ask, mode toggle) often set a bare string or fail silently in `finally` | Consistent error UI + retry affordance | UX |
| 9.3 | 🟡 | **Form validation** is minimal (create employee, playbook, team) — server 400s show as generic text; no field-level messages | Field-level validation display | UX |
| 9.4 | ⚪ | Good: `(app)/error.tsx` + `not-found.tsx` exist; permission-denied redirects to `/home` (though silent — a "you don't have access" toast would be clearer) | Add denial messaging | UX |

## Pass 10 — Enterprise readiness (100-person company lens)
- 🟠 **Unfinished feel:** Deal detail ≠ other 360s (4.1); emoji icons (1.2); mobile (5.x).
- 🟠 **Fragile feel:** generic error states (9.1); duplicate data fetching under load (7.1).
- 🟡 **Confusing:** two AI briefings + recommendations overlap; Command Center vs Home overlap; no Approvals destination.
- 🟡 **Missing enterprise table stakes (features, not this migration):** email, notifications inbox, bulk actions, saved views, export, SSO. Flag as roadmap, not RC blockers.
- ✅ **Strong:** RBAC + audit + demo/production isolation + workspace-scoped RAG + ⌘K are genuinely enterprise-grade.

## Pass 11 — Founder test (Aryan, no docs) — verified on :4100
| Task | Path | Result |
|---|---|---|
| Find today's priorities | Home → Focus / AI briefing | ✅ fast |
| Open MoneyPal | ⌘K "MoneyPal" → Company 360, or Companies → card | ✅ fast |
| See pipeline health | Home → Company Pulse (or Command Center) | ✅ (but duplicated in two places 🟡) |
| Review approvals | Home Focus / Command → but **no dedicated list to act in** | 🟡 friction (3.1) |
| Find Rahul | ⌘K "Rahul" → Person 360, or People | ✅ |
| Open meeting history | Person 360 → Meetings / Company 360 → Meetings | ✅ (split across objects 🟡) |
| Understand yesterday | Home → "What happened" | ✅ |
**Verdict:** 5/7 effortless; approvals + meeting-history-locality are the friction points.

## Pass 12 — Dogfooding readiness & ranked blockers
**Would I ask the whole team to switch tomorrow? No — one week of founder dogfooding first.** Ranked:

**🔴 Critical (fix before any team use)** — none purely blocking; the app runs, auth works, data is isolated.

**🟠 High (fix during/after RC-1 week)**
1. Deal `/work/[id]` → `ObjectPage` (object consistency). *Arch/Visual.*
2. Error-state standardization (9.1/9.2) — enterprise trust. *UX.*
3. Responsive shell + table fallbacks (5.1/5.2) — phones. *UX/Visual.*
4. Icon set swap (1.2) + icon-only `aria-label` (6.1). *Visual/A11y.*

**🟡 Medium**
5. Consolidate duplicate KPI/Panel/Badge (1.3/1.5/2.1). *Arch.*
6. Empty-state adoption (8.1). *UX.*
7. Contrast + color-only status (6.3/6.4). *A11y.*
8. React-`cache` the two hot service reads (7.1). *Perf (trivial).*
9. Merge Home ↔ Command Center overlap; single AI briefing. *Product/UX.*
10. Approvals destination (3.1). *UX (feature-ish).*

**⚪ Low**
11. Naming/label consistency (1.6). 12. Touch targets (6.6). 13. Loading skeletons for async (3.4).

---

## Recommended path (your RC-1 plan — endorsed)
1. **Freeze RC-1 now** (tag the current build).
2. **One week founder-only dogfooding** — run every lead/client/task/meeting/proposal/approval/note through STOS; keep the friction log (`docs/friction-log.md`, categories from the v2 design doc).
3. **Fix only** what this review + real usage surface — prioritize the 🟠 High list.
4. Tag **STOS v2.0.0 Internal**.
5. *Then* start new capabilities (agents, email, orchestration) on a stable base.

**No code was changed for this review.**
