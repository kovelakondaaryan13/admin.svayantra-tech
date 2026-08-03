# RevenueOS API — Endpoint Catalog

Authoritative list of every HTTP endpoint. Keep in sync with `src/app/api/**` (Documentation
Rules). Format guide: `README.md`. Conventions: `../../patterns/api-pattern.md`.

## Conventions (apply to every endpoint)
- **Base:** all under `/api`. All run on the Node.js runtime.
- **Auth:** every endpoint (except the Better Auth handler) requires a valid session →
  `401 unauthorized` otherwise.
- **Authz:** the listed `resource:action` permission is checked after auth →
  `403 forbidden` if the role lacks it. Role→permission map: `src/lib/authz.ts`.
- **Tenant scope:** every query is scoped by the caller's `orgId` (server-resolved, never
  client-supplied).
- **Success envelope:** `{ "data": ... }`. **Error envelope:** `{ "error": string, "code":
  string, ... }`.
- **Common statuses:** `400` validation (zod), `401`, `403`, `404` not found, `409` conflict,
  `422` business-rule, `500` unexpected. Only non-obvious extras are called out per endpoint.
- **IDs** are Mongo ObjectId hex strings. Timestamps are ISO-8601.

Legend: **[built]** = implemented in this repo · **[planned]** = to add (documented, not yet
coded).

---

