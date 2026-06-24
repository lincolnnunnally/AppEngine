export type ProductionAuthReadinessStatus = "ready_for_preview_review" | "blocked_in_production";

export type ProductionAuthReadinessCheck = {
  id: string;
  label: string;
  status: "passed" | "blocked" | "needs_owner_confirmation";
  evidence: string;
  productionImpact: string;
};

export type ProductionAuthReadinessReport = {
  kind: "production_auth_readiness";
  schemaVersion: 1;
  generatedAt: string;
  status: ProductionAuthReadinessStatus;
  ownerReadableSummary: string;
  protectedRoutes: string[];
  ownerOnlyApis: string[];
  adminOnlyApis: string[];
  checks: ProductionAuthReadinessCheck[];
  missingEnvAssumptions: string[];
  devBypassRisks: string[];
  guardrails: {
    noProductionDeploy: true;
    noSecretsOrEnvChanges: true;
    noRepositoryVisibilityChanges: true;
    noCodexAutoExecution: true;
    noGitHubIssueCreation: true;
    noLabelChanges: true;
  };
};

type RuntimeEnv = Record<string, string | undefined>;

const protectedRoutes = ["/", "/opportunity-intake", "/problem-intake-lite", "/owner-control-center", "/admin"];
const ownerOnlyApis = ["/api/opportunity-intake", "/api/problem-intake-lite"];
const adminOnlyApis = [
  "/api/engine/health",
  "/api/engine/setup-profile",
  "/api/engine/audit-trail",
  "/api/engine/handoff-relay",
  "/api/engine/project-memory",
  "/api/engine/orchestrator-run",
  "/api/engine/real-project-trial"
];

const requiredProductionEnv = ["AUTH_SECRET", "APP_ENGINE_OWNER_EMAIL"] as const;

export function createProductionAuthReadinessReport(env: RuntimeEnv = process.env, now = new Date()): ProductionAuthReadinessReport {
  const missingEnvAssumptions = requiredProductionEnv.filter((key) => !env[key]?.trim());
  const checks = buildChecks(env, missingEnvAssumptions);
  const blocked = checks.some((check) => check.status === "blocked");

  return {
    kind: "production_auth_readiness",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    status: blocked ? "blocked_in_production" : "ready_for_preview_review",
    ownerReadableSummary: blocked
      ? "Production auth is not complete yet. Keep production blocked until required auth env, admin access, and bypass settings are owner-confirmed."
      : "Production auth readiness checks are clear for preview review. Production still requires owner release approval.",
    protectedRoutes,
    ownerOnlyApis,
    adminOnlyApis,
    checks,
    missingEnvAssumptions,
    devBypassRisks: [
      "APP_ENGINE_DEV_ADMIN_BYPASS must not be enabled in production.",
      "APP_ENGINE_SETUP_ADMIN_BYPASS must not be enabled in production.",
      "Local development AUTH_SECRET fallback is only allowed when NODE_ENV is not production."
    ],
    guardrails: {
      noProductionDeploy: true,
      noSecretsOrEnvChanges: true,
      noRepositoryVisibilityChanges: true,
      noCodexAutoExecution: true,
      noGitHubIssueCreation: true,
      noLabelChanges: true
    }
  };
}

function buildChecks(env: RuntimeEnv, missingEnvAssumptions: string[]): ProductionAuthReadinessCheck[] {
  const hasOAuthProvider = Boolean(
    (env.AUTH_GITHUB_ID?.trim() && env.AUTH_GITHUB_SECRET?.trim()) || (env.AUTH_GOOGLE_ID?.trim() && env.AUTH_GOOGLE_SECRET?.trim())
  );
  const productionDevBypassEnabled = env.NODE_ENV === "production" && env.APP_ENGINE_DEV_ADMIN_BYPASS !== "false";
  const productionSetupBypassEnabled = env.NODE_ENV === "production" && env.APP_ENGINE_SETUP_ADMIN_BYPASS === "true";

  return [
    {
      id: "auth_secret_required",
      label: "AUTH_SECRET production guard",
      status: missingEnvAssumptions.includes("AUTH_SECRET") ? "blocked" : "passed",
      evidence: "getAuthSecret throws when NODE_ENV is production and AUTH_SECRET/NEXTAUTH_SECRET is missing.",
      productionImpact: "Production must not start with the local development fallback secret."
    },
    {
      id: "owner_email_required",
      label: "Owner/admin identity",
      status: missingEnvAssumptions.includes("APP_ENGINE_OWNER_EMAIL") ? "blocked" : "passed",
      evidence: "APP_ENGINE_OWNER_EMAIL remains the owner override while database roles are preserved.",
      productionImpact: "At least one owner identity must be configured before production use."
    },
    {
      id: "oauth_provider_required",
      label: "Auth provider configured",
      status: hasOAuthProvider ? "passed" : "needs_owner_confirmation",
      evidence: "GitHub or Google OAuth provider env names are supported.",
      productionImpact: "Production sign-in needs an owner-approved provider before public use."
    },
    {
      id: "admin_routes_gated",
      label: "Owner/admin routes and APIs are gated",
      status: "passed",
      evidence:
        "Two-door entry, Opportunity intake, problem intake, intake APIs, Owner Control Center, health, setup-profile, handoff, memory, orchestrator, trial, and audit endpoints require owner/admin access checks.",
      productionImpact: "Owner/admin surfaces stay behind access checks during soft launch."
    },
    {
      id: "dev_bypass_not_production",
      label: "Dev/setup bypasses blocked in production",
      status: productionDevBypassEnabled || productionSetupBypassEnabled ? "blocked" : "passed",
      evidence: "Development and setup bypasses are intended for non-production owner setup only.",
      productionImpact: "Production must not rely on bypass-based admin access."
    }
  ];
}
