"use client";
import { useState } from "react";
import { changePassword } from "@/lib/auth-client";

export function AccountForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  function validate(): string | null {
    if (!currentPassword) return "Current password is required.";
    if (newPassword.length < 6) return "New password must be at least 6 characters.";
    if (newPassword !== confirmPassword) return "New password and confirmation do not match.";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (res.error) throw new Error(res.error.message ?? "Could not change password.");
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div>
        <label htmlFor="currentPassword" className="mb-1 block text-xs font-medium text-muted">
          Current password
        </label>
        <input
          id="currentPassword"
          className="inp"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <div>
        <label htmlFor="newPassword" className="mb-1 block text-xs font-medium text-muted">
          New password
        </label>
        <input
          id="newPassword"
          className="inp"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          minLength={6}
          required
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="mb-1 block text-xs font-medium text-muted">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          className="inp"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          minLength={6}
          required
        />
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
          <p className="text-xs text-success">Password updated. Other sessions were signed out.</p>
        </div>
      )}
      <button type="submit" disabled={busy} className="btn-accent w-full">
        {busy ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Updating…
          </span>
        ) : (
          "Update password"
        )}
      </button>
    </form>
  );
}
