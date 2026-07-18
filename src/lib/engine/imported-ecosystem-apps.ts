// Imported ecosystem app records — the seeded roster of Lincoln's existing apps,
// moved verbatim out of app-portfolio-registry.ts so lightweight public surfaces
// (the apps.unitedundergod.org showcase) can read the roster without pulling the
// full engine import graph (durable state adapters, intake stores, etc.).
// app-portfolio-registry.ts remains the sole consumer that turns these into
// portfolio entries; this file is data only. Facts trace to the 2026-06-27
// ecosystem portfolio audit (.app-engine/state/app_portfolio_registry/
// ecosystem-portfolio-registry.json + source-of-truth/ecosystem-deployment-queue.md),
// with live URLs refreshed 2026-07-02 for the apps already serving traffic.

import type {
  AppPortfolioBuildState,
  AppPortfolioDeploymentState,
  AppPortfolioNextSafeAction
} from "./app-portfolio-registry";

export type ImportedAppRecord = {
  name: string;
  slug: string;
  status: string;
  productionUrl: string;
  deploymentState: AppPortfolioDeploymentState;
  buildState: AppPortfolioBuildState;
  nextSafeAction: AppPortfolioNextSafeAction;
  blockers: string[];
};

export const IMPORTED_ECOSYSTEM_APPS: ImportedAppRecord[] = [
  {
    name: "ChurchConnect",
    slug: "churchconnect",
    status: "live — migration off Emergent finishing (compute on Vercel + Render; data move pending)",
    productionUrl: "https://www.churchconnect.cloud",
    deploymentState: "production_live",
    buildState: "ready_for_vnext",
    nextSafeAction: "create_vnext_packet",
    blockers: ["Data still on Emergent-managed Atlas; finish the gated migration before deep changes."]
  },
  {
    name: "Easy Peasy Website (EasyPeazy)",
    slug: "easy-peasy-website",
    status: "live — Codex building Spaceship domain search/buy/manage",
    productionUrl: "https://easypeazy.site",
    deploymentState: "production_live",
    buildState: "ready_for_vnext",
    nextSafeAction: "create_vnext_packet",
    blockers: ["Provider credentials and provisioning safety per Launch Pack before backend changes."]
  },
  {
    name: "Kindred Connections",
    slug: "kindred-connections",
    status: "mined as canonical Connection Engine source; app not relaunched",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: ["App-local Launch Pack missing; build not rerun in the audit pass."]
  },
  {
    name: "Best Life",
    slug: "best-life",
    status: "planned; growth-dashboard template identified (Kindred-derived)",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: []
  },
  {
    name: "Live On Mission",
    slug: "live-on-mission",
    status: "planned; connection + events templates identified",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: []
  },
  {
    name: "Kids Need Dads",
    slug: "kids-need-dads",
    status: "planned; mutual-aid + community templates identified",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: []
  },
  {
    name: "ChildFirst Solutions",
    slug: "childfirst-solutions",
    status: "source mined (case management + mediated communication); ready to build",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "ready_for_build",
    nextSafeAction: "create_implementation_issue",
    blockers: []
  },
  {
    name: "Sandlot (formerly SwapAround)",
    slug: "sandlot",
    status: "live — kids meetups, fidget/toy exchange, supervised playdates (renamed from SwapAround 2026-07)",
    productionUrl: "https://swaparound.vercel.app",
    deploymentState: "production_live",
    buildState: "ready_for_vnext",
    nextSafeAction: "create_vnext_packet",
    blockers: ["Optional brand domain sandlot.unitedundergod.org not yet attached; Vercel project still named swaparound."]
  },
  {
    name: "Snip.Show",
    slug: "snip-show",
    status: "canonical-source decision pending (Snip.Show vs emergent repo)",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: ["Choose the canonical repo before any deploy."]
  },
  {
    name: "Toner Management",
    slug: "toner-management",
    status: "canonical-source decision pending across toner repos",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: ["Canonical source not chosen across toner repos."]
  },
  {
    name: "Laser Engrave Market",
    slug: "laser-engrave-market",
    status:
      "Mongo→Supabase pivot complete (2026-07-03): schema live on shared LPL Supabase, backend ported + E2E-verified locally, preview redeployed with backend URL baked in; awaiting Render deploy",
    productionUrl: "approval-gated",
    deploymentState: "review_ready",
    buildState: "preview_verified",
    nextSafeAction: "await_owner_review",
    blockers: [
      "RENDER_API_KEY needed to create the free laser-engrave-api web service (render.yaml blueprint ready in repo).",
      "STRIPE_API_KEY needed for live checkout (payments endpoints 503 cleanly until set)."
    ]
  },
  {
    name: "Iconium",
    slug: "iconium",
    status: "brand-kit generator source; database placement decision pending",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: ["Prisma-vs-Supabase decision before deploy."]
  },
  {
    name: "Association",
    slug: "association",
    status: "decision: fold association-tier features into ChurchConnect (not a separate app)",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: ["Queue verdict: merge unique association features into ChurchConnect rather than deploy separately."]
  },
  {
    name: "JeepFix",
    slug: "jeepfix",
    status: "decision: becomes a config of the shared troubleshooting engine",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: ["Convert to config after the shared knowledge/troubleshooting engine exists."]
  },
  {
    name: "RacketPro",
    slug: "racketpro",
    status: "decision: becomes a sports config of the shared connection/growth engine",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: ["Convert to config after the shared connection/growth engines are ready."]
  },
  {
    name: "Honestly",
    slug: "honestly",
    status: "decision: ChurchConnect module or standalone care/media app",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: ["Standalone boundary unclear — decide module-vs-app before any build."]
  },
  {
    name: "Ideas / Idea Capture",
    slug: "ideas-idea-capture",
    status: "idea capture + content forge source mined",
    productionUrl: "approval-gated",
    deploymentState: "production_blocked",
    buildState: "planned",
    nextSafeAction: "create_planning_issue",
    blockers: []
  }
];
