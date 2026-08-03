# STOS v2 — Experience Design Document

> **Status:** Design freeze on new features. This document is the gate. No v2 implementation
> begins until it is reviewed and accepted.
> **Premise:** v2 is **not a rewrite**. The backend (IAM, workspace isolation, RBAC, AI,
> Qdrant, Mongo, 60+ APIs) stays. v2 re-organizes the *experience* around business objects.
> **Author's stance:** the question is no longer "what features are missing" but
> **"does this make sense to use 8 hours a day?"** Today, honestly, not yet. Here's why, and
> what to do about it.

---

## 0. Executive summary

STOS is feature-complete and architecturally sound, but the UI is **feature-organized**, not
**object-organized**. Users navigate *to features* (CRM, Conveyor, Calendar, Dashboard,
Assistant) when they think *about objects* (this company, this person, this deal, my day).

v2 makes seven objects first-class and turns every "feature" into a **view** of an object:

```
Organization → People → Companies → Work → Knowledge → Time → AI
```

- **Sales** = a Work view.  **CRM** = a Company view.  **Calendar** = a Time view.
- **Tasks** = a Work view.  **Command Center** = an AI view.  **Conveyor** = a Work view.

Result: fewer top-level destinations, one canonical page per object ("MoneyPal → everything"),
a Home that shows *your day* (not widgets), and **AI everywhere** instead of a separate Assistant
product.

This document contains: the three audits (Product, Process, Design System), the business-object
graph, information architecture + navigation, object-centric navigation model, the Home
redesign, the invisible-AI interaction model, Design System v2, user journeys, screen inventory,
process flows, state-management philosophy, permission model, mobile strategy, deployment
strategy, a **no-rewrite migration plan**, and the **one-week dogfooding protocol**.

---

## 1. Product Audit (no code)

**The test:** could a 6–10 person company run its whole revenue + delivery motion on STOS,
8 hours a day, without leaving for a spreadsheet or a Slack thread? Findings, honest:

### 1.1 Fragmentation (the core problem)
- **Three overlapping "dashboards":** Home widgets, `/command` Command Center, and the
  `Dashboard` component all answer similar questions differently. A daily user shouldn't have to
  learn three mental models for "how's the business."
- **CRM is scattered:** companies live *inside* Work, contacts have no home surface, and there is
  **no company 360 page**. To understand "MoneyPal," a user assembles it from memory across Work,
  activities, proposals, and knowledge.
- **Calendar is not a place:** meetings exist as records but "Time" isn't a first-class surface;
  scheduling context is spread across Work, Home, and the Google connector.
- **Two AI briefings + recommendations** (work briefing, exec briefing, command recs) — three
  doors to the same intelligence.
- **Workspace is a junk drawer:** 9 admin cards (Organization, Data models, Sales models, Roles,
  People & Access, Integrations, Timeline, Audit, Settings) with no hierarchy.

### 1.2 You navigate to features, not objects
The unit of thought at work is an **object** ("the Rajkot deal", "Priya", "MoneyPal"), but STOS
makes you pick a *feature* first, then find the object inside it. Only Leads have a real detail
page (`/work/[id]`). Companies, People, and Meetings do not.

### 1.3 Cognitive load & naming drift
"Conveyor", "Workspace", "Assistant", "Command Center", "Data models" are internal-engineering
names, not how a founder thinks. Six nav items + per-page tabs + a 9-card admin hub = too many
entry points for a tool used all day.

### 1.4 Missing 8h/day essentials
- No **inbox / action queue** (what needs *me*, in one list).
- No **saved views / filters** on lists (every rep re-filters daily).
- No **bulk actions** (assign 10 leads, reschedule 5 tasks).
- **Email** is deferred — yet sales lives in email.
- **Mobile** is unaddressed — approvals and capture happen on phones.
- Global search (⌘K) — **just added, keep it, it's foundational to v2.**

### 1.5 What's genuinely good (keep, don't touch)
Centralized RBAC + per-user overrides; demo/production **data isolation**; workspace-aware RAG;
audit trail; deterministic revenue math with AI-drafted narrative; the simulation engine; ⌘K.
**These are v2 assets, not debt.**

**Verdict:** STOS is a strong *system* and a fragmented *product*. v2 is an experience
consolidation, not a feature sprint.

---

## 2. Process Audit — how Svayantra Tech actually operates

> Software should mirror reality, not force reality to match software.

