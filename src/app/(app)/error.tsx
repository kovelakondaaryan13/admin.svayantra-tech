"use client";
import { useEffect } from "react";
import Link from "next/link";

/** Graceful error boundary for the app shell — no raw Next.js error screen. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console for local debugging; real telemetry is a later milestone.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
      <div className="glass w-full p-8">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-action/15 text-2xl">
          ⚠️
        </div>
        <h1 className="mt-4 text-lg font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted">
          This screen hit an unexpected error. You can retry, or head back home and ask STOS.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button onClick={reset} className="btn-action">
            Try again
          </button>
          <Link href="/home" className="btn-ghost">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
