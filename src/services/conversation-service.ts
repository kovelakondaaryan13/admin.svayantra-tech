/**
 * ConversationService — the single persistence layer for the Assistant. Pages/routes NEVER touch
 * Mongo directly; every future AI feature (uploads, memory, agents, approvals) goes through here.
 * Conversations + messages are workspace-scoped (demo/production isolated).
 */
import { repo, toDTO } from "@/data/collection";
import * as audit from "@/lib/audit";
import { record } from "@/lib/telemetry";
import { NotFound, Forbidden } from "@/lib/errors";
import { filterByRelated, type Conversation, type ChatMessage, type RelatedObject, type MessageStatus, type AttachmentReference, type Citation } from "@/lib/chat-entities";
import type { DTO } from "@/lib/entities";
import type { User } from "@/lib/types";

const conversations = repo<Conversation>("conversations", { workspaceScoped: true });
const messages = repo<ChatMessage>("chatMessages", { workspaceScoped: true });

const titleFrom = (text: string) => {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 60 ? t.slice(0, 60) + "…" : t || "New conversation";
};

export interface AppendInput {
  role: ChatMessage["role"];
  content: string;
  status?: MessageStatus;
  provider?: string;
  model?: string;
  tokens?: { input?: number; output?: number };
  latencyMs?: number;
  attachments?: AttachmentReference[];
  citations?: Citation[];
  metadata?: Record<string, unknown>;
}

export const conversationService = {
  /** List (owner-scoped): pinned first, then most-recent. Optional text search + archived. */
  async list(user: User, opts: { q?: string; includeArchived?: boolean } = {}): Promise<DTO<Conversation>[]> {
    let rows = await conversations.list(user.orgId, { userId: user.id } as never, 200);
    if (!opts.includeArchived) rows = rows.filter((c) => !c.archived);

    const q = opts.q?.trim().toLowerCase();
    if (q) {
      // Match on title/summary...
      const byMeta = new Set(
        rows.filter((c) => (c.title + " " + (c.summary ?? "")).toLowerCase().includes(q)).map((c) => c._id.toHexString()),
      );
      // ...and on message content (simple text search, not semantic).
      const msgHits = await messages.list(user.orgId, { content: { $regex: q, $options: "i" } } as never, 300);
      for (const m of msgHits) byMeta.add(m.conversationId);
      rows = rows.filter((c) => byMeta.has(c._id.toHexString()));
    }

    return rows
      .sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false) ||
        new Date(b.lastMessageAt ?? b.updatedAt).getTime() - new Date(a.lastMessageAt ?? a.updatedAt).getTime())
      .map(toDTO);
  },

  /** Conversations the caller has linked to a given object (Deal/Company/Person 360). */
  async listForObject(user: User, type: string, id: string): Promise<DTO<Conversation>[]> {
    const rows = await conversations.list(user.orgId, { userId: user.id } as never, 200);
    return filterByRelated(rows.filter((c) => !c.archived), (c) => c.relatedObjects, type, id).map(toDTO);
  },

  /**
   * Create a conversation. When launched from an object (Action Bar / ⌘K intent), pass `title`
   * (e.g. "MoneyPal • Add task") and `relatedObject` so the thread is scoped to that object from
   * message one — it shows up in the object's Context and the orchestrator gets its identity.
   */
  async create(
    user: User,
    opts: { firstMessage?: string; title?: string; relatedObject?: RelatedObject; intentKey?: string } = {},
  ): Promise<DTO<Conversation>> {
    const { firstMessage, title, relatedObject, intentKey } = opts;
    const resolvedTitle = title ?? (firstMessage ? titleFrom(firstMessage) : "New conversation");
    const doc = await conversations.insert(user.orgId, {
      userId: user.id,
      title: resolvedTitle,
      summary: firstMessage ? titleFrom(firstMessage) : title,
      messageCount: 0,
      relatedObjects: relatedObject ? [relatedObject] : undefined,
    });
    if (relatedObject) record("intent", intentKey ?? "chat", { objectType: relatedObject.type });
    return toDTO(doc);
  },

  /** The objects a conversation is scoped to (for the orchestrator's ACTIVE OBJECT context). */
  async objectsFor(user: User, id: string): Promise<RelatedObject[]> {
    const conv = await conversations.findById(user.orgId, id);
    if (!conv || conv.userId !== user.id) return [];
    return conv.relatedObjects ?? [];
  },

  async get(user: User, id: string): Promise<{ conversation: DTO<Conversation>; messages: DTO<ChatMessage>[] }> {
    const conv = await own(user, id);
    const msgs = (await messages.list(user.orgId, { conversationId: id } as never, 1000))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return { conversation: toDTO(conv), messages: msgs.map(toDTO) };
  },

  /** Append a message + keep title/summary/count/timestamp current. */
  async append(user: User, conversationId: string, input: AppendInput): Promise<DTO<ChatMessage>> {
    const conv = await own(user, conversationId);
    const msg = await messages.insert(user.orgId, {
      conversationId,
      role: input.role,
      content: input.content,
      status: input.status ?? "complete",
      provider: input.provider,
      model: input.model,
      tokens: input.tokens,
      latencyMs: input.latencyMs,
      attachments: input.attachments,
      citations: input.citations,
      metadata: input.metadata,
    });
    // Auto-title only a still-default thread — never clobber a smart intent title ("Deal • Add task").
    const shouldAutoTitle = conv.messageCount === 0 && input.role === "user" && conv.title === "New conversation";
    await conversations.update(user.orgId, conversationId, {
      messageCount: (conv.messageCount ?? 0) + 1,
      lastMessageAt: new Date(),
      ...(shouldAutoTitle ? { title: titleFrom(input.content), summary: titleFrom(input.content) } : {}),
    });
    return toDTO(msg);
  },

  async rename(user: User, id: string, title: string): Promise<void> {
    await own(user, id);
    await conversations.update(user.orgId, id, { title: titleFrom(title) });
  },

  async setFlags(user: User, id: string, flags: { pinned?: boolean; archived?: boolean }): Promise<void> {
    await own(user, id);
    await conversations.update(user.orgId, id, flags);
  },

  async attachObject(user: User, id: string, related: RelatedObject): Promise<void> {
    const conv = await own(user, id);
    const existing = conv.relatedObjects ?? [];
    if (existing.some((r) => r.type === related.type && r.id === related.id)) return;
    await conversations.update(user.orgId, id, { relatedObjects: [...existing, related] });
  },

  async remove(user: User, id: string): Promise<void> {
    await own(user, id);
    await conversations.softDelete(user.orgId, id);
    const msgs = await messages.list(user.orgId, { conversationId: id } as never, 1000);
    for (const m of msgs) await messages.softDelete(user.orgId, m._id.toHexString());
    await audit.record({ actor: user, action: "conversation.delete", entity: id });
  },
};

/** Fetch a conversation and assert the caller owns it. */
async function own(user: User, id: string): Promise<Conversation> {
  const conv = await conversations.findById(user.orgId, id);
  if (!conv) throw new NotFound("conversation not found");
  if (conv.userId !== user.id) throw new Forbidden("not your conversation");
  return conv;
}