SVT is a small **AI-automation services firm**. Its real operating loop:

```
 Source ─► Qualify ─► Meet ─► Propose ─► Negotiate ─► Close ─► Onboard ─► Deliver ─► Renew
   (Marketing + SDRs)      (AEs / Founder)        (Finance gate)   (Operations)   (CS/Founder)
```

Around that revenue spine sit four support motions: **Finance** (quote approval, margin,
collections), **Operations** (delivery, provisioning, QA), **Marketing** (demand, content,
brand), and the **Founder's Office** (strategy, approvals, hiring).

**What this implies for software:**
- The **Company (account)** is the spine — everything (people, deals, meetings, docs, revenue,
  delivery) hangs off it. → *Companies must be a first-class object with a 360 page.*
- **People** are dual: external contacts *and* internal employees — both are "people we work
  with." → *One People object, two facets.*
- **Work** is the verb layer: every task, stage move, approval, follow-up. Sales pipeline and
  internal tasks are the same substance viewed differently. → *Work is one object; Sales is a
  view of Work scoped to deals.*
- **Time** is when work happens: meetings, deadlines, SLAs, follow-ups, availability. → *Time is
  a first-class view, backed by Calendar integration.*
- **Knowledge** is the firm's memory: SOPs, playbooks, proposals, client + meeting notes. → *Every
  object surfaces its knowledge; AI retrieves from it.*
- **AI** is how the firm thinks: prioritize, draft, summarize, detect risk. → *AI is a layer on
  every object, not a destination.*
- **Organization** is who SVT is: departments, roles, capacity, KPIs. → *The config that shapes
  everyone's views.*

**Reality → object mapping is 1:1 with your instinct.** The process audit *confirms* the
object model in §3.

---

## 3. First-class business objects & the object graph

Seven objects. Everything else is a **view**, a **relation**, or an **action** on these.

```
                         ┌──────────────────┐
                         │  ORGANIZATION     │  who SVT is (depts, roles, capacity, KPIs)
                         └─────────┬─────────┘
                                   │ shapes
                 ┌─────────────────┼──────────────────┐
                 ▼                 ▼                  ▼
          ┌───────────┐     ┌───────────┐      ┌───────────┐
          │  PEOPLE    │◄───►│ COMPANIES  │◄────►│   WORK     │
          │ (internal+ │     │ (accounts) │      │ (deals +   │
          │  external) │     │            │      │  tasks)    │
          └─────┬──────┘     └─────┬──────┘      └─────┬──────┘
                │                  │                   │
                └───────┬──────────┴─────────┬─────────┘
                        ▼                     ▼
                  ┌───────────┐         ┌───────────┐
                  │   TIME     │         │ KNOWLEDGE  │
                  │ (meetings, │         │ (docs,     │
                  │  SLAs)     │         │  notes)    │
                  └─────┬──────┘         └─────┬──────┘
                        └──────────┬───────────┘
                                   ▼
                             ┌───────────┐
                             │    AI      │  reads all of the above; acts on all of it
                             └───────────┘
```

### Object definitions (canonical)
| Object | Is | Backed by (existing) | Facets / views |
|---|---|---|---|
| **Organization** | The company's shape | `orgUnits`, `roles`, dept KPIs | Structure, Roles, Capacity, Admin |
| **People** | Everyone we work with | `employees` (internal), `contacts` (external) | Directory, Person 360, Team, Workload |
| **Companies** | Accounts/prospects/clients | `companies` | Company 360, Pipeline-by-account, Book of business |
| **Work** | Everything to do / move | `leads` (deals), `tasks`, `proposals`, `quotations`, `workflowInstances` | Pipeline (Sales), Board, My Work, Conveyor, Approvals |
| **Knowledge** | The firm's memory | `documents`, `activities` (as history) | Library, Object dossiers, RAG search |
| **Time** | When things happen | `meetings`, task `dueAt`, `stageDeadline` (SLA) | Calendar, Agenda, SLA board |
| **AI** | How the firm thinks | orchestrator, briefings, RAG, tools | Ambient actions, Command Center, Ask |

**Relations (the graph edges):** Company *has* People, Work, Meetings, Documents, Revenue; Person
*belongs to* Company/Org, *owns* Work, *attends* Meetings; Work *concerns* a Company + People,
*occurs in* Time, *references* Knowledge. Every 360 page is a **node**; every list is a
**filtered edge traversal**.

---

## 4. Information architecture & navigation

