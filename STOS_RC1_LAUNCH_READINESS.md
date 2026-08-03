# STOS RC-1 Launch Readiness Audit & Finalization

> Reviewer lens: VP of Product · Staff UX Designer · Principal Frontend Engineer · QA Lead ·
> Enterprise Software Architect. Feature freeze in effect — no new capabilities were added beyond
> wiring two already-promised-but-missing AI tools (meeting/proposal creation) to existing services.
> Method: 4 parallel code+live-audit passes against the running dev server (`localhost:3000`),
> signed in as a real `sales_rep` account, plus direct manual dogfooding. Every finding below was
> verified against actual code or a live request/response — nothing here is guessed from file names.
> This is a fresh audit, independent of the earlier `STOS_V2_PRODUCTION_READINESS.md`.

---

## 0. Dogfooding accounts provisioned

| Name | Email | Role | Reports to |
|---|---|---|---|
| Aryan | owner@svayantra.tech | Owner | — |
| Gaurav | gaurav@svayantra.tech | Sales Representative | Aryan |
| Deblina | deblina@svayantra.tech | Sales Representative (title updated; was "Marketing & Brand") | Aryan |
| Varshik | varshik@svayantra.tech | Sales Representative | Aryan |
| Mohan | mohan@svayantra.tech | Sales Representative | Aryan |
| Trilok | trilok@svayantra.tech | Sales Representative | Aryan |
| Suraj | suraj@svayantra.tech | Sales Representative | Aryan |

Passwords: `Name@1234` (e.g. `Gaurav@1234`). A self-service **Change password** page now exists at
`/account` (linked from the user block at the bottom of the sidebar) — built this session since it
didn't exist at all previously.

`sales_rep`'s permission set (`src/lib/iam/roles.ts`) already matched the requested scope exactly —
Companies/Leads/Deals/Meetings/Tasks/Assistant, no Org settings/Billing/Employee Management/AI
Configuration — no role redefinition was needed.

---

## 1. Fixed this session (verified live, not just code-read)

| # | Finding | Fix | Verified |
|---|---|---|---|
| 1 | **AI fabricated meeting/proposal creation.** No `create_meeting`/`create_proposal` tools existed; the assistant told users "Meeting Scheduled" / "Proposal Generated" while silently doing something else (or nothing). Worst finding across all four audits — breaks the core AI promise. | Added real `create_meeting` and `create_proposal` tools wired to the existing `meetingService`/`proposalService`. Updated the system prompt to forbid announcing success without calling the real tool. | Live: created an actual meeting and an actual AI-drafted proposal via chat; confirmed both exist via `/api/meetings` and `/api/proposals`. |
| 2 | **AI tool permission bypass.** 12 tools (`search_leads`, `create_lead`, `log_touch`, `list_leads`, `find_stale_leads`, `find_sla_breaches`, `entity_dossier`, `search_knowledge`, `search_company_knowledge`, `create_task`, `assign_task`, `assign_task_to_role`) had **no internal permission check** — they relied only on `ai.use`, which is a baseline permission held by *every* role, including `viewer`, `hr`, `developer`. Any role could create/mutate CRM leads and tasks via chat even without `crm.write`/`tasks.assign` via UI/API. | Added `assertPermission()` calls matching each tool's real REST-equivalent permission. | Live: temporarily downgraded a test account to `viewer` and confirmed `create_lead` now returns a clean permission-denied message instead of executing. Restored the role after. |
| 3 | `create_lead` ignored the `companyId` already available from conversation context, breaking the relational link between leads and companies. | Added an optional `companyId` param, wired through to `leadService.update` after creation. | Live: created a lead inside a company-scoped conversation; confirmed `companyId` is now set on the resulting lead record. |
| 4 | `/admin/organization` (department/team structure, headcount, manager names) was reachable by **any** sales_rep by direct URL — its guard only redirected when the org had **zero** units, which never happens for a real org. | Fixed the guard to match every sibling admin page: redirect whenever the user lacks `org.manage`. | Live: confirmed a sales_rep hitting `/admin/organization` now renders the Home page instead. |
| 5 | `/api/settings/org` was a dead, unused duplicate of `/api/admin/settings` gated by `settings.read` — a baseline permission every role holds — exposing org config including the AI auto-approve threshold that the UI explicitly labels "owner only." | Deleted the dead route (nothing referenced it). | Live: confirmed `404` now. |
| 6 | Unmapped legacy permission strings (`assertCan`) silently fell back to a broad baseline permission instead of denying — a footgun for future routes. | Now throws, forcing an explicit mapping decision instead of silently authorizing. | Typecheck + full grep of every current `assertCan` call site confirmed none rely on the fallback. |
| 7 | **Conversation list fully keyboard-inaccessible.** Rows and their pin/rename/archive/delete controls were bare `<div onClick>`/emoji `<span onClick>` — unreachable by keyboard, no accessible name. A core workflow (managing conversations) was unusable without a mouse. | Converted to real `<button>` elements with `aria-label`s; actions reveal on focus (`group-focus-within`), not just hover. | Live: confirmed rendered HTML now has `aria-label="Pin/Rename/Archive/Delete conversation"` on real buttons. |
| 8 | Leads-grid inline-edit cells (`Cell` component) were a bare `<div onClick>` — no keyboard access. | Added `role="button"`, `tabIndex`, `onKeyDown` (Enter/Space), focus ring. | Code-verified; matches the same pattern as other accessible controls in the app. |
| 9 | The assistant's "Thinking…"/tool-status indicator had no `aria-live`, unlike the app's own better pattern elsewhere (`ai-callout.tsx`). Silent to screen readers on the primary chat surface. | Added `role="status" aria-live="polite"`. | Code-verified. |
| 10 | Leads-grid table used `overflow-hidden` (no horizontal scroll) — columns clip on narrow screens, unlike the correct pattern already used in `employees-table.tsx`. | Changed to `overflow-x-auto`, matching the established correct pattern. | Live: confirmed in rendered HTML. |
| 11 | Uploading an unsupported file type (e.g. `.dat`) landed at `status: "ready", chunkCount: 0` — indistinguishable from a legitimately empty file. The assistant told the user extraction was "still in progress" **forever**, an unrecoverable loop. | Unsupported types now correctly set `status: "failed"` with a clear reason, which the existing (already-correct) error-messaging path in `context-resolver-service.ts` surfaces honestly. | Live: uploaded a `.dat` file, confirmed it now settles at `status: "failed", errorReason: "Unsupported file type — .dat files are not supported yet"`. |

