import { readFile } from "node:fs/promises";
import path from "node:path";
import { listRegisteredAppProjects, type RegisteredAppProject } from "@/lib/engine/app-portfolio-registry-store";
import { listLoopExecutionRecords } from "@/lib/engine/loop-run-records";

// READ-ONLY canonical-flow status. Reads existing stores (app_portfolio_registry,
// loop_run_records) and the latest regression test output only. It creates no
// state, no new registry, and runs no workflow logic.

const REGRESSION_RESULT_PATH = path.join(process.cwd(), ".app-engine", "regression", "canonical-flow-latest.json");

export type CanonicalFlowStatus = {
  safeToUse: "yes" | "no" | "unknown";
  headline: string;
  regression: {
    available: boolean;
    passed: boolean;
    generatedAt?: string;
    totalChecks?: number;
    failedChecks?: number;
    duplicateBuildBlocked?: boolean;
  };
  canonical: {
    frontDoor: string;
    registry: string;
    priorWorkCheck: string;
    executionRecord: string;
    registryEntryCount: number;
    executionRecordCount: number;
  };
  latestCompletedLoops: CompletedLoopRow[];
  latestNonBuildLoops: CompletedLoopRow[];
  duplicateBuildProtection: {
    verified: boolean;
    source: string;
  };
  pr: { branch: string; number: string; title: string; url: string };
};

export type CompletedLoopRow = {
  appSlug: string;
  appName: string;
  runId: string;
  goal: string;
  status: string;
  completedAt: string;
  solutionClass: string;
};

type RegressionResult = {
  passed?: boolean;
  generatedAt?: string;
  totalChecks?: number;
  failedChecks?: number;
  checks?: Array<{ label: string; ok: boolean }>;
};

export async function loadCanonicalFlowStatus(): Promise<CanonicalFlowStatus> {
  const [registry, executionRecords, regression] = await Promise.all([
    safeList(listRegisteredAppProjects),
    safeList(listLoopExecutionRecords),
    readRegressionResult()
  ]);

  const completed = collectCompletedLoops(registry);
  const latestCompletedLoops = completed.slice(0, 8);
  const latestNonBuildLoops = completed.filter((loop) => loop.solutionClass === "non_build").slice(0, 8);

  const duplicateCheck = (regression?.checks || []).find((check) => check.label.includes("duplicate build is blocked"));
  const regressionAvailable = Boolean(regression);
  const regressionPassed = regression?.passed === true;

  const safeToUse: CanonicalFlowStatus["safeToUse"] = !regressionAvailable ? "unknown" : regressionPassed ? "yes" : "no";
  const headline =
    safeToUse === "yes"
      ? "AppEngine is safe to use — the canonical flow passed its latest regression."
      : safeToUse === "no"
        ? "Caution — the latest canonical-flow regression FAILED. Review before building."
        : "Unknown — no regression result found. Run `npm run smoke:canonical-flow-regression`.";

  return {
    safeToUse,
    headline,
    regression: {
      available: regressionAvailable,
      passed: regressionPassed,
      generatedAt: regression?.generatedAt,
      totalChecks: regression?.totalChecks,
      failedChecks: regression?.failedChecks,
      duplicateBuildBlocked: duplicateCheck?.ok
    },
    canonical: {
      frontDoor: "problem_intake_gate",
      registry: "app_portfolio_registry",
      priorWorkCheck: "prior_work_check (blocking before any packet)",
      executionRecord: "loop_run_records",
      registryEntryCount: registry.length,
      executionRecordCount: executionRecords.length
    },
    latestCompletedLoops,
    latestNonBuildLoops,
    duplicateBuildProtection: {
      verified: duplicateCheck?.ok === true,
      source: "latest canonical-flow regression (packet layer refuses build_new for work already in the registry)"
    },
    pr: {
      branch: "feat/cockpit-shell-and-two-doors",
      number: "165",
      title: "Canonical flow consolidation",
      url: "https://github.com/lincolnnunnally/AppEngine/pull/165"
    }
  };
}

function collectCompletedLoops(registry: RegisteredAppProject[]): CompletedLoopRow[] {
  const rows: CompletedLoopRow[] = [];
  for (const app of registry) {
    for (const loop of app.completedLoops || []) {
      rows.push({
        appSlug: app.slug,
        appName: app.name,
        runId: loop.runId,
        goal: loop.goal,
        status: loop.status,
        completedAt: loop.completedAt,
        solutionClass: loop.solutionClass || "software"
      });
    }
  }
  return rows.sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
}

async function readRegressionResult(): Promise<RegressionResult | null> {
  try {
    const raw = await readFile(REGRESSION_RESULT_PATH, "utf8");
    return JSON.parse(raw) as RegressionResult;
  } catch {
    return null;
  }
}

async function safeList<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}
