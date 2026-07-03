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
    "adminStatsApi()"
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
    "orders (30d)"
  ]);
  assertFileIncludes("src/app/styles.css", [".portfolio-ops-strip"]);
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
