"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => <h2 className="mb-1 mt-3 text-base font-semibold text-fg first:mt-0">{children}</h2>,
  h2: ({ children }) => <h3 className="mb-1 mt-2.5 text-sm font-semibold text-fg first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-0.5 mt-2 text-sm font-medium text-fg first:mt-0">{children}</h4>,
  h4: ({ children }) => <h5 className="mb-0.5 mt-2 text-sm font-medium text-muted first:mt-0">{children}</h5>,
  h5: ({ children }) => <h6 className="mb-0.5 mt-1.5 text-sm font-medium text-muted first:mt-0">{children}</h6>,
  h6: ({ children }) => <h6 className="mb-0.5 mt-1.5 text-xs font-medium text-muted first:mt-0">{children}</h6>,
  p: ({ children }) => <p className="mb-1.5 text-sm leading-relaxed text-fg last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
  em: ({ children }) => <em className="italic text-fg/90">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-accent/30 pl-3 text-sm text-muted">{children}</blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="text-xs font-mono text-fg">{children}</code>
      );
    }
    return (
      <code className="rounded bg-overlay/[0.1] px-1.5 py-0.5 text-xs font-mono text-fg">{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-1.5 overflow-x-auto rounded-lg bg-overlay/[0.1] p-3">{children}</pre>
  ),
  ul: ({ children }) => <ul className="my-1 list-disc space-y-0.5 pl-5 text-sm text-fg">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 list-decimal space-y-0.5 pl-5 text-sm text-fg">{children}</ol>,
  li: ({ children, ...props }) => {
    const className = typeof props.className === "string" ? props.className : "";
    if (className.includes("task-list-item")) {
      return <li className="list-none -ml-5 flex items-start gap-1.5">{children}</li>;
    }
    return <li className="text-sm leading-relaxed text-fg">{children}</li>;
  },
  input: ({ checked }) => (
    <input
      type="checkbox"
      checked={checked}
      readOnly
      className="mt-1 h-3.5 w-3.5 shrink-0 appearance-none rounded border border-overlay/20 bg-overlay/[0.08] checked:border-accent checked:bg-accent/20"
    />
  ),
  table: ({ children }) => (
    <div className="my-1.5 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-overlay/10">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-overlay/[0.06]">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="px-2 py-1.5 text-left text-xs font-semibold text-fg/80">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-2 py-1.5 text-xs text-fg/70">{children}</td>
  ),
  hr: () => <hr className="my-3 border-overlay/10" />,
};

export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
