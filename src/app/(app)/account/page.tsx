import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { employeeService } from "@/services/employee-service";
import { connectorStatuses } from "@/lib/connectors/credentials";
import { issueService } from "@/services/issue-service";
import { PageHeader, Section, Avatar } from "@/components/ds";
import { AccountForm } from "./account-form";
import { ProfileForm } from "./profile-form";
import { GoogleCalendarCard } from "./google-calendar-card";
import { RaiseIssue, type IssueRow } from "./raise-issue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  owner: "Founder",
  super_admin: "Super Admin",
  admin: "Admin",
  sales_head: "Sales Head",
  sales_rep: "Sales Representative",
  finance_head: "Finance Head",
  finance_exec: "Finance Executive",
  ops_manager: "Operations Manager",
  hr: "HR",
  marketing: "Marketing",
  project_manager: "Project Manager",
  developer: "Developer",
  support: "Support",
  viewer: "Viewer",
};

export default async function AccountPage() {
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const [profile, statuses, issues] = await Promise.all([
    employeeService.getSelf(user).catch(() => null),
    connectorStatuses(user).catch(() => []),
    issueService.list(user).catch(() => []),
  ]);
  const google = statuses.find((s) => s.kind === "google_calendar");
  const issueRows: IssueRow[] = issues
    .filter((i) => i.reporterId === user.id)
    .map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      aiResponse: i.aiResponse,
      aiResolved: i.aiResolved,
      createdAt: new Date(i.createdAt).toISOString(),
    }));

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader eyebrow="Account" title="Your account" subtitle="Manage your sign-in details." />

      <Section title="Profile">
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={user.name ?? user.email} size="lg" />
          <div>
            <div className="text-sm font-medium text-fg">{user.name ?? user.email}</div>
            <div className="text-xs text-muted">{user.email} (login)</div>
            <div className="mt-0.5 text-xs text-muted">{ROLE_LABEL[user.role] ?? user.role}</div>
          </div>
        </div>
        {profile && (
          <ProfileForm name={profile.name} personalEmail={profile.personalEmail} phone={profile.phone} />
        )}
      </Section>

      <Section title="Google Calendar">
        <GoogleCalendarCard
          connected={google?.status === "connected"}
          accountEmail={google?.accountEmail ?? null}
          canConnect={can(user, "calendar.write")}
          canTest={can(user, "integrations.read")}
        />
      </Section>

      <Section title="Change password">
        <AccountForm />
      </Section>

      <Section title="Support">
        <RaiseIssue initial={issueRows} />
      </Section>
    </div>
  );
}
