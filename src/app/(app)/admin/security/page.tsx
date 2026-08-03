import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { WorkspacePage } from "@/components/ds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const user = await requireUser();
  if (!can(user, "audit.view")) redirect("/home");

  return (
    <WorkspacePage
      eyebrow="Administration"
      title="Security"
      subtitle="Password policy, session management, and authentication settings."
      max="max-w-3xl"
    >
      {/* ---- Password Policy ---- */}
      <section className="glass space-y-3 p-5">
        <div>
          <h2 className="text-sm font-semibold text-fg">Password Policy</h2>
          <p className="text-xs text-muted">Current password requirements for all users.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <span className="text-xs font-medium text-muted">Minimum length</span>
            <p className="mt-0.5 text-sm font-semibold text-fg">6 characters</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <span className="text-xs font-medium text-muted">Requirements</span>
            <p className="mt-0.5 text-sm font-semibold text-fg">At least one letter and number</p>
          </div>
        </div>
      </section>

      {/* ---- Active Sessions ---- */}
      <section className="glass space-y-3 p-5">
        <div>
          <h2 className="text-sm font-semibold text-fg">Active Sessions</h2>
          <p className="text-xs text-muted">Monitor and manage logged-in sessions across your organization.</p>
        </div>

        <div className="rounded-lg border border-border p-6 text-center">
          <p className="text-sm font-medium text-fg">Session management coming soon</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
            You will be able to view active sessions and revoke access from here.
          </p>
        </div>
      </section>

      {/* ---- Authentication ---- */}
      <section className="glass space-y-3 p-5">
        <div>
          <h2 className="text-sm font-semibold text-fg">Authentication</h2>
          <p className="text-xs text-muted">How users sign in to your organization.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <span className="text-xs font-medium text-muted">Provider</span>
            <p className="mt-0.5 text-sm font-semibold text-fg">Email + Password</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <span className="text-xs font-medium text-muted">Two-factor authentication</span>
            <p className="mt-0.5 text-sm font-medium text-fg">Coming in a future release</p>
          </div>
        </div>
      </section>
    </WorkspacePage>
  );
}
