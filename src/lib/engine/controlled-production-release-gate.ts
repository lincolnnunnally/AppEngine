import { loadAuditTrailOwnerVisibilityReport } from "./audit-trail-owner-visibility";
import { createPersistenceActivationReadiness } from "./persistence-activation-readiness";
import { createProductionLaunchBlockerReport } from "./production-launch-blocker-report";
import { createRuntimeMonitoringLiteReport } from "./runtime-monitoring-lite";

export type ControlledProductionReleaseGateStatus = "approved_for_first_controlled_use" | "blocked_pending_evidence";

export type ControlledProductionReleaseGateInput = {
  durableSchemaMigrationDryRunPassed?: boolean;
  productionAuthOwnerConfirmed?: boolean;
  monitoringReviewed?: boolean;
  auditTrailReviewed?: boolean;
  rollbackNotesReviewed?: boolean;
  launchBlockersAcceptedForControlledUse?: boolean;
  ownerApprovalNotes?: string;
};

export type ControlledProductionReleaseGate = {
  kind: "controlled_production_release_gate";
  schemaVersion: 1;
  generatedAt: string;
  status: ControlledProductionReleaseGateStatus;
  ownerReadableSummary: string;
  requiredEvidence: Array<{
    id: string;
    label: string;
    sourceArtifactKind: string;
    status: "passed" | "blocked";
    evidence: string;
  }>;
  blockedReasons: string[];
  nextSafeAction: string;
  productionAction: "blocked";
  guardrails: {
    releaseGateOnly: true;
    noProductionDeploy: true;
    noPaidResources: true;
    noLiveMigrations: true;
    noSecretsOrEnvChanges: true;
    repositoryVisibilityUnchanged: true;
    noCodexAutoExecution: true;
    noGitHubIssueCreation: true;
    noLabelChanges: true;
    noGeneratedAppAutoMerge: true;
  };
};

export async function createControlledProductionReleaseGate(
  input: ControlledProductionReleaseGateInput = {},
  now = new Date()
): Promise<ControlledProductionReleaseGate> {
  const [persistence, monitoring, auditTrail, launchBlockers] = await Promise.all([
    Promise.resolve(createPersistenceActivationReadiness(now)),
    createRuntimeMonitoringLiteReport(now),
    loadAuditTrailOwnerVisibilityReport(12, now),
    createProductionLaunchBlockerReport(now)
  ]);

  const requiredEvidence = [
    evidenceItem(
      "durable_state_readiness",
      "Durable state readiness reviewed",
      persistence.kind,
      persistence.status === "ready_for_owner_review" || Boolean(input.durableSchemaMigrationDryRunPassed),
      input.durableSchemaMigrationDryRunPassed
        ? "Owner-reviewed durable schema migration dry-run is recorded."
        : "Durable persistence is still blocked pending schema, migration dry-run, privacy review, or owner approval."
    ),
    evidenceItem(
      "auth_owner_confirmation",
      "Production auth owner confirmation recorded",
      "production_auth_owner_confirmation",
      Boolean(input.productionAuthOwnerConfirmed),
      input.productionAuthOwnerConfirmed
        ? "Owner confirmed production auth configuration."
        : "Production auth owner confirmation is missing."
    ),
    evidenceItem(
      "monitoring_reviewed",
      "Runtime monitoring reviewed",
      monitoring.kind,
      Boolean(input.monitoringReviewed),
      input.monitoringReviewed
        ? `Owner reviewed runtime monitoring status: ${monitoring.status}.`
        : `Runtime monitoring is ${monitoring.status}; owner review is required before controlled production use.`
    ),
    evidenceItem(
      "audit_trail_reviewed",
      "Audit trail reviewed",
      auditTrail.kind,
      Boolean(input.auditTrailReviewed),
      input.auditTrailReviewed
        ? `Owner reviewed ${auditTrail.events.length} visible audit event(s).`
        : "Audit trail owner review is required before controlled production use."
    ),
    evidenceItem(
      "rollback_notes_reviewed",
      "Rollback notes reviewed",
      "durable_schema_migration_dry_run",
      Boolean(input.rollbackNotesReviewed),
      input.rollbackNotesReviewed ? "Rollback notes were owner-reviewed." : "Rollback notes are missing or not owner-reviewed."
    ),
    evidenceItem(
      "launch_blocker_status_accepted",
      "Launch blocker status accepted for controlled use",
      launchBlockers.kind,
      Boolean(input.launchBlockersAcceptedForControlledUse) && launchBlockers.criticalBlockers.length === 0,
      launchBlockers.criticalBlockers.length
        ? `Critical blockers remain: ${launchBlockers.criticalBlockers.map((blocker) => blocker.id).join(", ")}`
        : "No critical launch blockers remain in the latest report."
    ),
    evidenceItem(
      "owner_approval_notes_present",
      "Owner approval notes present",
      "owner_approval",
      Boolean(input.ownerApprovalNotes?.trim()),
      input.ownerApprovalNotes?.trim() || "Owner approval notes are required before controlled production use."
    )
  ];
  const blockedReasons = requiredEvidence.filter((item) => item.status === "blocked").map((item) => `${item.id}: ${item.evidence}`);

  return {
    kind: "controlled_production_release_gate",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    status: blockedReasons.length ? "blocked_pending_evidence" : "approved_for_first_controlled_use",
    ownerReadableSummary: blockedReasons.length
      ? "Controlled production release remains blocked. Missing evidence must be resolved before AppEngine serves controlled real use."
      : "Controlled production release evidence is complete for first controlled use. Production deployment still requires a separate explicit owner action.",
    requiredEvidence,
    blockedReasons,
    nextSafeAction: blockedReasons.length
      ? "Resolve the first blocked evidence item before requesting controlled production approval."
      : "Owner may approve a separate production deployment workflow with rollback notes visible.",
    productionAction: "blocked",
    guardrails: {
      releaseGateOnly: true,
      noProductionDeploy: true,
      noPaidResources: true,
      noLiveMigrations: true,
      noSecretsOrEnvChanges: true,
      repositoryVisibilityUnchanged: true,
      noCodexAutoExecution: true,
      noGitHubIssueCreation: true,
      noLabelChanges: true,
      noGeneratedAppAutoMerge: true
    }
  };
}

function evidenceItem(
  id: string,
  label: string,
  sourceArtifactKind: string,
  passed: boolean,
  evidence: string
): ControlledProductionReleaseGate["requiredEvidence"][number] {
  return {
    id,
    label,
    sourceArtifactKind,
    status: passed ? "passed" : "blocked",
    evidence
  };
}
