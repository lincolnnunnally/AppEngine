import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.PENDING_CHECK_RESOLUTION_INPUT || "";
const outputPath = process.env.PENDING_CHECK_RESOLUTION_OUTPUT || "";

if (!inputPath || !fs.existsSync(path.resolve(inputPath))) {
  throw new Error("Pending check resolution needs an input JSON file.");
}

const input = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
const artifact = createPendingCheckResolution(input, new Date(input.now || Date.now()));

if (outputPath) writeJson(outputPath, artifact);

console.log(`pending-check-resolution ok: ${artifact.status} -> ${artifact.nextSafeAction}`);

function createPendingCheckResolution(input, now) {
  const timeoutMinutes = normalizeTimeout(input.timeoutMinutes);
  const checks = (input.checks || []).map((check) => normalizeCheck(check, now));
  const requiredChecks = checks.filter((check) => check.category === "required");
  const advisoryChecks = checks.filter((check) => check.category === "advisory");
  const blockingChecks = checks.filter((check) => check.category === "blocking");
  const failedChecks = checks.filter((check) => check.state === "failed");
  const missingChecks = checks.filter((check) => check.state === "missing");
  const pendingChecks = checks.filter((check) => check.state === "pending");
  const requiredNotPassed = requiredChecks.filter((check) => check.state !== "passed");
  const blockingNotPassed = blockingChecks.filter((check) => check.state !== "passed");
  const youngAdvisoryPending = advisoryChecks.filter((check) => check.state === "pending" && (check.ageMinutes || 0) < timeoutMinutes);
  const staleAdvisoryPending = advisoryChecks.filter((check) => check.state === "pending" && (check.ageMinutes || 0) >= timeoutMinutes);
  const decision = decideStatus({
    failedChecks,
    missingChecks,
    requiredNotPassed,
    blockingNotPassed,
    youngAdvisoryPending,
    staleAdvisoryPending
  });

  return {
    kind: "pending_check_resolution",
    schemaVersion: 1,
    id: `pending_check_resolution_${now.getTime().toString(36)}`,
    createdAt: input.createdAt || now.toISOString(),
    status: decision.status,
    reviewReady: decision.reviewReady,
    timeoutMinutes,
    requiredChecks,
    advisoryChecks,
    blockingChecks,
    pendingChecks,
    failedChecks,
    missingChecks,
    ownerReadableSummary: buildOwnerSummary(decision.status, {
      timeoutMinutes,
      failedChecks,
      requiredNotPassed,
      blockingNotPassed,
      youngAdvisoryPending,
      staleAdvisoryPending
    }),
    nextSafeAction: decision.nextSafeAction,
    evidence: decision.evidence,
    guardrails: defaultGuardrails()
  };
}

function decideStatus({ failedChecks, missingChecks, requiredNotPassed, blockingNotPassed, youngAdvisoryPending, staleAdvisoryPending }) {
  if (failedChecks.length) {
    return {
      status: "blocked_by_failed_check",
      reviewReady: false,
      nextSafeAction: "fix_failed_check",
      evidence: failedChecks.map((check) => `${check.name} failed`)
    };
  }

  if (blockingNotPassed.length) {
    return {
      status: "blocked_by_required_pending",
      reviewReady: false,
      nextSafeAction: "resolve_blocking_check",
      evidence: blockingNotPassed.map((check) => `${check.name} is ${check.state}`)
    };
  }

  if (requiredNotPassed.length || missingChecks.some((check) => check.category === "required")) {
    return {
      status: "blocked_by_required_pending",
      reviewReady: false,
      nextSafeAction: "wait_for_required_checks",
      evidence: requiredNotPassed.map((check) => `${check.name} is ${check.state}`)
    };
  }

  if (youngAdvisoryPending.length) {
    return {
      status: "waiting_for_timeout",
      reviewReady: false,
      nextSafeAction: "wait_for_external_pending_timeout",
      evidence: youngAdvisoryPending.map((check) => `${check.name} has been pending for ${check.ageMinutes || 0} minutes`)
    };
  }

  if (staleAdvisoryPending.length) {
    return {
      status: "review_ready_with_advisory_pending",
      reviewReady: true,
      nextSafeAction: "owner_review_with_advisory_pending_check",
      evidence: staleAdvisoryPending.map((check) => `${check.name} remains pending after ${check.ageMinutes || 0} minutes`)
    };
  }

  return {
    status: "review_ready",
    reviewReady: true,
    nextSafeAction: "owner_review",
    evidence: ["All required checks passed and no stale external pending status blocks owner review."]
  };
}

function buildOwnerSummary(status, context) {
  if (status === "blocked_by_failed_check") {
    return `Blocked: ${context.failedChecks.map((check) => check.name).join(", ")} failed. AppEngine must not bypass failing checks.`;
  }

  if (status === "blocked_by_required_pending") {
    const names = [...context.requiredNotPassed, ...context.blockingNotPassed].map((check) => `${check.name} (${check.state})`);
    return `Blocked: required or blocking checks are not complete: ${names.join(", ")}.`;
  }

  if (status === "waiting_for_timeout") {
    return `Waiting: external advisory checks are still pending but have not exceeded the ${context.timeoutMinutes} minute timeout.`;
  }

  if (status === "review_ready_with_advisory_pending") {
    return `Review-ready with caution: required checks passed, but ${context.staleAdvisoryPending
      .map((check) => check.name)
      .join(", ")} is still pending beyond ${context.timeoutMinutes} minutes. This is not merge approval.`;
  }

  if (status === "review_ready") return "Review-ready: required checks passed and no failed or unresolved blocking checks were found.";

  return "Failed honestly: AppEngine could not determine pending check resolution.";
}

function normalizeCheck(check, now) {
  return {
    ...check,
    ageMinutes: check.ageMinutes ?? ageMinutes(check.startedAt || null, now)
  };
}

function normalizeTimeout(value) {
  const fromEnv = Number(process.env.APPENGINE_PENDING_CHECK_TIMEOUT_MINUTES || "");
  const timeout = Number.isFinite(value) && value && value > 0 ? value : fromEnv > 0 ? fromEnv : 45;

  return Math.round(timeout);
}

function ageMinutes(startedAt, now) {
  if (!startedAt) return 0;
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return 0;

  return Math.max(0, Math.round((now.getTime() - started) / 60000));
}

function defaultGuardrails() {
  return {
    noAutomaticMerge: true,
    noBypassFailingChecks: true,
    requiredChecksMustPass: true,
    externalPendingOnlyAfterTimeout: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true,
    noCodexAutoExecution: true
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(path.resolve(filePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
