import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can, isOwner } from "@/lib/iam";
import { getOrgMode } from "@/lib/mode";
import { settingsService } from "@/services/settings-service";
import { ModeSettings } from "@/components/admin/mode-settings";
import { OrgSettingsForm } from "@/components/admin/org-settings";
import { WorkspacePage } from "@/components/ds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user, "org.manage")) redirect("/home");

  const [mode, orgSettings] = await Promise.all([
    getOrgMode(user.orgId),
    settingsService.getOrg(user),
  ]);

  const ownerFlag = isOwner(user);

  return (
    <WorkspacePage
      eyebrow="Administration"
      title="Settings"
      subtitle="Organization-wide operating configuration."
      max="max-w-3xl"
    >
      <OrgSettingsForm
        initial={orgSettings as Record<string, string | string[]>}
        currentModel="Claude (Anthropic)"
        showAiConfig={ownerFlag}
      />

      {/* Existing mode toggle at the bottom */}
      <ModeSettings initialMode={mode} canToggle={ownerFlag} />
    </WorkspacePage>
  );
}
