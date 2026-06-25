import { createControlledProductionReleaseGate, type ControlledProductionReleaseGateInput } from "./controlled-production-release-gate";
import { createProductionAuthReadinessReport } from "./production-auth-readiness";

export type WeSucceedSoftLaunchReadinessStatus = "ready_for_controlled_deploy" | "blocked_pending_evidence";

export type WeSucceedSoftLaunchReadinessInput = {
  productionOrigin?: string;
  healthCheckObservedOk?: boolean;
  problemDoorEndToEndVerified?: boolean;
  buildDoorEndToEndVerified?: boolean;
  ownerLoginVerified?: boolean;
  providerSpendGuardrailVerified?: boolean;
  rollbackNotesReviewed?: boolean;
  ownerApprovalNotes?: string;
  releaseGateEvidence?: ControlledProductionReleaseGateInput;
  env?: Record<string, string | undefined>;
};

export type WeSucceedSoftLaunchReadinessCheck = {
  id: string;
  label: string;
  status: "passed" | "blocked";
  evidence: string;
};

export type WeSucceedSoftLaunchReadiness = {
  kind: "we_succeed_soft_launch_readiness";
  schemaVersion: 1;
  generatedAt: string;
  status: WeSucceedSoftLaunchReadinessStatus;
  target: {
    productionOrigin: "https://we-succeed.org";
    healthPath: "/api/health";
    problemDoorPath: "/problem-intake-lite";
    buildDoorPath: "/opportunity-intake";
    ownerControlPath: "/owner-control-center";
  };
  checks: WeSucceedSoftLaunchReadinessCheck[];
  blockedReasons: string[];
  sourceArtifacts: {
    productionAuthReadiness: "production_auth_readiness";
    controlledProductionReleaseGate: "controlled_production_release_gate";
  };
  ownerReadableSummary: string;
  nextSafeAction: string;
  deploymentAction: "blocked_until_all_checks_pass" | "ready_for_controlled_deploy";
  guardrails: {
    step4Only: true;
    noNewPaidResources: true;
    noEcosystemAppWork: true;
    noChurchConnectWork: true;
    noDatabaseMigrations: true;
    noSecretsInOutput: true;
    existingProviderProjectOnly: true;
    providerSpendMustStayWithinLimits: true;
    healthCheckPublicReadOnly: true;
    ownerLoginRequiredForIntake: true;
  };
};

