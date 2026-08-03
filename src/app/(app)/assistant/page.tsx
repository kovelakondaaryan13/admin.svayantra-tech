import { requireUser } from "@/lib/auth";
import { conversationService } from "@/services/conversation-service";
import { intentService } from "@/services/intent-service";
import { AssistantConsole } from "@/components/assistant/console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const c = typeof sp.c === "string" ? sp.c : undefined;
  const intent = intentService.parse(sp) ?? undefined;

  type Att = { fileId: string; name: string; documentId?: string };
  const conversations = await conversationService.list(user).catch(() => []);
  let current:
    | {
        id: string;
        title: string;
        messages: { role: "user" | "assistant"; text: string; attachments?: Att[] }[];
        relatedObjects?: { type: string; id: string; label?: string }[];
      }
    | undefined;
  if (c) {
    const got = await conversationService.get(user, c).catch(() => null);
    if (got) {
      current = {
        id: got.conversation.id,
        title: got.conversation.title,
        relatedObjects: got.conversation.relatedObjects?.map((o) => ({ type: o.type, id: o.id, label: o.label })),
        messages: got.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            text: m.content,
            attachments: m.attachments?.map((a) => ({ fileId: a.fileId, name: a.name, documentId: a.documentId })),
          })),
      };
    }
  }

  // Remount the console when the conversation identity changes. Without a key, navigating between
  // conversations (sidebar → ?c=) reuses the component and its useState-initialized thread stays
  // stale — the shell loads but previous messages never appear. The key ties the client thread to
  // the URL: a real conversation id, else the intent/query, else a fresh chat.
  const consoleKey = c ?? (intent ? `intent:${intent.objectId}:${intent.intent ?? ""}:${q ?? ""}` : q ? `q:${q}` : "new");

  return (
    <AssistantConsole
      key={consoleKey}
      initial={q}
      intent={intent}
      current={current}
      conversations={conversations.map((cv) => ({
        id: cv.id,
        title: cv.title,
        lastMessageAt: cv.lastMessageAt ? new Date(cv.lastMessageAt).toISOString() : undefined,
        messageCount: cv.messageCount,
        pinned: cv.pinned,
      }))}
    />
  );
}