## Auth  `src/app/api/auth/[...all]/route.ts`  — [built]
Handled by Better Auth (email/password). No app-level authz.
| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/auth/*` | Better Auth: sign-up, sign-in, sign-out, session, etc. |

Client helpers: `src/lib/auth-client.ts` (`signIn`, `signUp`, `signOut`, `useSession`).

---

## Leads  `src/app/api/leads/**`  — [built]
| Method | Path | Authz | Request | Response |
|---|---|---|---|---|
| GET | `/api/leads` | `lead:read` | — | `Lead[]` |
| POST | `/api/leads` | `lead:create` | `{name, email?, company?, value?{amountMinor,currency}, notes?}` | `Lead` (201) |
| GET | `/api/leads/{id}` | `lead:read` | — | `Lead` |
| PATCH | `/api/leads/{id}` | `lead:update` | partial of create | `Lead` |
| DELETE | `/api/leads/{id}` | `lead:delete` | — | `{deleted:true}` (soft delete) |
| POST | `/api/leads/{id}/advance` | `lead:advance` | `{to: stage}` | `Lead` — **422** if the stage transition is illegal (conveyor-belt guard) |

Stages: `new → qualified → meeting → proposal → negotiation → won/lost`. Stage history +
audit + `lead.stage_changed` event recorded on advance.

---

## Companies  `src/app/api/companies/**`  — [built]
| Method | Path | Authz | Request | Response |
|---|---|---|---|---|
| GET | `/api/companies` | `company:read` | — | `Company[]` |
| POST | `/api/companies` | `company:create` | `{name, domain?, industry?, size?, notes?}` | `Company` (201) |
| GET | `/api/companies/{id}` | `company:read` | — | `Company` |
| PATCH | `/api/companies/{id}` | `company:update` | partial | `Company` |
| DELETE | `/api/companies/{id}` | `company:delete` | — | `{deleted:true}` |

## Contacts  `src/app/api/contacts/**`  — [built]
| Method | Path | Authz | Request | Response |
|---|---|---|---|---|
| GET | `/api/contacts` | `contact:read` | — | `Contact[]` |
| POST | `/api/contacts` | `contact:create` | `{name, email?, phone?, title?, companyId?}` | `Contact` (201) |
| GET | `/api/contacts/{id}` | `contact:read` | — | `Contact` |
| PATCH | `/api/contacts/{id}` | `contact:update` | partial | `Contact` |
| DELETE | `/api/contacts/{id}` | `contact:delete` | — | `{deleted:true}` |

## Tasks  `src/app/api/tasks/**`  — [built]
| Method | Path | Authz | Request | Response |
|---|---|---|---|---|
| GET | `/api/tasks` | `task:read` | — | `Task[]` |
| POST | `/api/tasks` | `task:create` | `{title, priority?, dueAt?(iso), leadId?, companyId?, assigneeId?}` | `Task` (201) |
| GET | `/api/tasks/{id}` | `task:read` | — | `Task` |
| PATCH | `/api/tasks/{id}` | `task:update` | partial + `status?(open|done)` | `Task` |
| DELETE | `/api/tasks/{id}` | `task:delete` | — | `{deleted:true}` |

## Meetings  `src/app/api/meetings/**`  — [built]
| Method | Path | Authz | Request | Response |
|---|---|---|---|---|
| GET | `/api/meetings` | `meeting:read` | — | `Meeting[]` |
| POST | `/api/meetings` | `meeting:create` | `{title, at(iso), leadId?, contactId?, notes?}` | `Meeting` (201) |
| GET | `/api/meetings/{id}` | `meeting:read` | — | `Meeting` |
| PATCH | `/api/meetings/{id}` | `meeting:update` | partial | `Meeting` |
| DELETE | `/api/meetings/{id}` | `meeting:delete` | — | `{deleted:true}` |
| POST | `/api/meetings/{id}/prep` | `meeting:prep` | — | `{brief: string}` — AI prep brief grounded in the lead + activity timeline. `maxDuration 60`. |

---

## Proposals  `src/app/api/proposals/**`  — [built]
Deterministic status flow; **amount is software-set, never model-authored**; the AI drafts
narrative only. `draft → pending_approval → approved → sent`.
| Method | Path | Authz | Request | Response |
|---|---|---|---|---|
| GET | `/api/proposals` | `proposal:read` | — | `Proposal[]` |
| POST | `/api/proposals` | `proposal:create` | `{leadId, title, amount{amountMinor,currency}, sections?, aiDraft?}` | `Proposal` (201). If `aiDraft:true`, narrative is drafted (AI). `maxDuration 60`. |
| GET | `/api/proposals/{id}` | `proposal:read` | — | `Proposal` |
| POST | `/api/proposals/{id}/approve` | `proposal:approve` | — | `Proposal` — **human approval gate**. 422 if already sent. |
| POST | `/api/proposals/{id}/send` | `proposal:send` | — | `Proposal` — 422 unless status is `approved`. (Email via Resend = [planned].) |

## Quotations  `src/app/api/quotations/**`  — [built]
**All money computed by software** (integer minor units): `subtotal = Σ qty·unit`,
`tax = round(subtotal·taxBps/10000)`, `total = subtotal+tax`. `draft → pending_approval → approved`.
| Method | Path | Authz | Request | Response |
|---|---|---|---|---|
| GET | `/api/quotations` | `quotation:read` | — | `Quotation[]` |
| POST | `/api/quotations` | `quotation:create` | `{leadId, currency, lineItems:[{description,quantity,unitMinor}], taxBps?}` | `Quotation` (201) |
| GET | `/api/quotations/{id}` | `quotation:read` | — | `Quotation` |
| POST | `/api/quotations/{id}/approve` | `quotation:approve` | — | `Quotation` — **human approval gate** |

---

## AI Chat  `src/app/api/ai/chat/route.ts`  — [built]
| Method | Path | Authz | Request | Response |
|---|---|---|---|---|
| POST | `/api/ai/chat` | `ai:chat` | `{message: string}` | `{text: string, pendingApprovals: [{type,leadId,to,summary}]}` |

Orchestrator (`claude-opus-4-8`, `src/ai/orchestrator.ts`) runs a tool loop. Tools:
`search_leads`, `search_knowledge`, `list_my_open_tasks`, `create_lead`, `create_task`
(execute); `advance_lead_stage` (returns a **pendingApproval** — never executes). The UI
approves via `POST /api/leads/{id}/advance`. `maxDuration 60`. Non-streaming in M1 ([planned]:
streaming). Model reasoning is server-side; the client only sees `text` + approvals.

---

## Activities  `src/app/api/activities/route.ts`  — [built]
| Method | Path | Authz | Query | Response |
|---|---|---|---|---|
| GET | `/api/activities` | `activity:read` | `?entityType=&entityId=` → entity timeline; none → recent org feed | `Activity[]` |

## Notifications  `src/app/api/notifications/**`  — [built]
| Method | Path | Authz | Response |
|---|---|---|---|
| GET | `/api/notifications` | `notification:read` | `Notification[]` (the caller's own) |
| POST | `/api/notifications/{id}/read` | `notification:read` | `{read:true}` — 404 if not the caller's |

*Creation is system-side* (event handlers), not a public endpoint.

## Audit  `src/app/api/audit/route.ts`  — [built]
| Method | Path | Authz | Response |
|---|---|---|---|
| GET | `/api/audit` | `audit:read` | `AuditEntry[]` (newest first; managers/founders) |

## Dashboard  `src/app/api/dashboard/route.ts`  — [built]
| Method | Path | Authz | Response |
|---|---|---|---|
| GET | `/api/dashboard` | `dashboard:view` | `{pipelineByStage, openTasks, wonThisView, recentActivity[]}` — server-side aggregation; one role-scoped dashboard |

## Knowledge Search  `src/app/api/knowledge/search/route.ts`  — [built]
| Method | Path | Authz | Query | Response |
|---|---|---|---|---|
| GET | `/api/knowledge/search` | `knowledge:search` | `?q=` | `KnowledgeHit[]` across leads/companies/contacts + Notion (Notion stubbed until wired; vector search = MongoDB Atlas Vector Search per ADR-003) |

## Settings  `src/app/api/settings/**`  — [built]
| Method | Path | Authz | Request | Response |
|---|---|---|---|---|
| GET | `/api/settings` | `settings:read` | — | user prefs object |
| PATCH | `/api/settings` | `settings:read` | JSON object | updated prefs |
| GET | `/api/settings/org` | `settings:read` | — | org settings object |
| PATCH | `/api/settings/org` | `settings:write` | JSON object | updated org settings |

---

## Knowledge Engine, Connectors & Calendar (ABOS capstone) — [built]
| Method | Path | Authz | Purpose |
|---|---|---|---|
| GET | `/api/documents` | `document:read` | List company documents (metadata). |
| POST | `/api/documents` | `document:create` | Upload a document → chunk → embed → Qdrant (or `pending` if no Qdrant). `maxDuration 120`. |
| GET | `/api/documents/{id}` | `document:read` | Document metadata. |
| DELETE | `/api/documents/{id}` | `document:delete` | Delete metadata + its Qdrant vectors. |
| POST | `/api/knowledge/ask` | `knowledge:ask` | RAG: RBAC-filtered retrieval → grounded, **cited** answer; refuses if no context. |
| GET | `/api/connectors` | `connector:read` | Connector catalog + this user's connection status. |
| GET | `/api/connectors/google/oauth/start` | `connector:manage` | Redirect to Google OAuth consent (signed `state`). |
| GET | `/api/connectors/google/oauth/callback` | (session) | Verify state → exchange code → store **sealed** refresh token. |
| POST | `/api/connectors/google/disconnect` | `connector:manage` | Remove the Google connection. |
| GET | `/api/calendar/events` | `calendar:read` | List Google Calendar events (`timeMin`/`timeMax`/`max`). |
| POST | `/api/calendar/events` | `calendar:write` | Create an event. |
| PATCH | `/api/calendar/events/{id}` | `calendar:write` | Update an event. |
| DELETE | `/api/calendar/events/{id}` | `calendar:write` | Delete an event. |
| GET | `/api/health` | (none) | Aggregated: Mongo, Qdrant + vector count, embeddings model, encryption, connectors. |

## Planned endpoints (documented, to add)
These complete the v1 surface; they follow the same pattern (thin handler → service → data
layer, authz, tenant scope, envelope).

| Method | Path | Authz | Purpose |
|---|---|---|---|
| GET | `/api/leads?stage=&owner=&cursor=` | `lead:read` | Filtered + **paginated** list (add to every list endpoint before scale). |
| GET | `/api/proposals/{id}/pdf` | `proposal:read` | Render an approved proposal to PDF (Cloudinary storage). |
| GET | `/api/quotations/{id}/pdf` | `quotation:read` | Render an approved quotation to PDF. |
| POST | `/api/leads/{id}/notes` | `lead:update` | Append a timeline note (activity). |
| GET | `/api/leads/{id}/activities` | `activity:read` | Sugar over `/api/activities?entityType=lead&entityId=`. |
| POST | `/api/ai/chat/stream` | `ai:chat` | **Streaming** variant of the orchestrator (SSE). |
| GET | `/api/knowledge/notion/sync` (job) | internal | Background sync of Notion pages → `knowledgeIndex` pointers. |
| POST | `/api/webhooks/resend` | internal | Email delivery/bounce webhooks (signed). |
| GET | `/api/me` | (any authed) | Current user + role + org (convenience for the client). |
| POST | `/api/org/invite` | `settings:write` | Invite a teammate (assign role). |
| GET | `/api/reports/pipeline` | `dashboard:view` | Cycle-time / conversion analytics from `stageHistory`. |

## Coverage notes / rules
- Every **list** endpoint must gain pagination (`cursor`+`limit`) before production scale —
  currently capped at 200–500 server-side. Tracked in `../../memory/technical-debt.md`.
- Every **mutation** records an audit entry and (where relevant) an activity + event.
- **AI never mutates revenue data directly** — `advance_lead_stage` and any future write tool
  return a `pendingApproval` that a human commits via the corresponding gated endpoint.
