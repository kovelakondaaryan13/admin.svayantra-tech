/**
 * Financial data — permission-protected. Only roles with `finance.read` (Owner,
 * Finance Head/Executive, or explicitly granted) can reach it; the check is in the
 * service AND the route, so no financial data leaks through any API.
 */
import { db } from "@/lib/mongo";
import { assertPermission } from "@/lib/iam";
import { activeWorkspace } from "@/lib/workspace";
import type { User } from "@/lib/types";

export interface FinanceSummary {
  currency: string;
  pipelineValueMinor: number;
  wonValueMinor: number;
  byStage: Record<string, number>;
}

export const financeService = {
  async summary(user: User): Promise<FinanceSummary> {
    assertPermission(user, "finance.read");
    const database = await db();
    const agg = await database
      .collection("leads")
      .aggregate<{ _id: string; total: number }>([
        { $match: { orgId: user.orgId, deletedAt: { $exists: false }, workspace: await activeWorkspace() } },
        { $group: { _id: "$stage", total: { $sum: { $ifNull: ["$value.amountMinor", 0] } } } },
      ])
      .toArray();

    const byStage: Record<string, number> = {};
    let pipeline = 0;
    let won = 0;
    for (const r of agg) {
      byStage[r._id] = r.total;
      pipeline += r.total;
      if (r._id === "won") won = r.total;
    }
    return { currency: "INR", pipelineValueMinor: pipeline, wonValueMinor: won, byStage };
  },
};
