# memory/known-issues.md

> Known bugs, limitations, and lessons learned. An honest list here prevents re-discovering
> the same problem. Record the symptom, the cause (if known), and the workaround/next step.

**Last updated:** 2026-07-19

## Open issues
| ID | Severity | Area | Symptom | Cause / status |
|----|----------|------|---------|----------------|
| — | — | — | None recorded yet (no app code). | — |

## Google Calendar connect — configuration checklist (NOT a code bug)
The OAuth flow (`/api/connectors/google/oauth/start` → Google consent → `/callback`),
credential seal/refresh (`lib/connectors/credentials.ts`), and the Calendar REST client are all
correct and typecheck/build clean. When "Connect Google" appears not to work, it is almost
always one of these **Google Cloud Console** settings, which cannot be fixed from code:
1. **Authorized redirect URI mismatch.** The OAuth 2.0 Client (Web application) must list the
   EXACT callback: `http://localhost:3000/api/connectors/google/oauth/callback` (derives from
   `BETTER_AUTH_URL`; override with `GOOGLE_REDIRECT_URI`). A trailing slash or wrong port →
   `redirect_uri_mismatch`.
2. **OAuth consent screen in "Testing".** Calendar scopes (`calendar.events`,
   `calendar.readonly`) are sensitive, so an unverified/testing app blocks anyone not listed as
   a **Test user**. Add the signing-in Google account under OAuth consent → Test users (or
   publish the app).
3. **Enable the Google Calendar API** for the project (APIs & Services → Library).
After connecting, `/api/work/schedule` and the Work→Calendar "Sync" button push dated tasks in;
until connected they return `{connected:false}` by design (no error). See ADR-020.

## Known limitations (by design, for now)
- None yet — will be populated as v1 scope decisions land (e.g., "AI cannot mutate revenue
  data without human approval in v1").

## Resolved
- **`querySrv ECONNREFUSED` on `mongodb+srv://` (2026-07-19).**
  **Real root cause (proven by instrumentation):** Node exposes **two independent default DNS
  resolvers** — the callback API (`dns.*`) and the promise API (`dns.promises` ===
  `node:dns/promises`). `dns.setServers()` updates ONLY the callback resolver. On this machine
  the c-ares default is `127.0.0.1` (nothing listening). **Next.js initializes the promise
  resolver at startup**, so it stayed pinned to `127.0.0.1`; the mongodb driver resolves SRV
  via `dns.promises.resolveSrv` (`mongodb/lib/connection_string.js`) → hit `127.0.0.1:53` →
  `ECONNREFUSED`. `dns.getServers()` looked correct because it reads the *callback* resolver —
  the wrong one. (A plain `node` script doesn't pre-init the promise resolver, which is why
  `ensure-indexes` worked with only `dns.setServers()` and masked the bug.)
  **Fix:** `configureDns()` sets servers on **both** channels — `dns.setServers()` AND
  `dnsPromises.setServers()`. Centralized in `src/lib/database/dns.ts`; one shared client.
  **Verified:** `next dev` boots with `connected + ping OK`, `/api/health` → 200 `db:true`,
  real `sign-up` → 200. `ensure-indexes` still connects. See ADR-004.
  **Correction:** an earlier note here blamed the tool sandbox — that was WRONG; the sandbox
  faithfully reproduced a real Next.js dual-resolver bug.

## Lessons learned
- **Naming drift is real:** internal SVT docs define ABOS two different ways and never use
  "RevenueOS" or "conveyor-belt." Lesson: reconcile product naming early; record the canonical
  name in `PROJECT.md`. (See `knowledge/business/svt-context.md`.)
