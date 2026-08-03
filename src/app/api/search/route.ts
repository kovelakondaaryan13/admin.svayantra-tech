import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { searchService } from "@/services/search-service";

export const runtime = "nodejs";

/** Global search for the ⌘K palette. Permission-gated + workspace-isolated per type. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const q = new URL(req.url).searchParams.get("q") ?? "";
    return ok(await searchService.global(user, q));
  } catch (err) {
    return handleError(err);
  }
}
