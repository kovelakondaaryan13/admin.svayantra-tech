/**
 * Minimal in-process event bus. Deliberately simple for M1 (Vercel serverless).
 * Upgrade to a durable jobs collection + cron only when retries/durability are
 * genuinely needed — record that as an ADR. See
 * .claude/skills/architecture/event-driven-architecture.md
 */
export type DomainEvent =
  | { name: "lead.created"; leadId: string; orgId: string; actorId: string }
  | {
      name: "lead.stage_changed";
      leadId: string;
      orgId: string;
      from: string;
      to: string;
      actorId: string;
    };

type Handler = (event: DomainEvent) => void | Promise<void>;

const handlers: Handler[] = [];

export function on(handler: Handler): void {
  handlers.push(handler);
}

/** Emit after a successful write. Handler failures are logged, never thrown. */
export async function emit(event: DomainEvent): Promise<void> {
  await Promise.all(
    handlers.map(async (h) => {
      try {
        await h(event);
      } catch (err) {
        console.error(`[events] handler failed for ${event.name}`, err);
      }
    }),
  );
}