### 4.1 Top-level navigation (v2)
```
🏠 Home            your day
💼 Work            deals + tasks + approvals (Sales/Board/Conveyor are views)
🏢 Companies       accounts (CRM is a view)
👥 People          internal + external (directory, 360s)
🧠 AI              ask + command center + automations (Assistant folds in here)
📚 Knowledge       library + dossiers + search
🏛 Organization    structure, roles, capacity, KPIs
⚙ Administration   settings, integrations, audit, data models, mode
```

**Gone from top level** (they become views/contexts): CRM, Conveyor, Calendar, Dashboard,
Reports, Assistant, Workspace, Command Center as separate destinations, Sales models (→ under
Work or Organization).

**Rationale:** 8 stable destinations that map to the object graph; no per-product tabs competing
with nav. Cognitive load drops from "which of 15 places is this in?" to "which of 7 objects is
this about?"

### 4.2 Where the old things live now
| Today | v2 home |
|---|---|
| Work → Leads | **Work** › Pipeline |
| Work → Tasks | **Work** › My Work / Board |
| Work → Conveyor | **Work** › Conveyor (a pipeline lens) |
| Approvals (in Workspace/Home) | **Work** › Approvals |
| Companies (in Work) | **Companies** (first-class) |
| Contacts (hidden) | **People** (external facet) |
| Employees / People & Access | **People** (internal facet) + **Administration** for access |
| Calendar / Meetings | **Time** view (surfaced in Home + every 360) |
| Assistant chat | **AI** (+ ambient actions everywhere) |
| Command Center `/command` | **AI** › Command Center |
| Knowledge | **Knowledge** |
| Organization / Data models / Sales models | **Organization** (+ Administration for data models) |
| Roles / Integrations / Audit / Settings / Mode | **Administration** |

### 4.3 Time as a view (not a nav item)
Time is real but doesn't need a top-level slot — it appears as: the **agenda strip** on Home,
a **Calendar tab** inside Work, and a **schedule section** on every Company/Person 360. Google
Calendar remains the scheduling engine.

---

## 5. Object-centric navigation ("navigate to objects, not features")

**The single biggest UX improvement.** Every first-class object gets one canonical page — a
**360** — that composes all related data. Example, `Companies › MoneyPal`:

```
┌───────────────────────────────────────────────────────────────────────┐
│  MoneyPal            [AI ▸ Summarize · Plan · Draft]        Owner: Priya│
│  SaaS · ₹80 est. rev · Client · Health ●green · Renewal in 4 mo         │
├──────────────┬────────────────────────────────────────────────────────┤
│ Overview     │  Deals (2)    Meetings (3)    Tasks (5)    Docs (6)       │
│ People       │  Timeline (last 90d)          Revenue      Approvals      │
│ Deals        │  ─────────────────────────────────────────────────────   │
│ Timeline     │  [contextual content for the selected facet]              │
│ Knowledge    │                                                           │
│ Revenue      │                                                           │
└──────────────┴────────────────────────────────────────────────────────┘
```

Every object type gets the same **DetailLayout** shell (header + facet rail + content + ambient
AI bar). Person 360, Deal 360, Meeting 360 all follow it. This is what makes STOS feel like *one*
product: same spatial model everywhere. **Consistency is a feature.**

**Linking is universal:** any mention of a company/person/deal anywhere (lists, timeline, AI
answers, ⌘K) is a link to its 360. You never dead-end.

---

## 6. Home = "Your day"

Home stops being a widget wall. It answers, in one glance, *what today is about*:

```
Good morning, Aryan.                                    [Demo ⇄ Production]

  ▸ AI briefing (Chief of Staff): yesterday · today · do-first     [1 line each]

  Your day
   09:30  Discovery — Cloudwave            (join · prep)
   11:00  Approve: NCR Digital ₹6.5L        (approve · open)
   14:00  Founder sync                       (agenda)
   ─ 3 follow-ups overdue · 2 leads at risk · 1 proposal to send ─

  [Everything else is one keystroke away — ⌘K]
```

- **Role-aware:** rep sees their tasks/meetings/follow-ups; owner sees the exec briefing +
  what's blocked + at-risk revenue. (We already compute all of this in `commandCenterService`.)
- **No dashboards on Home.** Analytics live in the object they describe (Work pipeline metrics,
  Company revenue, Org KPIs). Home is a *to-do surface*, not a *reporting surface*.
- **Everything else is searchable**, not displayed. Home ≠ index of the app.

