# Skill — Integrate an External API

## Purpose
Add a third-party integration (Notion, Claude, Resend, Cloudinary, …) behind a typed, resilient
wrapper so outages and rate limits never silently break a core flow.

## When to use
Any time RevenueOS calls an external service.

## Best practices
- **Wrap it.** One typed client module per service in `lib/integrations/`. Nothing else calls
  the vendor SDK directly. This makes the vendor swappable and mockable.
- **Timeouts + retries with backoff** on every call; treat the network as hostile.
- **Define the failure mode** explicitly: fallback value, cache, queue-for-later, or a clear
  user-facing error. Third-party down ≠ RevenueOS down.
- **Notion specifically:** keep it **behind a knowledge interface** and **off the AI critical
  path** — cache/pointer in Mongo (`knowledgeIndex`), refresh async. Respect rate limits.
- **Secrets from env**, documented by name in `knowledge/engineering/`; never committed.
- **Log failures to Sentry** with context; emit metrics for latency/error-rate.
- **Idempotency** for anything that sends or charges (email, etc.).

## Common mistakes
- Calling the vendor SDK inline throughout the codebase → un-swappable, un-mockable.
- No timeout → a hung vendor call hangs a Vercel function to timeout.
- Notion on the synchronous AI path → slow, rate-limited AI answers.
- Leaking vendor errors to users.

## Code conventions
- `lib/integrations/<vendor>.ts` exports a small typed API (`notion.getDoc(id)`), not the raw
  client. Config via env. Document the integration in `knowledge/integrations/<vendor>.md`.

## Example
```ts
// lib/integrations/notion.ts
export const notion = {
  async getDoc(pageId: string): Promise<KnowledgeDoc | null> {
    try {
      return await withRetry(() => client.pages.retrieve({ page_id: pageId }), { timeoutMs: 4000 });
    } catch (err) { captureException(err); return null; } // fail safe → caller uses cache/fallback
  },
};
```

## Checklist
- [ ] Typed wrapper in `lib/integrations/`; nothing else calls the SDK
- [ ] Timeout + retry/backoff; defined failure mode
- [ ] Notion behind knowledge interface, off the AI critical path
- [ ] Secrets from env; documented by name
- [ ] Failures logged to Sentry; user sees a clean error
- [ ] Integration note added to `knowledge/integrations/`
