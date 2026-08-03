# Skill — Create a React Page

## Purpose
Build a Next.js App Router page that is fast, accessible, on-brand (Linear/Stripe feel), and
handles all data states.

## When to use
Any new screen in the authenticated app (`app/(app)/…`) or auth flow (`app/(auth)/…`).

## Best practices
- **Server Component by default;** add `"use client"` only for the interactive parts, isolated
  into small child components.
- **Fetch on the server** (call the service layer directly) and pass plain props down.
- **Handle four states:** loading, empty, error, data. Design the empty state deliberately.
- **Compose shadcn/ui primitives**; don't restyle them. Tailwind for layout.
- **Accessibility:** semantic HTML, keyboard nav, focus states, `aria-*` on custom widgets;
  works in light + dark.
- **Keep pages thin:** page assembles feature components from `components/<domain>/`.

## Common mistakes
- `"use client"` on the whole page for one button.
- Client-side `fetch` to your own API when a server component could call the service directly.
- Missing empty/error states; layout shift on load.
- Re-implementing a shadcn primitive.

## Code conventions
- `app/(app)/<route>/page.tsx` server component; interactive bits in `components/<domain>/*`.
- Data via service layer or a typed fetch wrapper — never hardcoded `fetch` URLs.

## Example
```tsx
// app/(app)/leads/[id]/page.tsx
import { leadService } from "@/services/lead-service";
import { requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { LeadDetail } from "@/components/leads/lead-detail";

export default async function LeadPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const lead = await leadService.getForUser(params.id, user).catch(() => null);
  if (!lead) notFound();
  return <LeadDetail lead={lead} />;
}
```

## Checklist
- [ ] Server Component by default; client parts isolated
- [ ] Loading / empty / error / data all handled
- [ ] shadcn primitives composed; Tailwind for layout
- [ ] Accessible + light/dark
- [ ] Data fetched via service/typed wrapper
- [ ] Matches `../../patterns/ui-pattern.md`
