import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { PageHeader, Section, Avatar } from "@/components/ds";
import { AccountForm } from "./account-form";

export const runtime = "nodejs";

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

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader eyebrow="Account" title="Your account" subtitle="Manage your sign-in details." />

      <Section title="Profile">
        <div className="flex items-center gap-3">
          <Avatar name={user.name ?? user.email} size="lg" />
          <div>
            <div className="text-sm font-medium text-fg">{user.name ?? user.email}</div>
            <div className="text-xs text-muted">{user.email}</div>
            <div className="mt-0.5 text-xs text-muted">{ROLE_LABEL[user.role] ?? user.role}</div>
          </div>
        </div>
      </Section>

      <Section title="Change password">
        <AccountForm />
      </Section>
    </div>
  );
}
