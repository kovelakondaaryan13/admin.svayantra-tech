import Link from "next/link";

/** Global 404 — on-brand, always offers a way back. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="glass w-full max-w-md p-8">
        <div className="flex items-center justify-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-teal text-sm font-bold text-surface">
            S
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            ST<span className="text-accent">OS</span>
          </span>
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-1 text-sm text-muted">
          That page doesn&apos;t exist. It may have moved into the Assistant.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Link href="/home" className="btn-action">
            Go home
          </Link>
          <Link href="/assistant" className="btn-ghost">
            Ask STOS
          </Link>
        </div>
      </div>
    </div>
  );
}
