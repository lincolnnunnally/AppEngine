// Usage safeguard for customer apps. Every app gets a standard allowance with
// its build (and its monthly hosting). A busy app is good news — but past the
// allowance it costs real money to keep fast, so the owner is told before it
// matters: a heads-up at 80%, an upgrade request past 100%, each at most once
// per level per month, and the platform owner sees it in the attention queue.
// Nothing is throttled or switched off here — that would punish success.
// SERVER ONLY. Run daily by /api/cron/usage.
import { neon } from "@neondatabase/serverless";
import { getDatabase } from "@/lib/db/client";
import { listBuildJobsByStatus, type BuildJob } from "@/lib/engine/build-jobs";
import { getAppNeonDatabase, getNeonProjectUsage } from "@/lib/engine/database-setup";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";
import { sendEmail } from "@/lib/solution-engine/notify";

const MB = 1024 * 1024;

// What the standard plan includes per app, per month. Sized inside what one app
// costs us to host (Neon per-project free allowance: 100 compute-hours) so the
// standard price stays profitable. Change here; everything else follows.
export const STANDARD_ALLOWANCE = {
  storageBytes: 500 * MB,
  computeHours: 50,
  transferBytes: 2 * 1024 * MB
};

export type UsageLevel = "ok" | "warn" | "over";
export type AppUsage = {
  jobId: string;
  app: string; // the app's address, or its idea when it has none
  ownerEmail: string;
  storageBytes: number;
  computeHours: number;
  transferBytes: number;
  level: UsageLevel;
  worst: { metric: "storage" | "compute" | "transfer"; percent: number };
};

const LEVEL_RANK: Record<UsageLevel, number> = { ok: 0, warn: 1, over: 2 };

export function usageLevel(usage: { storageBytes: number; computeHours: number; transferBytes: number }) {
  const ratios = [
    { metric: "storage" as const, percent: (usage.storageBytes / STANDARD_ALLOWANCE.storageBytes) * 100 },
    { metric: "compute" as const, percent: (usage.computeHours / STANDARD_ALLOWANCE.computeHours) * 100 },
    { metric: "transfer" as const, percent: (usage.transferBytes / STANDARD_ALLOWANCE.transferBytes) * 100 }
  ];
  const worst = ratios.sort((a, b) => b.percent - a.percent)[0];
  const level: UsageLevel = worst.percent >= 100 ? "over" : worst.percent >= 80 ? "warn" : "ok";
  return { level, worst: { metric: worst.metric, percent: Math.round(worst.percent) } };
}

