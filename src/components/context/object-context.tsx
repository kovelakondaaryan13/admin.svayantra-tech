import type { ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { uploadService } from "@/services/upload-service";
import { conversationService } from "@/services/conversation-service";
import { activityService } from "@/services/activity-service";
import { fmtDate } from "@/lib/format";
import { Section, Timeline, Badge, AICallout, EmptyState, type TimelineItem, type BadgeVariant } from "@/components/ds";
import { ActivityFilter } from "@/components/context/activity-filter";
import type { RelatedObjectType } from "@/lib/chat-entities";

/**
 * ObjectContext — the "everything about this object" aggregation used by the Context tab on every
 * ObjectPage (Company / Person / Deal). Composes the already-unified surfaces (uploads → ingestion,
 * linked conversations, the universal activity timeline) so context lives in one place instead of
 * being scattered across tabs. Type-specific material (people, proposals, decisions) comes in via
 * `extras`, keeping this component object-agnostic. Server component — reads through services.
 */

const STATUS_TONE: Record<string, BadgeVariant> = {
  ready: "success",
  failed: "danger",
  stored: "info",
  uploading: "neutral",
  extracting: "warning",
  chunking: "warning",
  embedding: "warning",
  indexing: "warning",
  extracted: "info",
};

export async function ObjectContext({
  type,
  id,
  aiSummary,
  aiSummaryAt,
  extras,
}: {
  type: RelatedObjectType;
  id: string;
  aiSummary?: string;
  aiSummaryAt?: string;
  extras?: ReactNode;
}) {
  const user = await requireUser();
  // People are stored as contacts in the activity log; everything else maps 1:1.
  const activityType = type === "person" ? "contact" : type;
  const [files, conversations, activity] = await Promise.all([
    uploadService.list(user, { relatedType: type, relatedId: id }).catch(() => []),
    conversationService.listForObject(user, type, id).catch(() => []),
    activityService.listForEntity(user, activityType, id).catch(() => []),
  ]);

  const timeline: TimelineItem[] = activity
    .slice(0, 12)
    .map((a) => ({
      id: a.id,
      title: a.summary,
      time: fmtDate(a.createdAt),
      tone: a.kind === "won" ? ("won" as const) : a.kind === "lost" ? ("lost" as const) : ("note" as const),
    }));

  const empty = !aiSummary && files.length === 0 && conversations.length === 0 && timeline.length === 0 && !extras;

  return (
    <div className="space-y-4">
      {aiSummary && (
        <AICallout title="What STOS knows" action={aiSummaryAt ? <span className="t-micro">{fmtDate(aiSummaryAt)}</span> : undefined}>
          {aiSummary}
        </AICallout>
      )}

      {empty && (
        <Section variant="plain">
          <EmptyState icon="🔍" title="No context yet" description="Upload documents, log touches, or chat with STOS — everything will collect here." />
        </Section>
      )}

      {extras}

      <Section title={`Documents & files (${files.length})`}>
        {files.length === 0 ? (
          <EmptyState icon="📎" title="No files yet" description="Upload documents to build context for this object." action={<a href="/knowledge" className="btn-ghost text-xs">Upload →</a>} />
        ) : (
          <div className="space-y-1">
            {files.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-overlay/[0.03]">
                <a href={`/api/uploads/${f.id}`} target="_blank" rel="noreferrer" className="min-w-0 truncate text-fg hover:text-accent">
                  📎 {f.name}
                  {f.version && f.version > 1 ? <span className="t-micro"> v{f.version}</span> : null}
                </a>
                <Badge variant={STATUS_TONE[f.status] ?? "neutral"}>{f.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Conversations (${conversations.length})`}>
        {conversations.length === 0 ? (
          <EmptyState icon="💬" title="No conversations yet" description="Ask STOS about this object to start a thread." />
        ) : (
          <div className="space-y-1">
            {conversations.map((c) => (
              <Link key={c.id} href={`/assistant?c=${c.id}`} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm text-fg hover:bg-overlay/[0.03] hover:text-accent">
                <span className="min-w-0 truncate">💬 {c.title}</span>
                <span className="t-micro shrink-0">{c.messageCount} msg{c.lastMessageAt ? ` · ${fmtDate(c.lastMessageAt)}` : ""}</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Recent activity">
        {timeline.length === 0 ? (
          <EmptyState icon="📊" title="No activity yet" description="Activity will appear here as you work with this object." />
        ) : (
          <ActivityFilter
            items={timeline}
            kinds={activity.slice(0, 12).map(a => a.kind)}
          />
        )}
      </Section>
    </div>
  );
}
