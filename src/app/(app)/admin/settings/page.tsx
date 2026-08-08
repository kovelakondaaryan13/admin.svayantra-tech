import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can, isOwner } from "@/lib/iam";
import { getOrgMode } from "@/lib/mode";
import { getUploadRetentionDays } from "@/lib/upload-retention";
import { settingsService } from "@/services/settings-service";
import { ModeSettings } from "@/components/admin/mode-settings";
import { OrgSettingsForm } from "@/components/admin/org-settings";
import { UploadRetentionSettings } from "@/components/admin/upload-retention-settings";
import { WorkspacePage } from "@/components/ds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  if (!can(user, "org.manage")) redirect("/home");

  const [mode, orgSettings, retentionDays] = await Promise.all([
    getOrgMode(user.orgId),
    settingsService.getOrg(user),
    getUploadRetentionDays(user.orgId),
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

      <UploadRetentionSettings initialDays={retentionDays} canManage={can(user, "org.manage")} />

      {/* Existing mode toggle at the bottom */}
      <ModeSettings initialMode={mode} canToggle={ownerFlag} />
    </WorkspacePage>
  );
}