// ---- record of what we've already told each owner (per app, per month) -------
const memory = new Map<string, { level: UsageLevel; usage: AppUsage; at: string }>();
function useDb() {
  return Boolean(getConfiguredDatabaseUrl());
}
let tableReady: Promise<void> | null = null;
async function ensureTable(sql: ReturnType<typeof getDatabase>) {
  if (!tableReady) {
    tableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS app_usage_checks (
          job_id text NOT NULL,
          period text NOT NULL,
          level text NOT NULL DEFAULT 'ok',
          notified_level text NOT NULL DEFAULT 'ok',
          usage jsonb NOT NULL DEFAULT '{}'::jsonb,
          checked_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (job_id, period)
        )
      `;
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

function period(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

// Saves this check; returns the level the owner was last told about this month.
async function recordCheck(usage: AppUsage, month: string): Promise<UsageLevel> {
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    const rows = (await sql`
      insert into app_usage_checks (job_id, period, level, usage)
      values (${usage.jobId}, ${month}, ${usage.level}, ${JSON.stringify(usage)}::jsonb)
      on conflict (job_id, period) do update set level = excluded.level, usage = excluded.usage, checked_at = now()
      returning notified_level
    `) as Array<{ notified_level: UsageLevel }>;
    return rows[0]?.notified_level ?? "ok";
  }
  const key = `${usage.jobId}:${month}`;
  const previous = memory.get(key)?.level ?? "ok";
  memory.set(key, { level: previous, usage, at: new Date().toISOString() });
  return previous;
}

// Raise the notified level only if it's still below — two sweeps can't both email.
async function claimNotification(jobId: string, month: string, level: UsageLevel): Promise<boolean> {
  if (useDb()) {
    const sql = getDatabase();
    const rows = (await sql`
      update app_usage_checks set notified_level = ${level}
      where job_id = ${jobId} and period = ${month}
        and (case notified_level when 'over' then 2 when 'warn' then 1 else 0 end) < ${LEVEL_RANK[level]}
      returning job_id
    `) as Array<Record<string, unknown>>;
    return rows.length > 0;
  }
  const key = `${jobId}:${month}`;
  const entry = memory.get(key);
  if (!entry || LEVEL_RANK[entry.level] >= LEVEL_RANK[level]) return false;
  memory.set(key, { ...entry, level });
  return true;
}

// Apps at or past their allowance this month, for the owner's attention queue.
export async function listAppsNeedingUpgrade(month = period()): Promise<AppUsage[]> {
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    const rows = (await sql`
      select usage from app_usage_checks where period = ${month} and level in ('warn', 'over') order by level desc, checked_at desc limit 50
    `) as Array<{ usage: AppUsage }>;
    return rows.map((row) => row.usage);
  }
  return [...memory.entries()].filter(([key, v]) => key.endsWith(month) && v.usage.level !== "ok").map(([, v]) => v.usage);
}

// ---- the check -----------------------------------------------------------------
export async function measureApp(job: BuildJob): Promise<AppUsage | null> {
  if (!job.projectId) return null;
  const db = await getAppNeonDatabase(job.projectId).catch(() => null);
  if (!db) return null;
  const [neonUsage, sizeRows] = await Promise.all([
    getNeonProjectUsage(db.neonProjectId).catch(() => null),
    neon(db.databaseUrl)
      .query("select pg_database_size(current_database())::bigint as bytes")
      .catch(() => [] as Array<Record<string, unknown>>)
  ]);
  const measured = {
    storageBytes: Number((sizeRows as Array<{ bytes?: unknown }>)[0]?.bytes || 0),
    computeHours: Math.round(((neonUsage?.computeSeconds || 0) / 3600) * 10) / 10,
    transferBytes: neonUsage?.transferBytes || 0
  };
  return { jobId: job.id, app: job.url || job.idea.slice(0, 60), ownerEmail: job.userEmail, ...measured, ...usageLevel(measured) };
}

const LABEL = { storage: "storage", compute: "processing time", transfer: "data served" } as const;

export function usageEmail(job: Pick<BuildJob, "idea" | "url">, usage: AppUsage) {
  const app = job.url || job.idea.slice(0, 80);
  const what = LABEL[usage.worst.metric];
  if (usage.level === "over") {
    return {
      subject: "Your app is busy — time for a bigger plan",
      body: [
        `Good news: your app (${app}) is getting real use.`,
        "",
        `This month it has used ${usage.worst.percent}% of the ${what} its standard plan includes. It's still running, but to keep it fast as it grows it needs a bigger plan.`,
        "",
        "Reply to this email and we'll move it over — nothing is switched off while we sort it out.",
        "",
        "— App Engine"
      ].join("\n")
    };
  }
  return {
    subject: "Heads-up: your app is getting busy",
    body: [
      `Your app (${app}) has used ${usage.worst.percent}% of the ${what} its standard plan includes this month.`,
      "",
      "Nothing to do yet. If it keeps growing we'll let you know when it's time for a bigger plan — or reply now if you'd like to talk about it.",
      "",
      "— App Engine"
    ].join("\n")
  };
}

export async function sweepUsage(
  now = new Date(),
  measure: (job: BuildJob) => Promise<AppUsage | null> = measureApp
): Promise<{ checked: number; warned: number; over: number }> {
  const month = period(now);
  let checked = 0;
  let warned = 0;
  let over = 0;
  for (const job of await listBuildJobsByStatus("live", 500)) {
    const usage = await measure(job).catch(() => null);
    if (!usage) continue;
    checked += 1;
    const toldAlready = await recordCheck(usage, month);
    if (LEVEL_RANK[usage.level] <= LEVEL_RANK[toldAlready]) continue;
    if (!(await claimNotification(job.id, month, usage.level))) continue;
    const sent = await sendEmail({ to: job.userEmail, ...usageEmail(job, usage) });
    if (!sent.sent) console.error(`usage email for ${job.id} not sent: ${sent.reason}`);
    if (usage.level === "over") over += 1;
    else warned += 1;
  }
  return { checked, warned, over };
}
