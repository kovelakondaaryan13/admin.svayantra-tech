"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const SUGGESTIONS = [
  "What should I focus on today?",
  "Add a lead for Acme Corp",
  "Rahul joined today — onboard him to Sales",
  "Summarize everything about MoneyPal",
];

export function AskBar() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function go(text: string) {
    const v = text.trim();
    if (!v) return;
    router.push(`/assistant?q=${encodeURIComponent(v)}`);
  }

  return (
    <div className="glass p-2 shadow-glow">
      <div className="flex items-center gap-2">
        <span className="pl-2 text-lg">🤖</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go(q)}
          placeholder="Ask STOS to do anything…"
          className="flex-1 bg-transparent px-1 py-2 text-[15px] outline-none placeholder:text-muted/70"
        />
        <button onClick={() => go(q)} className="btn-action">
          Ask
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 px-1 pb-1 pt-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => go(s)}
            className="rounded-full border border-overlay/10 bg-overlay/[0.03] px-3 py-1 text-xs text-muted transition-colors hover:border-overlay/20 hover:text-fg"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
