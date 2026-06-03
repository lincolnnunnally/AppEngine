import type { analyzeIdea } from "./planner";

type Plan = ReturnType<typeof analyzeIdea>;

export type GeneratedAppHandoff = {
  routes: string[];
  files: Array<{
    path: string;
    purpose: string;
  }>;
  environment: string[];
  dataEntities: string[];
  verification: string[];
  deployment: string[];
};

export function buildGeneratedAppHandoff(plan: Plan): GeneratedAppHandoff {
  return {
    routes: [
      "/",
      "/app",
      "/account",
      "/onboarding",
      "/billing",
      "/requests",
      "/notifications",
      "/admin",
      "/admin/customers",
      "/admin/projects",
      "/api/customer/*",
      "/api/admin/*",
      "/api/webhooks/*"
    ],
    files: [
      {
        path: "src/app/app/page.tsx",
        purpose: "Customer dashboard with account, usage, requests, and next actions."
      },
      {
        path: "src/app/account/page.tsx",
        purpose: "Customer profile, organization, plan, billing, and notification preferences."
      },
      {
        path: "src/app/onboarding/page.tsx",
        purpose: "Guided customer onboarding, goal capture, setup checklist, and success criteria."
      },
      {
        path: "src/app/billing/page.tsx",
        purpose: "Pricing plans, subscription state, usage limits, invoices, and upgrade prompts."
      },
      {
        path: "src/app/requests/page.tsx",
        purpose: "Customer request intake, status tracking, priority, and recovery path."
      },
      {
        path: "src/app/notifications/page.tsx",
        purpose: "In-app notification feed, email preferences, and failure alerts."
      },
      {
        path: "src/app/admin/page.tsx",
        purpose: "Admin console for customers, generated apps, agent runs, QA, deployments, and audit logs."
      },
      {
        path: "src/app/admin/customers/page.tsx",
        purpose: "Admin customer management, account health, plan state, and support status."
      },
      {
        path: "src/app/admin/projects/page.tsx",
        purpose: "Admin project queue, agent run status, QA state, and deployment state."
      },
      {
        path: "src/lib/auth/roles.ts",
        purpose: `Role gates for ${plan.auth.roles.join(", ")}.`
      },
      {
        path: "src/lib/db/schema.sql",
        purpose: "Neon schema for Auth.js, organizations, app records, tasks, artifacts, QA checks, deployments, customer requests, and audit events."
      },
      {
        path: "scripts/setup-database.mjs",
        purpose: "One-command Neon schema and seed setup using DATABASE_URL."
      },
      {
        path: "src/lib/db/seed.sql",
        purpose: "Idempotent seed data for the first organization, templates, pricing, requests, notifications, and admin project queue."
      },
      {
        path: "src/lib/db/queries.ts",
        purpose: "Database-backed read helpers with generated static fallback data for build-safe local setup."
      },
      {
        path: "src/lib/templates/index.ts",
        purpose: `Reusable modules: ${plan.templates.map((template) => template.name).join(", ")}.`
      },
      {
        path: "src/lib/app-data.ts",
        purpose: "Static seed data for customer workflows, admin queues, pricing plans, notifications, and API stubs."
      },
      {
        path: "tests/e2e/customer-admin.spec.ts",
        purpose: "Browser verification for sign-in, customer workflows, admin workflows, responsiveness, and console errors."
      },
      {
        path: "vercel.json",
        purpose: "Deployment configuration, cron/workflow hooks, and runtime settings."
      }
    ],
    environment: [
      "DATABASE_URL",
      "AUTH_SECRET",
      "APP_ENGINE_OWNER_EMAIL",
      "AUTH_GITHUB_ID",
      "AUTH_GITHUB_SECRET",
      "AUTH_GOOGLE_ID",
      "AUTH_GOOGLE_SECRET",
      "OPENAI_API_KEY or ANTHROPIC_API_KEY",
      "VERCEL_TOKEN",
      "VERCEL_ORG_ID",
      "VERCEL_PROJECT_ID"
    ],
    dataEntities: [
      "users",
      "accounts",
      "sessions",
      "verification_token",
      "app_user_profiles",
      "organizations",
      "organization_memberships",
      "app_projects",
      "app_templates",
      "app_tasks",
      "agent_runs",
      "artifacts",
      "qa_checks",
      "deployments",
      "audit_events",
      "customer_requests",
      "subscription_plans",
      "notifications"
    ],
    verification: [
      "npm run typecheck",
      "npm run build",
      "API smoke: plan, save, run agents, run QA, prepare deployment",
      "Browser smoke: desktop and mobile customer/admin surfaces",
      "Auth smoke: customer route denied when signed out, admin route denied for customer",
      "Neon smoke: npm run db:setup applies the generated schema and seed data; protected APIs can read setup owner state",
      "Deployment smoke: preview URL loads and has no console errors"
    ],
    deployment: [
      "npm run db:setup",
      "vercel pull --yes --environment=preview --token=$VERCEL_TOKEN",
      "vercel build --token=$VERCEL_TOKEN",
      "vercel deploy --prebuilt --token=$VERCEL_TOKEN",
      "Run preview smoke tests",
      "Promote preview after QA passes"
    ]
  };
}

export function formatGeneratedAppHandoff(handoff: GeneratedAppHandoff) {
  return [
    "Generated App Handoff",
    "",
    "Routes:",
    ...handoff.routes.map((route) => `- ${route}`),
    "",
    "Files:",
    ...handoff.files.map((file) => `- ${file.path}: ${file.purpose}`),
    "",
    "Environment:",
    ...handoff.environment.map((item) => `- ${item}`),
    "",
    "Data:",
    ...handoff.dataEntities.map((item) => `- ${item}`),
    "",
    "Verification:",
    ...handoff.verification.map((item) => `- ${item}`),
    "",
    "Deployment:",
    ...handoff.deployment.map((item) => `- ${item}`)
  ].join("\n");
}
