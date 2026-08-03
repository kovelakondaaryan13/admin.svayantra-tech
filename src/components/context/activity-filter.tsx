"use client";
import { useState } from "react";
import { Timeline, type TimelineItem } from "@/components/ds";

const FILTERS = [
  { key: "all", label: "Everything" },
  { key: "ai", label: "AI" },
  { key: "people", label: "People" },
  { key: "documents", label: "Documents" },
  { key: "meetings", label: "Meetings" },
  { key: "tasks", label: "Tasks" },
];

const KIND_MAP: Record<string, string[]> = {
  all: [],
  ai: ["ai_chat", "ai_action", "ai_briefing", "assistant"],
  people: ["contact_created", "contact_updated", "employee"],
  documents: ["document_uploaded", "document_ingested", "upload", "ingestion"],
  meetings: ["meeting_created", "meeting", "calendar"],
  tasks: ["task_created", "task_completed", "task"],
};

export function ActivityFilter({ items, kinds }: { items: TimelineItem[]; kinds: string[] }) {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all"
    ? items
    : items.filter((_, i) => {
        const kind = kinds[i] ?? "";
        const filterKinds = KIND_MAP[filter] ?? [];
        return filterKinds.some(fk => kind.includes(fk));
      });

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              filter === f.key
                ? "bg-accent/15 text-accent"
                : "text-muted hover:bg-overlay/[0.06] hover:text-fg"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="px-1 py-2 text-sm text-muted">No activity for this filter.</p>
      ) : (
        <Timeline items={filtered} />
      )}
    </div>
  );
}