---

## 7. AI interaction model — invisible, everywhere

Retire the idea of "AI" as a place you go to chat. AI becomes a **capability on every object**.

### 7.1 The seven ambient verbs
Every 360 and list exposes context-aware AI actions (as an **AIActionBar**):

| Verb | Example |
|---|---|
| **Summarize** | "Summarize MoneyPal's last 90 days" |
| **Plan** | "Plan Priya's day" / "Plan the close of this deal" |
| **Generate** | "Draft the proposal / follow-up email / meeting agenda" |
| **Explain** | "Why is this deal at risk?" |
| **Search** | grounded RAG over the firm's knowledge |
| **Predict** | "Will this close this quarter?" (win probability, forecast) |
| **Optimize** | "Rebalance the team's workload" / "Fix the bottleneck" |

### 7.2 Three surfaces, one brain
1. **Ambient** — the AIActionBar on each object (context = that object).
2. **⌘K** — global: ask, search, run any action from anywhere.
3. **Command Center** (an AI *view*) — the proactive, org-wide layer: briefings,
   recommendations, risk detection. This is where "AI everywhere" rolls up for the owner.

### 7.3 Proactivity
AI should *act before asked*: surface the daily briefing unprompted, flag SLA breaches, propose
reassignment when someone's overloaded, draft the follow-up when a proposal goes cold. Guardrail
(keep from v1): **revenue-data mutations require human approval**; AI drafts, humans commit.

---

## 8. Design System v2

The biggest lever. Today the tokens are good (deep-navy glass, cyan/teal accent, warm-orange
action) but **application is inconsistent** — different modules chose different radii, spacings,
badge styles, and table treatments.

### 8.1 Principles
1. **One surface.** Every page is the same material (glass on deep navy). No module has its own look.
2. **Object-first.** Layouts serve objects (360 shell) and collections (list shell) — two archetypes, reused everywhere.
3. **Calm & intentional.** Motion is subtle (the `.animate-in` entrance, typing dots); nothing bounces for attention.
4. **AI-native.** The AIActionBar is a first-class, standard element — not bolted on per page.
5. **Premium dark.** Depth via translucency + soft shadow, not borders everywhere. Inspired by the SVT mark's gradient and rhythm.

### 8.2 Token discipline (codify, then enforce)
- **Radius scale:** `sm 8 / md 12 / lg 16 / xl 24` — cards use `xl`, controls `md`. (Today: mixed `rounded`, `rounded-lg`, `rounded-2xl`.)
- **Spacing scale:** 4-pt base; page gutter `32`, section gap `20/24`, card padding `16/20`.
- **Shadow scale:** `card` (soft), `overlay` (modal), `glow` (brand accent) — three, no ad-hoc.
- **Type scale:** display `24/600`, title `18/600`, section `15/600`, body `14`, meta `12`, micro `11` — with `-0.011em` tracking (already set).
- **Color roles:** surface, panel, border, muted, white, accent (cyan), teal (positive), action (warm/urgent), danger. No raw `text-green-400` etc.

### 8.3 Canonical component library (the contract)
Build/normalize these; every screen composes only from them:

`AppShell` · `PageHeader` (title + subtitle + actions + AI bar) · `ListShell` (toolbar, filters,
saved views, bulk actions, table/grid/board) · `DetailLayout` (the 360 shell) · `Card/Panel` ·
`StatTile` · `KpiRow` · `Table` · `Board` (kanban) · `Timeline` · `Badge` (one system: status,
health, stage, role) · `Avatar` (initials → photo) · `Button` (primary/action/ghost/danger only) ·
`Field/Input/Select/Textarea` (the `.inp` standard) · `EmptyState` (icon + hint + action) ·
`Skeleton` · `Drawer` (quick-create/quick-view) · `CommandPalette` · `AIActionBar` ·
`WorkspaceToggle` · `Toast`.

**Audit rule for v2:** if a screen introduces a bespoke variant of any of these, it's a bug.

### 8.4 The consistency backlog (from the audit)
Normalize: badge styles (stage vs health vs role currently differ), table row treatments
(People vs Sales models vs Employees differ), button hierarchy (btn-accent vs btn-action usage),
card padding/radius, empty states (now standardized — apply everywhere), loading skeletons
(exist — apply everywhere).

---

## 9. User journeys (the ones that must feel effortless)

