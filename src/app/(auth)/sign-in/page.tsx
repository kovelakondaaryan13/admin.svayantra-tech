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
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-muted">Password</label>
            <input
              id="password"
              className="inp"
              placeholder="••••••••"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-action/20 bg-action/10 px-3 py-2">
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
