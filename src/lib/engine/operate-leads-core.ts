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
  // Trends. Optional: an older Operate does not send them, and the cockpit
  // shows "not reporting" for whatever is missing.
  offered?: number;
  passed?: number;
  unmatched?: number;
  weekly?: Array<{ weekStart: string; requests: number }>;
  byTrade?: LeadBreakdownRow[];
  byTown?: LeadBreakdownRow[];
  notResponding?: Array<{ name: string; waiting: number }>;
};

export type LeadBreakdownRow = { name: string; requests: number; matched: number; won: number };

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

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const MISSING = Symbol("missing");

/**
 * An optional list: missing stays missing; present must be an array whose
 * every entry has its label as a string and real numbers, else the whole
 * answer is refused.
 */
function optionalRows<T>(
  value: unknown,
  textKey: string,
  numberKeys: readonly string[]
): T[] | typeof MISSING | null {
  if (value === undefined) return MISSING;
  if (!Array.isArray(value)) return null;
  const rows: T[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    if (typeof r[textKey] !== "string") return null;
    for (const key of numberKeys) if (!isNum(r[key])) return null;
    rows.push(Object.fromEntries([textKey, ...numberKeys].map((k) => [k, r[k]])) as T);
  }
  return rows;
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
  const trends: Partial<OperateLeadStats> = {};
  for (const key of ["offered", "passed", "unmatched"] as const) {
    if (stats[key] === undefined) continue;
    if (!isNum(stats[key])) return null;
    trends[key] = stats[key];
  }
  const weekly = optionalRows<{ weekStart: string; requests: number }>(stats.weekly, "weekStart", ["requests"]);
  const byTrade = optionalRows<LeadBreakdownRow>(stats.byTrade, "name", ["requests", "matched", "won"]);
  const byTown = optionalRows<LeadBreakdownRow>(stats.byTown, "name", ["requests", "matched", "won"]);
  const notResponding = optionalRows<{ name: string; waiting: number }>(stats.notResponding, "name", ["waiting"]);
  if (weekly === null || byTrade === null || byTown === null || notResponding === null) return null;
  if (weekly !== MISSING) trends.weekly = weekly;
  if (byTrade !== MISSING) trends.byTrade = byTrade;
  if (byTown !== MISSING) trends.byTown = byTown;
  if (notResponding !== MISSING) trends.notResponding = notResponding;
  return {
    ...(Object.fromEntries(keys.map((k) => [k, stats[k] as number])) as Pick<OperateLeadStats, (typeof keys)[number]>),
    charging: stats.charging === true,
    shops: shops
      .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === "object")
      .map((s) => ({
        name: String(s.name ?? ""),
        won: Number(s.won ?? 0),
        wonAmountCents: Number(s.wonAmountCents ?? 0),
        feesTrackedCents: Number(s.feesTrackedCents ?? 0)
      })),
    ...trends
  };
}

/**
 * A whole-number percent, or null when it can't be said: the counts are
 * missing or there is nothing to divide by yet (shown as such, never as 0%).
 */
export function percentOf(part: number | undefined, whole: number | undefined): number | null {
  if (part === undefined || whole === undefined || whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

/** Won / (won + lost). */
export function winRate(stats: OperateLeadStats): number | null {
  return percentOf(stats.won, stats.won + stats.lost);
}

/** (Accepted + passed) / offered matches; null when Operate doesn't send `offered`/`passed`. */
export function responseRate(stats: OperateLeadStats): number | null {
  if (stats.passed === undefined) return null;
  return percentOf(stats.accepted + stats.passed, stats.offered);
}