1. **Rep's morning:** open STOS → Home shows *your day* → click a follow-up → land on the Deal
   360 → "Generate follow-up" (AI) → send → mark done. *(≤ 4 interactions.)*
2. **Owner's morning:** Home → read AI briefing → "2 approvals waiting" → approve inline → "1 rep
   overloaded" → reassign via AI. *(No navigation to a separate approvals screen.)*
3. **Understand an account:** ⌘K "MoneyPal" → Company 360 → everything (people, deals, meetings,
   docs, revenue, timeline) on one page.
4. **Run a discovery:** Time/agenda → meeting → "Prep" (AI pulls the account + last touches) →
   after: "Summarize + create follow-ups" (AI).
5. **Close a deal:** Deal 360 → advance stage → proposal (AI draft, human numbers) → quote →
   approval workflow → won → onboarding tasks auto-created.
6. **Add a hire:** People → Add (already built) → assign dept/manager/role → they appear in
   Work/People/Org with zero code.
7. **Demo to an investor:** flip **Demo**, everything's alive; flip **Production**, it's a clean
   real workspace. *(Already built — a v2 headline capability.)*

---

## 10. Screen inventory (v2)

**Global:** AppShell (sidebar + ⌘K + AI bar), Sign-in.
**Home:** Your Day (role-aware).
**Work:** Pipeline (Sales view), My Work / Board, Conveyor view, Approvals, **Deal 360**.
**Companies:** Book of business (list), **Company 360**.
**People:** Directory (internal+external), **Person 360**, Team/Workload.
**AI:** Command Center, Ask (full-screen fallback of ⌘K), Automations.
**Knowledge:** Library, Search, (dossiers render inside object 360s).
**Organization:** Structure + Departments (KPIs/resources — built), Roles, Capacity.
**Administration:** Settings + Mode, Integrations, Data models (custom objects), Audit/Timeline, Access.

Each 360 = one `DetailLayout` with object-specific facets. ~14 screen archetypes total (vs the
current sprawl of ~25 loosely related pages).

---

## 11. Process flows (mirroring §2)

- **Revenue flow:** Company created → Deal (lead) → stages with SLAs (individual funnel *or*
  conveyor) → proposal → quote → **approval gate** → won → **onboarding tasks auto-spawn** →
  delivery (Ops) → renewal pipeline. *(Engines exist; v2 makes each step legible on the Deal/
  Company 360.)*
- **Work assignment flow:** AI/manager assigns → notification → appears in assignee's My Work +
  Home → complete → activity + (recurring?) next occurrence.
- **Approval flow:** trigger (quote > threshold) → sales_head → owner → recorded in audit;
  surfaced on Home + Work › Approvals, not a hidden workflow screen.
- **Knowledge flow:** doc/note created → embedded (workspace-tagged) → retrievable by AI on the
  relevant object 360 and ⌘K.

---

## 12. State-management philosophy

- **Server-first.** Server Components + Route Handlers are the source of truth (already the
  pattern). Minimize client state.
- **Per-request memoization** via React `cache` (used for `activeWorkspace`, `getUser`).
- **Mutations = server actions / typed API + `router.refresh()`**; optimistic UI only for
  instant toggles (task done, workspace switch).
- **No global client store** (no Redux/Zustand) unless a real cross-view need appears; ⌘K and
  AIActionBar are self-contained clients.
- **URL is state:** filters, saved views, selected facet live in the URL (shareable, back-button
  correct). *(New in v2 — enables saved views + deep links to 360 facets.)*
- **Workspace/mode** is server-resolved and threaded through the data layer (already built).

---

## 13. Permission model

