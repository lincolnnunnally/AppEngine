// Usage-based hosting for customer apps (owner decision 2026-11-01, LPL 03 §9a).
// Every app is hosted free inside the free allowance. A busy app is good news;
// past the allowance it pays for its activity: cost × margin, charged once a
// month from App Engine credits. The owner hears first: a heads-up at 80%, a
// "now billing for activity" note past 100%, each once per level per month, and
// the platform owner sees it in the attention queue.
// Nothing is throttled or switched off here; that would punish success. Out of
// credits = weekly reminder, and after 30 days unpaid it goes on Lincoln's to-do
// list (2026-11-02).
// SERVER ONLY. Run daily by /api/cron/usage.
import { neon } from "@neondatabase/serverless";
import { getDatabase } from "@/lib/db/client";
import { listBuildJobsByStatus, type BuildJob } from "@/lib/engine/build-jobs";
import { getAppNeonDatabase, getNeonProjectUsage } from "@/lib/engine/database-setup";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";
import { sendEmail } from "@/lib/solution-engine/notify";
import { chargeForHosting, getBalanceCents, getBillingConfig, isBillingEnabled, listHostingDebtors, normalizeUserKey } from "@/lib/engine/billing";
import { submitOwnerTask, updateOwnerTask } from "@/lib/engine/owner-tasks";
import { normalizeTaskInput } from "@/lib/engine/owner-tasks-core";
import {
  dollars,
  dunningStep,
  FREE_ALLOWANCE,
  hostingChargeReference,
  overageFor,
  previousPeriod
} from "@/lib/engine/hosting-charge-core";

const MB = 1024 * 1024;

// Free every month, per app (hosting-charge-core.ts). Past it, activity is billed.
export const STANDARD_ALLOWANCE = FREE_ALLOWANCE;

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
  priceCentsSoFar?: number; // activity past the free allowance this month, cost × margin
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
      // Set once the month is settled: what was charged (0 = inside the free allowance).
      await sql`ALTER TABLE app_usage_checks ADD COLUMN IF NOT EXISTS charged_cents bigint`;
      await sql`
        CREATE TABLE IF NOT EXISTS app_hosting_dunning (
          user_key text PRIMARY KEY,
          first_unpaid_at timestamptz NOT NULL DEFAULT now(),
          last_reminded_at timestamptz,
          escalated boolean NOT NULL DEFAULT false
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
  // Neon's project counters are an estimate, not its invoice (its docs say so).
  // They count processor time, which never exceeds what Neon bills, so this
  // errs toward charging the owner less, never more.
  return {
    jobId: job.id,
    app: job.url || job.idea.slice(0, 60),
    ownerEmail: job.userEmail,
    ...measured,
    ...usageLevel(measured),
    priceCentsSoFar: overageFor(measured, getBillingConfig().marginMultiplier).priceCents
  };
}

const LABEL = { storage: "storage", compute: "processing time", transfer: "data served" } as const;

export function usageEmail(job: Pick<BuildJob, "idea" | "url">, usage: AppUsage) {
  const app = job.url || job.idea.slice(0, 80);
  const what = LABEL[usage.worst.metric];
  if (usage.level === "over") {
    const soFar = usage.priceCentsSoFar ?? 0;
    return {
      subject: "Your app is busy. Here's what that means",
      body: [
        `Good news: your app (${app}) is getting real use.`,
        "",
        `This month it has used ${usage.worst.percent}% of the ${what} that's free every month. Hosting stays free up to that point. Activity past it is billed at our cost plus a small margin, once a month, from your App Engine credits.`,
        "",
        soFar > 0 ? `So far this month that comes to about ${dollars(soFar)}.` : "So far this month that comes to less than a cent.",
        "",
        "Nothing is switched off or slowed down. Add credits any time: https://appengine.unitedundergod.org/account",
        "",
        "— App Engine"
      ].join("\n")
    };
  }
  return {
    subject: "Heads-up: your app is getting busy",
    body: [
      `Your app (${app}) has used ${usage.worst.percent}% of the ${what} that's free every month.`,
      "",
      "Nothing to do. Hosting stays free up to the allowance. If it goes past, only the extra activity is billed, at our cost plus a small margin, from your App Engine credits. We'll tell you before that happens.",
      "",
      "— App Engine"
    ].join("\n")
  };
}

