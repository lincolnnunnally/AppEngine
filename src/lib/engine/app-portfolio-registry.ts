export type AppPortfolioEntryType =
  | "appengine_core"
  | "opportunity_front_door"
  | "ecosystem_core"
  | "app_slice"
  | "future_ecosystem_service";

export type AppPortfolioDeploymentState =
  | "build_preview"
  | "review_ready"
  | "review_blocked"
  | "approved_for_release"
  | "production_live"
  | "production_blocked"
  | "failed_needs_fix"
  | "unknown";

export type AppPortfolioBuildState =
  | "planned"
  | "ready_for_build"
  | "draft_pr_open"
  | "preview_pending"
  | "preview_verified"
  | "review_blocked"
  | "release_blocked"
  | "owner_approval_required"
  | "ready_for_vnext"
  | "failed_needs_fix"
  | "unknown";

export type AppPortfolioNextSafeAction =
  | "create_planning_issue"
  | "create_implementation_issue"
  | "create_draft_pr"
  | "wait_for_preview"
  | "verify_preview"
  | "verify_review_url"
  | "run_review_gates"
  | "create_fix_issue"
  | "await_owner_review"
  | "stop_for_owner_approval"
  | "pause_for_budget"
  | "request_budget_approval"
  | "prepare_release_gate"
  | "create_vnext_packet"
  | "continue_internal_trial"
  | "unknown";

export type AppPortfolioLink = {
  label: string;
  url: string;
};

export type AppPortfolioIssueLink = {
  number: number;
  title: string;
  url: string;
};

export type AppPortfolioPullRequestLink = AppPortfolioIssueLink & {
  state: "open" | "merged" | "draft" | "unknown";
  branch?: string;
};

export type AppPortfolioEntry = {
  name: string;
  slug: string;
  type: AppPortfolioEntryType;
  status: string;
  reviewUrl: string;
  productionUrl: string;
  currentVersion: string;
  deploymentState: AppPortfolioDeploymentState;
  buildState: AppPortfolioBuildState;
  nextSafeAction: AppPortfolioNextSafeAction;
  sourceOfTruthFiles: string[];
  linkedIssues: AppPortfolioIssueLink[];
  linkedPRs: AppPortfolioPullRequestLink[];
  blockers: string[];
  evidenceLinks: AppPortfolioLink[];
  lastUpdated: string;
};

export type AppPortfolioRegistry = {
  kind: "app_portfolio_registry";
  schemaVersion: 1;
  generatedAt: string;
  owner: "Lincoln";
  summary: {
    totalApps: number;
    reviewReadyApps: number;
    productionLiveApps: number;
    blockedApps: number;
    unknownReviewUrls: number;
    nextSafeActions: Record<string, number>;
  };
  apps: AppPortfolioEntry[];
  guardrails: {
    noSecretsInRegistry: true;
    noPrivateUserData: true;
    productionApprovalRequired: true;
    protectedPreviewBypassLinksBlocked: true;
    appBoundariesRequired: true;
  };
  ownerReadableSummary: string;
};

const generatedAt = "2026-06-17T00:00:00.000Z";

export async function loadOwnerPortfolioRegistry(): Promise<AppPortfolioRegistry> {
  return buildAppPortfolioRegistry(getSeedPortfolioEntries());
}

export function buildAppPortfolioRegistry(apps: AppPortfolioEntry[]): AppPortfolioRegistry {
  const nextSafeActions = apps.reduce<Record<string, number>>((counts, app) => {
    counts[app.nextSafeAction] = (counts[app.nextSafeAction] || 0) + 1;
    return counts;
  }, {});
  const blockedApps = apps.filter(
    (app) =>
      app.blockers.length > 0 ||
      app.deploymentState === "production_blocked" ||
      app.deploymentState === "review_blocked" ||
      app.buildState === "release_blocked" ||
      app.buildState === "review_blocked"
  ).length;
  const unknownReviewUrls = apps.filter((app) => isUnknownUrl(app.reviewUrl)).length;

  return {
    kind: "app_portfolio_registry",
    schemaVersion: 1,
    generatedAt,
    owner: "Lincoln",
    summary: {
      totalApps: apps.length,
      reviewReadyApps: apps.filter((app) => app.deploymentState === "review_ready").length,
      productionLiveApps: apps.filter((app) => app.deploymentState === "production_live").length,
      blockedApps,
      unknownReviewUrls,
      nextSafeActions
    },
    apps,
    guardrails: {
      noSecretsInRegistry: true,
      noPrivateUserData: true,
      productionApprovalRequired: true,
      protectedPreviewBypassLinksBlocked: true,
      appBoundariesRequired: true
    },
    ownerReadableSummary:
      "Owner Portfolio Dashboard indexes AppEngine-created apps, ecosystem slices, review paths, production status, and next safe actions from the app_portfolio_registry standard."
  };
}

