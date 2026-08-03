export function EmptyState({
  title,
  hint,
  action,
  icon = "✦",
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="animate-in rounded-2xl border border-dashed border-border bg-panel/60 p-10 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent/15 to-teal/15 text-xl text-accent">
        {icon}
      </div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
