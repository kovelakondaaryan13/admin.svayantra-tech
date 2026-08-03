"use client";

export default function AuthError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-sm p-8 text-center">
        <div className="mb-4 text-3xl">⚠️</div>
        <h1 className="text-lg font-semibold text-fg">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">{error.message || "An unexpected error occurred."}</p>
        <div className="mt-6 flex flex-col gap-2">
          <button onClick={reset} className="btn-accent w-full">Try again</button>
          <a href="/sign-in" className="text-xs text-muted transition-colors hover:text-fg">Back to sign in</a>
        </div>
      </div>
    </div>
  );
}