All fixes pass `tsc --noEmit` clean and were exercised against the live dev server, not just typechecked.

---

## 2. Confirmed, NOT fixed — logged for a deliberate follow-up

**Why not fixed:** each of these either touches a sensitive subsystem (auth) where a rushed fix is
riskier than the bug, requires a product decision (which mechanism, what scope), or is a real but
non-blocking quality issue better batched with related work.

### P0 — must resolve before real team dogfooding
1. **No admin-initiated password reset.** Only the new self-service `/account` flow exists. If an
   employee is locked out, there is currently no recovery path. Real fix requires either (a) Better
   Auth's `admin` plugin (adds ban/impersonation/session-management surface that needs its own
   review before enabling) or (b) email-based reset via Resend (not currently wired — "Invitations"
   has the same gap, see below). Deliberately not hand-rolled against the auth system under time
   pressure.
2. **Org is still in Demo mode.** `getOrgMode()` defaults to `"demo"` until an owner flips it in
   Workspace → Settings. Every lead/task/meeting/proposal the 6 reps create *right now* lands in the
   demo dataset, isolated from production — real dogfooding work will be invisible/mixed with
   synthetic data until this is switched. This is an operational action for Aryan, not a code fix.
3. **`assign_task`/`assign_leads`/`assign_task_to_role` don't actually work for sales_rep.** Their
   whole purpose is delegating to teammates ("ask Priya to follow up"), but they call
   `employeeService.list()`, which requires `users.read` — a permission sales_rep doesn't have. This
   needs a scoped "look up a teammate by email" capability (not simply granting `users.read`, which
   would over-expose the employee directory), a real design decision.

### P1 — should fix soon after RC-1 week
- Company/lead detail pages (`companies/[id]`, `work/[id]`) fetch **entire org-wide collections**
  and filter in memory instead of querying by relation — will degrade as data grows.
- No real AI token streaming — the full completion generates before any text appears (3–8s of
  "Thinking…" then the whole answer at once), despite SSE plumbing existing.
