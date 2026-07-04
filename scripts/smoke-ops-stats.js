// Smoke: the ops stats layer — generated apps expose a token-gated
// /api/admin/stats, the engine injects + stores the per-app token at deploy,
// the collector polls and caches readings, and the owner dashboard shows an
// honest Ops strip per app. Guards the wiring the same way the other smokes do.
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("generated apps ship a token-gated stats endpoint", () => {
  assertFileIncludes("src/lib/engine/foundation-modules.ts", [
    "src/app/api/admin/stats/route.ts",
    "APP_ENGINE_STATS_TOKEN",
    "timingSafeEqual",
    "select count(*)::int as n from users",
    "from support_tickets where status = 'open'",
    "from payments where created_at > now() - interval '30 days'",
    "adminStatsApi()",
    // Deep-dive fields: revenue is a SUM of paid rows, activity is events/day.
    "coalesce(sum(amount_cents), 0)",
    "where status = 'paid'",
    "revenueCentsRecent",
    "revenueCurrency",
    "activity",
    // Revenue must be bigint (no int4 overflow 500), currency-safe (grouped +
    // single-currency only), and the payments table must carry a currency column.
    "::bigint",
    "group by currency",
    "currency text not null default 'usd'",
    "add column if not exists currency",
    // Activity uses whole calendar days, not a partial rolling window.
    "current_date - interval '13 days'"
  ]);
});

runStep("generated env example and API contract include the stats endpoint", () => {
  assertFileIncludes("src/lib/engine/app-generator.ts", [
    "APP_ENGINE_STATS_TOKEN",
    "\"/api/admin/stats\""
  ]);
});

runStep("deploys inject a per-app stats token and keep it on the build job", () => {
  assertFileIncludes("src/lib/engine/customer-build.ts", [
    "APP_ENGINE_STATS_TOKEN",
    "statsToken"
  ]);
  assertFileIncludes("src/lib/engine/build-jobs.ts", [
    "stats_token",
    "statsToken",
    "listDeployedBuildJobs"
  ]);
});

runStep("the ops collector polls, caches, and stays honest", () => {
  assertFileIncludes("src/lib/engine/ops-stats.ts", [
    "getOpsSnapshot",
    "fetchStatsFromApp",
    "getSelfOpsStats",
    "app_ops_stats_cache",
    "/api/admin/stats",
    "Not reporting yet",
    "APP_ENGINE_OPS_TARGETS"
  ]);
});

runStep("the collector carries the deep-dive fields, null-honest end to end", () => {
  assertFileIncludes("src/lib/engine/ops-stats.ts", [
    "revenueCentsRecent",
    "revenueCurrency",
    "OpsActivityDay",
    // Cache columns self-apply; revenue is bigint so an out-of-range value
    // can't fail the insert; pre-existing rows read back null, never zero.
    "ADD COLUMN IF NOT EXISTS revenue_cents_recent bigint",
    "ADD COLUMN IF NOT EXISTS revenue_currency",
    "ADD COLUMN IF NOT EXISTS activity",
    // A revenue sum without its currency is rejected: both or neither.
    "revenueReported",
    // Negative revenue rejects to null (never a fabricated $0.00).
    "function asCents",
    // Measured-empty activity ([]) is preserved distinct from not-reported (null).
    "keep the newest window; [] when nothing was measured",
    // A hostile target can't OOM the ops function: body is capped before parse.
    "readCappedText",
    "STATS_BODY_CAP_BYTES"
  ]);
});

runStep("attention checks find what needs the owner, with directed actions", () => {
  assertFileIncludes("src/lib/engine/ops-attention.ts", [
    "collectAttentionForApp",
    "sortAttentionItems",
    "checkUrlReachable",
    "listVercelEnvNames",
    "isTemporaryVercelHost",
    "action_needed",
    "needs_domain",
    "missing_env",
    "not_reporting",
    "APP_ENGINE_STATS_TOKEN"
  ]);
  assertFileIncludes("src/lib/engine/ops-stats.ts", [
    "collectAttentionForApp",
    "sortAttentionItems",
    "needs: OpsAttentionItem[]",
    "attention: sortAttentionItems"
  ]);
});

