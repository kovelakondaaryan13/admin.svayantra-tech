"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";
import { Logo } from "@/components/shell/logo";

const ERROR_MAP: Record<string, string> = {
  "Invalid email or password": "Wrong email or password. Please try again.",
  "User already exists": "An account with this email already exists. Try signing in.",
  "auth failed": "Authentication failed. Please check your credentials.",
};

function friendlyError(msg: string): string {
  for (const [key, friendly] of Object.entries(ERROR_MAP)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return friendly;
  }
  if (msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("network")) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return msg;
}

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function validate(): string | null {
    if (!email.trim()) return "Email is required.";
    if (!password) return "Password is required.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (mode === "up" && !name.trim()) return "Name is required to create an account.";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setBusy(true);
    setError(null);
    try {
      const res =
        mode === "in"
          ? await signIn.email({ email: email.trim(), password })
          : await signUp.email({ email: email.trim(), password, name: name.trim() });
      if (res.error) throw new Error(res.error.message ?? "auth failed");
      router.push("/home");
    } catch (err) {
      setError(friendlyError((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-10 h-80 w-80 rounded-full bg-teal/10 blur-3xl" />

      <div className="animate-in relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size="lg" />
          <h1 className="mt-5 text-xl font-semibold tracking-tight">
            {mode === "in" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted">Svayantra&apos;s AI operating system for revenue teams.</p>
        </div>

        <form onSubmit={submit} className="glass space-y-3 p-6" noValidate>
          {mode === "up" && (
            <div>
              <label htmlFor="name" className="mb-1 block text-xs font-medium text-muted">Full name</label>
              <input
                id="name"
                className="inp"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-muted">Email</label>
            <input
              id="email"
              className="inp"
              placeholder="you@company.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-muted">Password</label>
            <div className="relative">
              <input
                id="password"
                className="inp pr-9"
                placeholder="••••••••"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted transition-colors hover:text-fg"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.5a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {error && (
            <div role="alert" aria-live="polite" className="flex items-start gap-2 rounded-lg border border-action/20 bg-action/10 px-3 py-2">
              <span className="mt-0.5 shrink-0 text-xs">⚠️</span>
              <p className="text-xs text-action">{error}</p>
            </div>
          )}
          <button type="submit" disabled={busy} className="btn-accent w-full">
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {mode === "in" ? "Signing in…" : "Creating account…"}
              </span>
            ) : (
              mode === "in" ? "Sign in" : "Create account"
            )}
          </button>
          <button
            type="button"
            onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(null); }}
            className="w-full text-xs text-muted transition-colors hover:text-fg"
          >
            {mode === "in" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
