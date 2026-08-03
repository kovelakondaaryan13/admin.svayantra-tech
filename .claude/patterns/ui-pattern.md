# Pattern — UI Component / Page

> Canonical shape for React UI in RevenueOS: Next.js App Router, Server Components by default,
> Tailwind + shadcn/ui, minimal client state. Design bar: Linear/Stripe — clean, fast, dense
> but calm.

## Rules of thumb
- **Server Components by default.** Add `"use client"` only for interactivity (state, effects,
  event handlers). Fetch data in the server component; pass plain props down.
- **Data fetching:** server components call the **service layer directly** (same-process) or a
  typed fetch wrapper for client components — never inline `fetch` with hardcoded URLs.
- **Components from `components/ui/` (shadcn)** first; compose, don't re-style primitives.
- **State:** local state for local concerns; server state via server components / route
  revalidation; avoid a global store until genuinely needed.
- **Every list/table screen handles four states:** loading, empty, error, and data. The empty
  state is a first-class design, not an afterthought.
- **Accessibility:** semantic elements, focus states, keyboard nav, `aria-*` on custom
  controls. Works in light and dark.

## Template

```tsx
// app/(app)/leads/page.tsx — Server Component
import { leadService } from "@/services/lead-service";
import { requireUser } from "@/lib/auth";
import { LeadsTable } from "@/components/leads/leads-table";
import { EmptyState } from "@/components/ui/empty-state";

export default async function LeadsPage() {
  const user = await requireUser();
  const leads = await leadService.listForUser(user);
  if (leads.length === 0) return <EmptyState title="No leads yet" cta="Add lead" />;
  return <LeadsTable leads={leads} />;   // client component only if it needs interactivity
}
```

## Folder convention
```
components/
  ui/            ← shadcn primitives (button, dialog, table…)
  <domain>/      ← feature components (leads/, proposals/, dashboard/)
app/(app)/       ← authenticated app routes
app/(auth)/      ← sign-in / sign-up
```

## Common mistakes
- Marking a whole page `"use client"` for one interactive widget → isolate the client bit.
- Missing empty/error/loading states.
- Re-implementing a shadcn primitive instead of composing it.

See also: `skills/frontend/create-react-page.md`, `skills/ui/build-dashboard.md`.
