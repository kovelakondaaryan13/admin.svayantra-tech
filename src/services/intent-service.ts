/**
 * IntentService — the single launcher for object-scoped AI actions. Every Action Bar button and
 * (later) ⌘K command becomes an *intent*: a structured request that carries where it came from,
 * what the user is trying to do, which object it concerns, and where to return. The Assistant
 * hydrates the intent so it never asks obvious questions ("which company?"), links the conversation
 * to the object, titles it meaningfully, and offers a way back.
 *
 * Pure module — no DB, no React. Safe to import from client (build/parse URLs) and server (title,
 * humanize). Persistence + object-linking happen through ConversationService; the AI object-context
 * injection happens in the orchestrator. This is the shared implementation the Action Bar and the
 * Command Palette both call, so launches stay consistent and become measurable (telemetry `intent`).
 */
import type { RelatedObjectType } from "@/lib/chat-entities";

export interface IntentContext {
  objectType: RelatedObjectType | string; // "company" | "lead" | "person"
  objectId: string;
  objectName: string;
  intent?: string; // machine key, e.g. "create_task"
  instruction: string; // natural-language message sent to the Assistant
  origin?: string; // e.g. "deal_action_bar"
  returnUrl?: string; // where to send the user back when done
}

// Machine-key → human label, used for conversation titles + the "back" affordance.
const HUMAN: Record<string, string> = {
  ask: "Ask AI",
  create_task: "Add task",
  create_deal: "Create deal",
  advance_stage: "Advance stage",
  generate_proposal: "Proposal draft",
  add_contact: "Add contact",
  schedule_meeting: "Schedule meeting",
  assign_owner: "Assign owner",
  mark_lost: "Mark lost",
  assign_work: "Assign work",
  schedule_1on1: "1:1",
  upload: "Upload",
};

type ParamBag = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export const intentService = {
  humanize(intent?: string): string {
    if (!intent) return "Chat";
    return HUMAN[intent] ?? intent.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  },

  /** Smart conversation title, e.g. "MoneyPal • Create deal". */
  title(ctx: Pick<IntentContext, "objectName" | "intent">): string {
    return `${ctx.objectName} • ${this.humanize(ctx.intent)}`;
  },

  /** Build the Assistant deep-link that carries the full intent. */
  launch(ctx: IntentContext): string {
    const p = new URLSearchParams();
    p.set("q", ctx.instruction);
    p.set("otype", ctx.objectType);
    p.set("oid", ctx.objectId);
    p.set("oname", ctx.objectName);
    if (ctx.intent) p.set("intent", ctx.intent);
    if (ctx.origin) p.set("origin", ctx.origin);
    if (ctx.returnUrl) p.set("return", ctx.returnUrl);
    return `/assistant?${p.toString()}`;
  },

  /** Hydrate an intent from Assistant search params. Returns null if no object is attached. */
  parse(params: ParamBag): IntentContext | null {
    const objectType = first(params.otype);
    const objectId = first(params.oid);
    const objectName = first(params.oname);
    const instruction = first(params.q);
    if (!objectType || !objectId || !objectName) return null;
    return {
      objectType,
      objectId,
      objectName,
      instruction: instruction ?? "",
      intent: first(params.intent),
      origin: first(params.origin),
      returnUrl: first(params.return),
    };
  },
};