- `/api/search` (⌘K palette) does sequential, unparalleled full-collection scans for 3 of 4 data
  types — a real waterfall, not just a raw-number artifact.
- "Invitations" don't send email — a new hire's temp password is shown once in the admin's browser
  with no delivery mechanism.
- Admin → Security → Active Sessions is an honest "coming soon" stub with no backing function.
- Mobile has a responsive breakpoint (sidebar hides < `md`) but the mobile topbar has **no visible
  navigation** — only reachable via ⌘K, which isn't visually discoverable as "the menu."
- Light-mode `faint` text token fails WCAG AA contrast (2.77:1–3.24:1, needs 4.5:1) for small
  meta/timestamp text used throughout the UI.
- Duplicate-upload processing has no content-hash idempotency — a double-submit creates duplicate
  Knowledge/RAG entries.
- The AI chat stream can leave a turn permanently "Thinking…" if the 60s serverless function timeout
  hits mid-response, with no client-side retry affordance.
- `ANTHROPIC_API_KEY` is read at module top-level across 8 AI-related files; if missing/invalid it
  crashes ungracefully as a framework 500 instead of the app's normal clean error envelope.
- Qdrant being reachable-but-erroring (vs. simply unconfigured) 500s Knowledge Ask instead of
  degrading to an ungrounded answer.
- Five different "empty state" implementations exist for one concept (two shared components plus
  three ad-hoc local ones) — inconsistent, sometimes actionless.
- Organization Settings (industry/currency/timezone/AI auto-approve threshold) persists to the DB
  but nothing in the app reads those fields back — a convincing UI with zero downstream effect.
- Knowledge Ask's `grounded: true` / citations are returned whenever any vector hits exist, with no
  relevance-score cutoff — masked today only by the model's own honesty in the answer text.

### P2 — polish, can wait until after dogfooding
- Home page hand-rolls its layout instead of the shared `PageHeader`/`WorkspacePage` template.
- Redundant width-wrapper on the People page (double-applies the same max-width).
- Two remaining demo-workspace test leads and four test uploads left over from this session's live
  audit testing — `sales_rep` correctly lacks delete permission for these, so they need an owner
  account (or the in-app "Reset demo data" action) to clear.
- Knowledge Ask relevance-threshold tuning.

---

## 3. What's already solid (verified, not re-flagged)

- **RBAC is real and enforced in the right places** for everything *except* the two gaps above (org
  page guard, AI tool layer) — every other admin page/API route/AI org-management tool correctly
  gates on the right permission, confirmed via live 403s as a sales_rep.
- **"Never ask what it already knows"** is real: the assistant correctly uses conversation-scoped
  object context (company/lead) without re-asking, verified live.
- **RAG refusal is real**: off-topic questions get an honest "I don't have that" instead of a
  hallucinated answer.
- **Audit log** (`audit.record`) is called from 19 distinct services — a genuine append-only trail,
  not decorative.
- **Health check, error boundaries, structured logging, demo/production data isolation** all exist
  and work as documented.
- **Executive Home dashboard** — every metric/chart traces to a real aggregation query; nothing is
  decorative or mock.
- Global `:focus-visible`, semantic landmarks, and most icon-only chrome buttons already have
  correct `aria-label`s (sign-out, notifications, theme toggle, command palette).

---

## 4. Launch recommendation: **Ready with caveats**

The two most severe issues found this session — the AI fabricating meeting/proposal success, and a
real permission bypass in the AI tool layer that let any role mutate CRM data via chat — are now
**fixed and verified live**, not just logged. Six real employee accounts are provisioned correctly
with least-privilege roles enforced at UI, API, and AI-tool layers.

**Before the team starts the RC-1 dogfooding week, do these three things (all P0, none require more
engineering than a decision + a config flip):**
1. Switch the org from Demo to Production mode (Workspace → Settings), or real work will land in the
   synthetic dataset.
2. Decide + implement an admin password-reset mechanism (or accept the risk for a 7-person team over
   one week with a manual fallback).
3. Decide whether to unblock `assign_task`/`assign_leads` for sales_rep now (a real workflow they'll
   likely want in week one) or accept it as a known gap for the dogfooding log.

Everything else (P1/P2) is legitimate should-fix-soon work, not a reason to delay the start of
dogfooding — the app is functionally solid, secure at the boundaries that matter, and the AI
experience now keeps its promises instead of fabricating them.
