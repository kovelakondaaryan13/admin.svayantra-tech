export type WorkspaceMode = "demo" | "production";

/**
 * Single client-side entry point for switching the org's active workspace. Both the
 * sidebar toggle and the command palette hit this instead of duplicating the
 * fetch + error-shape handling — a prior divergence between the two left one of them
 * silently no-op-ing on failure.
 */
export async function switchWorkspace(mode: WorkspaceMode): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/admin/mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.error ?? "Could not switch workspace mode." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the server. Check your connection and try again." };
  }
}
