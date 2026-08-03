import { db } from "@/lib/mongo";
import type { User } from "@/lib/types";

interface UsageRecord {
  orgId: string;
  userId: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  at: Date;
}

export interface UserUsageSummary {
  userId: string;
  name: string;
  email: string;
  totalInput: number;
  totalOutput: number;
  totalTokens: number;
  requestCount: number;
  estimatedCost: number;
}

export interface OrgUsageSummary {
  totalInput: number;
  totalOutput: number;
  totalTokens: number;
  requestCount: number;
  estimatedCost: number;
  byUser: UserUsageSummary[];
  period: { from: string; to: string };
}

const COST_PER_M_INPUT = 3.0;
const COST_PER_M_OUTPUT = 15.0;

function estimateCost(input: number, output: number): number {
  return (input / 1_000_000) * COST_PER_M_INPUT + (output / 1_000_000) * COST_PER_M_OUTPUT;
}

export const aiUsageService = {
  async record(user: User, inputTokens: number, outputTokens: number, model: string): Promise<void> {
    if (!inputTokens && !outputTokens) return;
    try {
      const d = await db();
      await d.collection<UsageRecord>("aiUsage").insertOne({
        orgId: user.orgId,
        userId: user.id,
        inputTokens,
        outputTokens,
        model,
        at: new Date(),
      });
    } catch { /* usage tracking must never break the app */ }
  },

  async summary(user: User, days = 30): Promise<OrgUsageSummary> {
    const d = await db();
    const since = new Date(Date.now() - days * 86400000);
    const col = d.collection<UsageRecord>("aiUsage");

    const pipeline = await col.aggregate<{
      _id: string;
      totalInput: number;
      totalOutput: number;
      count: number;
    }>([
      { $match: { orgId: user.orgId, at: { $gte: since } } },
      {
        $group: {
          _id: "$userId",
          totalInput: { $sum: "$inputTokens" },
          totalOutput: { $sum: "$outputTokens" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalOutput: -1 } },
    ]).toArray();

    const employeeCol = d.collection("employees");
    const employees = await employeeCol
      .find({ orgId: user.orgId, deletedAt: { $exists: false } })
      .project({ userId: 1, name: 1, email: 1 })
      .toArray();
    const nameMap = new Map(employees.map(e => [e.userId, { name: e.name as string, email: e.email as string }]));

    const byUser: UserUsageSummary[] = pipeline.map(row => {
      const info = nameMap.get(row._id);
      return {
        userId: row._id,
        name: info?.name ?? "Unknown",
        email: info?.email ?? "",
        totalInput: row.totalInput,
        totalOutput: row.totalOutput,
        totalTokens: row.totalInput + row.totalOutput,
        requestCount: row.count,
        estimatedCost: estimateCost(row.totalInput, row.totalOutput),
      };
    });

    const totalInput = byUser.reduce((s, u) => s + u.totalInput, 0);
    const totalOutput = byUser.reduce((s, u) => s + u.totalOutput, 0);

    return {
      totalInput,
      totalOutput,
      totalTokens: totalInput + totalOutput,
      requestCount: byUser.reduce((s, u) => s + u.requestCount, 0),
      estimatedCost: estimateCost(totalInput, totalOutput),
      byUser,
      period: { from: since.toISOString(), to: new Date().toISOString() },
    };
  },
};
