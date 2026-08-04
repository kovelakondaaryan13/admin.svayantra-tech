"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProfileForm({
  name: initialName,
  personalEmail: initialPersonalEmail,
  phone: initialPhone,
}: {
  name: string;
  personalEmail?: string;
  phone?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [personalEmail, setPersonalEmail] = useState(initialPersonalEmail ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, personalEmail, phone }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(b?.error ?? "Could not save your profile.");
        return;
      }
      setSuccess(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div>
        <label htmlFor="name" className="mb-1 block text-xs font-medium text-muted">Name</label>
        <input id="name" className="inp" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
      </div>
      <div>
        <label htmlFor="personalEmail" className="mb-1 block text-xs font-medium text-muted">
          Personal email <span className="text-faint">(recovery — not your login)</span>
        </label>
        <input
          id="personalEmail"
          className="inp"
          type="email"
          value={personalEmail}
          onChange={(e) => setPersonalEmail(e.target.value)}
          placeholder="you@gmail.com"
        />
      </div>
      <div>
        <label htmlFor="phone" className="mb-1 block text-xs font-medium text-muted">Phone</label>
        <input id="phone" className="inp" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
      </div>
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-action/20 bg-action/10 px-3 py-2">
          <span className="mt-0.5 shrink-0 text-xs" aria-hidden>⚠️</span>
          <p className="text-xs text-action">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-success/20 bg-success/10 px-3 py-2">
          <span className="mt-0.5 shrink-0 text-xs" aria-hidden>✅</span>
          <p className="text-xs text-success">Profile saved.</p>
        </div>
      )}
      <button type="submit" disabled={busy} className="btn-accent w-full">
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
