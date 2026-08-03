"use client";

import { useMemo } from "react";
import { Markdown } from "@/components/ds/markdown";
import {
  LeadCard,
  CompanyCard,
  TaskCard,
  MeetingCard,
  EmployeeCard,
  SuccessCard,
} from "@/components/ds/object-cards";

/* ---------- Types ---------- */

interface ObjectBlock {
  kind: "object";
  type: string;
  data: Record<string, unknown>;
}

interface TextBlock {
  kind: "text";
  content: string;
}

type ContentBlock = ObjectBlock | TextBlock;

/* ---------- Recognised object types → card renderers ---------- */

const CARD_RENDERERS: Record<string, (d: Record<string, unknown>) => React.ReactNode> = {
  lead_created: (d) => (
    <SuccessCard
      title={`Lead created${d.name ? `: ${d.name}` : ""}`}
      message={d.message as string | undefined}
      objectType="lead"
      objectId={d.id as string | undefined}
    />
  ),
  lead: (d) => (
    <LeadCard
      name={(d.name as string) ?? "Untitled Lead"}
      company={d.company as string | undefined}
      stage={d.stage as string | undefined}
      owner={d.owner as string | undefined}
      value={d.value as string | undefined}
      id={d.id as string | undefined}
    />
  ),
  company: (d) => (
    <CompanyCard
      name={(d.name as string) ?? "Untitled Company"}
      industry={d.industry as string | undefined}
      website={d.website as string | undefined}
      dealCount={typeof d.dealCount === "number" ? d.dealCount : undefined}
      id={d.id as string | undefined}
    />
  ),
  task: (d) => (
    <TaskCard
      title={(d.title as string) ?? (d.name as string) ?? "Untitled Task"}
      assignee={d.assignee as string | undefined}
      priority={d.priority as string | undefined}
      dueDate={d.dueDate as string | undefined}
      status={d.status as string | undefined}
      id={d.id as string | undefined}
    />
  ),
  meeting: (d) => (
    <MeetingCard
      title={(d.title as string) ?? "Meeting"}
      date={d.date as string | undefined}
      attendees={Array.isArray(d.attendees) ? (d.attendees as string[]) : undefined}
      location={d.location as string | undefined}
    />
  ),
  employee: (d) => (
    <EmployeeCard
      name={(d.name as string) ?? "Unknown"}
      email={d.email as string | undefined}
      role={d.role as string | undefined}
      department={d.department as string | undefined}
      id={d.id as string | undefined}
    />
  ),
  success: (d) => (
    <SuccessCard
      title={(d.title as string) ?? "Success"}
      message={d.message as string | undefined}
      objectType={d.objectType as string | undefined}
      objectId={d.objectId as string | undefined}
      actions={Array.isArray(d.actions) ? (d.actions as { label: string; href: string }[]) : undefined}
    />
  ),
  error: (d) => (
    <div className="glass max-w-sm rounded-xl border border-danger/20 px-4 py-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-danger/15 text-sm text-danger">!</span>
        <p className="text-sm font-semibold text-danger">{(d.title as string) ?? "Error"}</p>
      </div>
      {typeof d.message === "string" && <p className="text-xs leading-relaxed text-muted">{d.message}</p>}
    </div>
  ),
};

/* ---------- Parser ---------- */

/**
 * Splits content by ``` code fences. For each JSON block, tries to parse it
 * and check for a recognised `type` field. Recognised blocks become ObjectBlocks;
 * everything else becomes TextBlocks rendered via Markdown.
 */
function parseContent(raw: string): ContentBlock[] {
  // Split on code fences: ```lang\n...\n```
  // This regex captures: [before-fence, language, code-content, after-fence, ...]
  const parts = raw.split(/(```(\w*)\n([\s\S]*?)```)/);

  const blocks: ContentBlock[] = [];
  let i = 0;

  while (i < parts.length) {
    const segment = parts[i];

    // Check if the next parts form a code fence match (full match, lang, content)
    if (i + 3 < parts.length && parts[i + 1] && parts[i + 2] !== undefined && parts[i + 3] !== undefined) {
      const fullMatch = parts[i + 1];
      const lang = parts[i + 2];
      const code = parts[i + 3];

      // Add any text before the code fence
      if (segment && segment.trim()) {
        blocks.push({ kind: "text", content: segment });
      }

      // Try to parse JSON code blocks
      if (lang === "json" || lang === "") {
        try {
          const parsed = JSON.parse(code);
          if (parsed && typeof parsed === "object" && typeof parsed.type === "string") {
            const type = parsed.type as string;
            if (CARD_RENDERERS[type]) {
              blocks.push({ kind: "object", type, data: parsed });
              i += 4;
              continue;
            }
          }
        } catch {
          // Not valid JSON or no type — fall through to text
        }
      }

      // Unrecognised code block — render as markdown
      blocks.push({ kind: "text", content: fullMatch });
      i += 4;
      continue;
    }

    // Plain text segment
    if (segment && segment.trim()) {
      blocks.push({ kind: "text", content: segment });
    }
    i += 1;
  }

  // Merge adjacent text blocks
  const merged: ContentBlock[] = [];
  for (const block of blocks) {
    const last = merged[merged.length - 1];
    if (block.kind === "text" && last?.kind === "text") {
      last.content += block.content;
    } else {
      merged.push(block);
    }
  }

  return merged;
}

/* ---------- AiMessage component ---------- */

export function AiMessage({ content }: { content: string }) {
  const blocks = useMemo(() => parseContent(content), [content]);

  // Fast path: no object blocks found, just render markdown directly
  if (blocks.length === 1 && blocks[0].kind === "text") {
    return <Markdown content={content} />;
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (block.kind === "text") {
          return <Markdown key={i} content={block.content} />;
        }
        const renderer = CARD_RENDERERS[block.type];
        if (!renderer) {
          // Shouldn't happen (parser only creates object blocks for known types),
          // but fall back to markdown code block just in case.
          return <Markdown key={i} content={`\`\`\`json\n${JSON.stringify(block.data, null, 2)}\n\`\`\``} />;
        }
        return <div key={i}>{renderer(block.data)}</div>;
      })}
    </div>
  );
}