function getSeedPortfolioEntries(): AppPortfolioEntry[] {
  return [
    {
      name: "AppEngine Core",
      slug: "appengine-core",
      type: "appengine_core",
      status: "internal controlled use",
      reviewUrl: "/owner-control-center",
      productionUrl: "production blocked until owner-approved release gate",
      currentVersion: "controlled-use",
      deploymentState: "review_ready",
      buildState: "ready_for_vnext",
      nextSafeAction: "continue_internal_trial",
      sourceOfTruthFiles: [
        "source-of-truth/app-portfolio-registry.md",
        "source-of-truth/controlled-production-release-gate.md",
        "source-of-truth/internal-controlled-use-runbook.md"
      ],
      linkedIssues: [],
      linkedPRs: [
        {
          number: 130,
          title: "Internal controlled state adapter",
          url: "https://github.com/lincolnnunnally/AppEngine/pull/130",
          state: "merged",
          branch: "main"
        }
      ],
      blockers: ["Production launch still requires explicit owner approval and durable provider activation."],
      evidenceLinks: [{ label: "Owner Control Center", url: "/owner-control-center" }],
      lastUpdated: generatedAt
    },
    {
      name: "Opportunity",
      slug: "opportunity",
      type: "opportunity_front_door",
      status: "guided intake and routing active",
      reviewUrl: "/opportunity-intake",
      productionUrl: "production blocked until owner-approved release gate",
      currentVersion: "foundation",
      deploymentState: "review_ready",
      buildState: "preview_verified",
      nextSafeAction: "await_owner_review",
      sourceOfTruthFiles: [
        "source-of-truth/opportunity-intake-foundation.md",
        "source-of-truth/opportunity-clarification-engine.md",
        "source-of-truth/opportunity-solution-path-router.md",
        "source-of-truth/opportunity-action-plan-draft.md",
        "source-of-truth/opportunity-appengine-candidate-bridge.md"
      ],
      linkedIssues: [],
      linkedPRs: [
        {
          number: 138,
          title: "Opportunity to AppEngine candidate bridge",
          url: "https://github.com/lincolnnunnally/AppEngine/pull/138",
          state: "merged",
          branch: "main"
        }
      ],
      blockers: ["No public production URL yet; remains inside AppEngine controlled-use flow."],
      evidenceLinks: [{ label: "Opportunity Intake", url: "/opportunity-intake" }],
      lastUpdated: generatedAt
    },
    {
      name: "Life Produces Life Core",
      slug: "life-core",
      type: "ecosystem_core",
      status: "foundation preview merged",
      reviewUrl: "/life-core",
      productionUrl: "production blocked until owner-approved release gate",
      currentVersion: "mvp-foundation",
      deploymentState: "review_ready",
      buildState: "preview_verified",
      nextSafeAction: "await_owner_review",
      sourceOfTruthFiles: [
        "source-of-truth/01-ecosystem-philosophy.md",
        "source-of-truth/03-life-produces-life.md",
        "source-of-truth/app-portfolio-registry.md"
      ],
      linkedIssues: [],
      linkedPRs: [
        {
          number: 145,
          title: "Life Produces Life Core MVP Foundation Slice",
          url: "https://github.com/lincolnnunnally/AppEngine/pull/145",
          state: "merged",
          branch: "codex/builder-27661620756-1"
        }
      ],
      blockers: ["Needs stable public review URL before owner should have to leave AppEngine to inspect it."],
      evidenceLinks: [{ label: "Life Core Preview", url: "/life-core" }],
      lastUpdated: generatedAt
    },
    {
      name: "Spark of Hope Slices",
      slug: "spark-of-hope-intake-lite",
      type: "app_slice",
      status: "safe preview slices available",
      reviewUrl: "/spark-of-hope-intake-lite",
      productionUrl: "production blocked until owner-approved release gate",
      currentVersion: "vNext preview slices",
      deploymentState: "review_ready",
      buildState: "ready_for_vnext",
      nextSafeAction: "run_review_gates",
      sourceOfTruthFiles: [
        "source-of-truth/app-portfolio-registry.md",
        "source-of-truth/super-admin-registry.md"
      ],
      linkedIssues: [
        {
          number: 63,
          title: "Spark of Hope Intake Lite vNext 1",
          url: "https://github.com/lincolnnunnally/AppEngine/issues/63"
        }
      ],
      linkedPRs: [
        {
          number: 74,
          title: "Spark of Hope Intake Lite vNext 1: Controlled Preview Persistence",
          url: "https://github.com/lincolnnunnally/AppEngine/pull/74",
          state: "merged",
          branch: "main"
        }
      ],
      blockers: ["Real persistence, public trial approval, and production launch remain blocked by review gates."],
      evidenceLinks: [{ label: "Spark Intake Lite", url: "/spark-of-hope-intake-lite" }],
      lastUpdated: generatedAt
    },
    {
      name: "Future Ecosystem Apps and Services",
      slug: "future-ecosystem-apps-services",
      type: "future_ecosystem_service",
      status: "planned placeholders",
      reviewUrl: "unknown",
      productionUrl: "not live",
      currentVersion: "not started",
      deploymentState: "unknown",
      buildState: "planned",
      nextSafeAction: "create_planning_issue",
      sourceOfTruthFiles: [
        "source-of-truth/app-purpose-rules.md",
        "source-of-truth/app-portfolio-registry.md",
        "source-of-truth/opportunity-intake-foundation.md"
      ],
      linkedIssues: [],
      linkedPRs: [],
      blockers: ["Each future app or service needs an approved intake, candidate review, packet, and owner-approved phase path."],
      evidenceLinks: [],
      lastUpdated: generatedAt
    }
  ];
}

function isUnknownUrl(value: string) {
  return !value || ["unknown", "not live"].includes(value.toLowerCase());
}
