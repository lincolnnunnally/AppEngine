// Pure parts of the cockpit's Local Leads read (see operate-leads.ts).

export const OPERATE_STATS_AUDIENCE = "operate-stats";
const PASS_TTL_SECONDS = 120;

export type OperateLeadStats = {
  requests: number;
  requests30d: number;
  matched: number;
  prosTakingLeads: number;
  accepted: number;
  won: number;
  lost: number;
  wonAmountCents: number;
  feesTrackedCents: number;
  feeRateBps: number;
  charging: boolean;
  shops: Array<{ name: string; won: number; wonAmountCents: number; feesTrackedCents: number }>;
};

/**
 * A two-minute owner pass for Operate's /api/admin/lead-stats. Audience
 * "operate-stats", never "operate": Operate refuses to redeem it as a sign-in.
 */
export function leadStatsPassClaims(ownerEmail: string, nowSeconds: number, jti: string): Record<string, unknown> {
  return {
    iss: "appengine",
    aud: OPERATE_STATS_AUDIENCE,
    email: ownerEmail.trim().toLowerCase(),
    iat: nowSeconds,
    exp: nowSeconds + PASS_TTL_SECONDS,
    jti
  };
}

/** Accept Operate's answer only when every number is a real number. */
export function parseLeadStats(body: unknown): OperateLeadStats | null {
  const stats = (body as { ok?: unknown; stats?: unknown } | null)?.stats as Record<string, unknown> | undefined;
  if (!stats || (body as { ok?: unknown }).ok !== true) return null;
  const keys = [
    "requests", "requests30d", "matched", "prosTakingLeads", "accepted",
    "won", "lost", "wonAmountCents", "feesTrackedCents", "feeRateBps"
  ] as const;
  for (const key of keys) if (typeof stats[key] !== "number" || !Number.isFinite(stats[key])) return null;
  const shops = Array.isArray(stats.shops) ? stats.shops : [];
  return {
    ...(Object.fromEntries(keys.map((k) => [k, stats[k] as number])) as Omit<OperateLeadStats, "charging" | "shops">),
    charging: stats.charging === true,
    shops: shops
      .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === "object")
      .map((s) => ({
        name: String(s.name ?? ""),
        won: Number(s.won ?? 0),
        wonAmountCents: Number(s.wonAmountCents ?? 0),
        feesTrackedCents: Number(s.feesTrackedCents ?? 0)
      }))
  };
}