export async function createWeSucceedSoftLaunchReadiness(
  input: WeSucceedSoftLaunchReadinessInput = {},
  now = new Date()
): Promise<WeSucceedSoftLaunchReadiness> {
  const productionOrigin = normalizeProductionOrigin(input.productionOrigin);
  const [authReadiness, releaseGate] = await Promise.all([
    Promise.resolve(createProductionAuthReadinessReport({ ...(input.env || {}), NODE_ENV: "production" }, now)),
    createControlledProductionReleaseGate(input.releaseGateEvidence || {}, now)
  ]);
  const checks = [
    check(
      "target_url_is_locked",
      "Target URL is we-succeed.org",
      productionOrigin === "https://we-succeed.org",
      `productionOrigin=${productionOrigin}`
    ),
    check(
      "public_health_path_defined",
      "Public health check path is defined",
      true,
      "Source declares public read-only health path /api/health returning status ok."
    ),
    check(
      "two_door_routes_defined",
      "Both door routes are defined",
      true,
      "Problem door routes to /problem-intake-lite and build door routes to /opportunity-intake."
    ),
    check(
      "owner_auth_source_ready",
      "Owner auth source readiness is not blocked",
      authReadiness.status !== "blocked_in_production",
      `production_auth_readiness=${authReadiness.status}`
    ),
    check(
      "owner_login_verified",
      "Owner login verified on the target",
      Boolean(input.ownerLoginVerified),
      input.ownerLoginVerified ? "Owner login was verified on the target URL." : "Owner login has not been verified on the target URL."
    ),
    check(
      "health_check_live_ok",
      "Live /api/health returns ok",
      Boolean(input.healthCheckObservedOk),
      input.healthCheckObservedOk ? "Live health check returned ok." : "Live health check evidence is missing."
    ),
    check(
      "problem_door_end_to_end",
      "Problem door reaches intake end to end",
      Boolean(input.problemDoorEndToEndVerified),
      input.problemDoorEndToEndVerified
        ? "Problem door reached the problem intake with the rail intact."
        : "Problem door live end-to-end evidence is missing."
    ),
    check(
      "build_door_end_to_end",
      "Build door reaches intake end to end",
      Boolean(input.buildDoorEndToEndVerified),
      input.buildDoorEndToEndVerified
        ? "Build door reached the opportunity intake with the rail intact."
        : "Build door live end-to-end evidence is missing."
    ),
    check(
      "provider_spend_guardrail_verified",
      "Provider and spend guardrail verified",
      Boolean(input.providerSpendGuardrailVerified),
      input.providerSpendGuardrailVerified
        ? "Provider/spend controls were verified within configured limits."
        : "Provider/spend guardrail evidence is missing for the real deploy path."
    ),
    check(
      "controlled_release_gate_clear",
      "Controlled release gate evidence is clear",
      releaseGate.status === "approved_for_first_controlled_use",
      `controlled_production_release_gate=${releaseGate.status}`
    ),
    check(
      "rollback_notes_reviewed",
      "Rollback notes reviewed",
      Boolean(input.rollbackNotesReviewed),
      input.rollbackNotesReviewed ? "Rollback notes were reviewed." : "Rollback notes have not been reviewed."
    ),
    check(
      "owner_notes_present",
      "Owner approval notes present",
      Boolean(input.ownerApprovalNotes?.trim()),
      input.ownerApprovalNotes?.trim() || "Owner approval notes are missing."
    )
  ];
  const blockedReasons = checks.filter((item) => item.status === "blocked").map((item) => `${item.id}: ${item.evidence}`);
  const status: WeSucceedSoftLaunchReadinessStatus = blockedReasons.length ? "blocked_pending_evidence" : "ready_for_controlled_deploy";

  return {
    kind: "we_succeed_soft_launch_readiness",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    status,
    target: {
      productionOrigin: "https://we-succeed.org",
      healthPath: "/api/health",
      problemDoorPath: "/problem-intake-lite",
      buildDoorPath: "/opportunity-intake",
      ownerControlPath: "/owner-control-center"
    },
    checks,
    blockedReasons,
    sourceArtifacts: {
      productionAuthReadiness: authReadiness.kind,
      controlledProductionReleaseGate: releaseGate.kind
    },
    ownerReadableSummary: blockedReasons.length
      ? "Step 4 is not ready for controlled deploy yet. Missing live evidence or guardrail proof must be resolved first."
      : "Step 4 evidence is complete for a controlled deploy attempt to we-succeed.org within configured limits.",
    nextSafeAction: blockedReasons.length
      ? `Resolve Step 4 blocker: ${blockedReasons[0]}`
      : "Run the controlled deploy path, then verify we-succeed.org, both doors, owner login, and /api/health.",
    deploymentAction: blockedReasons.length ? "blocked_until_all_checks_pass" : "ready_for_controlled_deploy",
    guardrails: {
      step4Only: true,
      noNewPaidResources: true,
      noEcosystemAppWork: true,
      noChurchConnectWork: true,
      noDatabaseMigrations: true,
      noSecretsInOutput: true,
      existingProviderProjectOnly: true,
      providerSpendMustStayWithinLimits: true,
      healthCheckPublicReadOnly: true,
      ownerLoginRequiredForIntake: true
    }
  };
}

function normalizeProductionOrigin(value: string | undefined): string {
  return (value || "https://we-succeed.org").replace(/\/+$/, "");
}

function check(id: string, label: string, passed: boolean, evidence: string): WeSucceedSoftLaunchReadinessCheck {
  return {
    id,
    label,
    status: passed ? "passed" : "blocked",
    evidence
  };
}
