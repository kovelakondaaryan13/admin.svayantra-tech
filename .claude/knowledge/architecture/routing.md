# Routing & Navigation — STOS (single source of truth)

Established in **Sprint 1 — Foundation Audit & Navigation** (2026-07-20). This is the
canonical map of every route, its access guard, and its fallback. Keep it in sync when
routes are added or moved.

## Rules (invariants)

1. **Primary navigation is exactly 6 items** — Home · Assistant · Work · People · Knowledge ·
   Workspace. Defined in `src/app/(app)/layout.tsx` (permission-gated) and rendered by
   `src/components/shell/sidebar.tsx`. Nothing else appears in the sidebar.
2. **Permission-denied always falls back to `/home`.** Never `/dashboard` (deleted) and never
   a page outside the primary nav — a denied user must land somewhere they can navigate from.
3. **Admin/platform screens live under Workspace.** They are reached only via the `/workspace`
   card grid, never the sidebar. Ordinary employees never see them.
4. **No orphan pages.** Every page route is reachable from the nav or a page that is. If a
   route becomes unreachable, delete it (don't leave it dead).
5. **Every page in `(app)` inherits shared UX states** — `loading.tsx`, `error.tsx`, and the
   global `not-found.tsx`. Don't reintroduce raw Next.js error screens.

## Route map

| Route | Auth | Permission guard | Denied → | In nav? | Notes |
|---|---|---|---|---|---|
| `/` | — | — | — | no | Redirects: signed-in → `/home`, else → `/sign-in` |
| `/sign-in` | public | — | — | no | Auth. Success → `/home` |
| `/home` | required | none (all authed) | — | ✅ Home | Executive briefing; persona-scoped widgets |
| `/assistant` | required | none | — | ✅ Assistant | Primary AI surface |
| `/work` | required | `crm.read` | `/home` | ✅ Work | Leads grid (Airtable-style) |
| `/people` | required | `users.read` | `/home` | ✅ People | Directory (shared `EmployeesTable`, People-framed header) |
| `/knowledge` | required | none | — | ✅ Knowledge | Ask + document intake |
| `/workspace` | required | any admin perm* | (empty state) | ✅ Workspace | Admin hub; cards filtered per-perm; empty-state copy if none |
| `/admin/organization` | required | `org.manage` (or has units) | `/home` | no | via Workspace |
| `/admin/objects` | required | `objects.read` | `/home` | no | via Workspace |
| `/admin/roles` | required | `roles.manage` | `/home` | no | via Workspace |
| `/admin/employees` | required | `users.read` | `/home` | no | via Workspace (admin-framed header) |
| `/admin/audit` | required | `audit.view` | `/home` | no | via Workspace |
| `/admin/timeline` | required | `audit.view` | `/home` | no | via Workspace |
| `/connectors` | required | — | — | no | via Workspace (Integrations) |

\* Workspace card grid is filtered by `can(user, perm)`; a user with zero admin perms sees the
empty state instead of a redirect.

## Deleted in Sprint 1 (do not recreate)

- **`/dashboard`** — was an orphan reachable only as the admin denied-fallback (dead-end).
  The executive dashboard is `/home`; a richer version arrives in Sprint 9. The
  `dashboardService` + `/api/dashboard` route are kept for that sprint.
- **`/leads`** — superseded by `/work`. Deleted with its duplicate components
  `components/leads/leads-table.tsx` and `components/ai/ai-chat.tsx` (replaced by
  `components/work/leads-grid.tsx` and `components/assistant/console.tsx`).

## UX-state files (Sprint 1)

- `src/app/(app)/loading.tsx` — branded skeleton for all app routes.
- `src/app/(app)/error.tsx` — client error boundary (retry + go-home).
- `src/app/not-found.tsx` — global 404 (go-home / ask-STOS).