// ---- monthly settlement: charge last month's activity past the allowance -------
async function settleMonth(month: string): Promise<{ charged: number }> {
  if (!useDb() || !isBillingEnabled()) return { charged: 0 };
  const sql = getDatabase();
  await ensureTable(sql);
  const { marginMultiplier } = getBillingConfig();
  const rows = (await sql`
    select job_id, usage from app_usage_checks where period = ${month} and charged_cents is null limit 500
  `) as Array<{ job_id: string; usage: AppUsage }>;
  let charged = 0;
  for (const row of rows) {
    const usage = row.usage;
    const price = overageFor(usage, marginMultiplier).priceCents;
    const userKey = normalizeUserKey(usage.ownerEmail);
    if (price > 0 && userKey) {
      const balance = await chargeForHosting(
        userKey,
        hostingChargeReference(row.job_id, month),
        price,
        `Hosting activity past the free allowance, ${month} (${usage.app})`
      );
      charged += 1;
      const sent = await sendEmail({
        to: usage.ownerEmail,
        subject: `Your app's hosting for ${month}: ${dollars(price)}`,
        body: [
          `Your app (${usage.app}) was busy in ${month}. The activity past the free allowance came to ${dollars(price)}, taken from your App Engine credits.`,
          "",
          balance >= 0
            ? `Credits left: ${dollars(balance)}.`
            : `Your credits are ${dollars(-balance)} short. The app keeps running. Add credits when you can: https://appengine.unitedundergod.org/account`,
          "",
          "— App Engine"
        ].join("\n")
      });
      if (!sent.sent) console.error(`hosting receipt for ${row.job_id} not sent: ${sent.reason}`);
    }
    await sql`update app_usage_checks set charged_cents = ${price} where job_id = ${row.job_id} and period = ${month}`;
  }
  return { charged };
}

// ---- out of credits: weekly reminder; after 30 days, Lincoln's to-do list ------
function unpaidTaskId(userKey: string) {
  return `appengine-unpaid-hosting-${userKey.replace(/[^a-z0-9]+/g, "-")}`.slice(0, 80);
}

async function runDunning(now: Date): Promise<{ reminded: number; escalated: number }> {
  if (!useDb() || !isBillingEnabled()) return { reminded: 0, escalated: 0 };
  const sql = getDatabase();
  await ensureTable(sql);
  const debtors = await listHostingDebtors();
  const owing = new Set(debtors.map((debtor) => debtor.userKey));
  let reminded = 0;
  let escalated = 0;
  for (const { userKey, balanceCents } of debtors) {
    const rows = (await sql`
      insert into app_hosting_dunning (user_key) values (${userKey})
      on conflict (user_key) do update set user_key = excluded.user_key
      returning first_unpaid_at, last_reminded_at, escalated
    `) as Array<{ first_unpaid_at: Date | string; last_reminded_at: Date | string | null; escalated: boolean }>;
    const state = rows[0];
    const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null);
    const step = dunningStep(
      { firstUnpaidAt: iso(state.first_unpaid_at)!, lastRemindedAt: iso(state.last_reminded_at), escalated: state.escalated },
      now
    );
    if (step.remind) {
      const sent = await sendEmail({
        to: userKey,
        subject: "A reminder about your app's hosting",
        body: [
          `Your App Engine credits are ${dollars(-balanceCents)} short for hosting activity past the free allowance.`,
          "",
          "Your app is still running. Nothing is switched off. Add credits when you can: https://appengine.unitedundergod.org/account",
          "",
          "— App Engine"
        ].join("\n")
      });
      if (sent.sent) {
        reminded += 1;
        await sql`update app_hosting_dunning set last_reminded_at = now() where user_key = ${userKey}`;
      }
    }
    if (step.escalate) {
      const task = normalizeTaskInput({
        id: unpaidTaskId(userKey),
        app: "appengine",
        title: `Unpaid hosting: ${userKey} is ${dollars(-balanceCents)} short`,
        why: `Their app has been past its free allowance and unpaid for ${step.daysUnpaid} days. It is still running and they get a weekly reminder. Your rule (2026-11-02): a personal call after 30 days.`,
        steps: ["Reach out personally", "Add credits for them, forgive it, or agree a plan. Note what you decided."],
        kind: "money",
        priority: "recommended",
        requestedBy: "App Engine usage check",
        verifiedOn: now.toISOString().slice(0, 10),
        verifiedHow: `credits ledger shows a ${dollars(-balanceCents)} balance below zero, unpaid ${step.daysUnpaid} days`
      });
      if (task.ok) {
        await submitOwnerTask(task.task, "api");
        await sql`update app_hosting_dunning set escalated = true where user_key = ${userKey}`;
        escalated += 1;
      }
    }
  }
  // Paid up: stop reminding and clear the to-do item.
  const tracked = (await sql`select user_key, escalated from app_hosting_dunning`) as Array<{ user_key: string; escalated: boolean }>;
  for (const row of tracked) {
    if (owing.has(row.user_key)) continue;
    if ((await getBalanceCents(row.user_key)) < 0) continue;
    await sql`delete from app_hosting_dunning where user_key = ${row.user_key}`;
    if (row.escalated) await updateOwnerTask(unpaidTaskId(row.user_key), { status: "done" }).catch(() => null);
  }
  return { reminded, escalated };
}

export async function sweepUsage(
  now = new Date(),
  measure: (job: BuildJob) => Promise<AppUsage | null> = measureApp
): Promise<{ checked: number; warned: number; over: number; charged: number; reminded: number; escalated: number }> {
  const month = period(now);
  // Close last month first: one charge per app, idempotent by ledger reference.
  const settled = await settleMonth(previousPeriod(month)).catch((error) => {
    console.error("hosting settlement failed", error);
    return { charged: 0 };
  });
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
  const dunning = await runDunning(now).catch((error) => {
    console.error("hosting reminders failed", error);
    return { reminded: 0, escalated: 0 };
  });
  return { checked, warned, over, charged: settled.charged, ...dunning };
}
