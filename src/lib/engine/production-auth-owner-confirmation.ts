import { createProductionAuthReadinessReport } from "./production-auth-readiness";

export type ProductionAuthOwnerConfirmationStatus = "confirmed_for_controlled_use" | "blocked_pending_owner_confirmation";

export type ProductionAuthOwnerConfirmationInput = {
  confirmedAuthSecretManagedByOwner?: boolean;
  confirmedOwnerEmailManagedByOwner?: boolean;
  confirmedAuthProvider?: "github" | "google" | "other";
  confirmedProtectedRoutesReviewed?: boolean;
  confirmedAdminApisReviewed?: boolean;
  confirmedDevBypassDisabledInProduction?: boolean;
  ownerApprovalNotes?: string;
};

export type ProductionAuthOwnerConfirmation = {
  kind: "production_auth_owner_confirmation";
  schemaVersion: 1;
  generatedAt: string;
  status: ProductionAuthOwnerConfirmationStatus;
  ownerReadableSummary: string;
  requiredEnvVarNames: string[];
  protectedRoutes: string[];
  adminOnlyApis: string[];
  confirmationChecklist: Array<{
    id: string;
    label: string;
    status: "confirmed" | "blocked";
    evidence: string;
  }>;
  missingOwnerConfirmations: string[];
  guardrails: {
    noProductionDeploy: true;
    noSecretsOrEnvChanges: true;
    noSecretValuesReadOrExposed: true;
    noRepositoryVisibilityChanges: true;
    noCodexAutoExecution: true;
    noGitHubIssueCreation: true;
    noLabelChanges: true;
  };
};

export function createProductionAuthOwnerConfirmation(
  input: ProductionAuthOwnerConfirmationInput = {},
  now = new Date()
): ProductionAuthOwnerConfirmation {
  const readiness = createProductionAuthReadinessReport({ NODE_ENV: "production" }, now);
  const confirmationChecklist = [
    checklistItem(
      "auth_secret_owner_managed",
      "AUTH_SECRET is owner-managed in production",
      Boolean(input.confirmedAuthSecretManagedByOwner),
      "The owner must confirm AUTH_SECRET exists in the deployment environment. This report never reads or exposes the value."
    ),
    checklistItem(
      "owner_email_owner_managed",
      "APP_ENGINE_OWNER_EMAIL is owner-managed in production",
      Boolean(input.confirmedOwnerEmailManagedByOwner),
      "The owner must confirm the production owner/admin identity is configured."
    ),
    checklistItem(
      "auth_provider_selected",
      "Auth provider selected",
      Boolean(input.confirmedAuthProvider),
      input.confirmedAuthProvider
        ? `Owner selected ${input.confirmedAuthProvider} as the production auth provider path.`
        : "Owner must select GitHub, Google, or another approved provider path before production use."
    ),
    checklistItem(
      "protected_routes_reviewed",
      "Protected routes reviewed",
      Boolean(input.confirmedProtectedRoutesReviewed),
      `Protected owner/admin routes: ${readiness.protectedRoutes.join(", ")}`
    ),
    checklistItem(
      "admin_apis_reviewed",
      "Admin-only APIs reviewed",
      Boolean(input.confirmedAdminApisReviewed),
      `Admin-only APIs: ${readiness.adminOnlyApis.join(", ")}`
    ),
    checklistItem(
      "production_bypass_disabled",
      "Development/setup bypass disabled in production",
      Boolean(input.confirmedDevBypassDisabledInProduction),
      "APP_ENGINE_DEV_ADMIN_BYPASS and APP_ENGINE_SETUP_ADMIN_BYPASS must not grant production access."
    ),
    checklistItem(
      "owner_approval_notes_present",
      "Owner approval notes present",
      Boolean(input.ownerApprovalNotes?.trim()),
      input.ownerApprovalNotes?.trim() || "Owner notes are required before controlled production use."
    )
  ];
  const missingOwnerConfirmations = confirmationChecklist.filter((item) => item.status === "blocked").map((item) => item.id);

  return {
    kind: "production_auth_owner_confirmation",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    status: missingOwnerConfirmations.length ? "blocked_pending_owner_confirmation" : "confirmed_for_controlled_use",
    ownerReadableSummary: missingOwnerConfirmations.length
      ? "Production auth is still blocked because owner confirmations are missing. Do not use controlled production until each confirmation is recorded."
      : "Production auth is owner-confirmed for controlled use. Production release still requires the release gate.",
    requiredEnvVarNames: ["AUTH_SECRET", "APP_ENGINE_OWNER_EMAIL", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"],
    protectedRoutes: readiness.protectedRoutes,
    adminOnlyApis: readiness.adminOnlyApis,
    confirmationChecklist,
    missingOwnerConfirmations,
    guardrails: {
      noProductionDeploy: true,
      noSecretsOrEnvChanges: true,
      noSecretValuesReadOrExposed: true,
      noRepositoryVisibilityChanges: true,
      noCodexAutoExecution: true,
      noGitHubIssueCreation: true,
      noLabelChanges: true
    }
  };
}

function checklistItem(id: string, label: string, confirmed: boolean, evidence: string): ProductionAuthOwnerConfirmation["confirmationChecklist"][number] {
  return {
    id,
    label,
    status: confirmed ? "confirmed" : "blocked",
    evidence
  };
}
