# The STOS Product Bible

**A brutally honest internal handbook — what STOS actually is, how it actually works, and where it actually stands.**

*Compiled 2026-08-04 by direct inspection of the repository at this commit — not from memory, not from prior docs taken on faith. Every claim below was either read directly from source (file:line citations throughout) or is explicitly labeled as inherited from a prior document and flagged if unverified. Where the code and the docs disagree, the code wins and the doc is called out as stale.*

> **Read this first if you read nothing else:** the codebase is a serious, working, well-architected product that has vastly outpaced its own documentation. `.claude/PROJECT.md` and `.claude/ROADMAP.md` — the files this repo's own conventions call "the single source of truth" — describe a project in "Phase 0, no application code yet." That description is wrong by roughly forty-three shipped sprints. This document exists to replace that gap.

---

## Table of contents

1. [Product Vision](#1-product-vision)
2. [Product Philosophy](#2-product-philosophy)
3. [Architecture](#3-architecture)
4. [Complete Feature Inventory](#4-complete-feature-inventory)
5. [Object Model](#5-object-model)
6. [AI Architecture](#6-ai-architecture)
7. [Design System](#7-design-system)
8. [Business Processes](#8-business-processes)
9. [Current Product Status](#9-current-product-status)
10. [Remaining Work](#10-remaining-work)
11. [Things We Intentionally Did NOT Build](#11-things-we-intentionally-did-not-build)
12. [Product Roadmap](#12-product-roadmap)
13. [Engineering Principles](#13-engineering-principles)
14. [Product Critique](#14-product-critique)
15. [Executive Summary](#15-executive-summary)

---

## 1. Product Vision

### What STOS is

**STOS (Svayantra Tech Operating System, née "RevenueOS")** is an AI-native operating system for sales organizations, and the first module of Svayantra Tech's long-term **ABOS (Autonomous Business Operating System)** vision. The one-line thesis, verbatim from `.claude/PROJECT.md`:

> "Traditional CRMs help humans manage work. RevenueOS lets **AI orchestrate the work** while **humans make high-value decisions** and **deterministic software executes**."

Concretely: employees are not supposed to learn a complex piece of software with elaborate menus and forms. They are supposed to ask an AI Chief of Staff — "What should I work on?", "Generate a proposal", "Show pipeline health", "Prepare me for today's meeting" — and have real, permission-checked, audited actions happen. The UI exists for the cases where a conversation is the wrong tool (bulk editing a spreadsheet-like grid, a calendar, a KPI dashboard), not as the primary interface.

### The problem it solves

Small, founder-led teams (Svayantra Tech itself is the reference customer — an early-stage, founder-led AI-automation company in India) drown in the operational overhead of running a business: leads go stale because nobody remembers to follow up, tasks get created but not actioned, proposals take an afternoon to draft, and the founder ends up personally being the routing layer for "who should do this." STOS's bet is that most of that routing, drafting, and follow-up work is amenable to an AI operating on top of deterministic, permissioned, audited services — not a human staring at a CRM UI, and not an unconstrained autonomous agent either.

### Philosophy vs. reality — the internal tension, stated honestly

The internal SVT business documents (`.claude/knowledge/business/svt-context.md`, tagged `[REAL]` for "sourced from actual internal company docs, not the product brief") say something the product's own name contradicts: **"'RevenueOS' and 'conveyor-belt' appear in none of the internal docs."** The real first wedge SVT's own internal thinking identified was an **AR/invoice-to-payment follow-up agent, WhatsApp-native, for Indian MSMEs** — not a seat-based sales CRM — and those same docs explicitly warn **"do NOT sell it as an 'operating system' — nobody buys those."**

The resolution the team adopted, and the one this document inherits: **internal architecture = OS, external pitch = one painful workflow.** STOS is being built with OS-grade bones (permissions, object model, workflow engine, AI orchestration) so that whichever painful workflow gets sold first — invoicing, sales follow-up, whatever — plugs into the same substrate instead of starting over. That is a real, load-bearing design decision, and it's why the object model (Section 5) is more general than "a CRM" would need.

### What makes it different from a CRM / ERP / PM tool / Notion / Slack

- **It is not a system of record you fill in.** The design doctrine (Section 7) is explicit that "Overview was the symptom of not knowing what the home should be" — every object answers "what is happening?" (Context) and "what can I do?" (Action Bar), not "here is a table of fields to edit."
- **The AI executes, it doesn't just chat.** 25 tools in the AI orchestrator (Section 6) directly call the same services the UI calls — `create_lead`, `create_task`, `create_meeting`, `assign_leads` — with real permission checks (mostly) and a real audit trail. This is meaningfully different from a chatbot bolted onto a CRM that can only answer questions.
- **The object model is metadata-driven, not hardcoded**, in principle (ADR-007): a generic `ObjectDefinition`/`CustomRecord` platform exists so that, in theory, new business objects don't require new tables or new code. In practice this is one of the least mature parts of the product (see Section 5.3 and Section 9) — but the *intent* to be OS-like rather than CRM-like is real and shapes many decisions.
- **Permissions are a single, centralized engine** (Section 3.7, Section 6 IAM), not per-feature ACL checks — the explicit goal being to scale from a 5-person team to a 10,000-person enterprise without an authorization redesign.

### Long-term vision: ABOS

STOS/RevenueOS is explicitly **"the first module"** of ABOS. `svt-context.md` defines ABOS two ways internally and states which one this project uses: *"Autonomous Business Operating System"* (the strategic framing used here) as opposed to *"AI Business Optimization Solutions"* (a services/factory framing used elsewhere in the company). The strategic version's stated aim is to **"remove the founder as the operating system"** — i.e., today a founder personally is the routing, memory, and decision layer for a small company; ABOS's bet is that this can be systematized and handed to AI-orchestrated software, starting with revenue operations (this module) and expanding to other business functions later. No second module exists yet, and no code in this repository is generic across "any business function" today — RevenueOS is sales/revenue-specific throughout its object model and permission catalog.

---

## 2. Product Philosophy

Every principle below is drawn from `STOS_DESIGN_SYSTEM.md` and `.claude/DECISIONS.md`, with an honest note on how consistently the codebase actually follows it (full detail in Sections 7 and 9).

### 2.1 — "The two questions" (the design doctrine's core claim)

> "*What is happening?*" → the **Context** tab. "*What can I do?*" → the **Action Bar."

Every object — a lead, a company, a person — is supposed to default to a Context view (never "Overview": *"Overview was the symptom of not knowing what the home should be"*) and expose exactly one primary action, a few secondary actions, an overflow menu, and an always-present "Ask AI." **Why this exists:** an earlier UX pass found that 15 of 20 core user journeys contained a "where do I do X?" moment, traced to three root causes — read-only tabs with no verb, the same capability duplicated across multiple tabs, and AI living at a separate address instead of being a capability *on* the object. The fix is now a permanent constraint, stated as a literal test: **"if a user has to ask 'where do I do X?', the design has failed."**

*Reality check:* this pattern is implemented correctly and is genuinely good where it's used — but it is only used on **3 pages** (Lead, Company, Person). 10 of 28 top-level pages hand-roll their own layout with no Action Bar and no enforced Context-first ordering. See Section 7.

### 2.2 — Object-first, not feature-first

`STOS_V2_DESIGN.md`'s own self-critique, quoted directly: *"the UI is **feature-organized**, not **object-organized**. Users navigate *to features* when they think *about objects*."* The intended fix is the canonical `ObjectPage` template (Section 3, Section 7) — one page shape for every "thing" in the business, not a bespoke screen per feature.

### 2.3 — AI as execution layer, not chat

**Why:** per `.claude/PROJECT.md`'s stated AI philosophy: *"Never use AI where deterministic software is better. For every feature decide whether it is: traditional software · workflow · AI agent · tool · background job · scheduled job · human approval · RAG · memory · search."* This is why STOS has a workflow *engine* (deterministic state machine, Section 5.7) separate from the AI tool catalog, and why the AI's tools call real services rather than generating free-text that a human has to interpret and re-type elsewhere.

*Reality check:* the stated companion rule — *"writes to revenue data require human approval in v1"* — is **not what the code does**. Of 25 AI tools, exactly **one** (`advance_lead_stage`) requires human approval before executing; the other 24, including `create_lead`, `assign_leads` (an *unbounded* mass-reassignment with no filter cap), `create_meeting`, and `create_proposal`, execute immediately. This is the single largest gap between stated philosophy and shipped behavior in the whole codebase. See Section 6 and Section 14.

### 2.4 — Invisible AI / "never ask what it already knows"

The orchestrator's system prompt has a rule ("#1 RULE: ACT FIRST, NEVER ASK UNNECESSARY QUESTIONS") that a live audit (`STOS_RC1_LAUNCH_READINESS.md`) confirmed working in practice: the AI is handed a live "BUSINESS CONTEXT" block (team roster, pipeline snapshot, task counts) on every turn specifically so it doesn't have to ask "who is Priya?" when Priya is a real person in the roster. **Why:** the product bet is that most friction in AI tools comes from the AI making the human do the AI's context-gathering for it.

### 2.5 — What / Why / Next (the dashboard doctrine)

Every metrics surface follows a fixed order: **Metrics** ("what is happening" — never a fabricated delta; if there's no prior snapshot, show the bare number) → **Charts** ("why is it happening" — *"a page with no question deserves no chart"*) → **AI** ("what should happen next"). The explicit contrast drawn in the design doc: *"This is an operating system, not a BI tool… not 'here are 47 metrics.'"*

*Reality check:* the "never fabricate a delta" rule is genuinely honored everywhere it's checked — deltas only appear where a real prior data point exists. The "one hue, no legend" charting constraint is real but has resulted in a chart library that only implements about a third of what its own design spec (§6, categorical/sequential/diverging palettes) describes.

### 2.6 — Every object is a living entity with a timeline

`Activity` is a first-class, append-only, entity-agnostic collection (10 entity types) explicitly built because — per ADR-034 — "many mutations didn't emit activity events, so the timeline was incomplete." **Why this matters philosophically:** an object without a history is a form; an object with a history is something you can reason about and hand to an AI to summarize. This is genuinely built and used across leads, tasks, and meetings — see Section 5.

### 2.7 — Every business operation should become contextual

The `IntentService` mechanism (Section 6) exists specifically so that an Action Bar verb without a dedicated screen doesn't become a dead end — it becomes a **pre-scoped AI conversation** ("Create a deal for MoneyPal", already knowing which company). The explicit decision recorded in ADR-039: *"Did **not** build a stateful server-side intent engine (would be the architecture bloat we agreed to stop at)"* — the whole thing is a pure URL codec plus one context-injection block in the orchestrator's prompt, not a new subsystem.

### 2.8 — "This catalogue is law" — consistency as a design constraint, not a suggestion

`STOS_DESIGN_SYSTEM.md` §0.8, verbatim: *"A bespoke variant of an existing primitive is a bug."* This is the harshest, most falsifiable principle in the whole philosophy, and Section 7 documents exactly where it holds and where it's been violated (spoiler: `object-cards.tsx` — 291 lines, one consumer, and it re-implements three separate badge-color systems that the design system's own primitives already solve).

---

## 3. Architecture

### 3.1 Layering

The stated (and mostly followed) layering is: **route handler → service → data layer**, with route handlers required to stay "thin" (`.claude/patterns/api-pattern.md`: *"parses/validates, checks auth, delegates to a service, shapes the response. No business logic, no direct DB access in the handler."*) In measured practice: **89 of 90 API route files** use the shared `ok()`/`handleError()` response envelope (the one exception, the Better Auth catch-all, correctly shouldn't); **zero route handlers** query MongoDB directly — the layering is real, not aspirational, at the route level.

### 3.2 Data layer

`src/data/collection.ts`'s generic `repo<T>(name, opts)` factory is the intended single data-access abstraction: it force-stamps `orgId`/`createdAt`/`updatedAt`, optionally tags `workspace` (demo/production isolation, see 3.4), always filters soft-deletes (`deletedAt`), and never hard-deletes. **27 collections** go through it (14 of them workspace-scoped).

Honest gap: the abstraction lacks `findOne`, `upsert`, `count`, and `aggregate` — so **10 of 43 services (23%) bypass it** with raw MongoDB driver calls. About half of those bypasses are legitimate (real aggregation pipelines the generic layer genuinely can't express); the other half are plain inconsistency against a `repo()` that already exists for that collection (several `employees` lookups, for instance). Two live collections (`auditLogs`, `aiUsage`) never got a `repo()` at all and are hand-rolled everywhere they're touched.

`src/data/leads.ts` is the one large, deliberate hand-typed exception — Leads need six operations (`search`, `setOwner`, `logTouch`, `setStage` with history push, etc.) the generic repo can't express, so it duplicates the org/soft-delete/workspace scoping by hand rather than fighting the abstraction.

Indexing is real but incomplete: 25 collections are indexed (`src/data/indexes.ts`), but **zero indexes include `workspace`** despite every scoped read filtering on it, **7 in-use collections have no indexes at all** (including `conversations`, `chatMessages`, `uploadedFiles`), and index creation is a manual `npm run ensure-indexes` step, not run automatically on boot.

### 3.3 Authentication

Better Auth (`src/lib/auth.ts`) handles authentication only — session, email/password, OAuth token exchange. **Role and org membership deliberately do NOT come from Better Auth**; they're resolved from the `employees` directory on every request (`getUser()`), with the code comment explicit that this is intentional: "auth ≠ authorization." This is one of the cleanest separations of concern in the codebase.

The corollary, stated plainly: **there is no invite gate.** Sign-up is open (`emailAndPassword: { enabled: true }`, a live sign-up page), and any successfully-registered account is JIT-provisioned into `org "default"` with role `sales_rep` — real CRM read/write access — with zero admin action required. There is also no `middleware.ts` anywhere in the app; page-level protection is per-server-component `requireUser()` calls, which is convention-enforced, not framework-enforced.

A real production incident and its fix are worth recording here because they explain a currently-live piece of config: sign-in on the deployed domain (`admin.svayantra.tech`) failed with "Invalid origin" because Better Auth only trusts `BETTER_AUTH_URL` by default, and that env var was still `localhost:3000` in the deployment. The fix (a `TRUSTED_ORIGINS` comma-separated env var, `src/lib/auth.ts:28`) works and is deployed, but **it is undocumented** — absent from `.env.example` and every knowledge-base doc — so it will silently regress on the next fresh deployment unless someone remembers.

### 3.4 Multi-tenancy and demo/production isolation

Every content collection is scoped by `orgId`, and 14 of them additionally carry a `workspace: "demo" | "production"` tag so a team can dogfood on synthetic data without polluting real records, and flip modes without losing structural data (identity, roles, org units stay shared). This is a genuinely well-reasoned design (ADR-022 explicitly rejected the naive alternative — a separate `orgId` per mode — because it would break the acting user's own membership resolution).

Two structural weaknesses: (1) `activeWorkspace()` **hardcodes `ORG = "default"`** — despite `orgId` being threaded through every service call, actual multi-tenancy currently supports exactly one tenant; and (2) the mode switch itself has a real bug — `PATCH /api/admin/settings` accepts unvalidated JSON and does a full-subdocument replace of the settings blob, so a partial update can silently revert `mode` back to its `"demo"` default, and a `super_admin` (who lacks the owner-only `/api/admin/mode` permission) can flip it anyway through this side door.

### 3.5 Permissions (RBAC)

Covered in depth in Section 6 (which is shared between "Architecture" and "AI" because the same engine gates both). Summary: one centralized engine (`src/lib/iam/`), 41 dotted permissions, 14 system roles, custom roles + per-user overrides, and a legacy colon-string shim (`lead:create` → `crm.write`) that bridges old call sites into the same engine and fails closed on anything unmapped. **This part of the architecture is genuinely solid** — with one serious, live escalation bug documented in Section 9.

### 3.6 Knowledge / RAG infrastructure

GridFS (raw file bytes) → async extraction (PDF/DOCX/XLSX/CSV/text, pluggable registry) → chunking (1200 chars, 150 overlap) → embeddings (Voyage AI, with a hashed-bag-of-words fallback if unconfigured) → Qdrant (payload-partitioned, RBAC-filtered *inside* the vector query) → retrieval. Full detail and honest failure-mode analysis in Section 6.4.

### 3.7 Conversation & AI orchestration layer

A hand-rolled tool-use loop over the Claude Messages API (not the SDK's tool runner), 8-iteration cap, sequential tool execution, live business-context injection per turn. Full detail in Section 6.

### 3.8 Audit and telemetry

Every mutating service call is expected to call `audit.record()` — verified across 19+ distinct services, with genuine human-vs-AI attribution (`actorId` prefixed `ai:` when a tool executed the write). The read side is far behind the write side: the only queryable surface is a raw 100–500-row table with no filter, search, or export, and "immutable audit trail" is a code comment, not an enforced database property (plain `insertOne`, no WORM, no hash chain, no TTL).

---

## 4. Complete Feature Inventory

Organized by area. **Maturity key: 🟢 solid · 🟡 partial · 🔴 fragile/stub.** Detail (architecture, UI, limitations) for each is in Sections 5, 6, and 8 — this table is the map.

| Feature | Area | Maturity | One-line status |
|---|---|---|---|
| Leads/Deals + conveyor-belt stage engine | Sales | 🟢 | Richest, best-audited object; a few ownership-check gaps on delete/reassign |
| Bulk CSV/Excel lead import w/ AI column mapping | Sales | 🟢 | Real end-to-end feature, safe (model can't hallucinate a column) |
| Companies | Sales | 🟡 | Great read/detail page; **no UI to create or edit one** |
| Contacts (CRM people) | Sales | 🔴 | Full CRUD API, indexed, **zero UI, zero AI reach** |
| Tasks (list/board/calendar/workload views) | Work | 🟢 | Deepest collaboration features of any object; one duplicate-calendar-event bug |
| Meetings | Work | 🟡 | Google Calendar sync works; **no ownership check, no dedicated page** |
| Proposals + AI drafting | Sales | 🟡 | Drafting and approval status machine work; **"sent" sends no email** |
| Quotations | Finance | 🟡 | Deterministic money math is correct; **no UI at all** |
| Approval workflow engine | Platform | 🔴 | The engine itself is real and general; **the one example workflow it's meant to run isn't seeded anywhere in the repo** |
| Conveyor teams + playbooks | Sales Ops | 🟡 | Assignment/SLA/analytics work; per-stage owner rotation and playbook editing are unimplemented |
| Calendar page (agenda view) | Personal productivity | 🟢 | New, small, honest scope — "my calendar" only, no team view |
| Google Calendar integration | Integrations | 🟢 | The **only** fully implemented connector of 10 in the registry; 9 others are literal "Coming soon" |
| AI Assistant (chat) | AI | 🟡 | Real tool execution; **no conversation history is ever sent to the model** |
| AI tool catalog (25 tools) | AI | 🟡 | Broad coverage; only 1 tool requires human approval despite the stated v1 policy |
| Knowledge base / document RAG | AI | 🟡 | Real pipeline; **fails silently to "ready, 0 chunks" if Qdrant isn't configured** |
| Knowledge Ask (grounded Q&A with citations) | AI | 🟢 | The one place real, clickable citations exist |
| Employee directory + self-service profile | Org | 🟢 | Best-built subsystem in the org/admin layer |
| Protected-owner guard | Security | 🟡 | Correct where it's checked; single call site, config-dependent, has a sibling function with zero protection |
| Org unit tree (departments/teams/etc.) | Org | 🟢 | Real cycle/orphan guards; no read-only view for non-admins |
| Custom roles + per-user permission overrides | Security | 🔴 | Complete backend, **create-only UI, no delete, can't even be assigned through the UI** |
| Custom objects platform | Platform | 🟡 | Works as thin generic CRUD; **not searchable, not AI-reachable, field types stored but never enforced** |
| Policies | Platform | 🔴 | Pure write-only CRUD; **nothing anywhere reads a policy to make a decision** |
| Audit log + Organization Timeline | Compliance | 🟡 | Write side is trustworthy; read side is a 100-row debug table |
| Global search (⌘K) | Navigation | 🔴 | 3 of 4 data types are fetch-then-filter-in-Node against a 200-doc cap; sequential, not parallel |
| AI usage / cost tracking | Ops | 🟡 | Real per-employee aggregation; **covers only 2 of 11 actual Claude call sites** |
| Command Center (executive rollup) | Exec | 🟢 | Genuine cross-service aggregation, no new data invented |
| Design system (`components/ds/*`) | Frontend | 🟢 | The library itself is excellent; adoption across pages is the gap (Section 7) |
| Admin → Security page | Admin | 🔴 | Password policy displayed is **hardcoded text, not real config**; sessions/2FA are literal "coming soon" |
| Connectors framework (registry pattern) | Platform | 🟢 | Clean interface; only one of ten descriptors has an implementation |

---

## 5. Object Model

### 5.1 Leads / Deals — the spine of the product

**There is no separate `deals` collection — a `Lead` is the deal.** One document (`src/lib/types.ts:82-121`, ~30 fields) carries source attribution, conveyor execution state, pipeline stage, money, and an "intelligence" block (AI-computed score, health, probability, pain points, competitors, buying committee).

- **Stage engine:** a hardcoded, one-directional transition map (`new→qualified→meeting→proposal→negotiation→won/lost`), enforced server-side. The UI's stage `<select>` offers all 7 stages regardless of validity, so most out-of-order selections fail server-side and are silently swallowed by a `router.refresh()`.
- **Ownership model (`assertCanModify`):** managers (owner, or holders of `sales.assign`/`crm.delete`) can touch any lead; conveyor-model leads are writable by any team member; individual-model leads only by their owner. This check is applied to `update` and `advance` — **but not to `remove` or `reassign`**, which is a real gap: a `crm.delete` holder can delete a lead outside their team, and `reassign` (documented as "a manager action") is actually gated on plain `crm.write`.
- **Read-side has no row-level security at all.** `list`/`get`/`search` are org-wide and unfiltered by ownership — every role holding `crm.read` (which is most of them, including `viewer` and `finance_exec`) can read every lead in the org by ID or listing. The write-side ownership model has no read-side counterpart.
- **Bulk import** (new): CSV/XLSX upload → Claude one-shot column-mapping (validated so the model can never invent a column name that doesn't exist) → rep confirms/corrects the mapping → sequential, per-row-error-tolerant lead creation. This is a genuinely solid, safe feature.

### 5.2 Companies

Full CRUD service exists; the detail page (Context/Work/Knowledge/Insights) is one of the most complete `ObjectPage` instantiations in the app. **There is no UI to create or edit a company** — only the API, the AI, or seed scripts can. No permission or ownership check exists in the service at all; gating is route-level only.

### 5.3 Contacts

Full CRUD API, properly indexed — and functionally invisible. No page renders a contact as its own object; contacts surface only as read-only sub-lists inside the Company and Lead pages. No AI tool touches contacts. This is the clearest example in the codebase of infrastructure built ahead of the UI/AI surface that would make it matter.

### 5.4 Tasks

The deepest collaboration object: comments, followers, `dependsOn` (stored, never enforced), recurrence (real — completing a recurring task spawns the next occurrence), four view modes (List/Board/Calendar/Workload), and a genuinely complete object-level access check (`assertTaskAccess`: owner, assignee, creator, or the assignee's direct manager) applied consistently across all five mutating/reading paths. Newly wired: Google Calendar sync on create/update/delete, targeting the *assignee's* calendar (not the creator's) — correctly handles reassignment (moves the event), completion (removes it), and due-date changes. One known bug: a separate legacy "sync tasks to calendar" button creates a second, un-deduplicated calendar event alongside the automatic one.

### 5.5 Meetings

A single-instant object (no duration field — a fixed 30-minute block is assumed for calendar purposes). Google Calendar sync works the same way as tasks'. **No ownership check exists in the service at all** — anyone with `calendar.write` can edit or delete any meeting in the org. No dedicated meetings page exists; meetings render only as read-only timeline items on other objects' pages.

### 5.6 Proposals

A real status machine (`draft → approved → sent`) with AI-assisted drafting (Claude writes narrative sections around software-supplied numbers, explicitly instructed not to alter or invent the numbers). **The `pending_approval` status is declared and never reached by any code path** — the enum lies about the real state machine. **"Sent" sends nothing** — there is no email delivery; the status flips and nothing external happens. No dedicated UI exists; proposals appear only as a read-only list on the lead page.

### 5.7 Quotations + the approval workflow engine — two solid halves, disconnected

The money math (line items → subtotal → tax → total, all integer minor-unit arithmetic) is correct and deterministic. Separately, `src/lib/platform/workflow-engine.ts` is a genuinely general-purpose, metadata-driven approval state machine — not hardcoded to quotes at all, with real cycle/loop guards and a clean `pendingApprover`/`applyDecision` API.

**They are not connected.** `quotationService.approve()` never starts a workflow. The one example workflow the whole system is demonstrated with, `quote_approval`, **does not exist as a seeded definition anywhere in the repository** — the demo/simulation scripts call `workflowService.start("quote_approval", ...)` and one of them explicitly catches the resulting failure with a comment: `"approvals skipped (no quote_approval workflow def?)"`. The flagship approval demo depends on a definition someone has to POST by hand, and no UI exists to author one.

### 5.8 Conveyor teams + playbooks

The "conveyor belt" concept — a lead moves through a team's playbook-defined stages with per-stage SLA deadlines — is real for assignment, SLA stamping, and analytics (compliance %, average handoff time, bottleneck-stage detection). Two parts of the concept are stored but not implemented: per-stage owner *rotation* (a `PlaybookStage.ownerRole` field is declared and never read — the "current stage owner" is set once, at model-assignment time, and never actually rotates as the lead advances), and playbook editing (playbooks can be created and deleted, but not updated — a wrong SLA requires deleting and recreating the whole playbook).

### 5.9 Employees / org structure

The best-built subsystem outside core sales: a clean separation between authentication (Better Auth) and authorization (the `employees` directory), a working self-service profile (name/personal email/phone, structurally incapable of touching another user's record because it's always resolved by the caller's own `userId`), and a real org-unit tree with cycle and orphan guards on reparenting/deletion. A protected-owner guard exists specifically so no one — not even another owner — can modify the one designated master account except by signing in as it; it's honest about being config-dependent (a no-op if the `OWNER_EMAIL` env var isn't set) and single-purpose (it doesn't stop direct database access, and its sibling bootstrap function `setRole` has zero authorization checks of its own, safely unreachable today only because nothing HTTP-facing calls it).

### 5.10 Custom objects platform

A generic `ObjectDefinition` + `CustomRecord` platform exists so that, in principle, a new business object type is data, not code. In practice it is a thin, honest CRUD shell: field types are declared (text/number/date/select/reference) but never validated or enforced on write; a whole `RelationshipDef` type exists and is never read; custom records don't appear in global search; and there is no AI tool to create, read, or search a custom record (only to define its *schema*). The admin UI for authoring a definition is a textarea parsed as `key|Label|type` lines.

### 5.11 The relationship graph, honestly described

Company→Lead is a real foreign key *and* a parallel, unreliable free-text name match (both exist simultaneously). Lead→Task, Lead→Meeting, Company→Task (declared, never queried), Contact→Meeting (declared, never queried) are all direct FK relationships. Lead↔Contact has **no direct edge** — "stakeholders on a deal" is resolved transitively (lead→company→contacts) plus a free-text array field. `ObjectContext`, the shared "everything about this object" component, assembles uploads + conversations + activity timeline generically, but each page still fetches and filters its own tasks/meetings/proposals individually rather than through one relational assembler.

---

## 6. AI Architecture

### 6.1 The orchestrator — a hand-rolled tool loop, genuinely capable, with one major architectural gap

`src/ai/orchestrator.ts` is a manual tool-use loop over Claude's Messages API (not the SDK's built-in tool runner), capped at 8 iterations, tools executed **sequentially** within a turn. On every turn it builds a live "BUSINESS CONTEXT" block — pipeline stage histogram, open-task count, team roster, org units, Google Calendar connection status — and injects it into the system prompt.

**The single largest gap in the whole AI system: no persisted conversation history is ever sent back to the model.** Conversations are saved for the *human* (search, pin, archive all work), but each new turn starts the model with only the current message plus whatever live context gets rebuilt. Multi-turn coherence — "do the same thing for the other lead we discussed" — only works if that lead happens to be the currently pinned "ACTIVE OBJECT," which is a URL/intent mechanism, not memory.

A second concrete gap: the two ways users reach the assistant use **different permission gates**. The streaming route the actual chat UI uses only calls `requireUser()`; a separate, non-UI-used route calls `assertCan(user, "ai:chat")`. Since `ai.use` is a baseline permission held by every single role, this is low-severity in practice, but it means the documented AI permission gate is not actually enforced on the path real users take.

### 6.2 The tool catalog — 25 tools, real execution, thin approval gate

Every tool asserts a permission or delegates to a service that does — with nine mutating tools (org/employee/policy/object-definition edits, and the notable `assign_leads`) relying entirely on the service layer's check rather than asserting anything themselves. This isn't a hole (the services do check) but it does mean a permission denial surfaces to the model as a plain `{error: "..."}` string mid-conversation rather than as a clean failure — the AI can narrate around it or try something else instead of the user seeing an unambiguous "you can't do that."

**`advance_lead_stage` is the only tool of 25 that requires human approval** (`PendingApproval` is a one-member union). Everything else — creating leads, logging touches, creating tasks, creating meetings, drafting proposals, and **mass-reassigning every visible lead with `assign_leads`** (no cap, no filter, executes immediately) — runs the instant the model decides to call it.

### 6.3 Intent system and context resolution — the two mechanisms that make the assistant feel aware

**Intent** (`src/services/intent-service.ts`) is deliberately *not* AI — a pure, stateless URL codec. An Action Bar verb without its own screen becomes a link like `/assistant?intent=create_deal&otype=company&oid=...`, which the assistant page parses to pre-title and pre-scope a new conversation, and auto-sends (or pre-fills, for fill-in-the-blank instructions).

**Context resolution** for *documents* (`context-resolver-service.ts`) is the most carefully engineered file in the AI subsystem: when a file is attached in chat, its extracted text is injected into the prompt *regardless of whether background embedding has finished or even succeeded* — because the text is available earlier in the pipeline than the vector index is, and every failure mode (still-processing, failed-extraction, budget-exceeded) gets a specific, carefully worded instruction so the model never tells a user to re-upload a file that actually uploaded fine.

### 6.4 Knowledge / RAG pipeline — real, but fails silently in two configurations

Upload → GridFS → async extract (PDF/DOCX/XLSX/CSV/text; **spreadsheets are flattened to comma-separated prose here, not structured rows** — a wall of text to the model, no cell addressing) → chunk (1200 chars, 150 overlap) → embed (Voyage AI) → Qdrant upsert (RBAC and org/workspace filters enforced *inside* the vector query, not just at the app layer) → retrieval.

Two silent degradation modes, both real and both currently live risks:
- **`QDRANT_URL` unset:** documents are marked **"ready" with 0 chunks** — the UI shows a green checkmark on a document that is permanently unsearchable, with no re-index job despite a code comment promising one.
- **`VOYAGE_API_KEY` unset:** retrieval falls back to a hashed bag-of-words embedding — cosine similarity measures literal token overlap, so a paraphrased question scores zero against a relevant document. This choice is made once at process start (module-level singleton) and never re-evaluated.

### 6.5 Citations — real in one place, decorative in another

The Knowledge Workbench's "Ask" feature produces real, numbered, clickable citations grounded in actual Qdrant hits, with a system prompt that insists every claim carry a `[1]`-style reference. The **main chat assistant does not** — a `Citation` schema is fully plumbed through the conversation model and never populated by any caller; "citing sources" in chat is a prompt instruction with no verification, and a small UI affordance ("ingested into Knowledge ✓") can never actually render because it checks a field that's only populated after the response it would appear in has already been sent.

### 6.6 Bulk lead import — the AI system's best-engineered safety property

Architecturally the inverse of the orchestrator: one Claude call, no tools, no system prompt, one JSON object out. The critical safety property: a column name the model returns is **only accepted if it's an exact match against the real spreadsheet headers** — the model cannot hallucinate a column into existence, and a parse failure falls back to a conservative "first column is the name, nothing else mapped" rather than guessing.

### 6.7 AI cost visibility — real, but covers a fifth of the surface

Per-employee token/cost tracking exists with a real aggregation and an owner-only admin page. It records from exactly **2 of roughly 11** distinct Claude call sites in the codebase (the two chat routes) — proposal drafting, executive briefings, lead-column-mapping, lead summarization, and Knowledge Ask are all untracked. The recorded cost constants are also currently priced against a promotional rate that will change.

---

## 7. Design System

### 7.1 The stated philosophy

`STOS_DESIGN_SYSTEM.md` explicitly frames itself as "a milestone, not a skin" and "the single source of truth," organized around the doctrine in Section 2.1/2.5, a hard token-purity rule (*"never use raw hex or `text-green-400`-style utilities"*), and a closing self-imposed test: **"crop any screen and it should still read as STOS."**

### 7.2 What's actually built, and how well it's adopted

The component library itself (`src/components/ds/*`, ~1,200 lines across 13 files) is **better engineered than it is adopted.** Every primitive file except the biggest one carries a doc comment citing the exact design-system section it implements — real traceability, not decoration. The token system (`tailwind.config.ts` + CSS variables) delivers a complete, working light/dark theme with zero raw hex codes anywhere in a `.tsx` file — genuinely exceeding what the design doc itself claims (light mode is documented as "pending"; it has, in fact, shipped).

Where it breaks down is adoption:
- **Only 3 of 28 top-level pages** use the canonical `ObjectPage` template (Lead, Company, Person). Ten pages are fully bespoke, hand-rolling their own header/layout — a direct violation of the system's own "never hand-roll a header" rule.
- **The Action Bar pattern — the mechanical realization of "what can I do?" — exists on exactly those same 3 pages.** Everywhere else, "where do I do X?" is answered however that page happened to invent, which is precisely the failure mode the design doctrine exists to prevent.
- **Four different stage-color-to-badge mappings exist simultaneously** (the canonical one in `ds/primitives.tsx` has only 2 consumers) — this is the literal "bespoke variant of an existing primitive" the design system calls a bug, and it exists inside the design system's own card component.
- **The typography scale is essentially unused in practice**: one of its six utility classes (`t-title`) has zero usages anywhere in the app; meanwhile 14 places hand-roll heading styles with raw Tailwind size classes, including inside the design system's own primitives.
- **The chart library implements roughly a third of its own spec** — one hue only, no mount animation, no categorical/sequential/diverging palettes, honestly self-documented in its own code comments as a deliberate initial scope-cut rather than an oversight.
- **The document's own color table is now factually wrong** relative to the shipped CSS variables (the brand gradient, the "action" color, and one text tone have all changed since the doc was last edited) — a small, telling piece of evidence that the doc-drift problem (Section 9) isn't unique to the top-level `PROJECT.md`/`ROADMAP.md`.

### 7.3 Navigation philosophy in practice

The stated intent — "founder-first, persona-aware IA... a handful of destinations, everything else reached through the Assistant" — holds up well: 3 unconditional nav items plus up to 6 permission-gated ones, all UX-only gating (every route separately enforces authorization server-side, so a hidden nav item is not a security boundary, correctly). `⌘K` is genuinely the primary interaction layer, not a decorative shortcut — it's the *only* navigation mechanism on mobile, a deliberate, honestly-documented product bet rather than an oversight.

---

## 8. Business Processes

### 8.1 Sales — outbound and inbound

A lead enters via one of 9 tracked sources (`apollo`, `linkedin`, `website`, `referral`, `email`, `whatsapp`, `conference`, `manual`, `other`), or via the AI (`viaAi: true`, distinctly audited), or via the bulk CSV/Excel importer. It's assigned an execution model — **individual** (one rep owns the full cycle) or **conveyor** (a team works it through playbook-defined stages with SLA deadlines) — and flows through the fixed 7-stage pipeline (`new → qualified → meeting → proposal → negotiation → won/lost`) with every transition audited and timestamped.

### 8.2 Meetings and tasks

Meetings and tasks are both first-class, both sync to the relevant person's Google Calendar (best-effort — a failed calendar sync never blocks the underlying save), and both feed the universal activity timeline. Tasks additionally support recurrence, comments, followers, and role/department-wide fan-out ("assign this to every sales rep").

### 8.3 Proposals, quotations, and approvals

A proposal is drafted (optionally with AI-written narrative around software-supplied numbers) and can be marked approved/sent — with the caveat that "sent" currently sends nothing externally. A quotation's money math is fully deterministic. The approval *workflow engine* underneath both is real and general-purpose, but as documented in Section 5.7, it is not currently wired to either object in a way that runs without a human manually posting a workflow definition first.

### 8.4 Knowledge

Any document — uploaded standalone or attached in a chat — is extracted, chunked, embedded, and made retrievable both by the AI (`search_company_knowledge`) and by a dedicated grounded Q&A surface with real citations. Documents can be linked to a specific company/deal/client so they show up on that object's page, not just in a generic library.

### 8.5 Organization

Departments/teams/business units form an arbitrary tree (9 supported unit types) with real cycle and orphan protection on restructuring. Roles are centrally defined and resolved once per request. Every structural change (unit created/moved/deleted, role granted, employee onboarded) is audited and feeds the Organization Timeline.

### 8.6 Execution models compared

| | Individual funnel | Conveyor belt |
|---|---|---|
| Who can touch it | The one assigned owner (+ managers) | Any member of the assigned team |
| Stage progression | Manual, by the owner | Same stage machine, but SLA-timed per playbook stage |
| Ownership on handoff | N/A — one owner throughout | *Intended* to rotate to a per-stage owner; **in the current code, it's stamped once and never rotates again** |
| Analytics | Standard pipeline metrics | Additional SLA compliance %, avg handoff time, bottleneck-stage detection |

### 8.7 AI-driven processes

"Plan my day" (a daily briefing tool), "reduce workload for X" (search their leads/tasks, then propose or execute reassignment), stale-lead and SLA-breach detection, and the executive Command Center's daily "8 executive questions" rollup are all real, working, data-derived features — not aspirational copy. The Command Center's own header comment is accurate: "pure aggregation over existing services, no new data."

---

## 9. Current Product Status

*Ratings below are qualitative, not a formal audit score, but every rating is backed by specific evidence cited in this document (mostly Sections 3, 5, 6, 7) rather than a general impression.*

| Area | Rating | Why |
|---|---|---|
| **Architecture** | Good, with real debt | Layering is consistently followed at the route level; the data-access abstraction is missing basic operations that forced a 23% bypass rate; two parallel permission-check idioms exist (bridged safely, but unfinished as a migration) |
| **Design** | Strong library, uneven adoption | The system itself is close to excellent; two-thirds of pages don't use it |
| **UX** | Good where the doctrine is applied, generic elsewhere | The 3 canonical object pages are the best UX in the product; 10 bespoke pages predate the doctrine entirely |
| **Reliability** | Mostly honest degradation, some silent failure | Most services `.catch(() => [])` gracefully; but RAG "fails green" (looks fine, does nothing) in two real configurations, and a settings-save bug can silently flip the whole app between demo and production data |
| **Performance** | Adequate at current scale, will not survive 10x | List queries cap at 200–500 rows in-memory rather than paginating server-side; global search does 3 of 4 lookups by fetching everything and filtering in Node; several dashboards independently re-scan the full lead collection |
| **Enterprise readiness** | Not close | No SSO, no admin-initiated password reset, no session management (literal "coming soon" stub), a password-policy display that doesn't correspond to any enforced policy |
| **Security** | Good core engine, one serious live bug | The permission engine itself is well-designed and consistently used at the route/page level; **a `roles.manage` holder can currently create a custom role granting `"*"` permissions and become owner-equivalent** — a real, working privilege escalation, not a theoretical one (Section 14 gives the exact chain) |
| **Scalability** | Single-tenant today despite multi-tenant intent | `orgId` is threaded everywhere, but workspace resolution hardcodes `"default"` — there is exactly one tenant in practice |
| **AI maturity** | Genuinely capable, one foundational gap | Real tool execution, real permission checks (mostly), real RAG — but no conversation memory across turns, and the "human approval for revenue writes" policy is true for exactly one tool out of 25 |
| **Code quality** | High, with visible fast-iteration scars | Services are consistently structured and well-commented; but duplicated badge/color/KPI components, two audit-log endpoints doing the identical thing, and dead schema fields (declared, stored, never read) are all present and identifiable |
| **Technical debt** | Substantial but mapped, not hidden | This document alone surfaces dozens of specific, cited items; the team's own `.claude/DECISIONS.md` shows a pattern of *fixing* debt when found (e.g., the attachment-context bug, the DOCX bundling bug) rather than accumulating it silently |
| **Dogfood readiness** | Was assessed once, honestly, and the assessment is now stale | `STOS_RC1_LAUNCH_READINESS.md` (2026-07-22) concluded "ready with caveats" for a 7-person internal team, contingent on 3 specific P0 items; whether those were actually done is unverified by this document |
| **Production readiness** | Not yet, by the product's own prior self-assessment | The most recent formal self-audit's own words: *"demo-ready and close to dogfood-ready, but not yet team-deployment-ready."* Nothing in this research pass found reason to revise that verdict upward — if anything, the newly-found permission escalation revises it downward |

---

## 10. Remaining Work

### P0 — must fix before any further real-user rollout

1. **Close the `roles.manage` → owner escalation.** `role-service.ts` explicitly whitelists `"*"` when validating a custom role's permission list; the resolution engine honors it; the authorization check treats anyone holding `"*"` as owner-equivalent. **Why this is P0:** it is not a theoretical gap — it is a complete, working chain from a permission any `admin` already holds to full owner access, with no UI exposing it only because the role-creation form's dropdown happens not to offer `*` (an accident of UI, not a security boundary). Fix: reject `"*"` in custom-role validation, and have the role-assignment guard inspect what a custom role key *resolves to*, not just its literal name.
2. **Decide the settings-save / demo-production isolation bug.** An unvalidated `PATCH /api/admin/settings` can silently revert the whole org from production data back to demo, and a `super_admin` can flip the mode through this path despite the mode switch being intended as owner-only. Add schema validation and make the mode field immutable through the general settings endpoint.
3. **Add real approval breadth or stop calling it a v1 policy.** Either extend human-approval-required to the other revenue-mutating tools (`create_lead`, `assign_leads` especially, given it has no reassignment cap) or update `CLAUDE.md`'s stated policy to match reality, so the next engineer doesn't build on a false assumption.
4. **Cap or gate `assign_leads`.** Currently a single AI tool call can reassign every lead a user can see, with no filter and no approval step.

### P1 — should fix soon, real user-facing pain

- No admin-initiated password reset path exists — a locked-out employee has no recovery mechanism today.
- RAG's silent-failure modes (Qdrant unconfigured → permanently unsearchable "ready" documents; Voyage unconfigured → degraded, never-rechecked embeddings) should fail loud or self-heal, not fail green.
- Global search's 3-of-4-sequential-in-memory-scan implementation will get slower, not more correct, as data grows — needs real database queries and, ideally, parallel execution.
- The AI-cost dashboard should track all ~11 Claude call sites, not 2, or the number it shows is misleading by omission.
- The duplicate-calendar-event bug (legacy manual task-sync button vs. automatic per-task sync) should be reconciled — pick one code path.
- `Companies` and `Contacts` need either real creation/edit UI or an honest decision that they're API/AI-only for now.

### P2 — real, but not urgent

- Custom-role and per-user-override UI is API-only; either build the missing screens or stop offering the backend as a "feature."
- The `quote_approval` workflow should either be seeded for real or the approval-engine demo should be described accurately as "the engine exists; nothing runs on it yet."
- Design-system adoption on the remaining ~10 bespoke pages.
- Reconcile `STOS_DESIGN_SYSTEM.md`'s color table and stale `§2.7` tab list with the shipped code.

### Long-term roadmap items (explicitly deferred by the team, not forgotten)

- Real email/LinkedIn/WhatsApp outbound sequences with reply tracking (needs provider webhooks).
- A true cross-entity knowledge graph (today's `entity_dossier` merges one lead's history; it doesn't traverse relationships).
- Finance and Operations executive dashboards (blocked on invoice/project objects that don't exist yet).
- A queue/worker for document ingestion if this ever needs to run on serverless infrastructure rather than a long-running Node process (the current fire-and-forget ingestion pattern assumes the latter).

---

## 11. Things We Intentionally Did NOT Build

Each of these was a recorded, deliberate decision (mostly from `.claude/DECISIONS.md`), not an oversight — worth stating plainly so nobody "discovers" the gap and assumes it's a bug.

- **AI Memory (cross-turn conversation history sent to the model).** Not an explicit ADR, but the shape of the current system (context re-derived fresh each turn from live data + a pinned "active object") is a real, if implicit, choice against a naive full-history-replay design. *When to revisit:* as soon as multi-turn tasks that reference earlier, non-pinned context become common in real usage — right now it's a known gap, not yet confirmed as a felt one.
- **General-purpose AI Agents / autonomous long-running jobs.** ADR-027 explicitly scoped the "full AI workspace" (agents, background research, long-running jobs) as out of scope for the design-system migration and future feature work, not a rejected idea.
- **A stateful, server-side Intent engine.** ADR-039 explicitly chose a pure, stateless URL codec instead, calling a stateful version "the architecture bloat we agreed to stop at." Revisit only if intents need to survive across sessions or devices, which they currently don't need to.
- **Automation Builder (user-authored triggers/workflows).** The workflow *engine* exists and is general; a UI for a non-engineer to author one doesn't. This is a scope decision, not a technical blocker — building the authoring UI is the next logical step whenever a second real workflow (beyond the unseeded quote-approval example) is needed.
- **Predictive analytics / forecasting beyond simple stage-weighted pipeline value.** No ML model, no time-series forecasting exists; `forecast.weightedPipelineMinor` is a hardcoded stage-probability heuristic, not a learned one.
- **External integrations beyond Google Calendar.** Nine of ten connector registry entries are placeholders. ADR-016 designed the registry specifically so each is "a registry entry + provider implementation, no core changes" when the time comes — the extensibility is real even though the connectors aren't.
- **Notion as the knowledge layer.** The original product brief specified Notion for knowledge; ADR-005 deliberately made it "a future connector" and built the real knowledge layer (GridFS + Qdrant + Voyage) internally instead, specifically so the AI never depends on a connector that might be down or unconfigured.
- **Real email delivery for proposals/invitations.** Resend is in the tech-stack table and unused in both cases — proposal "send" and employee invitations both currently stop at "here's a temp password / status flag," deferred pending Resend wiring.
- **Enterprise table-stakes: SSO, notifications inbox, bulk actions, saved views, data export.** Explicitly flagged by a prior internal audit as "roadmap, not RC blockers" — known gaps for a future enterprise push, not missed requirements for internal use.

---

## 12. Product Roadmap

*As documented by the team, with staleness flagged where the document and the shipped code have visibly diverged.*

### What's shipped (verified by this research pass, not just claimed)

Forty-three recorded architectural decisions span: the initial stack freeze; a centralized IAM engine; a metadata-driven org/object/workflow/policy platform; a founder-first AI-primary UX redesign (the RevenueOS → STOS rename); nine consolidation sprints (org engine, lead intelligence, outbound CRM fields, AI assistant v2, task engine, knowledge graph, integrations layer, executive dashboards, final validation); a Work Execution Engine (conveyor belt, playbooks, SLA); demo/production data isolation; a full Design System v2 (tokens, primitives, showcase, dark+light theming); and an RC-1 hardening track (canonical object templates, universal timeline, attachment-context bug fixes, the Context/Action-Bar interaction doctrine, markdown rendering, decision-chart honesty rules).

### What the team's own roadmap doc says (⚠️ stale)

`.claude/ROADMAP.md` still describes an M0–M9 milestone scheme frozen at "M1 walking skeleton, in progress, pending run against real creds and Vercel deploy" — a description that predates essentially all forty-three of the decisions above. It is explicitly self-labeled inside the file as "a placeholder skeleton to be replaced... from blueprint Part 8" — and that blueprint (`../REVENUEOS_BLUEPRINT.md`) **has never been generated.** This document (the Product Bible you're reading) is the closest thing to that missing source-of-truth document that currently exists.

### The actually-followed sequencing (reconstructed from `.claude/DECISIONS.md`)

RC-1 freeze → one week of founder-only dogfooding with a friction log (the log file itself, `docs/friction-log.md`, does not exist in the repo — whether it was kept elsewhere is unverified) → fix only what real usage + review surfaced → tag an internal release → *then* new capability work (agents, real email, deeper orchestration) on a stable base. The team-wide dogfooding gate (`STOS_RC1_LAUNCH_READINESS.md`) named three specific pre-conditions — switch out of Demo mode, decide a password-reset mechanism, and fix a sales-rep permission gap on task/lead reassignment — and whether all three were actually done is not something this document can verify without live access to current deployment state.

### Long-term: ABOS

RevenueOS/STOS remains, by every source document, explicitly "the first module" of a larger ABOS vision. No second module, and no code generalizing this platform beyond sales/revenue operations, exists yet in this repository.

---

## 13. Engineering Principles

Documented rules, each with the reasoning behind it, drawn from `.claude/CLAUDE.md`, `.claude/patterns/*`, and `.claude/playbooks/*`:

- **Reuse before rewrite.** "Check `skills/`, `playbooks/`, `patterns/` for an existing guide before starting" — the explicit goal is that Claude (or any engineer) spends *less* effort re-deriving context over time, not more.
- **Services before pages; route handlers stay thin.** Business logic lives in `src/services/*`; a route handler parses, checks auth, delegates, shapes the response — nothing else. Verified as genuinely followed: zero route handlers query MongoDB directly.
- **Object-first, not feature-first.** Design and data model both organize around "things" (leads, companies, people) rather than screens — see Section 2.2 and Section 7.
- **No duplicated UI ("this catalogue is law").** A second implementation of an existing primitive is explicitly a bug, not a style choice — even though, as Section 7 documents, this rule is violated in several concrete places today.
- **No speculative engineering — "the simplest design that survives the next 2 milestones, not the enterprise version."** This is why, for example, ADR-003 initially deferred Qdrant entirely in favor of a simpler vector approach, only reintroducing it (ADR-005) once a concrete need existed — though note the earlier decision was never formally superseded in writing, which is itself a small process gap.
- **Feature Freeze during hardening passes.** Multiple ADRs (RC-1 Sprint entries, the two production-readiness audits) explicitly state "feature freeze in effect" while stabilization work happens — new capability work waits.
- **Everything AI touches must respect permissions.** The stated rule; Section 6 documents where this is thoroughly true (most tools) and where it's thinner than stated (the human-approval policy, specifically).
- **Every action should emit a timeline event.** Verified: audit calls exist across 19+ services; ADR-034 exists specifically because this wasn't true everywhere at first and got fixed.
- **Everything should be contextual.** The Context-tab/Action-Bar/Intent trio (Sections 2 and 6) is the concrete mechanism; the principle predates and motivates all three.
- **Don't invent numbers.** A specific, narrow, well-enforced rule: no fabricated percentage deltas, no fabricated confidence scores — if there's no real prior data point, show the bare number. Verified as consistently followed everywhere metrics render.
- **Never blame a missing parser for a corrupt file, and never tell a user to re-upload something that actually succeeded.** A narrow but carefully-engineered rule (`classifyFailure()` in the extraction pipeline, and the AI's document-context instructions) born directly from a specific dogfooding bug (ADR-040/041) and kept as a standing principle afterward.
- **A v2/redesign change is only justified by a logged friction point or an already-agreed model change — no speculative features.** Stated explicitly in `STOS_V2_DESIGN.md` as "the non-negotiable."

---

## 14. Product Critique

*Written as an outside reviewer would write it — a YC-partner-style pass, not a pep talk.*

**What feels unfinished.** Roughly a third of the object model (Contacts, Quotations, Policies, custom-object records) has a complete backend and no way for a human to actually use it day-to-day. That's not a small gap — it means a meaningful fraction of the "OS" framing is currently API surface area with no product behind it yet. A new user exploring the admin section will find several screens that are honest "Coming soon" stubs (Active Sessions, 2FA, nine of ten connectors) sitting right next to fully-functional ones, with no visual distinction between "not built" and "built but you lack permission" — that's a confidence problem as much as a features problem.

**What feels confusing.** The product has, at minimum, two different definitions of "sent" (a proposal that's "sent" delivers nothing), two different places a lead's company can be recorded (a real foreign key and a parallel free-text field, simultaneously, with no reconciliation), and — most confusingly for anyone reading the codebase to understand the product — a top-level `PROJECT.md` that describes a different, much earlier product than the one that exists. Anyone new joining this project and reading the "source of truth" doc first would form a badly wrong mental model before writing a single line of code.

**Where users will hesitate.** The moment someone tries to use a feature whose backend exists but whose UI doesn't (assign a custom role, edit a per-user override, author a workflow definition, edit a playbook's SLA), they will hit a wall with no error message explaining *why* — because from the UI's perspective, the option was simply never offered. That's a worse experience than a clear "not yet supported" message, because it looks like something is missing rather than something being deliberately withheld.

**Where the architecture is over-engineered relative to what's used.** The generic custom-object platform (`ObjectDefinition`/`CustomRecord`) is real infrastructure for a capability — "define any business object without engineering" — that, as of this audit, has exactly zero real custom object types in active use beyond the demo/seed data, isn't searchable, and isn't AI-reachable. That's a lot of general-purpose machinery ahead of a proven need for it. Contrast this with `RelationshipDef` (a whole type for object-to-object relationships) and `WorkflowNode.mode: "parallel"` / `escalateToRole` / `timeoutHours` — all declared, all typed, all completely unread by any code. This is the software equivalent of building a highway interchange before there's a road on either side.

**Where it's under-engineered.** The opposite problem exists just as clearly: read-side permission checks on Leads (anyone with `crm.read` — most roles — can read any lead by ID, no ownership check at all), the settings-mode-flip bug, and the `"*"` custom-role escalation are all places where the *effort* clearly went into the write path and the read/edge-case path was left thinner than the product's own stated security bar implies. A system whose permission engine is this well-designed at the core has no excuse for a whitelisted `"*"` slipping through role validation.

**What should be simplified.** Four separate stage-color mappings for the same seven lead stages is not a feature, it's drift, and it will keep drifting every time someone adds an eighth stage and updates three of the four maps. The two audit-log API endpoints that do the literally identical thing should be one endpoint. The `pending_approval` status that no code path ever reaches on Proposals and Quotations should either be wired up or removed — a lying enum is worse than a missing feature, because it actively misleads the next person who reads the type.

**What should be removed.** The dead `policy-engine.ts` evaluation code was already removed at some point between the last audit and this one — a good sign the team does clean up when they notice. The same treatment should apply to: `Task.dependsOn` (stored, never enforced — either enforce it or remove the field), `PlaybookStage.ownerRole` (declared, never read), and the several other "declared and dead" fields catalogued in Sections 5, 9, and 10. None of these are harmful today, but each one is a small tax on every future engineer who has to figure out whether it matters.

**What should never change.** The auth/authorization separation (Better Auth authenticates; the `employees` directory authorizes) is exactly right and should be defended against any future "just add a role field to the user model" shortcut. The centralized permission engine with a fail-closed legacy bridge is a genuinely good piece of architecture. The "never fabricate a metric delta" rule is a real trust-building discipline and should survive contact with any future pressure to make a dashboard look more impressive. And the underlying bet of the whole product — that most operational overhead in a small company is AI-orchestratable if the underlying actions are deterministic, permissioned, and audited — is sound; nothing in this research pass found reason to doubt the premise, only the current completeness of its execution.

---

## 15. Executive Summary

**What is STOS today?** A working, seriously-built AI-native sales operating system with a genuinely good permission architecture, a genuinely good design system (where it's been applied), a real and mostly-safe AI tool layer, and a lead/deal object model that is the clear center of gravity and the most mature part of the product. It is also a product whose own top-level documentation describes an earlier, much smaller version of itself, and whose most recent honest internal self-assessment called it "demo-ready and close to dogfood-ready, but not yet team-deployment-ready" — a verdict this research found no reason to revise upward.

**What has been accomplished?** Forty-three recorded architectural decisions' worth of real engineering: a centralized IAM system; a working conversation/RAG/Google-Calendar-integrated AI assistant with a real tool-execution layer; a conveyor-belt sales workflow engine with SLA enforcement; a demo/production data-isolation scheme; a full two-theme design system with genuine token discipline; and — measured directly in this pass — a codebase where 89 of 90 API routes, 88 of 90 with an auth check, and 11 of 11 admin pages follow their own stated conventions. That is not a prototype; it is a real system with real users' worth of surface area.

**How mature is it?** Uneven, in a specific and mappable way: the write paths for the core sales objects (leads, tasks) are mature; the read-side security and several adjacent objects (companies, contacts, quotations, custom objects) trail noticeably behind; and a handful of platform-level capabilities (workflow authoring, policy enforcement, custom-role management) have complete backends and no usable front door yet.

**Can a real company operate on it today?** A small team could operate the core sales/task/meeting/calendar loop today, and by the product's own most recent internal audit, did successfully complete a founder-dogfooding pass. A company relying on it for approvals, quotations, proposal delivery, or anything touching the custom-object platform would find those specific paths incomplete. And **no company should run this in its current state with more than one trusted administrator**, because of the live `"*"`-permission escalation documented in Sections 9, 10, and 14 — that is a fix-first item, not a roadmap item.

**What should happen next?** In order: (1) close the permission-escalation bug and the settings-mode-flip bug — both are P0 and both are small, contained fixes, not redesigns; (2) decide, explicitly and in writing, whether "human approval for revenue-data AI writes" is still the intended v1 policy, because the code and the stated policy currently disagree and someone should choose which one is right; (3) either finish or explicitly shelve the platform-level features with no UI (custom roles, workflow authoring, policies) rather than leaving them in the current ambiguous half-built state; (4) update `.claude/PROJECT.md` and `.claude/ROADMAP.md` to describe the product that exists, so the next person — human or AI — doesn't start from a forty-three-decisions-old mental model the way this research pass had to correct for on page one.
