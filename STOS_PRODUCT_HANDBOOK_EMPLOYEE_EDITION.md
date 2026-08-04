# The STOS Product Handbook — Employee Edition

**What STOS actually is, how it actually works, and how to think about using it.**

*Compiled 2026-08-04 by direct inspection of the codebase — not from memory, not from prior docs taken on faith. This is an honest account, including where a feature is newer or less polished than others; it is written for the team using the product, not for the engineers building it, so internal security review details and forward-looking engineering task lists have been left out of this edition.*

> **Read this first if you read nothing else:** STOS is a real, working, seriously-built system — not a prototype. Some parts of it (leads, tasks, the AI assistant, Google Calendar sync) are mature and used daily. Other parts (Contacts, Quotations, custom objects) have real functionality under the hood but no finished screen yet — so if something looks like it's missing, it may genuinely not be built yet rather than something you're doing wrong.

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
9. [Things We Intentionally Did NOT Build](#9-things-we-intentionally-did-not-build)
10. [Product Roadmap](#10-product-roadmap)
11. [Engineering Principles](#11-engineering-principles)
12. [Executive Summary](#12-executive-summary)

---

## 1. Product Vision

### What STOS is

**STOS (Svayantra Tech Operating System, née "RevenueOS")** is an AI-native operating system for sales organizations, and the first module of Svayantra Tech's long-term **ABOS (Autonomous Business Operating System)** vision. The one-line thesis:

> "Traditional CRMs help humans manage work. RevenueOS lets **AI orchestrate the work** while **humans make high-value decisions** and **deterministic software executes**."

Concretely: you are not supposed to learn a complex piece of software with elaborate menus and forms. You are supposed to ask an AI Chief of Staff — "What should I work on?", "Generate a proposal", "Show pipeline health", "Prepare me for today's meeting" — and have real, permission-checked, logged actions happen. The UI exists for the cases where a conversation is the wrong tool (a spreadsheet-like grid, a calendar, a KPI dashboard), not as the primary way to use the product.

### The problem it solves

Small, founder-led teams drown in operational overhead: leads go stale because nobody remembers to follow up, tasks get created but not actioned, proposals take an afternoon to draft, and the founder ends up personally being the routing layer for "who should do this." STOS's bet is that most of that routing, drafting, and follow-up work is something an AI can handle on top of deterministic, permissioned, logged services — freeing you to make the decisions that actually need a human.

### What makes it different from a CRM / ERP / PM tool / Notion / Slack

- **It is not a system of record you fill in.** Every object answers "what is happening?" (its Context tab) and "what can I do?" (its Action Bar) — not "here is a table of fields to edit."
- **The AI executes, it doesn't just chat.** Asking the assistant to create a lead, log a task, or schedule a meeting actually does those things — the same way clicking a button in the UI would, with the same permission checks and the same record kept of who did what.
- **Permissions are centralized**, so what you can see and do is consistent everywhere in the product, not decided feature-by-feature.

### Long-term vision: ABOS

STOS/RevenueOS is explicitly "the first module" of a longer-term vision: an Autonomous Business Operating System whose aim is to reduce how much of running a company has to live in one founder's head. Sales and revenue operations are the first function this gets built for; other business functions are expected to follow the same pattern later.

---

## 2. Product Philosophy

### 2.1 — "The two questions"

> "*What is happening?*" → the **Context** tab. "*What can I do?*" → the **Action Bar."

Every object — a lead, a company, a person — is meant to default to a Context view (not an "Overview") and expose one primary action, a few secondary actions, an overflow menu, and an always-present "Ask AI." The design rule behind this: **if you have to ask "where do I do X?", something's wrong.** This pattern is fully built and works well on the Lead, Company, and Person pages today; other pages are still catching up to this layout (see Section 7).

### 2.2 — Object-first, not feature-first

The product is organized around the *things* in your business (a lead, a company, a person) rather than a menu of features — the goal being that you navigate to "MoneyPal" (the company), not to "the companies feature."

### 2.3 — AI as execution layer, not chat

STOS deliberately keeps a separation between the AI (which decides what to do and drafts things) and a deterministic workflow engine (which enforces rules like valid stage transitions) — the philosophy being "never use AI where deterministic software already does the job better." One practical thing worth knowing: today, only advancing a lead's stage requires a click of human approval before it takes effect; other assistant actions (creating a task, logging a touch, drafting a proposal) execute right away when you ask for them.

### 2.4 — Invisible AI / "never ask what it already knows"

The assistant is handed a live snapshot of your team, your pipeline, and your open tasks on every message specifically so it doesn't ask you things it should already know — if you mention a teammate by first name, it's expected to match them against the real roster rather than asking "who's that?"

### 2.5 — What / Why / Next (the dashboard doctrine)

Dashboards are built in a fixed order: **Metrics** (what's happening right now — and never a made-up trend arrow; if there's no real prior data point, it shows the plain number instead of guessing), **Charts** (why it's happening — a page only gets a chart if it answers a real question), then **AI** (what to do next). The intent, in the team's own words: "this is an operating system, not a BI tool" — not a wall of forty-seven metrics.

### 2.6 — Every object is a living entity with a timeline

Every lead, task, and meeting keeps a real, append-only activity history — not just its current state. That's what lets the AI (or a teammate) reconstruct "what happened with this deal" instead of only seeing where it stands right now.

### 2.7 — Every business operation should become contextual

When you click an action that doesn't have its own screen yet, it opens the assistant already knowing what you were doing and on what object — you shouldn't have to re-explain yourself.

### 2.8 — Consistency as a rule, not a suggestion

The design system's own stated rule: "a bespoke variant of an existing pattern is a bug." The intent is that any screen in STOS should feel unmistakably like the same product — Section 7 covers how consistently that's actually landed so far.

---

## 3. Architecture

*(A brief, non-technical pass — this section exists so you understand the shape of the system, not to teach you to build it.)*

### 3.1 How a request flows

Every action — clicking a button, sending an assistant message — flows the same way: the page or the AI tool calls a well-defined internal service, which checks your permissions, does the actual work, and records what happened. This consistency is why the same rules apply whether you're using the UI or asking the assistant to do something for you.

### 3.2 Where your data lives

All operational data (leads, tasks, companies, meetings, and so on) lives in one MongoDB database, organized so that "demo" data (used for training/dogfooding) and real production data are kept separate — you can switch between them without losing your team structure or logins.

### 3.3 Signing in

Authentication (who you are) and authorization (what you're allowed to do) are handled by two different systems that talk to each other: your login is Better Auth; your role and permissions come from the employee directory, resolved fresh on every request — so a role change takes effect immediately on your next action, no need to log out and back in.

### 3.4 Multiple environments

STOS supports a demo/production split so the team can safely try things (or onboard someone) without touching real customer data, and switch back once ready.

### 3.5 Permissions

Covered in Section 6. In short: one central system decides what every role and every person can see and do, consistently, across the UI, the API, and the AI assistant.

### 3.6 Knowledge search

Documents you upload — whether standalone or attached in a chat — are processed in the background so they become searchable and so the AI can answer questions grounded in them, with source citations available in the dedicated Knowledge Q&A screen.

### 3.7 The AI assistant, technically

The assistant is a genuine tool-using AI: when you ask it to do something, it can call the same real actions the UI can (create a task, schedule a meeting, look up a lead), not just describe what it would do.

### 3.8 A record of everything

Every meaningful action — by a person or by the AI on someone's behalf — is logged with who did it and when, including a clear distinction between actions a human took and actions the AI took automatically.

---

## 4. Complete Feature Inventory

**Maturity key: 🟢 ready to use daily · 🟡 works, but has real limitations · 🔴 early / API-and-AI-only, no finished screen yet.**

| Feature | Area | Maturity | What to know |
|---|---|---|---|
| Leads/Deals + conveyor-belt stage engine | Sales | 🟢 | The most complete part of the product — use this as your main working surface |
| Bulk CSV/Excel lead import w/ AI column mapping | Sales | 🟢 | Upload a spreadsheet of leads; the AI figures out which column is which — safe, it won't invent a column that isn't there |
| Companies | Sales | 🟡 | Great to view; **new companies currently need to come in via a lead or the AI**, not a "new company" button |
| Contacts (people at a company) | Sales | 🔴 | Exists in the system, shows up on Company pages, but has no page of its own yet |
| Tasks (list/board/calendar/workload views) | Work | 🟢 | The richest collaboration object — comments, followers, recurrence, and it syncs to Google Calendar |
| Meetings | Work | 🟡 | Syncs to Google Calendar; no dedicated meetings page yet — you'll see them on the related lead/company |
| Proposals + AI drafting | Sales | 🟡 | The AI can draft real proposal sections around your numbers; **"send" currently doesn't email it out** — you'll need to deliver it yourself |
| Quotations | Finance | 🟡 | The math (subtotal/tax/total) is solid and precise; there's no screen for this yet |
| Approval workflows | Platform | 🔴 | The underlying engine works, but the sample approval flow isn't set up out of the box — ask an admin if you expect to see approval requests |
| Conveyor teams + playbooks | Sales Ops | 🟡 | Team-based lead assignment with SLA deadlines works well; editing a playbook's SLA after the fact currently means recreating it |
| Calendar page | Personal productivity | 🟢 | Your meetings, your tasks with due dates, and (once connected) your real Google Calendar, in one agenda view |
| Google Calendar integration | Integrations | 🟢 | The one fully working integration today — connect it from your Account page |
| AI Assistant (chat) | AI | 🟡 | Real, capable, and aware of your business context — just remember each new message doesn't automatically recall everything from earlier in a long conversation (see Section 6) |
| Knowledge base / document search | AI | 🟡 | Works well when properly configured; ask an admin if search results seem to be missing something you uploaded |
| Knowledge Ask (grounded Q&A with citations) | AI | 🟢 | The most trustworthy AI surface — every answer here links back to its source document |
| Employee directory + your profile | Org | 🟢 | Edit your own name, personal email, and phone from your Account page any time |
| Organization chart | Org | 🟢 | Departments/teams with real safeguards against, e.g., accidentally making a team its own parent |
| Custom roles + per-person permission tweaks | Security | 🔴 | Admin-only, and currently create-only — ask an admin if you need something custom |
| Custom objects | Platform | 🟡 | A flexible way to model something beyond leads/tasks; simple, but not yet searchable or AI-reachable |
| Global search (⌘K) | Navigation | 🟡 | Fast to open, useful for jumping around — may miss results in very large lists |
| AI usage tracking | Ops | 🟡 | Admins can see AI cost per person, covering the main chat usage today |
| Command Center | Exec | 🟢 | A real, live rollup of what's happening across the business — no invented numbers |
| Design system | Frontend | 🟢 | Most-used screens (Lead/Company/Person) are the most polished; a few admin screens are plainer |
| Connectors (Integrations page) | Platform | 🟢/🔴 | Google Calendar is real; the other listed integrations (Slack, Notion, Drive, etc.) are "coming soon" placeholders |

---

## 5. Object Model

### 5.1 Leads / Deals — the core of the product

A "Lead" *is* your deal record — one object tracks where it came from, its stage, its value, and (increasingly) AI-computed signals like health and win probability.

- **Stage engine:** leads move through a fixed pipeline — `new → qualified → meeting → proposal → negotiation → won/lost` — enforced by the system, so you can't skip stages by accident (the dropdown will show all stages, but only valid moves actually save).
- **Two ways to work a lead:** *individual* (one rep owns it end-to-end) or *conveyor* (a team works it through shared, SLA-timed stages).
- **Bulk import:** upload a CSV/Excel file of leads, confirm the AI's column mapping, and import — a safe, solid feature.

### 5.2 Companies

Great to browse (context, related work, knowledge, insights) — but there's currently no "create company" or "edit company" button in the UI. Companies mostly get created as a side effect of creating a lead, or via the AI assistant.

### 5.3 Contacts

People at a company show up as a read-only list on that company's page. They don't yet have their own dedicated page, and the AI doesn't work with them directly.

### 5.4 Tasks

The deepest object in the product for day-to-day collaboration: comments, followers, recurrence (finishing a recurring task automatically creates the next one), and four different views (List/Board/Calendar/Workload). Tasks with a due date sync automatically to the assignee's connected Google Calendar, and moving/reassigning/completing a task keeps that calendar entry in sync too.

### 5.5 Meetings

Sync to Google Calendar the same way tasks do. There's no dedicated "Meetings" page yet — you'll find them listed on the related lead or company page, and on your `/calendar` agenda.

### 5.6 Proposals

The AI can draft real narrative sections around numbers you (or software) provide — it's instructed never to alter or invent the numbers themselves. A proposal can be marked approved and "sent," but — important to know — marking it "sent" does not currently email anything to the client. You'll need to deliver it yourself for now.

### 5.7 Quotations

Line-item quotes with precise, deterministic tax/total math. There's no dedicated screen for these yet.

### 5.8 Conveyor teams + playbooks

A "playbook" defines a reusable set of pipeline stages with SLA deadlines for a team; a "conveyor team" is the group of people who share that pipeline. Assignment, SLA tracking, and team analytics (compliance %, average handoff time, where deals get stuck) all work well. One current limitation: a playbook can be created or deleted but not edited in place — a wrong SLA number means recreating the whole playbook.

### 5.9 Employees / your profile

Your name, personal/recovery email, and phone are editable by you, any time, from your Account page — nobody else can change these for you, and you can't accidentally change anyone else's. The organization chart (departments, teams) is maintained by admins with real safeguards against structural mistakes like circular reporting lines.

### 5.10 Custom objects

If your business needs to track something beyond leads/tasks/meetings, an admin can define a new object type with its own fields. It's a simple, working feature — just not yet searchable from the global search bar or reachable by the AI assistant.

### 5.11 How things connect

A company can have many leads, contacts, and (indirectly) meetings and tasks. A lead can have its own tasks, meetings, proposals, and quotations. The "Context" tab on an object's page is the best single place to see everything connected to it — documents, related conversations, and its full activity history, all in one view.

---

## 6. AI Architecture

### 6.1 How the assistant works

When you ask STOS to do something, it doesn't just generate text — it can call real actions (create a lead, log a task, schedule a meeting) using the exact same permission checks and logging as the rest of the product. Every message is also given a live snapshot of your business — your pipeline, your open tasks, your team roster — so it rarely needs to ask you basic questions it could otherwise answer itself.

**One thing worth knowing about long conversations:** each new message to the assistant doesn't automatically carry the full history of everything said earlier in that thread — it relies on a live snapshot plus whatever object you're currently focused on. For best results, be specific about what you're referring to rather than assuming the assistant remembers a detail from several messages back.

### 6.2 What the assistant can do on its own vs. what needs your approval

Today, **advancing a lead's stage is the one action that always asks for a human click before it takes effect.** Everything else the assistant can do — creating leads, logging touches, creating tasks and meetings, drafting proposals, reassigning leads — happens immediately when you ask for it. If you're delegating meaningful work to the assistant (especially anything that reassigns work across your team), it's worth double-checking what it actually did afterward, the same way you'd sanity-check a new hire's early work.

### 6.3 How the assistant "knows what you're talking about"

Two mechanisms make the assistant feel aware of context: clicking an action button on an object (like "Create a deal" on a company page) opens a conversation that's already scoped to that object, so you don't have to re-explain which company you mean. And when you attach a document to a chat, its content is made available to the assistant right away — even before the document has finished being fully indexed for search elsewhere.

### 6.4 Knowledge search / RAG

Uploaded documents are extracted, broken into searchable chunks, and indexed so both the assistant and the dedicated Knowledge Q&A screen can find and cite them. If search results seem to be missing something you know you uploaded, it's worth checking with an admin — this pipeline depends on a couple of external services being configured, and it can degrade quietly rather than showing an error.

### 6.5 Citations

The dedicated **Knowledge Ask** screen is the most trustworthy place to ask fact-based questions — every answer there links back to the specific source document and passage. The main chat assistant is instructed to cite sources when it uses company knowledge, but doesn't offer the same clickable, verified citation links yet — for anything that matters, cross-check important facts via Knowledge Ask.

### 6.6 Bulk lead import

The safest AI feature in the product from a correctness standpoint: it can only map your spreadsheet's *actual* column names onto lead fields — it's structurally unable to invent a column that isn't really there, and if it can't confidently map something, it asks you to confirm before anything is created.

---

## 7. Design System

### 7.1 The intent

STOS is built around a small set of design rules meant to make every screen feel like the same product: every object defaults to a "what's happening" Context view, exposes a clear "what can I do" action bar, and dashboards only show a chart when it answers a real question — never a decorative one, and never a fabricated trend.

### 7.2 Where this is most and least polished today

The Lead, Company, and Person pages are where this design system is most fully realized — they're the best example of what STOS is meant to feel like everywhere. A number of other screens, especially in the admin section, are still simpler and more utilitarian while they catch up to the same standard. If a screen feels a little less refined than the Lead page, that's a fair read — it's not a bug, just a part of the product that hasn't had its design pass yet.

### 7.3 Navigation

The sidebar is deliberately short — a handful of destinations, with everything else reachable through the assistant or `⌘K` (Cmd/Ctrl+K), which is the fastest way to jump to almost anything in the product. On mobile, `⌘K`-style search is the primary way to navigate, since there's no full mobile nav menu yet.

---

## 8. Business Processes

### 8.1 Sales — outbound and inbound

A lead can arrive from any of nine tracked sources (referral, website, LinkedIn, WhatsApp, and so on), from the AI assistant, or from a bulk spreadsheet import. It's assigned to either an individual rep or a conveyor team, and moves through the standard pipeline with every stage change recorded.

### 8.2 Meetings and tasks

Both sync automatically to Google Calendar (once you've connected it) and both feed into the activity history of whatever they're related to. Tasks additionally support comments, followers, recurrence, and bulk assignment to a whole role or department.

### 8.3 Proposals, quotations, and approvals

Proposals can be AI-drafted and marked approved; quotations are calculated precisely. The underlying approval-workflow engine is real and general-purpose, but isn't currently wired up to run automatically behind quotations out of the box — check with an admin if you expect a specific approval process to trigger automatically.

### 8.4 Knowledge

Any document — uploaded on its own or attached in a chat — becomes searchable by the AI and by the dedicated Knowledge Q&A tool, and can be linked to the specific company or deal it's about so it shows up right there too.

### 8.5 Organization

Departments and teams form a flexible tree structure, maintained by admins, with every structural change (a new team, a role change, a new hire) recorded in the Organization Timeline.

### 8.6 Individual vs. conveyor, compared

| | Individual funnel | Conveyor belt |
|---|---|---|
| Who works it | One assigned rep | Any member of the assigned team |
| Progression | Manual, by the rep | Same pipeline, but each stage has an SLA clock |
| Analytics | Standard pipeline view | Plus SLA compliance %, handoff time, bottleneck detection |

### 8.7 What the AI can do for your day-to-day

"Plan my day," "show me what's stale," "who needs help with their workload," and the executive Command Center's daily rollup are all real, working features grounded in your actual data — none of it is decorative or made up.

---

## 9. Things We Intentionally Did NOT Build

Worth knowing about so you don't assume something's missing by accident:

- **The AI doesn't remember your entire conversation history automatically.** It works from a live business snapshot plus whatever you've told it in the current thread — a deliberate simplicity choice, not an oversight.
- **General-purpose autonomous AI agents.** STOS's AI acts on your specific requests; it doesn't run long, unsupervised background jobs on its own yet.
- **A workflow/automation builder for non-engineers.** The underlying engine that could power custom approval flows exists, but there's no drag-and-drop way to build one yet — that's a planned next step, not a rejected idea.
- **Predictive forecasting.** Pipeline forecasts today use a straightforward, transparent stage-based estimate, not a machine-learning model.
- **Integrations beyond Google Calendar.** Slack, Notion, Google Drive, Gmail, and others are on the roadmap but not built yet — they show as "Coming soon" in the Integrations page.
- **Automatic email delivery for proposals and new-hire invitations.** Both currently stop one step short of actually sending an email — you'll need to deliver those manually for now.
- **Enterprise features like SSO, a notifications inbox, bulk actions, saved views, and data export.** Known, deliberate gaps for a future push — not requirements that were missed.

---

## 10. Product Roadmap

STOS has gone through a long, real sequence of development work: a foundational permissions and data architecture, a founder-first AI-primary redesign (this is when the product was renamed from "RevenueOS" to "STOS"), a series of consolidation sprints covering the org structure, lead intelligence, the AI assistant, the task engine, knowledge search, integrations, and executive dashboards, followed by a Work Execution Engine (the conveyor-belt model), a full visual design system pass, and a hardening track focused on consistency and trust.

The near-term plan is a period of internal, founder/team dogfooding — using STOS for real day-to-day work and fixing what that actually surfaces — before new large capabilities (broader automation, real email delivery, deeper AI agents) get built on top. Longer-term, this module is meant to be the first of several that eventually make up the larger ABOS vision.

---

## 11. Engineering Principles

For anyone curious how the team builds this (not required reading to use the product):

- **Reuse before rewrite** — check for an existing pattern before building something new.
- **Business logic lives in one place** (the "service" layer), so the UI, the API, and the AI assistant all go through the same rules — this is why permissions behave consistently no matter how you interact with STOS.
- **Object-first, not feature-first** — organize around the things in your business, not a menu of features.
- **Consistency is enforced, not optional** — a one-off variant of an existing pattern is treated as a bug to fix, not a style choice.
- **Build the simplest thing that survives the next couple of milestones** — not a hypothetical enterprise version nobody's asked for yet.
- **Everything the AI touches must respect the same permissions as everything else.**
- **Every meaningful action leaves a record.**
- **Never fabricate a number.** If there's no real data to support a trend or a percentage, show the plain number instead of guessing — a small rule, consistently followed, that's worth knowing you can trust.

---

## 12. Executive Summary

**What is STOS today?** A real, working AI-native sales operating system, most mature around its lead/deal pipeline, its task and calendar workflow, and its AI assistant — genuinely useful for day-to-day sales operations right now.

**What has been accomplished?** A substantial amount of real engineering: a centralized permission system, a working AI assistant that can actually take action (not just chat), a conveyor-belt team workflow with SLA tracking, a two-theme design system, and a Google Calendar integration that keeps your meetings and tasks in sync automatically.

**How mature is it?** Uneven in a specific, mappable way — leads and tasks are the most mature and battle-tested parts; a few adjacent objects (Companies, Contacts, Quotations) and some admin-facing features have real backends but are still waiting on a finished screen.

**Should you use it day-to-day?** Yes, for its strong suits: leads, tasks, meetings, the AI assistant, and Google Calendar sync are all solid, real tools you can rely on today. For anything touching proposal delivery, quotations, or custom objects, expect a rougher edge and loop in an admin if something seems incomplete rather than assuming you're missing a button that exists.

**What should you do if something feels off?** If a screen looks unfinished, or a feature you expect doesn't have a button for it yet, that's very likely accurate rather than user error — check with an admin, or just ask the AI assistant directly; STOS is explicitly built so the assistant is often the fastest path to getting something done even when the UI hasn't caught up yet.
