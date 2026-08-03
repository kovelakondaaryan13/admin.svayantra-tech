import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { disconnect } from "@/lib/connectors/credentials";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await requireUser();
    assertCan(user, "connector:manage");
    await disconnect(user, "google_calendar");
    return ok({ disconnected: true });
  } catch (err) {
    return handleError(err);
  }
}
