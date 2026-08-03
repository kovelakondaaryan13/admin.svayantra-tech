import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { commandCenterService } from "@/services/command-center-service";
import { CommandCenterView } from "@/components/command/command-center";
import { WorkspacePage } from "@/components/ds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const user = await requireUser();
  // Executive view — owner + managers (anyone who can see the team).
  if (!can(user, "users.read")) redirect("/home");
  const cc = await commandCenterService.summary(user);
  const firstName = (user.name ?? user.email).split(/[ @]/)[0];

  return (
    <WorkspacePage
      hero
      eyebrow="Executive operations"
      title={<>Command <span className="text-gradient">Center</span></>}
      subtitle={`${firstName}, here's the whole operation at a glance — what moved, what's stuck, and where to point attention.`}
    >
      <CommandCenterView cc={cc} />
    </WorkspacePage>
  );
}