Keep the v1 foundation (it's strong): centralized dotted-permission IAM, system + custom roles,
per-user overrides, **Owner = `*`**, role sourced from the employee directory, append-only audit,
and **workspace (demo/production) isolation**.

**v2 additions:**
- **Object-level visibility** as the primary lens (can I see this Company/Deal/Person?), with
  actions gated underneath — matches object-first navigation.
- **Field-level sensitivity** (e.g., revenue/margin visible only to finance-visible roles) —
  already partially done at render; formalize as a policy.
- **View scoping** (My / Team / All) as a reusable primitive across every list, not just tasks.
- Ownership/autonomy rules (individual funnel vs conveyor team) already enforced — surface them
  in the UI so users understand *why* they can/can't edit.

---

## 14. Mobile strategy

STOS is used on phones for exactly three things: **approve**, **capture**, **check my day**.
- **Responsive-first**, not a separate app. The AppShell collapses the sidebar to a bottom bar
  (Home · Work · ⌘K · AI).
- **Mobile Home = Your Day** (the highest-value screen) + one-tap **approve** + quick **capture**
  (log a touch, add a note/task) + **AI ask**.
- 360 pages are read-optimized on mobile (facets become a swipeable segment control).
- Defer: full editing/admin on mobile (do it on desktop). Don't try to shrink everything.

---

## 15. Deployment strategy

- **Host:** Vercel (Next.js App Router). **Data:** MongoDB Atlas (+ the DNS-dual-resolver fix
  from ADR-004). **Vectors:** Qdrant (workspace-indexed). **AI:** Claude. **Auth:** Better Auth.
- **Modes:** demo/production isolation is the safety rail for live demos vs real data. Keep the
  simulation script for demo refresh.
- **Config:** all secrets in env (`.env.local` gitignored); Google OAuth redirect URIs must be
  whitelisted per host (see known-issues).
- **Release discipline for v2:** ship behind a **navigation flag** — v2 shell can run alongside
  v1 routes during migration; flip per-user, then org-wide. typecheck + lint + build + live smoke
  remain the gate (unchanged).
- **Observability:** health endpoint exists; add per-object load timing before wide rollout.

---

## 16. Migration plan (no rewrite)

v2 is a **re-navigation + composition** layer over the existing backend. Phased, each shippable:

1. **v2 shell + nav** (8 destinations) behind a flag; old routes still reachable.
2. **DetailLayout + Company 360** (the highest-value new surface) — reuse company/lead/activity/
   doc services.
3. **Person 360** + People unification (internal+external).
4. **Work consolidation** — Pipeline/Board/Conveyor/Approvals as *views* of one Work surface.
5. **AIActionBar** standardized on every 360; fold Assistant into AI + ⌘K.
6. **Home = Your Day** (reuse `commandCenterService` + `taskService` + meetings).
7. **Design System v2 pass** — normalize tokens/components across all screens (the consistency
   backlog, §8.4).
8. **Retire** duplicated dashboards/screens; delete dead routes.

No service, schema, or engine is rewritten. Estimated: sequential, verify-gated, weeks not months.

---

## 17. The non-negotiable: run SVT on STOS for one week

Before any v2 code, **dogfood v1 for a week.** Every task, meeting, approval, lead, proposal,
note, follow-up, and decision goes through STOS. Keep a friction log — these observations
outrank any feature idea.

**Friction log template** (`docs/friction-log.md`):
```
Date | Screen/flow | What I did | Friction | Category | Severity | v2 fix idea
-----|-------------|-----------|----------|----------|----------|------------
```
**Categories** (from your own prompts): `too-many-clicks` · `expected-info-missing` ·
`cant-do-from-here` · `AI-should-have-done-this` · `looks-inconsistent` · `couldnt-find-it`.

**Rule:** a v2 change is only justified if it maps to a logged friction entry *or* the object-model
consolidation in this doc. No speculative features.

---

## Appendix A — Object ↔ current-backend map (nothing to rebuild)
| v2 object/view | Existing services / collections |
|---|---|
| Companies 360 | `companyService`, `contactService`, `leadService`, `activityService`, `documentService`, `financeService` |
| Deal 360 | `leadService` (+ intelligence, execution model), `proposalService`, `quotationService`, `workflowService` |
| Person 360 | `employeeService`, `contactService`, `taskService`, `meetingService` |
| Work views | `taskService.listScoped`, `leadService`, `conveyorMetricsService`, `workflowService` |
| Time | `meetingService`, `calendarService`, task `dueAt`, `stageDeadline` |
| Knowledge | `documentService`, `knowledgeAskService`, `retrieveKnowledge` (workspace-scoped) |
| AI | orchestrator, `commandCenterService`, `ai/*briefing`, `ai/command-recommendations`, `searchService` |
| Organization | `orgUnitService` (+ dept KPIs), `roleService` |
| Administration | `permissionService`, `connectorService`, mode (`lib/mode`), audit, `objectDefinitionService` |

## Appendix B — Decision checklist before v2 build starts
- [ ] Object model (§3) accepted.
- [ ] Nav (§4.1) accepted — confirm the 8 destinations + names.
- [ ] One week of dogfooding complete; friction log reviewed.
- [ ] Design System v2 tokens/components (§8) ratified.
- [ ] Migration flag strategy (§16) agreed.