runStep("the dashboard surfaces the attention queue", () => {
  assertFileIncludes("src/components/engine/owner-portfolio-dashboard.tsx", [
    "OpsAttentionPanel",
    "Needs your attention",
    "All clear",
    "Couldn't load the app checks",
    "needs attention",
    "portfolio-attention-panel"
  ]);
  assertFileIncludes("src/app/styles.css", [".portfolio-attention-panel", ".portfolio-needs-flag"]);
});

runStep("the owner API route is admin-gated", () => {
  assertFileIncludes("src/app/api/engine/ops/stats/route.ts", [
    "canAccessEngineAdmin",
    "getOpsSnapshot",
    "Unauthorized"
  ]);
});

runStep("AppEngine itself practices the stats standard", () => {
  assertFileIncludes("src/app/api/admin/stats/route.ts", [
    "APP_ENGINE_STATS_TOKEN",
    "timingSafeEqual",
    "getSelfOpsStats"
  ]);
});

runStep("the dashboard shows an honest Ops strip per app", () => {
  assertFileIncludes("src/components/engine/owner-portfolio-dashboard.tsx", [
    "/api/engine/ops/stats",
    "portfolio-ops-strip",
    "Not reporting yet",
    "Not live yet — nothing to report",
    "open tickets",
    "orders (30d)",
    "revenue (30d)"
  ]);
  assertFileIncludes("src/app/styles.css", [".portfolio-ops-strip"]);
});

runStep("expanded cards deep-dive into users, revenue, and activity — honestly", () => {
  assertFileIncludes("src/components/engine/owner-portfolio-dashboard.tsx", [
    "OpsDeepDive",
    "How it&apos;s doing",
    "Not reported",
    "ActivityTrend",
    "Activity trend not reported yet",
    "formatMoney",
    // Gaps are gap-filled to real zero days; measured-zero ([]) is distinct
    // from not-reported (null); the span can't render thousands of bars.
    "densifyActivity",
    "No activity in the last 14 days",
    "ACTIVITY_MAX_SPAN"
  ]);
  assertFileIncludes("src/app/styles.css", [
    ".portfolio-deep-dive",
    ".portfolio-activity-bars",
    ".portfolio-activity-bar"
  ]);
});

runStep("the rollup states its coverage — a partial total never poses as the whole", () => {
  assertFileIncludes("src/components/engine/owner-portfolio-dashboard.tsx", [
    "OpsRollupPanel",
    "Across your apps",
    "apps reporting",
    // Revenue totals stay per currency; nothing converts or merges them.
    "revenueByCurrency",
    // A metric no app reported shows "not reported", never 0; each metric
    // names its own coverage; events are bounded to the 14-day window.
    "users not reported",
    "activity not reported",
    "coverageNote",
    "fourteenDayCutoff"
  ]);
  assertFileIncludes("src/app/styles.css", [".portfolio-ops-rollup"]);
});

runStep("the account-wide deploy sweep flags failing Vercel projects with a directed fix", () => {
  assertFileIncludes("src/lib/engine/ops-attention.ts", [
    "collectVercelDeployAttention",
    "listVercelProjectHealth",
    "deploy_failing",
    "deploy_check_failed",
    "DEPLOY_FAILURE_RECENT_MS",
    "disconnect the git integration",
    "deploy health wasn't checked"
  ]);
  assertFileIncludes("src/lib/engine/ops-stats.ts", [
    "collectVercelDeployAttention",
    "deploySweepCache",
    "deployAttention"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["\"smoke:ops-stats\""]);
});

console.log("ops-stats smoke ok");

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function assertFileIncludes(relativePath, expectedValues) {
  const content = readFile(relativePath);

  for (const expected of expectedValues) {
    if (!content.includes(expected)) {
      throw new Error(`${relativePath} should include ${JSON.stringify(expected)}`);
    }
  }
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}
