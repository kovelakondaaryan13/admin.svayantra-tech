# Pattern — API Route Handler

> Canonical shape for a Next.js App Router route handler in RevenueOS. Copy this. A route
> handler is **thin**: it parses/validates input, checks auth, delegates to a service, and
> shapes the response. No business logic, no direct DB access in the handler.

## Shape

```
app/api/<resource>/route.ts          → collection: GET (list), POST (create)
app/api/<resource>/[id]/route.ts     → item: GET, PATCH, DELETE
```

## Template

```ts
// app/api/leads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";           // Better Auth session guard
import { can } from "@/lib/authz";                   // policy check
import { LeadCreateSchema } from "@/lib/schemas/lead";
import { leadService } from "@/services/lead-service";
import { handleError } from "@/lib/http";            // maps errors → status codes

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);             // 401 if no session
    const input = LeadCreateSchema.parse(await req.json()); // 400 on bad body (zod)
    if (!can(user, "lead:create")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const lead = await leadService.create(input, user); // service owns the logic
    return NextResponse.json({ data: lead }, { status: 201 });
  } catch (err) {
    return handleError(err);                          // consistent error envelope
  }
}
```

## Rules
- **Order:** auth → validate → authorize → delegate → respond.
- **Validation:** every request body/query parsed with a zod schema from `lib/schemas/`.
- **Response envelope:** `{ data }` on success, `{ error, code? }` on failure. Never leak
  stack traces or Mongo errors to the client.
- **Status codes:** 200/201 success, 400 validation, 401 unauthenticated, 403 unauthorized,
  404 not found, 409 conflict, 422 business-rule violation, 500 unexpected.
- **No DB in handlers.** Data access lives in services → data layer.
- **Idempotency:** POSTs that can be retried (e.g. from AI tools) accept an idempotency key.
- **Audit:** mutations record an entry via the audit helper (see `database-pattern.md`).

## Common mistakes
- Business logic creeping into the handler. → push to the service.
- Forgetting the authz check after the auth check (authenticated ≠ authorized).
- Returning raw Mongo `_id` objects instead of serialized strings.

See also: `service-pattern.md`, `database-pattern.md`, `skills/backend/create-api-endpoint.md`.
