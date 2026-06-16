export type PendingCheckCategory = "required" | "advisory" | "blocking";

export type PendingCheckState = "passed" | "failed" | "pending" | "missing";

export type PendingCheckProvider = "local" | "github" | "vercel" | "external";

export type PendingCheckResolutionStatus =
  | "review_ready"
  | "review_ready_with_advisory_pending"
  | "blocked_by_failed_check"
  | "blocked_by_required_pending"
  | "waiting_for_timeout"
  | "failed_honestly";

export type PendingCheckResolutionCheck = {
  name: string;
  category: PendingCheckCategory;
  state: PendingCheckState;
  provider: PendingCheckProvider;
  startedAt?: string | null;
  completedAt?: string | null;
  detailsUrl?: string | null;
  ageMinutes?: number | null;
  note?: string;
};

export type PendingCheckResolution = {
  kind: "pending_check_resolution";
  schemaVersion: 1;
  id: string;
  createdAt: string;
  status: PendingCheckResolutionStatus;
  reviewReady: boolean;
  timeoutMinutes: number;
  requiredChecks: PendingCheckResolutionCheck[];
  advisoryChecks: PendingCheckResolutionCheck[];
  blockingChecks: PendingCheckResolutionCheck[];
  pendingChecks: PendingCheckResolutionCheck[];
  failedChecks: PendingCheckResolutionCheck[];
  missingChecks: PendingCheckResolutionCheck[];
  ownerReadableSummary: string;
  nextSafeAction: string;
  evidence: string[];
  guardrails: PendingCheckResolutionGuardrails;
};

export type PendingCheckResolutionInput = {
  checks: PendingCheckResolutionCheck[];
  timeoutMinutes?: number;
  createdAt?: string;
};

type PendingCheckResolutionGuardrails = {
  noAutomaticMerge: true;
  noBypassFailingChecks: true;
  requiredChecksMustPass: true;
  externalPendingOnlyAfterTimeout: true;
  noProductionDeploy: true;
  noPaidResources: true;
  noMigrations: true;
  noSecretsOrEnvChanges: true;
  repositoryVisibilityUnchanged: true;
  noCodexAutoExecution: true;
};

const DEFAULT_TIMEOUT_MINUTES = 45;

export function createPendingCheckResolution(input: PendingCheckResolutionInput, now = new Date()): PendingCheckResolution {
  const timeoutMinutes = normalizeTimeout(input.timeoutMinutes);
  const createdAt = input.createdAt || now.toISOString();
  const checks = input.checks.map((check) => normalizeCheck(check, now));
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
    createdAt,
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

function decideStatus({
  failedChecks,
  missingChecks,
  requiredNotPassed,
  blockingNotPassed,
  youngAdvisoryPending,
  staleAdvisoryPending
}: {
  failedChecks: PendingCheckResolutionCheck[];
  missingChecks: PendingCheckResolutionCheck[];
  requiredNotPassed: PendingCheckResolutionCheck[];
  blockingNotPassed: PendingCheckResolutionCheck[];
  youngAdvisoryPending: PendingCheckResolutionCheck[];
  staleAdvisoryPending: PendingCheckResolutionCheck[];
}) {
  if (failedChecks.length) {
    return {
      status: "blocked_by_failed_check" as const,
      reviewReady: false,
      nextSafeAction: "fix_failed_check",
      evidence: failedChecks.map((check) => `${check.name} failed`)
    };
  }

  if (blockingNotPassed.length) {
    return {
      status: "blocked_by_required_pending" as const,
      reviewReady: false,
      nextSafeAction: "resolve_blocking_check",
      evidence: blockingNotPassed.map((check) => `${check.name} is ${check.state}`)
    };
  }

  if (requiredNotPassed.length || missingChecks.some((check) => check.category === "required")) {
    return {
      status: "blocked_by_required_pending" as const,
      reviewReady: false,
      nextSafeAction: "wait_for_required_checks",
      evidence: requiredNotPassed.map((check) => `${check.name} is ${check.state}`)
    };
  }

  if (youngAdvisoryPending.length) {
    return {
      status: "waiting_for_timeout" as const,
      reviewReady: false,
      nextSafeAction: "wait_for_external_pending_timeout",
      evidence: youngAdvisoryPending.map((check) => `${check.name} has been pending for ${check.ageMinutes || 0} minutes`)
    };
  }

  if (staleAdvisoryPending.length) {
    return {
      status: "review_ready_with_advisory_pending" as const,
      reviewReady: true,
      nextSafeAction: "owner_review_with_advisory_pending_check",
      evidence: staleAdvisoryPending.map((check) => `${check.name} remains pending after ${check.ageMinutes || 0} minutes`)
    };
  }

  return {
    status: "review_ready" as const,
    reviewReady: true,
    nextSafeAction: "owner_review",
    evidence: ["All required checks passed and no stale external pending status blocks owner review."]
  };
}

function buildOwnerSummary(
  status: PendingCheckResolutionStatus,
  context: {
    timeoutMinutes: number;
    failedChecks: PendingCheckResolutionCheck[];
    requiredNotPassed: PendingCheckResolutionCheck[];
    blockingNotPassed: PendingCheckResolutionCheck[];
    youngAdvisoryPending: PendingCheckResolutionCheck[];
    staleAdvisoryPending: PendingCheckResolutionCheck[];
  }
) {
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

  if (status === "review_ready") {
    return "Review-ready: required checks passed and no failed or unresolved blocking checks were found.";
  }

  return "Failed honestly: AppEngine could not determine pending check resolution.";
}

function normalizeCheck(check: PendingCheckResolutionCheck, now: Date): PendingCheckResolutionCheck {
  return {
    ...check,
    ageMinutes: check.ageMinutes ?? ageMinutes(check.startedAt || null, now)
  };
}

function normalizeTimeout(value: number | undefined) {
  const fromEnv = Number(process.env.APPENGINE_PENDING_CHECK_TIMEOUT_MINUTES || "");
  const timeout = Number.isFinite(value) && value && value > 0 ? value : fromEnv > 0 ? fromEnv : DEFAULT_TIMEOUT_MINUTES;

  return Math.round(timeout);
}

function ageMinutes(startedAt: string | null, now: Date) {
  if (!startedAt) return 0;
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return 0;

  return Math.max(0, Math.round((now.getTime() - started) / 60000));
}

function defaultGuardrails(): PendingCheckResolutionGuardrails {
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
