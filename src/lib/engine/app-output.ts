import type { AgentStructuredArtifact } from "./agent-artifacts";
import type { analyzeIdea } from "./planner";

type Plan = ReturnType<typeof analyzeIdea>;

type AgentOutputForHandoff = {
  agent: string;
  structuredArtifacts?: AgentStructuredArtifact[];
};

export type GeneratedAppHandoff = {
  routes: string[];
  apiRoutes: Array<Record<string, unknown>>;
  roleMatrix: Array<Record<string, unknown>>;
  databaseModel: Array<Record<string, unknown>>;
  workflows: Array<Record<string, unknown>>;
  qaChecks: Array<Record<string, unknown>>;
  deploymentGates: string[];
  agentBlueprint: Array<{
    agent: string;
    kind: string;
    title: string;
    summary: string;
    data: Record<string, unknown>;
  }>;
  files: Array<{
    path: string;
    purpose: string;
  }>;
  environment: string[];
  dataEntities: string[];
  verification: string[];
  deployment: string[];
};

export function buildGeneratedAppHandoff(plan: Plan, agents: AgentOutputForHandoff[] = []): GeneratedAppHandoff {
  const agentBlueprint = extractAgentBlueprint(agents);
  const architectureData = artifactData(agentBlueprint, "system_architecture");
  const backendData = artifactData(agentBlueprint, "backend_plan");
  const authData = artifactData(agentBlueprint, "auth_plan");
  const databaseData = artifactData(agentBlueprint, "data_model");
  const experienceData = artifactData(agentBlueprint, "experience_plan");
  const qaData = artifactData(agentBlueprint, "qa_plan");
  const deploymentData = artifactData(agentBlueprint, "deployment_plan");
  const routes = stringArray(architectureData.routes, [
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
  ]);

  return {
    routes,
    apiRoutes: recordArray(backendData.apiRoutes, [
      { method: "GET", path: "/api/health", purpose: "public health check", auth: "public" },
      { method: "GET", path: "/api/customer/requests", purpose: "list customer requests", auth: "customer" },
      { method: "GET", path: "/api/admin/customers", purpose: "list admin customers", auth: "admin" },
      { method: "GET", path: "/api/admin/projects", purpose: "list admin projects", auth: "admin" }
    ]),
    roleMatrix: recordArray(
      authData.roles,
      plan.auth.roles.map((role) => ({ role, can: role === "customer" ? ["manage own account"] : ["manage app operations"] }))
    ),
    databaseModel: recordArray(
      databaseData.entities,
      [
        "organizations",
        "organization_memberships",
        "customer_requests",
        "subscription_plans",
        "notifications",
        "app_projects",
        "audit_events"
      ].map((name) => ({ name }))
    ),
    workflows: recordArray(experienceData.workflows, [
      { name: "Customer onboarding", steps: ["goal capture", "company setup", "first workflow", "success criteria"] },
      { name: "Primary customer workflow", steps: ["intake", "status", "next action", "completion", "recovery"] },
      { name: "Admin operations", steps: ["customer list", "project queue", "QA findings", "deployment gate"] }
    ]),
    qaChecks: recordArray(qaData.checks, [
      { title: "typecheck", severity: "high", command: "npm run typecheck" },
      { title: "production build", severity: "high", command: "npm run build" }
    ]),
    deploymentGates: stringArray(deploymentData.releaseGates, [
      "env configured",
      "database setup applied",
      "QA passed",
      "preview smoke test passed",
      "release notes recorded"
    ]),
    agentBlueprint,
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
        path: "src/lib/auth/permissions.ts",
        purpose: "Machine-usable role permissions and protected route access gates from the auth agent."
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
        path: "src/lib/generated-blueprint.ts",
        purpose: "Machine-usable build blueprint produced from agent artifacts."
      },
      {
        path: "src/lib/generated-api-contract.ts",
        purpose: "Typed API route contracts produced from the backend agent."
      },
      {
        path: "src/lib/db/generated-model.ts",
        purpose: "Typed database entity map produced from the data agent."
      },
      {
        path: "src/lib/qa/acceptance-checks.ts",
        purpose: "Launch checks and evidence expectations produced from the QA agent."
      },
      {
        path: "src/lib/deployment/deployment-plan.ts",
        purpose: "Required environment, deploy commands, and release gates produced from the deployment agent."
      },
      {
        path: "app-engine-blueprint.json",
        purpose: "Full JSON blueprint for routes, APIs, roles, tables, workflows, QA, and deployment gates."
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
    "API Routes:",
    ...handoff.apiRoutes.map((route) => `- ${formatObjectLine(route, ["method", "path", "purpose", "auth"])}`),
    "",
    "Roles:",
    ...handoff.roleMatrix.map((role) => `- ${formatObjectLine(role, ["role", "can"])}`),
    "",
    "Database Model:",
    ...handoff.databaseModel.map((entity) => `- ${formatObjectLine(entity, ["name", "purpose", "fields", "indexes"])}`),
    "",
    "Workflows:",
    ...handoff.workflows.map((workflow) => `- ${formatObjectLine(workflow, ["name", "steps"])}`),
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
    ...handoff.qaChecks.map((check) => `- ${formatObjectLine(check, ["title", "severity", "command"])}`),
    "",
    "Deployment:",
    ...handoff.deployment.map((item) => `- ${item}`),
    ...handoff.deploymentGates.map((gate) => `- gate: ${gate}`),
    "",
    "Agent Usable Artifacts:",
    ...handoff.agentBlueprint.map((artifact) => `- ${artifact.agent}: ${artifact.title} (${artifact.kind})`)
  ].join("\n");
}

function extractAgentBlueprint(agents: AgentOutputForHandoff[]) {
  return agents.flatMap((agent) =>
    (agent.structuredArtifacts || []).map((artifact) => ({
      agent: agent.agent,
      kind: artifact.kind,
      title: artifact.title,
      summary: artifact.summary,
      data: artifact.data
    }))
  );
}

function artifactData(agentBlueprint: GeneratedAppHandoff["agentBlueprint"], kind: string) {
  return agentBlueprint.find((artifact) => artifact.kind === kind)?.data || {};
}

function recordArray(value: unknown, fallback: Array<Record<string, unknown>>) {
  return Array.isArray(value) && value.every((item) => item && typeof item === "object")
    ? (value as Array<Record<string, unknown>>)
    : fallback;
}

function stringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? (value as string[]) : fallback;
}

function formatObjectLine(value: Record<string, unknown>, keys: string[]) {
  return keys
    .filter((key) => value[key] !== undefined)
    .map((key) => `${key}: ${formatUnknown(value[key])}`)
    .join(" | ");
}

function formatUnknown(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(formatUnknown).join(", ");
  }

  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}
