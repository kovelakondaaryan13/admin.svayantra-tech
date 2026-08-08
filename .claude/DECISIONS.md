# DECISIONS.md — Architectural Decision Log

> Append-only. Newest at the top. One entry per meaningful decision. Never delete an entry;
> if a decision is reversed, add a new entry that supersedes it and link back.
>
> **Format (ADR-lite):**
> `### ADR-NNN — <title>` · **Date** · **Status** (Proposed / Accepted / Superseded by
> ADR-XXX) · **Context** · **Decision** · **Consequences** · **Alternatives considered**.

---

### ADR-044 — Default AI model: Haiku 4.5 (not Sonnet), accepted for high employee volume
- **Date:** 2026-08-09
- **Status:** Accepted.
- **Context:** `src/ai/claude.ts`'s shared `MODEL` constant (used by the orchestrator/assistant,
  daily/executive briefings, lead-import mapping, summaries, knowledge Q&A, issue triage) was
  changed from `claude-sonnet-5` to `claude-haiku-4-5-20251001` in an earlier session, but never
  recorded here (flagged by a code audit — see ADR discipline in CLAUDE.md). Question raised:
  is Haiku realistic once every employee is using the assistant constantly?
- **Decision:** Keep Haiku 4.5 as the org-wide default. At high call volume it is the only
  financially sane choice — Sonnet's per-token cost would scale linearly with headcount and
  usage, while Haiku 4.5 is Anthropic's tier purpose-built for agentic/tool-calling work, not
  the older weak Haiku. Bump a specific caller back to `claude-sonnet-5` (one line in
  `ai/claude.ts` or a per-call override) only if dogfooding shows a concrete quality gap.
- **Consequences:** The actual risk this surfaced wasn't cost or raw quality — it's that
  `assign_leads`, `assign_task`, and `assign_task_to_role` in `src/ai/tools.ts` execute
  immediately with no human approval step, unlike `advance_lead_stage` (which already returns
  a `pendingApproval` for the user to confirm). At high volume, an occasional tool-call mistake
  on these (wrong leads matched, wrong assignee) becomes real, repeated, unreviewed data
  mutations. **Follow-up shipped same day:** all three now return a `pendingApproval`
  (`bulk_reassign_leads` / `assign_task` / `assign_task_to_role`) instead of executing —
  confirmed via `POST /api/leads/bulk-reassign` (new), `POST /api/tasks` (reused —
  `task:create` already maps to the same `tasks.assign` permission), and
  `POST /api/tasks/assign-role` (new). `src/components/assistant/console.tsx`'s Approve
  button now dispatches per approval type. Also found and fixed the same `users.read` gap
  from ADR's sibling issue in `taskService.assignToRole`/`assignToUnit` (used
  `employeeService.list`, now `listDirectory`).
- **Alternatives considered:** Reverting to Sonnet org-wide (rejected — cost scales badly with
  every employee using it constantly, and Haiku 4.5 is specifically built for this workload).

---

### ADR-043 — UX Overhaul: Markdown rendering, Dashboard charts, Notifications, Command Palette, Organization rename
- **Date:** 2026-07-22
- **Status:** Accepted. Multi-pass UX improvement driven by dogfooding.
- **Pass 1 (Executive Visibility):** Home executive dashboard now shows 8 KPI tiles (Company Pulse +
  Operational Pulse), decision charts (Pipeline by Stage via `BarChart`, Workload by Team via
  `BarChartH` with red "bad" tone on overloaded members), and an `AIInsight` callout for at-risk
  deals. Data sourced from enhanced `CommandCenter` interface (`pipelineByStage`, `taskStats`).
- **Pass 3 (Markdown Rendering):** Created `src/components/ds/markdown.tsx` using `react-markdown` +
  `remark-gfm`. Replaces raw `whitespace-pre-wrap` text in Assistant messages and Executive Briefing.
  Handles headings, code blocks, tables, lists, blockquotes, task lists — all styled for STOS dark
  theme. No more raw `**bold**` or `### heading` reaching the user.
- **Pass 6 (Command Palette):** Added action verbs: Create deal, Schedule meeting, Upload document,
  Generate proposal. Added owner-only nav: Employees, Roles & Permissions, Organization, Audit Log.
- **Pass 7 (Notification Bell):** Created `NotificationBell` client component wired to existing
  `/api/notifications` backend. Shows unread count badge, dropdown with mark-all-read, auto-polls
  every 60s. Added to both desktop sidebar and mobile topbar.
- **Pass 2 (partial):** Renamed sidebar nav "Workspace" → "Organization" (`🏗️` icon). Updated
  workspace hub page title/subtitle to match. Command palette updated.
- **Consequences:** AI messages now render rich formatted content; the Home page is a real executive
  dashboard; notifications are surfaced in the shell chrome; the command palette is more action-oriented.
- **Alternatives:** Considered `marked` for markdown — chose `react-markdown` for native React
  component rendering (no `dangerouslySetInnerHTML`).

---

### ADR-042 — What/Why/Next doctrine + honest movement deltas (Executive Visibility)
- **Date:** 2026-07-21
- **Status:** Accepted. Phase 3 (executive visibility). Formalizes the chart philosophy from ADR-041.
- **Doctrine (STOS_DESIGN_SYSTEM.md §0.1):** an operational page is three layers in fixed order —
  **Metrics = "what is happening?"**, **Charts = "why?"**, **AI = "what should happen next?"** —
  laid out **Summary → Decision Metrics → Decision Charts → Action Bar → Underlying Objects**.
  Explicit guardrail: *operating system, not BI* — answer "what needs my attention today?", never a
  wall of 47 metrics; a number that doesn't drive a decision isn't surfaced prominently.
- **Honest movement (the discipline point):** `StatTile.delta` now carries an optional semantic
  `tone` (up isn't always good — rising deal-age/open-tasks is "bad"); arrow shows direction so
  it's never color-alone. Critically, **deltas are computed only where a real time basis exists** —
  "New leads (7d)" compares `createdAt` this week vs the prior week. Metrics without a prior
  snapshot (pipeline value trend) show the number with **no delta** rather than a fabricated one.
  Time-series deltas (pipeline over time) would need a periodic metric-snapshot store — deferred
  until dogfooding shows it's wanted (don't invent numbers).
- **Work page = the exemplar of the full doctrine:** decision metrics (open pipeline / open deals /
  new leads 7d + real Δ / win rate) → charts (value-by-stage, deals-by-stage) → an **AIInsight**
  that computes deals stuck 14+ days in proposal/negotiation (age = last stageHistory entry, real
  timestamps) and names the top 3 with links → the leads grid. Numbers → visualization →
  recommendation, on one page.
- **Verified:** typecheck + lint 0; full `next build` 0; dev on :4300 (all routes 307 auth gate;
  one transient cold-start 500 on first compile, gone at steady state). Not driven headlessly: the
  authenticated visual of the metrics/charts/insight.
- **Roadmap (agreed):** P1 foundation ✅ · P2 friction/trust ✅ · **P3 executive visibility 🚧** ·
  P4 dogfood-driven backlog. Next visibility targets (on request): workload-by-person (`BarChartH`,
  `bad` tone over capacity) + the same What/Why/Next structure on Home and object pages.
- **Date:** 2026-07-21
- **Status:** Accepted. Corrects ADR-040's P1 (which didn't take effect) + starts the Executive
  Visibility pass.
- **DOCX still failed after ADR-040 — real root cause:** the extractors used a *variable* specifier
  (`const mod = "mammoth"; import(mod)`) to hide the name from the bundler. That also hid it from
  `serverExternalPackages` (which matches on the literal specifier), so the externalization never
  applied and Next still failed to resolve the parser at runtime → "parser not installed". **Fix:**
  use **literal** `import("mammoth"|"pdf-parse"|"xlsx")` so `serverExternalPackages` matches and Next
  resolves them natively from node_modules. Added `src/types/pdf-parse.d.ts` (that package ships no
  types). Proven: extracted 60 chars from a real `.docx` through the exact extractor path at the
  Node level. Live confirmation from dogfooding: the **P2 graceful-degradation worked** — the
  assistant said "upload worked, extraction failed" + offered retry/convert/paste, no "re-upload".
  - **Caveat (stated to user):** a file uploaded *before* this fix keeps its persisted `failed`
    status — re-attach it (or use the Knowledge-tab retry) to get extraction with the fixed resolver.
- **First decision charts (Executive Visibility pass, started):** new DS `charts.tsx` — `BarChart`
  (vertical) + `BarChartH` (horizontal), **single-series** (one measure across categories ⇒ one
  hue, no legend, no categorical-palette risk), token-driven so light/dark are the same chart
  re-themed. Followed the dataviz method: validated the candidate categorical hues with the skill's
  script (teal/amber FAILed the dark lightness band → excluded; kept single-series brand blue which
  passes contrast); mark specs = 4px rounded data-ends at the baseline, 2px gaps, recessive axis,
  direct labels, per-bar hover. Placed on `/work`: **Pipeline value by stage** + **Deals by stage**
  (open stages) — answering "where's the value / where are deals clustering?". Charts render only
  when there's pipeline (no empty decoration).
- **Verified:** typecheck + lint 0; full `next build` 0; dev restarted on :4300. Not driven
  headlessly: the authenticated docx re-upload round-trip and the visual look of the charts (needs a
  logged-in view — asked the user to eyeball).
- **Next (visibility pass continues, on request):** workload-by-person (BarChartH with `bad` tone
  when over capacity) on Home/People; extend to object pages; only decision-driven charts.
