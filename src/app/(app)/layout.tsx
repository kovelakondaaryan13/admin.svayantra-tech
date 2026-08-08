import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { activeWorkspace } from "@/lib/workspace";
import { Sidebar, type NavItem } from "@/components/shell/sidebar";
import { CommandPalette } from "@/components/shell/command-palette";
import { MobileTopBar } from "@/components/shell/mobile-topbar";

export const runtime = "nodejs";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  const workspace = await activeWorkspace();

  // Founder-first, persona-aware IA. A handful of destinations; everything else is
  // reached through the Assistant or contextual navigation. Nav is gated by
  // permission (UX only — every route also enforces authorization server-side).
  const items: NavItem[] = [
    { href: "/home", label: "Home", icon: "🏠" },
    { href: "/assistant", label: "Assistant", icon: "🤖" },
    { href: "/calendar", label: "Calendar", icon: "📅" },
  ];
  if (user.isOwner) items.push({ href: "/command", label: "Command", icon: "🎯" });
  if (can(user, "crm.read")) items.push({ href: "/work", label: "Work", icon: "💼" });
  if (can(user, "crm.read")) items.push({ href: "/companies", label: "Companies", icon: "🏢" });
  if (can(user, "users.read")) items.push({ href: "/people", label: "People", icon: "👥" });
  if (can(user, "ai.use")) items.push({ href: "/knowledge", label: "Knowledge", icon: "📚" });
  if (
    can(user, "org.manage") ||
    can(user, "objects.manage") ||
    can(user, "roles.manage") ||
    can(user, "policies.manage") ||
    can(user, "audit.view") ||
    can(user, "settings.manage")
  ) {
    items.push({ href: "/workspace", label: "Organization", icon: "🏗️" });
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} workspace={workspace} user={{ name: user.name, email: user.email, role: user.role, isOwner: user.isOwner }} />
      <main className="animate-in flex-1 overflow-x-hidden px-4 py-4 md:px-8 md:py-8">
        <MobileTopBar workspace={workspace} />
        {children}
      </main>
      <CommandPalette isOwner={user.isOwner} userId={user.id} />
    </div>
  );
}
