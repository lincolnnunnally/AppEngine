import { createControlledProductionReleaseGate } from "./controlled-production-release-gate";
import { createFinalProductionClosurePlan } from "./final-production-closure-plan";
import { createProductionLaunchBlockerReport } from "./production-launch-blocker-report";

export type ControlledUseReadinessStatus =
  | "ready_for_internal_controlled_use"
  | "blocked_for_public_use"
  | "blocked_for_autonomous_execution";

export type ControlledUseReadinessSummary = {
  kind: "controlled_use_readiness_summary";
  schemaVersion: 1;
  generatedAt: string;
  readinessStatuses: ControlledUseReadinessStatus[];
  ownerReadableSummary: string;
  broaderPurpose: string[];
  currentAppEngineCapability: string[];
  problemsAppEngineCanHelpSolve: string[];
  safeForControlledUse: string[];
  notYetSafe: string[];
  remainingBlockersBeforePublicCommunityCustomerUse: string[];
  requiredOwnerConfirmations: string[];
  nextOperationalSteps: string[];
  nextRecommendedOperationalAction: string;
  sourceArtifacts: {
    finalProductionClosurePlan: string;
    controlledProductionReleaseGate: string;
    productionLaunchBlockerReport: string;
  };
  guardrails: {
    summaryOnly: true;
    noProductionDeploy: true;
    noPaidResources: true;
    noLiveMigrations: true;
    noSecretsOrEnvChanges: true;
    repositoryVisibilityUnchanged: true;
    noCodexAutoExecution: true;
    noGitHubIssueCreation: true;
    noLabelChanges: true;
  };
};

export async function createControlledUseReadinessSummary(now = new Date()): Promise<ControlledUseReadinessSummary> {
  const [closurePlan, releaseGate, launchBlockers] = await Promise.all([
    createFinalProductionClosurePlan(now),
    createControlledProductionReleaseGate({}, now),
    createProductionLaunchBlockerReport(now)
  ]);

  return {
    kind: "controlled_use_readiness_summary",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    readinessStatuses: ["ready_for_internal_controlled_use", "blocked_for_public_use", "blocked_for_autonomous_execution"],
    ownerReadableSummary:
      "AppEngine is ready for internal controlled use as an owner-reviewed planning, memory, orchestration, and review tool. It is still blocked for public/community/customer use and blocked for autonomous execution until durable state, owner auth confirmation, release evidence, monitoring/audit durability, and explicit owner approvals are complete.",
    broaderPurpose: [
      "AppEngine is not the product.",
      "Transformation and problem-solving are the product.",
      "AppEngine is a tool that helps move people from pain or problem to clarity, purpose, and useful solutions.",
      "The purpose is to help Lincoln spend less time relaying work between systems and more time helping people directly."
    ],
    currentAppEngineCapability: [
      "Capture and route problems or visions into structured planning paths.",
      "Maintain source-of-truth, project memory, handoff, action queue, and owner status artifacts.",
      "Generate bounded planning, review, and release-gate artifacts.",
      "Prepare owner-reviewed next actions without automatic execution.",
      "Support Spark of Hope as a controlled real-app trial path."
    ],
    problemsAppEngineCanHelpSolve: [
      "Clarify a problem before assuming the answer is an app.",
      "Convert a vision into a packet, phase path, or non-app solution plan.",
      "Keep cross-agent work aligned to shared source of truth.",
      "Reduce Lincoln's manual copy/paste relay burden.",
      "Expose blockers before preview, release, or production claims are made."
    ],
    safeForControlledUse: [
      "Internal owner-controlled planning and review.",
      "Problem intake and portfolio routing with local/mock storage.",
      "Manual orchestrator runs and prepared handoffs.",
      "Dry-run release and persistence readiness reports.",
      "Owner-visible status summaries that do not deploy or mutate production."
    ],
    notYetSafe: [
      "Public/community/customer use with real sensitive data.",
      "Autonomous Codex execution or label-triggered work without owner approval.",
      "Production deployment or production promotion.",
      "Live migrations or production database writes.",
      "Paid resource creation or secrets/env changes."
    ],
    remainingBlockersBeforePublicCommunityCustomerUse: [
      ...launchBlockers.criticalBlockers.map((blocker) => blocker.label),
      ...launchBlockers.launchBlockers.map((blocker) => blocker.label)
    ],
    requiredOwnerConfirmations: [
      "Confirm production auth owner/admin configuration and provider path.",
      "Approve durable schema and migration dry-run before any live migration.",
      "Review monitoring and audit trail evidence.",
      "Review rollback notes and controlled release gate evidence.",
      "Explicitly approve any future production deployment workflow."
    ],
    nextOperationalSteps: [
      "Use AppEngine internally for owner-reviewed planning and controlled Spark trial preparation.",
      "Complete owner confirmations for auth, durable state, monitoring, audit, and rollback evidence.",
      "Keep public/community/customer use blocked until the controlled release gate has complete evidence.",
      "Keep autonomous execution blocked until result ingestion, durable memory, and owner-approved dispatch safeguards exist."
    ],
    nextRecommendedOperationalAction: chooseNextOperationalAction(releaseGate.blockedReasons, closurePlan.recommendedNextThreePrs.map((pr) => pr.title)),
    sourceArtifacts: {
      finalProductionClosurePlan: closurePlan.kind,
      controlledProductionReleaseGate: releaseGate.kind,
      productionLaunchBlockerReport: launchBlockers.kind
    },
    guardrails: {
      summaryOnly: true,
      noProductionDeploy: true,
      noPaidResources: true,
      noLiveMigrations: true,
      noSecretsOrEnvChanges: true,
      repositoryVisibilityUnchanged: true,
      noCodexAutoExecution: true,
      noGitHubIssueCreation: true,
      noLabelChanges: true
    }
  };
}

function chooseNextOperationalAction(blockedReasons: string[], recommendedPrs: string[]) {
  if (blockedReasons.length) {
    return `Resolve controlled-use release evidence first: ${blockedReasons[0]}`;
  }

  return `Proceed with owner-reviewed operational hardening: ${recommendedPrs[0] || "durable state and auth confirmation"}.`;
}