- **Date:** 2026-07-21
- **Status:** Accepted. Dogfooding-found. RC-1 feature work paused for these two trust issues.
- **P0 — reopening a conversation showed an empty/stale thread (persistence was fine).** Root cause
  was NOT persistence: the sidebar does `router.push('/assistant?c=<id>')`, the server page
  re-renders with the right messages, but `AssistantConsole` was **reused** across the query change
  and its thread comes from `useState(current?.messages)` — initializers run only on mount, so
  switching conversations never reloaded the thread (the shell/sidebar updated; messages didn't). A
  hard refresh worked; clicking didn't — exactly the reported symptom. **Fix:** key the console by
  conversation identity in `assistant/page.tsx` (`c` → else intent/query → else "new") so React
  remounts and re-initializes the thread on switch. Messages/attachments/relatedObjects were always
  persisted correctly; no data-layer change needed.
- **P1 — `.docx` (and pdf/xlsx) extraction wrongly reported "parser not installed".** The parsers
  ARE installed (verified: extracted 60 chars from a real docx through the exact extractor path).
  The failure was **Next.js bundling** the dynamic `import(parser)` in the ingestion route, which
  breaks resolution at runtime. **Fix:** add `mammoth`, `pdf-parse`, `xlsx` to
  `serverExternalPackages` in `next.config.mjs` so Next resolves them natively from node_modules.
  (Requires a server restart — config isn't hot-reloaded.)
- **P2 — misleading failure surface (the `catch` blamed a missing parser for every error; the AI
  told users to "re-upload").**
  - `extractors.ts`: `classifyFailure()` splits `unavailable` (module-not-found only) from `error`
    (parser present but extraction threw) — no more blaming a missing parser for a corrupt file.
  - `ingestion-service.ts`: records the two as distinct statuses/telemetry
    (`extraction_unavailable` vs `extraction_error`) with the real error string.
  - `context-resolver-service.ts`: on a failed doc the AI is now told the **upload succeeded** and
    the file is safe — never suggest re-uploading; offer retry-extraction / convert-to-PDF /
    paste-details-and-continue. Pending docs likewise say "uploaded, still extracting".
- **Verified:** real-docx extraction proven at the Node level through the extractor path; typecheck
  + lint 0; full `next build` 0; dev restarted clean on :4300. The one thing not driven headlessly:
  a logged-in browser reopen-conversation click and an authenticated docx upload round-trip.
- **Deferred to the Executive Visibility pass (post-reliability, user-requested):** every object/
  Home answers "what's happening / what next / are we healthy?"; decision-driven charts only. Not
  started — reliability first.
- **Date:** 2026-07-21
- **Status:** Accepted. Completes the mental model behind ADR-038 (Action Bar). Last planned
  architecture addition before the RC-1 dogfooding week drives further changes.
- **Problem:** ADR-038 routed Action Bar verbs to `/assistant?q=…`, but the resulting conversation
  was disconnected — the user had no confidence the work belonged to the object they came from, the
  AI could ask "which deal?", the thread was titled "New conversation", and nothing returned them.
- **`IntentService` (`services/intent-service.ts`, pure — client + server):**
  - `launch(ctx)` → Assistant deep-link carrying `{objectType, objectId, objectName, intent,
    instruction, origin, returnUrl}`.
  - `parse(params)` → hydrate the intent from the Assistant's search params.
  - `title(ctx)` / `humanize(key)` → smart conversation titles ("MoneyPal • Create deal").
  - It's the shared launcher the Action Bar uses now and ⌘K will use later, so launches stay
    consistent and become measurable.
- **Wiring (end to end):**
  - `ObjectPage` builds intent links via `intentService.launch` using a new `objectRef` prop +
    `usePathname()` for `returnUrl`; each action carries an `intentKey`.
  - Assistant page `intentService.parse(searchParams)` → passes an `intent` to the console.
  - Console: on an intent launch, `ensureConversation` creates the thread **titled + linked**
    (`relatedObject`) up front; seeds the "linked" chip immediately; shows a **✓ Done → Back to
    {object}** return bar once the assistant replies. Instructions ending in ":" (Add task:, Create
    deal:) **prefill** the composer; complete instructions (Advance stage, Ask AI) **auto-send**.
  - `POST /api/conversations` accepts `{title, intentKey, relatedObject}`; `ConversationService.create`
    sets them + records `telemetry("intent", intentKey, …)`; `append` no longer clobbers a smart
    title. New `objectsFor(user,id)`.
  - **Messages route** loads `conversationService.objectsFor(id)` and passes it to `chat()` as
    `objectContext`; the **orchestrator** injects an "ACTIVE OBJECT(S)" block so the model uses the
    id in tool calls and never asks which object — on the first message *and every follow-up* (the
    scope lives on the conversation, not the URL).
  - Because the thread is linked, the exchange + any tool-emitted activity now surface back in the
    object's **Context** tab automatically. Loop closed.
- **Lifecycle honesty:** implemented the pragmatic subset — `launch` / `parse`(=hydrate) / `title`,
  `complete` = the return bar, `resume` = conversations persist + are linked (reopen from Context),
  `cancel` = navigate away. Did **not** build a stateful server-side intent engine (would be the
  architecture bloat we agreed to stop at); revisit only if dogfooding shows a need.
- **Verified:** typecheck + lint 0; full `next build` 0 (assistant + all object pages compiled);
  dev relaunched clean on :4300. Reuses the existing orchestrator/tools — no new AI capabilities.
- **Follow-up (dogfooding-driven):** surface the *outcome* in Context ("Proposal drafted by AI →
  view") rather than the thread title; extend intents to ⌘K + collection-page rows.

---

### ADR-038 — Interaction model: Context is the object home + the Action Bar
- **Date:** 2026-07-21
- **Status:** Accepted. Product-refinement phase (not feature-building). Supersedes the per-object
  "Overview" tab everywhere.
- **Context (from a UX Workflow Pass):** 15 of 20 core journeys contained a "where do I do X?"
  moment. Three root causes, not fifteen problems: (1) read-only tabs with no verb, (2) duplicated
  destinations (documents in 2 tabs, activity in 3 tab-names, upload in 4 places), (3) AI as a
  separate address instead of a capability on the object. The `ObjectPage.actions` slot existed but
  held only a back-link.
- **Doctrine (now STOS_DESIGN_SYSTEM.md §0.0):** every object answers two questions — **"what is
  happening?" → Context** (the default, first tab; Overview removed, its sections folded in) and
  **"what can I do?" → the Action Bar**. Permanent constraint: *if a user must ask "where do I do
  X?", the design failed* — every common action is in the Action Bar or in ⌘K, never buried.
- **`ObjectPage` gains an Action Bar** (`object-page.tsx`): `actionBar: ObjectActionItem[]` +
  `askAi: string`. Strict tiers — one **primary** (`btn-accent`), a few **secondary** (`btn-ghost`),
  rest in a **⋯ More** menu, plus an always-present **✦ Ask AI**. Items are plain data (no
  callbacks, so pages stay server components); dispatched client-side by kind:
  - `tab` → switch the active tab (e.g. Upload → Knowledge tab).
  - `href` → navigate.
  - `intent` → open `/assistant?q=<instruction>` pre-scoped to the object. **Key decision:** verbs
    without a dedicated screen (Advance stage, Create deal, Add task, Assign work, Schedule…) become
    one-click Assistant intents — reusing the orchestrator's existing tools instead of building new
    modals. This makes read-only dead-ends actionable AND makes AI a capability *on* the object.
- **Tab consolidation (Overview removed; Context default everywhere):**
  - **Company:** Context · Work (opportunities + meetings) · Knowledge (upload + docs) · Insights
    (financials + health). Action Bar: **Create deal** · Upload · Add contact · Schedule meeting · Ask AI.
  - **Deal:** Context (engagement KPIs + stakeholders + proposals + notes + docs/convos/activity) ·
    Work (log touch + tasks + meetings + execution/assignment) · Knowledge · Forecast (value/prob +
    intelligence). 11 tabs → 4. Action Bar: **Advance stage** · Generate proposal · Add task · Upload
    · Assign owner · (More: Mark lost) · Ask AI.
  - **Person:** Context (workload KPIs + skills + manager/reports + files/activity) · Work (open
    work + meetings). Action Bar: **Assign work** · Schedule 1:1 · Ask AI.
- **Deviations from the sketch (stated):** Deal keeps a 4th **Knowledge** tab (files need one home,
  consistent with Company) rather than a literal 3 tabs. Person drops its file-uploader (edge case;
  Context shows files read-only, global Knowledge / ⌘K covers upload).
- **Verified:** typecheck + lint 0; full `next build` 0 (Company/Deal/Person all compiled); dev
  relaunched clean on the fresh origin :4300. Intents/tab-switches are wired to existing routes and
  the existing orchestrator — no new services.
- **Follow-ups (not this pass):** collapse the same duplication on collection pages + Home;
  scope-link the Assistant conversation to the object (set `relatedObjects`) when opened via an
  intent, so the round-trip auto-appears in the object's Context.

---

### ADR-037 — P0: Attachment context resolution (LLM never received the document)
- **Date:** 2026-07-21
- **Status:** Accepted. Fixes a critical RC-1 regression found in dogfooding.
- **Bug:** Sprint 4 persisted attachments on the message but the orchestrator (`chat`) was called
  with only the raw text — the model received no attachment ids, extracted text, Knowledge ids, or
  status. So on a freshly-uploaded file the assistant said "I don't see a document attached" even
  though the chip was visibly present. The prompt builder ignored attachment metadata entirely.
- **Fix — `ContextResolverService` (`services/context-resolver-service.ts`):** resolves every
  `AttachmentReference` on a message into its `UploadedFile` (name, ingestion status, Knowledge
  `documentId`, extracted text, error) and renders a structured **ATTACHED DOCUMENTS** block. The
  LLM never sees bare ids — it gets an assembled context package.
  - Text is injected **whenever it exists**, regardless of final status: the pipeline saves
    `extractedText` at the `extracted` step *before* embedding, so a doc whose Qdrant embedding
    later failed still yields usable text (the model can extract a lead even if RAG indexing broke).
  - Genuinely-pending / failed / missing docs produce an explicit instruction to explain that state
    — **never** to claim "there is no document". Per-doc 8k / total 20k char budget guards context.
- **Orchestrator:** `chat(user, message, { attachments })` prepends the block to the user turn
  ("ATTACHED DOCUMENTS … --- User's instruction: …") and SYSTEM now instructs the model that
  attachments listed in that block ARE available and that "this document / this file / it" refer to
  them (implicit references work without typing the filename). `messages` route passes the persisted
  `attachments` through.
- **Boundary:** the model still reaches Mongo/GridFS/Qdrant only through services — the resolver is
  the single place that assembles document context. Create endpoint unaffected (shell only; chat
  runs solely in `/messages`).
- **Verified:** typecheck + lint 0; `/api/conversations/[id]/messages` recompiled clean on the live
  dev server (:4300); `/assistant` serves. Authenticated upload→ask round-trip is type/compile
  validated; not driven headlessly.
- **Deferred (follow-up, not P0):** expose an `extractDocument(documentId)` / `searchKnowledge` tool
  so the model can pull *non-attached* Knowledge on demand (the inline block already covers the
  attached-file P0). Dedup guard if a not-ready file is force-reprocessed (currently we only read
  status, so no double-index risk today).

---

### ADR-036 — RC-1 Sprints 4 + Context tab: Assistant attachments + object aggregation
- **Date:** 2026-07-21
- **Status:** Accepted. Closes the RC-1 build scope (Sprints 1–5 + Context all done).
- **Sprint 4 (Assistant attachments UX):** the composer now carries files end-to-end. The message
  endpoint (`POST /api/conversations/[id]/messages`) accepts `attachments[]` ({fileId, name,
  mimeType?, documentId?}) and persists them on the user turn via the existing
  `ConversationService.append` (schema already had `attachments` — no migration). In
  `assistant/console.tsx`: 📎 attach button + hidden multi-file input; **drag-and-drop** onto the
  composer (ring highlight + "Drop files to attach…"); each file uploads to `POST /api/uploads` and
  shows a **pending chip** with a live spinner → filename, **removable** before send; on send the
  ready attachments are included and rendered as chips on the user turn that **open via
  `/api/uploads/[id]`** (download route), with a ✓ once ingested into Knowledge. Conversation
  `relatedObjects` render as **jump-links** (🏢/👤/💼 → /companies|/people|/work) at the top of the
  thread. `assistant/page.tsx` now hydrates `current.messages[].attachments` + `relatedObjects`.
  - **Note:** chip opens the raw file (reliable) rather than a Knowledge doc page — no
    `/knowledge/[id]` route exists yet; when built, point the ✓ chip there.
- **Context tab (first-class, on every object):** new `components/context/object-context.tsx` —
  a server component that aggregates, for `{type,id}`: the AI summary (`AICallout`), **Documents &
  files** (uploads scoped by relatedType/relatedId, status badge + download), **Conversations**
  (`listForObject` → /assistant links), and **Recent activity** (`listForEntity` → `Timeline`).
  Object-specific material comes in via an `extras` slot. Added as a "Context" tab to Company
  (extras: Knowledge documents), Deal (extras: Proposals), and Person ObjectPages. `person` maps to
  `contact` for the activity query (People are contacts in the activity log); person activity is
  actor-scoped so its timeline can be sparse — honest empty state.
- **Verified:** typecheck + lint + build all 0; `/assistant`, `/work/[id]`, `/companies/[id]`,
  `/people/[id]` all serve (307 auth gate → compile + render OK). Full authenticated upload
  round-trip validated by types + build; not driven headlessly.
- **Deferred (Medium, cosmetic):** dedupe local `Kpi`/`Panel` in conveyor-dashboard + command-center
  onto DS `StatTile`/`Section` (carried from ADR-035).

---

### ADR-035 — RC-1 Sprints 3 + 5: Production-readiness + Instrumentation
- **Date:** 2026-07-21
- **Sprint 3 (production-readiness):**
  - **Responsive shell:** sidebar `hidden md:flex`; new `MobileTopBar` (logo + Demo pill + Search
    that opens ⌘K as the mobile nav + theme); `main` padding responsive. Desktop unchanged.
  - **Component-header migrations → `PageHeader`:** roles-matrix, objects-panel (→ "Data models"),
    sales-models; removed the duplicate header inside `org-console` (page provides `PageHeader`).
  - **Error states:** branded `(app)/error.tsx` with retry + go-home (already present, confirmed).
  - **A11y:** aria-labels on icon-only controls (mobile search, theme, sign-out).
  - (Deferred/Medium: dedupe the local `Kpi`/`Panel` in conveyor-dashboard + command-center onto DS
    `StatTile`/`Section` — cosmetic, tracked.)
- **Sprint 5 (instrumentation):** `lib/telemetry.ts` — fire-and-forget, never throws. `record(kind,
  event, meta)` + `timed()` + `summary()`. Hooked: ingestion ready/failed, search hit/miss, upload
  received. Owner-only `GET /api/admin/diagnostics` + `/admin/diagnostics` page (event counts +
  recent failures/misses) + Workspace card. "For the team, not end users."
- **Verified live (:4100):** search → telemetry event shows in diagnostics; Home/Work/Companies/
  Diagnostics all 200; typecheck + lint + build 0.
- **Remaining RC-1:** Sprint 4 (Assistant attachments UX) + the Context tab.

### ADR-034 — RC-1 Sprint 2: Universal Timeline (comprehensive event emission)
- **Date:** 2026-07-21
- **Status:** Accepted (RC-1 Sprint 2)
- **Context:** The DS `Timeline` already rendered on Home/Company/Person/Deal, but many mutations
  didn't emit activity events, so the timeline was incomplete.
- **Decision:** widened `Activity.entityType` (+ `document`, `employee`, `workflow`) and added the
  missing emitters so "every meaningful event generates a timeline entry":
  - **lead stage change** (`won`/`lost`/`stage_changed`) — `leadService.advance`.
  - **AI summary generated** — `leadService.saveSummary`.
  - **task completed** — `taskService.update` (status→done).
  - **document added** — `documentService.upload` (covers uploads → Knowledge).
  - **approval completed** (`approved`/`rejected`) — `workflowService.act`.
  - (already emitting: company/contact/lead/meeting/proposal/quotation/task created, lead touch,
    proposal sent.)
  - One `Timeline` component powers every surface; only the query/filter changes
    (`activityService.recent` org-wide, `listForEntity` per-object). `/admin/timeline` remains the
    structural-audit lens.
- **Verified live (:4100):** advanced a lead qualified→meeting → Deal 360 Timeline shows
  "Stage qualified → meeting". typecheck + lint + build 0.
- **Remaining RC-1:** Sprint 3 prod-readiness · Sprint 4 Assistant attachments UX · Sprint 5
  instrumentation · Context tab.

### ADR-033 — RC-1 Sprint 1: Deal/Opportunity 360 on the canonical ObjectPage
- **Date:** 2026-07-21
- **Status:** Accepted (RC-1 Sprint 1 — resolves the last object-template inconsistency)
- **Decision:** `/work/[id]` rebuilt on `ObjectPage` (same language as Company/Person). Header =
  logo + name + stage/health/value badges + AI summary + actions. Tabs: Overview (engagement KPIs
  + AI summary + log-touch + notes), Stakeholders (contacts + buying committee), Tasks, Meetings,
  Timeline, Knowledge & Files (object-linked `FileUploader` + proposals), Forecast (value × win
  prob → weighted), Conversations (`conversationService.listForObject`), Activity, Execution
  (existing `LeadExecutionModel` + `LeadIntelligence`). All existing interactive components reused
  — no logic change. Bespoke `lead-detail` grid layout retired.
- **Result:** all three first-class objects (Company, Person, Deal) now share one template →
  RC-1 exit criterion "every first-class object uses canonical templates" is met.
- **Verified live (:4100):** `/work/[id]` 200, ARIA tablist, tabs render. typecheck + lint + build 0.
- **Remaining RC-1:** Sprint 2 Universal Timeline · Sprint 3 prod-readiness (error pages,
  responsive shell, KPI/badge dedupe, a11y, header migrations) · Sprint 4 Assistant attachments UX
  · Sprint 5 instrumentation · + the proposed **Context** tab (everything-about-this-object).

### ADR-032 — Object-aware Knowledge integration (Sprint 4)
- **Date:** 2026-07-21
- **Status:** Accepted (plan item #4 — mostly a linking layer over Sprints 2–3)
- **Decision:** Uploads become first-class, object-linked Knowledge assets.
  - `uploadService.list(user, {relatedType, relatedId})` filters by linked object;
    `GET /api/uploads?relatedType=&relatedId=` exposes it.
  - `FileUploader` gained an optional `related` prop — when present it uploads with the link and
    shows only that object's files.
  - Ingestion already maps `related` → the KnowledgeDocument's companyId/dealId/clientId, so an
    uploaded, embedded doc is retrievable by RAG **and** appears on the object page.
  - **Company 360 › Knowledge** now has the uploader (linked to the company) above its documents;
    **Person 360** gained a **Files** tab (linked to the person).
- **Verified live (:4100):** upload linked to a company → appears under that company's files
  (status advancing to ready), a different company id returns 0 (object isolation), Company 360 +
  Person 360 render. typecheck + lint + build 0.
- **Also fixed this session:** a **hydration bug** on Home (client components formatting dates with
  `toLocale*` → SSR/CSR mismatch). Added `lib/format.ts` (deterministic `fmtDate/fmtClock/
  fmtDateTime/fmtRel`) + server-side formatting for Home; replaced locale calls in
  exec-dashboard, lead-detail, tasks-workspace, connectors panel.

### ADR-031 — File uploads: GridFS + async ingestion pipeline (Sprint 3)
- **Date:** 2026-07-21
- **Status:** Accepted (plan item #3)
- **Architecture (async, not synchronous):** upload returns as soon as bytes are in **GridFS**;
  extraction→embed→index runs **asynchronously** (fire-and-forget on the node server) through an
  explicit status model: `stored → extracting → extracted → embedding → ready` (or `failed` +
  `errorReason`, `retryCount`, `lastProcessedAt`). Retry via `POST /api/uploads/[id]/reprocess`.
- **Pluggable `ExtractorRegistry`** (`lib/files/extractors.ts`): text (txt/md/csv/json/…, zero
  deps), pdf, docx, spreadsheet. Rich parsers load via **dynamic import with fallback** — app
  builds without them; a missing parser yields a clear **"Extraction unavailable"** status
  (verified with .pdf here). Adding OCR/HTML/email = add an extractor.
- **`uploadedFiles`** (workspace-scoped) stores status, **raw extracted text** (no reparse),
  chunkCount, documentId, **version** (revisions never overwrite), and `related[]` (object-aware,
  Sprint 4). Binary in GridFS bucket "uploads".
- **Services:** `uploadService` (store + version + kick off async ingest; list; download; remove;
  reprocess) → `ingestionService.process` (the pipeline; reuses `documentService.upload` for
  chunk→embed→Qdrant→KnowledgeDocument, workspace-tagged).
- **API:** `POST/GET /api/uploads`, `GET/DELETE /api/uploads/[id]`, `POST /api/uploads/[id]/reprocess`.
  **UI:** Knowledge workbench `FileUploader` (multi-file, live status polling, retry, download,
  version badge).
- **Verified live (:4100), full checklist:** .md upload → 201 stored → status **ready** (chunks=1,
  documentId set, raw text kept) → **RAG grounded** ("BLUE-FALCON-42 [1]") → **download** returns
  bytes → **listed** in Knowledge; **.pdf → failed "Extraction unavailable — parser for .pdf not
  installed"** (graceful; will extract after `npm install`). typecheck + lint + build 0.
- **Deploy note:** fire-and-forget ingestion completes on a long-running node server; on serverless
  (Vercel) a queue/worker is needed — the status model + `reprocess` already support it.

### ADR-030 — Persistent Assistant conversations (foundation for all AI features)
- **Date:** 2026-07-21
- **Status:** Accepted (plan item #2; persistence only — no GridFS/ingestion/Knowledge yet)
- **Schema (forward-designed):** `conversations` {userId, title, summary, messageCount,
  lastMessageAt, pinned, archived, relatedObjects[]} + `chatMessages` {conversationId, role,
  content, status, **attachments[]** (forward-compat for Sprint 3 — no migration needed),
  citations[], **provider/model/tokens/latencyMs** (vendor-agnostic), metadata}. Both workspace-
  scoped (demo/production isolated).
- **`ConversationService`** = the single persistence layer (pages/routes never touch Mongo):
  `list` (pinned-first, `?q=` text search over titles+summaries+**message content**,
  `includeArchived`), `create`, `get`, `append` (persists role+content+AI metadata; auto-titles
  from first user message; bumps count/lastMessageAt), `rename`, `setFlags` (pin/archive),
  `attachObject`, `remove` (soft-deletes messages too).
- **API:** `GET/POST /api/conversations`, `GET/PATCH/DELETE /api/conversations/[id]`,
  `POST /api/conversations/[id]/messages` (persist user → run `chat()` orchestrator → persist
  assistant with provider/model/latency).
- **UI:** Assistant reworked ChatGPT-style — conversation rail (New chat · search · pin · rename ·
  archive · delete · recent), thread loads from `/assistant?c=<id>`, history survives reload,
  approvals preserved.
- **Verified live (:4100):** create→send→reload persists (2 turns, model stamped); search matches
  message content; pin/rename/archive/delete all work. typecheck + lint + build 0.
- **Next:** #3 GridFS uploads (attachments schema already in place) → #4 Knowledge integration.

### ADR-029 — Computed Views: eliminate hardcoded UI metrics (foundational)
- **Date:** 2026-07-21
- **Status:** Accepted (item #1 of the 4-part "behaves like an OS" plan)
- **Context:** Employee + department KPIs were **static seeded values** (`employee.kpis`,
  `orgUnit.metadata.kpis`) — the UI wasn't deriving from the object model. Role/dept/manager/
  title/status were already DB-driven + editable; KPIs were the violation.
- **Decision:** New **`employee-view-service`** (the requested "view model" layer):
  `computeEmployeeView(userId, capacity, {leads, tasks, meetings})` derives openTasks/overdue/done,
  meetings-this-month, owned/won/pipeline value, overload, and KPI chips — **all computed, never
  stored**. Ships a pure `computeFrom` + bulk `loadData` so lists/rollups load data once (no N+1).
  - **Person 360** → KPIs computed (Pipeline/Won/Meetings(mo)/Open work), tagged "computed live".
  - **People directory** → per-employee KPI chips computed from one bulk load.
  - **Organization** → department KPIs (Pipeline/Won/Open work) computed by aggregating members'
    live data; `metadata.resources` kept as config (not a metric).
- **Verified live (:4100):** Person 360 shows the computed KPIs; People + Org 200. typecheck +
  lint + build 0.
- **Note:** the seeded static `employee.kpis` field is now unused for display (harmless; can be
  dropped from `simulate.ts` later). Remaining plan items: #2 persistent Assistant conversations,
  #3 GridFS file uploads, #4 upload→Knowledge/Qdrant + object-aware linking.

### ADR-028 — Brand logo + light/dark theming (logo-matched palette)
- **Date:** 2026-07-21
- **Status:** Accepted
- **Logo/favicon:** real Svayantra Tech logo hardcoded — `public/brand/svayantra-logo.png`
  (transparent) + `src/app/icon.png` (favicon). `<Logo>` renders the image; because the logo's
  wordmark is dark (made for light bg), dark mode sits it on a light `.logo-tile`, light mode
  renders it plain.
- **Theming:** tokens converted to **CSS variables (RGB triplets)** in `globals.css` with a
  `.light` override; Tailwind colors resolve to `rgb(var(--x) / <alpha>)` so every token flips.
  Added `fg` (foreground) + `overlay` (theme-aware subtle surfaces) tokens. No-flash theme script
  in root layout; `ThemeToggle` in the sidebar footer; persisted to `localStorage` (`stos-theme`),
  **dark default**.
- **Logo-matched palette:** brand gradient changed from cyan→indigo→violet to **steel blue →
  cyan** (logo S/T + TECH); **action = orange** (the logo arrow). Light theme = soft light-gray
  canvas, near-black text, white panels, blue/cyan accents, orange action.
- **Migration:** bulk, mechanical — `text-white`→`text-fg`, `*-white/α`→`*-overlay/α` across all
  components so light mode actually adapts (0 remaining). `.glass` gets a solid panel in light.
- **Verified live (:4100):** logo asset + favicon 200; light `--bg`/`--fg` + `var(--blue)` brand
  gradient compiled into shipped CSS; all pages 200; typecheck + lint + build 0.
- **Caveat:** dark is fully polished; light mode is functional (tokens flip) but wants a visual QA
  pass for residual raw colors (a few `text-red-*`, modal scrim, chip `text-surface`).

### ADR-027 — STOS v2 rollout Phases 2–3: supporting + remaining modules
- **Date:** 2026-07-21
- **Status:** Accepted (design migration; visual only, no logic/workflow/feature changes)
- **Phase 2 (supporting):**
  - **Knowledge** — header → `PageHeader` (workbench logic untouched).
  - **AI / Assistant** — empty-state mark → brand gradient + pulse + gradient wordmark (chat logic
    untouched). NOTE: the full "AI workspace" (quick actions / research / agents / long-running
    jobs) is a FEATURE effort — out of scope for a design migration.
  - **Command Center** — page → `WorkspacePage` hero; view already on `.ai-surface`.
- **Phase 3 (remaining):** migrated to `WorkspacePage`/`PageHeader` (no new patterns):
  Workspace hub, Settings, Audit, Organization Timeline, Organization (+`PageHeader` above the
  departments overview + console), Integrations/Connectors. Renamed the workspace page function to
  avoid a clash with the `WorkspacePage` template. Calendar/Reports are VIEWS, not pages — n/a.
- **Verified live (:4000):** Phase 2 (`/knowledge`, `/assistant`, `/command`) + Phase 3
  (`/workspace`, `/connectors`, `/admin/{settings,audit,timeline,organization,roles,employees,
  sales-models}`) all 200. typecheck + lint + build 0 (cleared stale `.next` once for the known
  Windows worker error).
- **Still bespoke inside components (final-QA candidates, already token-based):** roles-matrix,
  objects-panel, sales-models, tasks-workspace internals — they use DS tokens but render their own
  section headers. Fold into the final visual-QA pass.

### ADR-026 — STOS v2 rollout Phase 1: Work, Company 360, Person 360
- **Date:** 2026-07-21
- **Status:** Accepted (Phase 1 of the migration; Phases 2–3 pending)
- **Context:** Design migration (no features/logic/workflow/IA-logic changes) — move real screens
  onto the DS so the app feels like one OS. Reuse-first: compose from `src/components/ds` only.
- **Decision / done:**
  - New templates: `CollectionPage`, `WorkspacePage` (thin compositions of `PageHeader`+`Section`).
  - **Home** → workspace **zones** (Company pulse · AI briefing · Focus · Today · What happened)
    on DS primitives (done previously; ADR-024/025 foundation).
  - **Work** (`/work`, `/work/tasks`) → `CollectionPage` + `Section`; existing grid/board/tabs
    logic untouched. (Inbox / Saved Views flagged as FEATURES — out of scope for a design migration.)
  - **Companies** → first-class: `/companies` (`CollectionPage` book-of-business) + `/companies/[id]`
    **Company 360** on `ObjectPage` (Overview/Financial context, Relationship health, Opportunities,
    People, Meetings, Timeline, Knowledge, Activity) — read-only composition of company/contact/
    lead/meeting/document/activity services. "Companies" added to sidebar (additive).
  - **People** → `/people/[id]` **Person 360** on `ObjectPage` (Workload & performance, KPIs,
    Skills, Today's work, Meetings, Relationships=manager+reports, Activity); directory header →
    `PageHeader`, names link to the 360.
- **Verified live (:4000):** all pages 200; Company/Person 360 render real data on the template.
  typecheck + lint + build 0. No business logic/workflow changed.
- **Next:** Phase 2 (Knowledge, AI, Command Center) → Phase 3 (Calendar, Organization,
  Administration, Integrations, Settings) → final visual QA. Rule enforced: search DS before any
  new pattern; new components only when the system genuinely can't compose the need.

### ADR-025 — STOS Design System v2 milestone (catalogue + primitives + showcase)
- **Date:** 2026-07-20
- **Status:** Accepted (system built; page rollout intentionally deferred)
- **Context:** A theme isn't an identity. Need a documented design *language* + reusable
  primitives BEFORE touching product pages, to prevent drift as STOS commercializes.
- **Decision:** Build "STOS Design System v2" as its own milestone; do NOT refactor product pages
  yet (sequence: ratify system → then roll out).
  - **Catalogue:** `STOS_DESIGN_SYSTEM.md` — principles, tokens, component library (purpose ·
    variants · states · a11y · token deps each), page templates, object-page template, workspace
    zones, module personalities, data-viz standards, motion, iconography, spacing, typography,
    accessibility, and the rollout sequence.
  - **Primitives (`src/components/ds/`):** `PageHeader` (signature header, `hero` variant),
    `Section` (workspace zone — replaces floating cards), `StatTile`+`KpiRow` (standard KPI
    presentation), `AICallout`/`AIInsight`/`AIChip`/`TypingDots` (the one AI treatment),
    `Timeline`, `ActivityFeed` (single feed), `Badge`+`Avatar`, and **`ObjectPage`** — the
    canonical object-detail template (Avatar/logo · name · statuses · AI summary · quick actions
    + fixed tabs Overview/Timeline/Work/Meetings/Knowledge/Relationships/Analytics, ARIA
    tablist + arrow-key nav). Barrel `@/components/ds`.
  - **Living catalogue:** `/design` (owner-only) renders every primitive + the object template
    with sample data — the sign-off artifact.
- **Not done yet (next milestone):** converting Home to zones, building real Company/Person 360 on
  `ObjectPage`, migrating existing pages/tables to the primitives, Lucide icon swap, light mode.
- **Verified:** typecheck + lint + build 0; `/design` renders live. No business logic/workflow/IA
  changed.

### ADR-024 — STOS v2 Visual Design System ("Svayantra vibrant")
- **Date:** 2026-07-20
- **Status:** Accepted (foundation pass — dark theme)
- **Context:** UI read as "generic dark SaaS"; brief was to match the vibrant Svayantra Tech
  website (energy, gradients, depth, motion, high contrast). Visual-only — **no business logic,
  workflow, or IA change**.
- **Decision:** A formal **design-token system** in `tailwind.config.ts` + `globals.css`, consumed
  by components (no hardcoded hex):
  - **Palette:** signature brand gradient **cyan `#22D3EE` → indigo `#6366F1` → violet `#A855F7`**;
    teal = positive, coral = urgent; semantic success/warning/danger/info; a **layered surface
    ladder** (bg → surface → panel → elevated → floating) for real depth.
  - **Scales:** radii (md/lg/xl/2xl), **elevation shadows** e1/e2/e3 + `glow`/`glow-ai`, motion
    durations + `ease-emphasized` curve, typography utilities (`t-display/title/section/meta/micro`).
  - **Component classes (names preserved so the whole app upgrades at once):** richer `.glass`
    (gradient fill + sheen + e1), `.glass-hover` (lift), `.floating` (modals/palette), primary
    `.btn-accent/.btn-primary` = **brand-gradient + glow**, `.btn-action`, `.btn-ghost`, `.inp`
    (focus glow), unified `.badge` system, **`.ai-surface`/`.ai-chip`** (branded gradient + glow +
    pulse for AI), `.text-gradient`, `.shimmer` skeletons.
  - **Ambient mesh** app background (cyan/violet/teal radial glows). **Sidebar** redesigned:
    icon tiles, brand-gradient active pill + accent bar + glow. AI surfaces (exec briefing,
    command-center recs, palette) get the special treatment. Home greeting = gradient name.
- **Scope note:** vibrant **dark** theme delivered + verified (brand gradient compiled into
  shipped CSS; all pages 200). **Light mode** tokens are structured for but NOT yet applied across
  components (needs the hardcoded-alpha → token migration). Exact SVT brand hexes can be dropped
  into `tailwind.config.ts` in one place. typecheck + lint + build 0.
- **Alternatives considered:** renaming tokens (rejected — would touch every screen; instead kept
  names, changed values so adoption is automatic).

### ADR-023 — Sprint 12D (2–5): Realism, Executive dashboard, Branding/polish, ⌘K palette
- **Date:** 2026-07-20
- **Status:** Accepted
- **12D-2 Operational realism:** new fields `Lead.intentScore`, `Company.revenueEstimate`,
  `Employee.kpis`, `Playbook.kpis`; department KPIs/resources in `orgUnit.metadata`. `simulate.ts`
  populates ICP + intent scores, per-lead AI summaries, company revenue, employee/dept/playbook
  KPIs, a **Founder Sales** team, and client/meeting-notes knowledge docs. Displays: lead
  Intelligence sidebar shows ICP/Intent/Win%; People shows initials avatars + KPI chips; Sales
  models shows playbook KPI chips; **Departments overview** (`DepartmentKpis`) renders each
  department's KPIs + shared resources + headcount atop `/admin/organization`. (Idempotent-create
  trap: KPIs backfilled via `updateMany`.)
- **12D-3 Executive dashboard + AI briefing:** owner/manager Home renders `ExecutiveDashboard`
  (big forecast KPI tiles + Chief-of-Staff **AI executive briefing** via
  `POST /api/command-center/briefing` + above-the-fold attention panels: needs-attention,
  revenue-at-risk, team-load, meetings-today, overnight strip). Non-managers keep the persona home.
- **12D-4 Branding + polish + delight:** reusable `<Logo/>` lockup (SVT-inspired gradient mark +
  "by Svayantra Tech") on sign-in + sidebar; premium branded sign-in with ambient glow; global
  `.animate-in` entrance + `:focus-visible` ring in globals.css; page content fades in;
  `EmptyState` gained an icon; typing-dots indicator.
- **12D-5 ⌘K Command Palette:** `CommandPalette` mounted app-wide (⌘/Ctrl+K), sidebar "Search ⌘K"
  trigger. Jump to any page, run actions (new task, ask STOS, **switch Demo⇄Production**), and
  **global search** (`searchService` + `GET /api/search`) across leads/companies/employees/docs —
  permission-gated + workspace-isolated. Keyboard nav (↑/↓/Enter/Esc).
- **Verified live (:4000):** exec dashboard + AI briefing render; search `q=NCR` returns
  lead+company+doc; sign-in branded. typecheck + lint + build all 0. **Sprint 12D complete.**

### ADR-022 — Sprint 12D-1: Demo/Production data isolation (workspace tagging)
- **Date:** 2026-07-20
- **Status:** Accepted
- **Context:** Demo and production data must never mix; switching mode must instantly hide all
  simulated content; demo must never write into production; AI/search/dashboards/KPIs respect
  the active mode.
- **Decision:** A **`workspace: "demo" | "production"`** dimension on CONTENT collections only.
  - `src/lib/workspace.ts` — `activeWorkspace()` (React `cache`, per-request) maps 1:1 from the
    org operating mode (`lib/mode.ts`): Demo mode → demo workspace, Production → production.
  - `repo()` gains opt-in `{ workspaceScoped: true }`: scoped reads add `workspace: <active>`,
    writes stamp it. Enabled on leads (custom data module), companies, contacts, tasks, meetings,
    proposals, quotations, activities, notifications, documents, customRecords, workflowInstances.
  - **Identity/config stays shared** (users, employees, roles, org units, playbooks, conveyor
    teams, settings) so auth + structure survive a mode switch. Consequence: the People
    directory and org tree persist across modes by design; operational content is what isolates.
  - Raw aggregations (`finance-service`, `dashboard-service`) filter by `activeWorkspace()` too.
  - **Knowledge/RAG:** Qdrant payload carries `workspace`; retrieval adds a `workspace` filter;
    `ensureCollection` now creates the `workspace` keyword payload index idempotently (also on
    pre-existing collections). AI only retrieves from the active mode.
  - `simulate.ts` runs in demo → all synthetic content tagged `demo` (+ a backfill pass).
    Production starts as a clean slate.
- **UI:** `WorkspaceToggle` on the owner Home header (flip mode → `router.refresh()` re-reads
  every server component); persistent "Demo" pill in the sidebar.
- **Verified live (:4000):** Demo = 18 leads / 8 conveyor / grounded RAG; Production = 0 / 0 /
  "I don't have that"; toggling back restores demo. typecheck + lint + build 0.
- **Alternatives considered:** Separate orgId per mode (rejected — breaks the acting user's
  membership resolution). Blanket workspace scoping on ALL collections (rejected — would hide the
  owner's own employee/role record and break access).

### ADR-021 — Sprint 12: SVT Organization & Real Operations (Simulation, People Admin, Command Center)
- **Date:** 2026-07-20
- **Status:** Accepted
- **Context:** Move from demo mode to a realistic internal operating environment. Reframed
  "seeding" as **simulation** (open STOS and it looks like SVT has run on it for ~3 months),
  made the team **data not code** (People admin), and separated Demo vs Production.
- **12A — Simulation engine + Demo/Production mode:**
  - `src/lib/mode.ts` — org operating mode in settings (`getOrgMode`/`setOrgMode`/`assertDemoMode`);
    defaults to `demo`. Simulation/reset refuse in Production.
  - `scripts/simulate.ts` (`npm run simulate`) — idempotent, demo-guarded. Builds the real SVT
    org (8 departments + managers + capacity, employees assigned by role), **8 playbooks**
    (Founder/Enterprise/SMB Outbound, Inbound Qualification, Client Onboarding, Proposal
    Follow-up, Renewal, Referral), conveyor teams (Outbound Alpha, Enterprise Accounts), **16
    companies across 8 industries**, **18 leads at every stage** with a **time-machine backdating
    sweep** (createdAt / stageHistory / ownerHistory / activities spread across 60–90 days),
    per-person tasks (some completed+backdated), past+upcoming meetings, 4 proposals, 3 quote
    approvals, and **6 knowledge documents** (overview, pricing, SOPs, template, FAQ) so RAG has
    real content. Verified live: conveyor dashboard populated (avg cycle 65.3d), RAG answers
    "pricing tiers" with citations.
- **12B — People Administration:** the team is now data. `employeeService.create` provisions a
  Better Auth account (returns a shareable temp password — email invites need Resend) + directory
  record; `POST /api/admin/employees`. `/admin/employees` upgraded to a full admin: **Add
  employee** (name/email/role/title/department/manager/capacity/execution-model) + inline edit of
  role/status/department/manager/model. New `Employee.defaultExecutionModel`. `/people` stays a
  simple directory (new props optional). Demo/Production toggle UI at `/admin/settings` (owner
  toggles, managers read-only) via `GET/PATCH /api/admin/mode`; Workspace cards for Settings +
  Sales models.
- **12C — Owner Command Center:** `/command` (sidebar for owner; page gated `users.read`) —
  `commandCenterService.summary` aggregates the 8 executive questions: what happened (48h
  activity), what's blocked (approvals waiting + SLA breaches), who needs help (overloaded/overdue),
  deals at risk, forecast (booked + stage-weighted pipeline + win rate), team utilization,
  bottlenecks. AI recommendations via `POST /api/command-center/recommendations`
  (`ai/command-recommendations.ts`). Verified live: real prioritized recommendations grounded in
  the simulated data.
- **Consequences:** `npm run simulate` is the canonical "make it look alive" command; demo-seed
  remains for the lighter set. Adding a hire no longer needs a deploy. Mode gates synthetic-data
  ops. typecheck + lint + build all 0; live-verified on :4000.
- **Alternatives considered:** Backdating via service calls (rejected — services stamp `now`; a
  post-hoc time-machine sweep over collections gives faithful history). Per-employee hard
  execution model (rejected — model lives on the Lead; employee field is a default/hint only).

### ADR-020 — Sprint 11: Deferred Work-Engine surfaces (Work views, Conveyor dashboard, Sales-model admin, Calendar)
- **Date:** 2026-07-20
- **Status:** Accepted
- **Context:** Sprint 10 (ADR-019) shipped the Work Execution Engine backends but deferred four
  UI/analytics surfaces. This sprint builds them on the existing, verified backends (no schema
  or engine changes) and diagnoses the Google Calendar connect issue.
- **11A — Work views:** `/work/tasks` gains a client-side view switcher — **List** (open/done),
  **Board** (kanban by priority: High/Medium/Low/Unprioritized), **Calendar** (due-date buckets:
  Overdue/Today/Tomorrow/This week/Later/No date), **Workload** (per-assignee open-count vs.
  `employee.capacity`, overload flagged). Page now passes `capacityById` + `currentUserId`.
- **11B — Conveyor throughput dashboard:** new `conveyor-metrics-service` (one pass over
  conveyor-model leads → per-team leads-per-stage, SLA compliance %, active breaches, avg handoff
  hours from `ownerHistory`, avg cycle days, conversion %, bottleneck stage). Surfaced at
  `/work/conveyor` (new `WorkTabs` "Conveyor" tab, gated to `users.read`) via `GET
  /api/metrics/conveyor` (`assertPermission("sales.read")`). Read-only server-rendered dashboard.
- **11C — Sales-model admin UI:** `/admin/sales-models` (Workspace card, gated `workflows.manage`
  ∥ `sales.assign`) — create/delete Operating Playbooks (label + model + ordered stages + optional
  per-stage SLA) and create/delete Conveyor Teams (name + member chips + optional playbook). New
  `DELETE /api/playbooks/[id]`; conveyor-team CRUD already existed.
- **11D — Calendar auto-schedule:** `POST /api/work/schedule` pushes the caller's open, dated
  tasks into Google Calendar via the existing `calendarService`. **Degrades gracefully** — returns
  `{connected:false}` (not a 500) when Google isn't connected, so the Calendar view can prompt to
  connect. Added `.inp` form-control class to `globals.css`.
- **Google Calendar "not working" — root cause = configuration, not code.** The OAuth start/
  callback, credential seal/refresh, and REST client are all correct; `BETTER_AUTH_URL` resolves
  the redirect URI to `http://localhost:3000/api/connectors/google/oauth/callback`. The connect
  flow fails only when (a) that exact URI isn't whitelisted in the Google Cloud OAuth client's
  Authorized redirect URIs, or (b) the OAuth consent screen is in **Testing** and the Google
  account isn't added as a Test user (calendar scopes are sensitive → unverified apps block
  non-test users). See `known-issues.md`.
- **Consequences:** All four Work-Engine surfaces are now navigable. Conveyor dashboard shows an
  empty state until leads are set to the Conveyor model + a team (`npm run seed-sales` seeds
  playbooks + "Outbound Team Alpha"). typecheck + lint + build all exit 0; live smoke on :3000
  green (metrics/schedule/pages all 200, schedule correctly reports `connected:false`).
- **Alternatives considered:** Board-by-status (rejected — task status is binary open/done, so
  priority columns are more useful). A separate `/analytics` area for the conveyor dashboard
  (rejected — it belongs beside the work it measures, as a Work tab).

### ADR-019 — Sprint 10: Work Execution Engine (People, Tasks & Sales Operations)
- **Date:** 2026-07-20
- **Status:** Accepted
- **Context:** Unify tasks + sales operations into one AI-orchestrated work layer on shared
  business objects (not a standalone task manager). Built in 3 verified phases.
- **Phase 10A — People + Work/Tasks workspace:**
  - Employee model gains `title`, `skills[]`, `capacity`, `availability`; **Deblina** added as
    a real Marketing login; reporting lines + profiles seeded (`npm run add-people`).
  - `/work` becomes tabbed (Leads · Tasks). New `/work/tasks` with **My / Team / All Work**
    scopes — `taskService.listScoped` enforces RBAC server-side (mine=own; team=direct reports,
    users.read; all=owner only). Status columns, overdue flags, inline complete, AI "Plan my
    day". Verified: owner all=22/mine=6; Deblina My-only + `scope=all`→403; sales_head sees Team.
- **Phase 10B — Sales Execution Models:**
  - Lead gains `executionModel` (individual|conveyor), `conveyorTeamId`, `playbookKey`,
    `currentStageOwnerId`, `stageDeadline`, `ownerHistory[]`.
  - **Operating Playbooks** (`playbooks`) + **Conveyor Teams** (`conveyorTeams`) entities +
    services + APIs; seeded `individual-full-cycle`, `conveyor-outbound`, and "Outbound Team
    Alpha" (`npm run seed-sales`).
  - **Autonomy enforcement** (`assertCanModify` in lead-service, on update/advance/touch):
    managers act on any lead; individual → owner only; conveyor → team members only. Advancing
    a conveyor lead stamps the next stage's SLA deadline + records the handoff.
  - `POST /api/leads/[id]/model` sets the model; lead detail shows an Execution-model panel
    (model, team, playbook, SLA, current owner, ownership history) with a manager control.
  - Verified: conveyor lead SLA set; team member (Priya) can touch it; **Priya editing Rahul's
    individual lead → 403 "owned by another rep"**; owner/manager allowed.
- **Phase 10C — AI Sales Ops + Daily Briefing:**
  - `ai/daily-briefing.ts` + `POST /api/work/briefing` → personalized, prioritized, overdue-
    first briefing (wired to the Tasks "Plan my day" button, on-demand).
  - AI tool `find_sla_breaches` ("who missed SLA"). Verified: briefing generated for Priya;
    breach tool flagged the overdue conveyor lead.
- **Verification:** typecheck + lint + build exit 0 at every phase; all above smoke-tested live.
- **Deferred (scaffold ready):** Calendar/Board/Workload work-views + Google auto-scheduling;
  dedicated conveyor throughput dashboard (metrics-service ready); a Workspace admin UI for
  playbooks/teams (currently API + seed + AI).

### ADR-018 — Final Validation Sprint (Consolidation Program complete)
- **Date:** 2026-07-20
- **Status:** Accepted
- **Scope:** End-to-end validation of the whole STOS Architecture Consolidation Program
  (Sprints 1–9) across all five personas + the mandated end-to-end workflows.
- **Results (live on :3000, production build + typecheck + lint all exit 0):**
  - **Persona nav matrix:** all 5 personas (owner, sales_head, sales_rep, finance_head,
    ops_manager) resolve every route; admin routes render **no admin content** for
    non-admins (server-side redirect, verified no `h1` leak). No broken navigation.
  - **E2E deal lifecycle:** create lead → log touch → schedule meeting → advance
    new→qualified→meeting→proposal→negotiation→**won**. ✓
  - **Approval:** owner approved a running quote instance (NCR ₹6.5L, node a2) → **approved**,
    workflow completed. ✓
  - **AI over business objects:** `entity_dossier` grounded history; `assign_task` to another
    employee with notification; `assign_leads` round-robin; `log_touch`; org edits
    ("Rahul reports to Anita"). ✓
  - **RAG:** upload doc → ask → **grounded:true** answer with citation [1]. ✓
- **Known non-automatable:** live Google Calendar OAuth requires interactive consent — the
  connect/refresh/health architecture is wired and verified for all reachable states.
- **Net:** all 9 sprints delivered, each gated (typecheck+lint+build+live smoke) before the
  next. Backend engines (RBAC, workflow, policy, metadata, Qdrant, Better Auth) preserved
  throughout — the program was additive consolidation, not a rewrite.

### ADR-017 — Sprint 9: Executive Operating System (dashboards)
- **Date:** 2026-07-20
- **Status:** Accepted
- **Context:** The old `/dashboard` was deleted in Sprint 1; Home is the executive surface.
  Sprint 9 turns Home into a persona-aware analytics dashboard (no separate route → keeps the
  6-item IA intact).
- **Decision:**
  - **`metricsService.summary`:** one pass over the org's leads → pipeline by stage
    (count + value), won/pipeline totals, win rate, SDR leaderboard (by owner, won value),
    source mix, and an at-risk list (no-reply-after-follow-ups / never-contacted / marked
    stalled). Permission-scoped (crm.read to compute).
  - **`Dashboard` on Home:** "Business at a glance" — pipeline-by-stage bars, win rate, and
    either the **Rep leaderboard** (users.read → managers/owner) or the **source mix**
    (everyone else); ₹ figures render only for finance-visible personas; "Deals that need
    attention" deep-links to lead pages. Sits above the existing action briefing.
- **Verification:** typecheck+lint+build exit 0. Live: owner → Pipeline by stage + Rep
  leaderboard + Win rate (+₹); sales_rep → Pipeline by stage + source mix, leaderboard and ₹
  correctly hidden.
- **Deferred:** dedicated Finance (cashflow/invoices/collections) and Operations
  (projects/capacity/bottlenecks) dashboards need invoice/project objects not yet modeled;
  forecast + pipeline-aging trend charts. Scaffold (metrics-service) is ready to extend.

### ADR-016 — Sprint 8: Integrations Layer
- **Date:** 2026-07-20
- **Status:** Accepted
- **Context:** Connector architecture (registry, encrypted creds, auto token refresh,
  disconnect, statuses) already existed and is extensible. Gaps: no health/test-connection and
  a thin status UI.
- **Decision (additive; core unchanged):**
  - **`connectorService.test(user, kind)`:** mints a fresh token (refreshing if expired) and
    does one live read (Calendar: list 1 event) to prove the integration works; records health
    via `markStatus` (connected+lastSyncedAt on success, error on failure). Returns
    supported/connected/healthy/detail. Exposed at `POST /api/connectors/[kind]/test`.
  - **`markStatus` helper** in the credential layer (status + optional lastSyncedAt).
  - **UI:** connectors page → "Integrations", grouped by category, per-connector status dot
    (connected/error/not-connected), account email + last-synced, and Test / Reconnect /
    Disconnect actions with inline health result. Planned providers show "Coming soon".
  - **Extensibility confirmed:** adding Slack/Notion/Outlook/HubSpot/Drive/Gmail is a registry
    entry + provider impl of the existing `OAuthProvider`/`CalendarProvider` interfaces — no
    core changes. The AI reads the internal knowledge layer, never a vendor directly.
- **Verification:** typecheck+lint+build exit 0. Live: page renders categories + status;
  `GET /api/connectors` lists registry with availability; test `google_calendar` → correctly
  "Not connected"; test `slack` → "isn't testable yet". (Full Google OAuth needs interactive
  consent — token-refresh + health paths are wired and unit-verified for the reachable states.)

### ADR-015 — Sprint 7: Knowledge Graph & Organization Memory
- **Date:** 2026-07-20
- **Status:** Accepted
- **Context:** Knowledge was document-only RAG. Sprint 7 makes the whole business queryable —
  "everything about X" across operational data + the audit trail, grounded.
- **Decision:**
  - **`dossierService.forName`:** assembles a chronological, source-attributed dossier for a
    lead/client — merging stage history, activity, meetings, proposals, tasks, and audit
    entries (resolving `actorId`→employee name, incl. `ai:` prefix → "via AI"). One timeline,
    oldest→newest, each event tagged with its type + date.
  - **AI tool `entity_dossier(name)`:** exposes it so the assistant answers "show everything
    about NCR", "when did negotiations begin?", "who approved pricing?", "what meetings
    happened before the quote?" — grounded in returned events with type+date citations.
  - Complements the existing document RAG (`search_company_knowledge`, Qdrant) and the visual
    dossier already on the lead detail page (Sprint 3).
- **Verification:** typecheck+lint+build exit 0. Live: "everything about NCR" → full dated
  history with citations; "when did negotiations begin?" → exact timestamp + actor
  ("Rahul Verma advanced it proposal → negotiation") from stage history + audit.
- **Deferred:** cross-entity graph traversal (company↔leads↔contacts as a true graph);
  invoices/emails/calendar sources arrive with Sprint 8 integrations.

### ADR-014 — Sprint 6: Task & Workflow Engine
- **Date:** 2026-07-20
- **Status:** Accepted
- **Context:** Tasks could only be created for the current user; no collaboration or org-aware
  assignment.
- **Decision (additive):**
  - **Task model:** added `createdById`, `followers[]`, `comments[]`, `dependsOn[]`,
    `recurrence` (none/daily/weekly/monthly).
  - **Assignment + notifications:** `create` records creator, auto-follows creator, and
    notifies the assignee when it's someone else. `assignToRole` and `assignToUnit` fan a task
    out to every active employee with a role / in a dept-or-team.
  - **Collaboration:** `addComment` ($push, notifies assignee + followers except author),
    `toggleFollower` ($addToSet/$pull) via `POST /api/tasks/[id]/comment` and `/follow`.
  - **Recurring tasks:** completing a task with a recurrence spawns the next occurrence with
    its due date shifted (daily +1 / weekly +7 / monthly +30).
  - **AI:** `assign_task` (to an employee by email, optional lead link) and
    `assign_task_to_role` (bulk by role) — notifies assignees.
- **Verification:** typecheck+lint+build exit 0. Live: AI assigned a task to Priya (notified);
  AI bulk-assigned both sales reps; Priya's notifications populated; comment added + persisted;
  recurrence spawn PASS (2 tasks, 1 open) via service.
- **Deferred:** dedicated task-board UI (no IA slot yet — tasks surface on Home + lead detail +
  via AI); dependency enforcement (field stored, not yet gating); @mention parsing.

### ADR-013 — Sprint 5: AI Assistant v2 (Operating System Brain)
- **Date:** 2026-07-20
- **Status:** Accepted
- **Context:** The assistant behaved like generic ChatGPT — static prompt, no situational
  awareness, asked for data it should already know.
- **Decision:**
  - **Live context injection:** `buildContext(user)` gathers a permission-scoped, real-time
    snapshot (identity + role + isOwner; pipeline counts by stage; my open tasks; approvals
    awaiting action; upcoming meetings; team roster name/email/role; org units) and appends it
    to the system prompt each turn. The prompt instructs the model to USE it and not re-ask.
  - **STOS identity + rules:** renamed from "RevenueOS"; reason over business objects not chat
    history; ground in tools; keep the stage-change human-approval boundary.
  - **New reasoning tools:** `list_leads` (stage/source filters — "clients from LinkedIn"),
    `find_stale_leads` (minTouches + minDaysSinceTouch — "who hasn't replied after N follow-
    ups"), `assign_leads` (round-robin reassignment by rep emails — "split qualified leads
    between Priya and Arjun"; crm.write-gated via new `leadService.reassign` + `leads.setOwner`).
    Iteration budget 6→8 for multi-step bulk ops.
- **Verification:** typecheck+lint+build exit 0. Live (owner): answered role + 14-lead pipeline
  from context with no tool; `list_leads` LinkedIn → NCR; `assign_leads` split 2 qualified
  leads round-robin (Verde→Priya, Ashwin→Rahul) — DB-confirmed.

### ADR-012 — Sprint 4: Outbound Sales Operating System
- **Date:** 2026-07-20
- **Status:** Accepted
- **Context:** Make STOS an outbound CRM, not a passive record store — attribution + engagement.
- **Decision (additive):**
  - **Data model:** `Lead` gains `source` (apollo/linkedin/website/referral/email/whatsapp/
    conference/manual/other), `campaign`, `touchCount`, `lastTouchAt`. `LeadCreateSchema`
    accepts source/campaign; `leads.logTouch` uses `$inc` + `$set` (atomic).
  - **Engagement:** `POST /api/leads/[id]/touch` (channel + note) → `leadService.logTouch`
    bumps count, stamps last-touch, writes the activity timeline, audited as `lead.touch`.
  - **UI:** `/work` grid gains a Source column (inline editable) + source filter; lead detail
    shows source/campaign/touches/days-since-last-touch + a `LogTouch` control (channel + note).
  - **AI:** `create_lead` extended with source/campaign; new `log_touch` tool ("I just called
    Acme" → finds lead, logs touch).
- **Verification:** typecheck+lint+build exit 0. Live: source/campaign PATCH; two touches
  increment 1→2 with last-touch stamped; grid Source column + filter; detail engagement panel;
  AI `log_touch` executed ("now 3 touches").
- **Deferred to Sprint 8 (Integrations):** real email/LinkedIn/WhatsApp sending, multi-step
  sequences/cadences, open/reply/click tracking (needs provider webhooks). Engagement scaffold
  (touches + last-touch + timeline) is in place to receive them.

### ADR-011 — Sprint 3: Lead Intelligence & CRM
- **Date:** 2026-07-20
- **Status:** Accepted
- **Context:** CRM lived only in a flat table. Sprint 3 gives every lead a Notion-style page
  and real deal intelligence — "no information should live only inside tables."
- **Decision (additive):**
  - **Data model:** added optional intelligence fields to `Lead` — `companyId`, `score`,
    `health` (green/yellow/red), `probability`, `estimatedCloseAt`, `nextAction`,
    `painPoints[]`, `competitors[]`, `buyingCommittee[]`, `aiSummary`/`aiSummaryAt`. Widened
    `leads.update` pick + `LeadUpdateSchema`; service converts `estimatedCloseAt` ISO→Date.
  - **Lead detail page** `/work/[id]` (Notion-style): header (name/company/stage/value/notes),
    main column = AI summary + related Contacts/buying-committee, Tasks, Meetings,
    Proposals & approvals, and a merged stage-history + activity Timeline; right sidebar =
    editable Intelligence panel. All related data reuses existing services (filtered by
    `leadId`/`companyId`). Grid rows now deep-link (`↗`) to the detail page.
  - **AI summary:** `ai/summarize-lead.ts` reads the deal's real data and returns
    `{summary, health, probability, nextAction}` (JSON, no invented numbers); persisted via
    `leadService.saveSummary` through new route `POST /api/leads/[id]/summary` (ai:chat +
    lead:read gated, audited as `lead.ai_summary`).
- **Verification:** typecheck + lint + build exit 0. Live on NCR Digital lead: detail renders
  all sections; intelligence PATCH persists (health/probability/nextAction); AI summary
  generated grounded narrative + health + win-probability and stored.
- **Deferred:** promoting `company` free-text → linked `companyId` everywhere (backfill),
  contact-level buying-committee linking (currently names + company contacts).

### ADR-010 — Sprint 2: Organization Engine
- **Date:** 2026-07-20
- **Status:** Accepted
- **Context:** The org builder was correct but conceptually thin (nested divs, no move/rename/
  manager/capacity). Rebuilt into an enterprise console — reusing the existing `orgUnits`
  backend, not replacing it.
- **Decision (additive; no breaking API changes):**
  - **Backend:** added `headcountCapacity` to `OrgUnit` + schema; `orgUnitService.listWithStats`
    (member counts from employees assigned as dept/team, vacancies = capacity − members,
    manager name resolved); a **descendant-cycle guard** on move (can't reparent under own
    sub-tree); widened `parentId`/`managerUserId` to nullable so the UI can move-to-root /
    unassign. All mutations still `org.manage`-gated and audited (feeds the Timeline).
  - **AI editing:** 4 new tools (auto-registered in `toolSchemas`) — `move_org_unit`,
    `rename_org_unit`, `assign_org_manager`, `set_employee_manager` ("Rahul reports to
    Anita"). Thin wrappers over the same services; structural so they execute (no approval).
  - **UI:** new `org-console.tsx` — collapse/expand, inline rename (double-click), HTML5
    **drag-and-drop reparenting** + move-to-root dropzone, manager dropdown, inline capacity,
    member/vacancy chips, add sub-unit, delete. Deleted the old `org-tree.tsx` (orphaned).
    All via the existing PATCH/POST/DELETE routes — no new endpoints.
- **Verification:** typecheck + lint + build exit 0. Live: create → move → **cycle-guard
  rejects** invalid move → rename → capacity all work via API; console renders; AI
  "Rahul reports to Anita" executed and DB confirms `managerUserId` set.
- **Deferred to later sprints:** true workload-balancing/auto-capacity suggestions; assigning
  members to units from this screen (People sprint territory).

### ADR-009 — Sprint 1: Foundation Audit & Navigation (Consolidation Program)
- **Date:** 2026-07-20
- **Status:** Accepted
- **Context:** First sprint of the STOS Architecture Consolidation Program (plan-first, one
  sprint per conversation). Goal: make STOS feel like a polished product before adding
  features — no dead ends, consistent design system, real UX states. No backend/schema/API
  changes.
- **Decision:**
  - **One fallback rule:** every permission-denied guard redirects to `/home` (was a mix of
    `/home` and `/dashboard`). Documented in `.claude/knowledge/architecture/routing.md` (new
    single-source route map).
  - **Deleted orphans/duplicates:** `/dashboard` (dead-end, only reachable as an admin
    denied-fallback; exec view is `/home`, richer version in Sprint 9) and `/leads`
    (superseded by `/work`). Removed duplicate components `leads-table.tsx` and `ai-chat.tsx`
    (replaced by `work/leads-grid.tsx` and `assistant/console.tsx`). `dashboardService` +
    `/api/dashboard` kept for Sprint 9.
  - **Shared UX states:** added `(app)/loading.tsx` (branded skeleton), `(app)/error.tsx`
    (client boundary, retry + go-home), and global `not-found.tsx`. No more raw Next error
    screens.
  - **Design-system consistency:** reskinned all remaining OLD pages (People, Knowledge,
    Connectors, Sign-in, and all `admin/*`) to `.glass` / `.btn-*` / semantic tokens; unified
    status colors (`green-400`→`teal`, kept red for errors). `EmployeesTable` header is now a
    prop so `/people` shows a People-framed header instead of "Employee Directory".
    `/workspace` gained a zero-permission empty state.
- **Verification:** typecheck + lint + production build all exit 0. Live smoke on :3000:
  owner sees all 13 routes (200); `sales_rep` is redirected off every admin route to `/home`
  with **no admin content rendered** (guards enforce server-side); global 404 works; no
  runtime errors in the dev log.
- **Note on dev redirects:** in `next dev`, `redirect()` returns **200** with a client-side
  redirect payload (contains `NEXT_REDIRECT`), not a 307 — this is dev-only; production build
  returns 307. Not a leak: denied content is never rendered.
- **Not done (by design):** deeper rebuilds belong to their owning sprints — Organization
  engine (Sprint 2), CRM data model (Sprint 3), dashboards (Sprint 9). Sprint 1 only
  reskinned those screens for consistency.

### ADR-008 — Founder-experience redesign; rename to STOS; AI as the primary interface
- **Date:** 2026-07-19
- **Status:** Accepted
- **Context:** The backend (engines, RBAC, Qdrant) is strong, but the UX read as an
  admin panel/CRM. Product renamed **RevenueOS → STOS** (Svayantra Technology Operating
  System). The AI is the product; the UI visualizes the business.
- **Decision (UX/IA only — NO backend changes):**
  - **6-item, persona-gated IA:** Home · Assistant · Work · People · Knowledge · Workspace.
    Everything else is reached via the Assistant or contextual nav. Admin/platform screens
    live under **Workspace** and are hidden from ordinary employees.
  - **Design system:** deep navy/slate surfaces, cyan-teal accents, warm orange for actions,
    soft glassmorphism (Linear/Arc/Stripe quality). Semantic tokens (`surface/panel/border/
    muted/accent` + `action/teal`) redefined so existing components adopt the identity.
  - **Home = executive briefing** (real data, permission-scoped): priorities, pending
    approvals, meetings, activity, revenue (finance-visible only), + an "Ask STOS" bar. No
    empty KPI boxes.
  - **Assistant = primary surface** (Cursor/ChatGPT-style): starters, conversation, working
    state, approval cards. Home's Ask bar deep-links here with the query.
  - **Work** = leads as an Airtable/Notion-style inline-editable grid (edit/add/advance/
    delete/search). **Platform jargon hidden** ("Custom Objects" → "Data models", etc.).
  - Root now routes to `/home`. Old routes remain (backward compatible), just off the primary nav.
- **Consequences:** The app reads as an AI Chief of Staff, not a CRM. Verified: 6 pages 200,
  Home briefing renders, persona nav gating, lint/typecheck/build exit 0.
- **Staged next (not yet built):** persona-specific Home variants, Notion-style client pages,
  full Airtable keyboard/drag/paste + AI CSV import, drop-first Knowledge intake, AI execution-
  plan visualization. Backend already supports these.

### ADR-007 — Metadata-driven platform (configurable BOS, no hardcoded structure)
- **Date:** 2026-07-19
- **Status:** Accepted
- **Context:** Evolve from CRM to a configurable business OS (Salesforce/ServiceNow-like) —
  orgs restructure without engineering; 5→5,000 employees, any industry.
- **Decision (all additive; nothing existing rebuilt):**
  - **Dynamic org engine** — `orgUnits` tree (department/team/division/region/branch/…);
    parent/children, manager, metadata. No hardcoded departments.
  - **Custom object platform** — `objectDefinitions` (fields + relationships) + one generic
    `customRecords` collection. Generic routes `/api/objects/[type]` give any object CRUD +
    RBAC (`objects.*` + per-object role visibility) + audit + **AI search** (records embed into
    Qdrant, so the AI answers over them) — no per-object code.
  - **Workflow/approval engine** — `workflowDefinitions` (condition/approval/notify/end nodes,
    branching, sequential/parallel, reject paths) + `workflowInstances` runtime. Configuration,
    not code. Existing proposal/quotation approvals untouched (engine is additive).
  - **Policy engine** — `policies` (domain/effect/value) editable by owners; `policy-engine.ts`
    helpers replace hardcoded business rules.
  - **AI Organization Admin** — orchestrator tools (create_org_unit, set_employee_role,
    create_object_definition, set_policy) that mutate metadata THROUGH the services, so they
    enforce the user's permissions and audit every change.
  - **Organization timeline** — structural changes drawn from the immutable audit log.
- **Consequences:** Business structure/objects/workflows/policies are data, editable from UI or
  AI chat. Verified live against real Qdrant: knowledge upload→embed→cited answer; org tree
  build. lint+typecheck+build exit 0 (61 routes).
- **Alternatives considered:** per-object code + migrations (rejected — the thing being
  removed); a separate config service (rejected — metadata collections + generic engines are
  simpler and share the existing repo/RBAC/audit).

### ADR-006 — Centralized IAM: dotted permissions, DB-backed roles, Owner, org isolation
- **Date:** 2026-07-19
- **Status:** Accepted
- **Context:** Multi-tenant enterprise IAM foundation for ABOS — scale 5→10,000 employees
  without redesign; no scattered permission logic.
- **Decision:**
  - **One permission vocabulary** (`domain.action`, `lib/iam/permissions.ts`) and **one engine**
    (`can`/`assertPermission`). Effective permissions resolve = system/custom role ∪ per-user
    grant overrides − deny overrides; **Owner = `*` (bypasses all checks)**. Resolved once per
    request in `getUser` (React `cache`) and attached to `User.permissions`.
  - **Role/org is sourced from the `employees` directory, NOT Better Auth** (auth ≠
    authorization). Better Auth only authenticates; the employee record is the membership +
    role source of truth, so role changes take effect next request.
  - **Legacy `resource:action` checks** (the original 39 routes) are mapped to dotted perms
    (`lib/iam/legacy.ts`) and flow through the SAME engine — nothing checks two ways.
  - **Owner bootstrap** is env-driven + idempotent (`scripts/bootstrap-owner.ts`) — no
    hardcoded/committed credentials.
  - **Org structure**: organizations → departments → teams → employees; custom roles;
    per-user overrides; audit is append-only (insert-only in code). Every query is orgId-scoped.
- **Consequences:** Enforcement is server-side everywhere; nav is gated for UX only. Verified
  live: Owner `*` bypass, sales_rep denied finance (403) + admin (403). Financial data never
  leaks (permission checked in service AND route).
- **Alternatives considered:** roles-as-enums with hardcoded maps (rejected — not customizable,
  scattered); storing role on Better Auth user (rejected — couples authz to auth, hard to change).

### ADR-005 — Knowledge engine (Qdrant semantic memory) + connector architecture
- **Date:** 2026-07-19
- **Status:** Accepted
- **Context:** Evolve RevenueOS toward ABOS — company-wide knowledge Q&A + integrations.
- **Decision:**
  - **MongoDB stays the source of truth** (CRM + document metadata). **Qdrant is semantic
    memory only** — one collection (`revenueos_knowledge`) with payload partitioning by
    `orgId`/`documentType`/`permissions` (not a collection per type). Operational state is
    never duplicated into Qdrant; every vector traces back to a Mongo `documentId`.
  - **Embeddings** behind an `EmbeddingProvider` interface (Voyage AI via REST; non-semantic
    dev fallback). **All external services via thin `fetch` clients** (Qdrant, Voyage, Google)
    — no heavy SDKs, config-gated, graceful degradation when unset.
  - **RAG** enforces RBAC + tenant scope INSIDE the Qdrant query; answers are grounded +
    cited and refuse when no context (no hallucination).
  - **Connectors** are first-class (`OAuthProvider`/`CalendarProvider` interfaces + registry).
    Google Calendar is live (OAuth 2.0, refresh tokens **AES-256-GCM encrypted** at rest);
    Drive/Gmail/Slack/Notion/etc. are declared future connectors. **Notion is deliberately a
    future connector — the AI depends on the internal knowledge layer, not Notion.**
- **Consequences:** Adding a connector or embedding/vector backend is wiring, not redesign.
  Qdrant/Voyage/Google are optional locally (documents store as `pending` without Qdrant).
- **Alternatives considered:** per-type Qdrant collections (rejected — index sprawl); heavy
  SDKs (rejected — install/version risk); embedding operational state into Qdrant (rejected —
  Qdrant is not the source of truth).

### ADR-004 — Centralized database layer + one client + co-located DNS bootstrap
- **Date:** 2026-07-19
- **Status:** Accepted
- **Context:** `mongodb+srv://` failed with `querySrv ECONNREFUSED`. **Proven root cause:**
  Node has TWO independent default DNS resolvers — callback (`dns.*`) and promise
  (`dns.promises`/`node:dns/promises`). `dns.setServers()` updates only the callback resolver.
  The c-ares default here is `127.0.0.1`; Next.js pre-initializes the promise resolver at
  startup so it stayed on `127.0.0.1`, and the mongodb driver resolves via
  `dns.promises.resolveSrv` → `ECONNREFUSED`. `dns.getServers()` read the (correct) callback
  resolver, masking it. (Also fixed: two MongoClients existed; bootstrap-dns was a stray
  side-effect.)
- **Decision:** One database layer at `src/lib/database/` — a single globalThis MongoClient
  shared by app, scripts, AND Better Auth. `configureDns()` sets **both** resolver channels
  (`dns.setServers()` + `dnsPromises.setServers()`) from `DNS_SERVERS`, co-located with connect
  and once at boot in `src/instrumentation.ts`. `src/lib/mongo.ts` re-exports `db`. Added
  retries, logging, `ping()` health check (`/api/health`), graceful shutdown.
- **Consequences:** Exactly one MongoClient. Both DNS APIs configured, so the driver's
  promise-based SRV resolution works. Verified in `next dev` (health 200, sign-up 200) and via
  `ensure-indexes`. `DNS_SERVERS` unset in prod/Vercel = no-op.
- **Alternatives considered:** Non-SRV connection string (avoids c-ares entirely) — viable
  fallback, kept `+srv` since setting both resolvers is clean and prod is unaffected. Setting
  only the callback resolver (the earlier incorrect fix). Scattered `dns.setServers`.
- See `knowledge/architecture/` and `../memory/known-issues.md`.

### ADR-003 — Defer Qdrant; use MongoDB Atlas Vector Search; no separate Context Engine
- **Date:** 2026-07-19
- **Status:** Accepted
- **Context:** Pre-implementation review surfaced "Qdrant" and "Context Engine" in the scope
  checklist, contradicting the frozen MongoDB + Notion stack. No proven need for a dedicated
  vector DB or bespoke context service in the MVP.
- **Decision:** Defer Qdrant. When semantic search/RAG is needed, use **MongoDB Atlas Vector
  Search** (same cluster, one less system). No separate Context Engine service — the AI
  orchestrator assembles context from the Mongo data layer + Notion knowledge interface.
- **Consequences:** One fewer stateful system + sync pipeline to operate for v1. Vector search
  lives behind the knowledge interface, so adopting Qdrant later (if Atlas is insufficient at
  scale) is a localized change.
- **Alternatives considered:** Stand up Qdrant now (rejected: premature infra); build a custom
  context engine (rejected: orchestrator + retrieval already covers MVP).
- See `knowledge/architecture/architecture-review-2026-07-19.md`.

### ADR-002 — Adopt a `.claude/` living knowledge base
- **Date:** 2026-07-19
- **Status:** Accepted
- **Context:** The repo should get progressively smarter; Claude should stop re-deriving
  project context on every task.
- **Decision:** Create the `.claude/` structure (skills, knowledge, playbooks, patterns,
  prompts, memory) with Documentation Rules that fire on every major feature completion.
- **Consequences:** Small ongoing documentation tax per feature; large compounding payoff in
  context reuse and onboarding. `memory/*`, `DECISIONS.md`, `ROADMAP.md` become mandatory
  update surfaces at merge time.
- **Alternatives considered:** Ad-hoc README + code comments (rejected: goes stale, not
  structured for AI retrieval).

### ADR-001 — Technology stack
- **Date:** 2026-07-19
- **Status:** Accepted
- **Context:** RevenueOS is an AI-native, Vercel-deployed web app for sales orgs.
- **Decision:** Next.js (App Router) + React + Tailwind + shadcn/ui; Next.js Route Handlers;
  MongoDB Atlas via the official `mongodb` driver; Better Auth; Claude API; Notion API;
  Resend; Cloudinary; Vercel; Sentry; PostHog.
- **Consequences:** Single-language (TS) full stack; serverless constraints on Vercel drive
  the connection/caching strategy; Notion on the AI critical path is a known coupling risk
  (to be mitigated behind a knowledge interface).
- **Alternatives considered:** Deferred — recorded when a challenger is proposed.

---

> **Open decisions to resolve during Phase 0–1** (tracked, not yet decided):
> - RevenueOS-as-sales-OS (brief) vs AR-follow-up / WhatsApp wedge (real internal docs).
> - One composable role-scoped dashboard vs three separate dashboards.
> - Notion knowledge store behind a swappable interface (recommended) vs direct coupling.
> - AI write-access boundary: human approval required for all revenue-data mutations in v1.
