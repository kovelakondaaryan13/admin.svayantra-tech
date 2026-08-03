# knowledge/integrations

How RevenueOS talks to external services. One note per integration: purpose, auth, key
endpoints/SDK, rate limits, failure modes, and our wrapper/fallback strategy.

## Integrations in the stack
| Service    | Purpose                        | Wrapper / notes |
|------------|--------------------------------|-----------------|
| Claude API | AI orchestration & drafting    | Via a typed client; model selection per task; retries + fallback. |
| Notion API | Knowledge store (SOPs, docs…)  | **Behind a swappable knowledge interface**; never on the AI critical path without a cache/fallback; mind rate limits. |
| Resend     | Transactional email / notifications | Templated; verify domain; handle bounces. |
| Cloudinary | File/image storage             | Signed uploads; store the URL/ref in Mongo, not the blob. |
| Better Auth| Authentication                 | Serverless-safe session handling; see `../../skills/security/implement-authentication.md`. |
| Sentry     | Error monitoring               | Scrub PII; alert on error-rate spikes. |
| PostHog    | Product analytics              | Event taxonomy documented here as it grows. |

## What lives here
- One file per integration as it's implemented (e.g. `notion.md`, `claude.md`, `resend.md`),
  following `../../skills/integrations/integrate-external-api.md`.

## Rule
Every external call is wrapped (typed client), has a timeout + retry policy, and a defined
failure mode. Third-party outages must never take down a core RevenueOS flow silently.
