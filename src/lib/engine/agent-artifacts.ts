import type { AgentRole } from "./agent-roles";
import type { EngineTask } from "./tasks";

export type AgentArtifactKind =
  | "chatgpt_handoff_packet"
  | "problem_solution_intake"
  | "problem_portfolio_routing"
  | "solution_candidate_review"
  | "intake_packet"
  | "pilot_app_build"
  | "build_completion_plan"
  | "preview_verification"
  | "deployment_lifecycle"
  | "cost_governance"
  | "owner_status_report"
  | "app_build_packet"
  | "vnext_packet"
  | "identity_auth_plan"
  | "super_admin_registry_entry"
  | "app_portfolio_registry"
  | "provider_cost_review"
  | "deployment_environment_plan"
  | "design_review"
  | "compatibility_test_plan"
  | "release_gate_plan"
  | "product_brief"
  | "business_model"
  | "system_architecture"
  | "template_plan"
  | "data_model"
  | "auth_plan"
  | "experience_plan"
  | "frontend_plan"
  | "backend_plan"
  | "qa_plan"
  | "fix_plan"
  | "deployment_plan";

export type AgentStructuredArtifact<TData extends Record<string, unknown> = Record<string, unknown>> = {
  kind: AgentArtifactKind;
  title: string;
  summary: string;
  data: TData;
};

export type AgentArtifactContext = {
  projectName: string;
  idea: string;
  customer: string;
  problem: string;
  appType: string;
  recommendedTarget: string;
  templates: string[];
};

export function buildLocalStructuredArtifacts(
  role: AgentRole,
  task: Pick<EngineTask, "acceptanceCriteria">,
  context: AgentArtifactContext
): AgentStructuredArtifact[] {
  const commonRoutes = ["/", "/app", "/account", "/onboarding", "/billing", "/requests", "/notifications", "/admin"];

  const artifacts: Record<string, AgentStructuredArtifact[]> = {
    product: [
      {
        kind: "product_brief",
        title: "Customer Problem Brief",
        summary: `Defines the first customer, paid problem, MVP boundary, and acceptance criteria for ${context.projectName}.`,
        data: {
          customer: context.customer,
          problem: context.problem,
          appType: context.appType,
          valueProposition: `Help ${context.customer} solve ${context.problem} with a finished, account-based ${context.appType}.`,
          mvpScope: [
            "Customer sign-in and account workspace",
            "Primary customer workflow",
            "Admin management console",
            "Run history and status tracking",
            "QA and launch readiness checks"
          ],
          nonGoals: ["Custom native mobile app", "Unbounded marketplace features", "Manual deployment-only workflow"],
          acceptanceCriteria: task.acceptanceCriteria
        }
      }
    ],
    business: [
      {
        kind: "business_model",
        title: "Revenue And Growth Model",
        summary: "Defines pricing, activation, retention, and expansion levers for the generated app.",
        data: {
          pricingTiers: [
            { name: "Starter", price: "$49/mo", limit: "1 workspace", upgradeTrigger: "first successful workflow" },
            { name: "Growth", price: "$149/mo", limit: "5 workspaces", upgradeTrigger: "team usage or repeated automation" },
            { name: "Scale", price: "$399/mo", limit: "unlimited workflows", upgradeTrigger: "admin controls and support needs" }
          ],
          activationEvents: ["complete onboarding", "create first workflow", "see a saved result", "clear first launch blocker"],
          retentionMetrics: ["weekly active workflows", "resolved requests", "time saved", "blocked-to-ready conversion"],
          expansionLevers: ["more seats", "more generated apps", "managed deployment", "premium support"]
        }
      }
    ],
    architecture: [
      {
        kind: "system_architecture",
        title: "Production Architecture",
        summary: `Defines the deployable system boundary for ${context.recommendedTarget}.`,
        data: {
          stack: ["Next.js App Router", "TypeScript", "Auth.js", "Neon Postgres", "Vercel"],
          routes: commonRoutes,
          services: ["planner", "agent runner", "app exporter", "database setup", "readiness scoring", "deployment gate"],
          backgroundJobs: ["long model runs", "generated app verification", "preview deployment", "scheduled readiness refresh"],
          integrations: ["Neon", "Vercel", "OpenAI or Anthropic", "GitHub"]
        }
      }
    ],
    template: [
      {
        kind: "template_plan",
        title: "Reusable Module Plan",
        summary: "Declares which reusable modules the generated app should include.",
        data: {
          selectedTemplates: context.templates,
          moduleContracts: context.templates.map((template) => ({
            name: template,
            includes: ["routes", "data model", "UI states", "API contract", "QA checks"]
          })),
          futureTemplates: ["support inbox", "audit reporting", "team invitations", "usage metering"]
        }
      }
    ],
    database: [
      {
        kind: "data_model",
        title: "Neon Data Model",
        summary: "Creates concrete tables, ownership boundaries, indexes, and seed data for the generated app.",
        data: {
          entities: [
            entity("organizations", "Customer organizations and ownership", ["name", "slug", "owner_user_id"], ["slug"]),
            entity("organization_memberships", "User membership and roles", ["organization_id", "user_id", "role"], ["organization_id", "user_id"]),
            entity("customer_requests", "Customer workflow requests", ["organization_id", "title", "summary", "priority", "status"], ["organization_id", "status"]),
            entity("subscription_plans", "Pricing tiers and plan limits", ["name", "price", "audience", "includes", "active"], ["active"]),
            entity("notifications", "Customer/admin notification feed", ["organization_id", "user_id", "title", "body", "channel", "read_at"], [
              "organization_id",
              "read_at"
            ]),
            entity("app_projects", "Admin project queue and readiness", ["organization_id", "name", "summary", "status", "readiness_score"], [
              "organization_id",
              "status"
            ]),
            entity("audit_events", "Admin/customer action audit trail", ["organization_id", "actor_user_id", "event_type", "event_data"], [
              "organization_id",
              "created_at"
            ])
          ],
          ownershipPath: "users -> organization_memberships -> organizations -> customer records",
          seedData: ["first organization", "pricing plans", "sample requests", "notifications", "admin project queue"],
          migrationFiles: ["src/lib/db/schema.sql", "src/lib/db/seed.sql", "scripts/setup-database.mjs"]
        }
      }
    ],
    auth: [
      {
        kind: "auth_plan",
        title: "Auth And Permission Plan",
        summary: "Defines roles, protected routes, and server-side permission checks.",
        data: {
          roles: [
            { role: "owner", can: ["manage engine", "manage admins", "deploy apps", "view audit logs"] },
            { role: "admin", can: ["manage customers", "run agents", "review QA", "prepare deployments"] },
            { role: "customer", can: ["manage account", "use workflows", "view own requests", "manage notifications"] }
          ],
          protectedRoutes: [
            { path: "/app", access: ["owner", "admin", "customer"] },
            { path: "/account", access: ["owner", "admin", "customer"] },
            { path: "/admin", access: ["owner", "admin"] },
            { path: "/api/customer/*", access: ["owner", "admin", "customer"] },
            { path: "/api/admin/*", access: ["owner", "admin"] }
          ],
          sessionMode: "Auth.js when configured, local setup user before credentials are ready",
          auditEvents: ["admin customer update", "deployment prepared", "QA blocker changed", "billing plan changed"]
        }
      }
    ],
    design: [
      {
        kind: "experience_plan",
        title: "Customer And Admin Experience Plan",
        summary: "Maps the screens, workflows, and states needed for repeated app use.",
        data: {
          workflows: [
            workflow("Customer onboarding", ["goal capture", "company setup", "first workflow", "success criteria"]),
            workflow("Primary customer workflow", ["intake", "status", "next action", "completion", "recovery"]),
            workflow("Admin operations", ["customer list", "project queue", "QA findings", "deployment gate"])
          ],
          screens: [
            { path: "/app", purpose: "customer work dashboard" },
            { path: "/account", purpose: "profile, organization, plan, notifications" },
            { path: "/requests", purpose: "customer workflow requests" },
            { path: "/admin", purpose: "admin operating console" },
            { path: "/admin/customers", purpose: "customer health and support" },
            { path: "/admin/projects", purpose: "generated app projects and readiness" }
          ],
          states: ["empty", "loading", "ready", "blocked", "needs attention", "completed", "retrying"]
        }
      }
    ],
    frontend: [
      {
        kind: "frontend_plan",
        title: "Frontend Build Plan",
        summary: "Declares concrete pages, components, and data sources for generated app files.",
        data: {
          pages: [
            page("/", "landing/open app entry", []),
            page("/app", "customer workspace", ["customerMetrics", "customerWorkflows", "selectedModules"]),
            page("/account", "customer account", ["accountSections"]),
            page("/onboarding", "guided onboarding", ["onboardingSteps"]),
            page("/billing", "plans and usage", ["pricingPlans"]),
            page("/requests", "customer request tracking", ["customerRequests"]),
            page("/notifications", "notification center", ["notifications"]),
            page("/admin", "admin operating console", ["adminMetrics", "adminQueues"]),
            page("/admin/customers", "customer management", ["adminCustomers"]),
            page("/admin/projects", "project readiness queue", ["adminProjects"])
          ],
          components: ["MetricCard", "WideCard", "ActionRow", "StatusBadge", "ProtectedPageShell"],
          responsiveRules: ["single column under 760px", "stable card dimensions", "no horizontal overflow"]
        }
      }
    ],
    backend: [
      {
        kind: "backend_plan",
        title: "Backend API And Persistence Plan",
        summary: "Defines API routes, validation, persistence helpers, and fallback behavior.",
        data: {
          apiRoutes: [
            api("GET", "/api/health", "public health check", "public"),
            api("GET", "/api/customer/requests", "list customer requests", "customer"),
            api("GET", "/api/admin/customers", "list admin customers", "admin"),
            api("GET", "/api/admin/projects", "list admin projects", "admin")
          ],
          persistenceHelpers: ["getDatabase", "hasDatabase", "withFallback", "listCustomerRequests", "listAdminProjects"],
          validation: ["route-level auth checks", "typed static fallback data", "database read fallback"],
          failureHandling: ["return 401 for missing customer session", "return 403 for non-admin access", "fallback to seed data for local setup"]
        }
      }
    ],
    qa: [
      {
        kind: "qa_plan",
        title: "Acceptance And Verification Plan",
        summary: "Defines checks the generated app should pass before launch.",
        data: {
          checks: [
            qa("typecheck", "high", "npm run typecheck"),
            qa("production build", "high", "npm run build"),
            qa("customer workspace loads", "high", "GET /app"),
            qa("admin console loads", "high", "GET /admin"),
            qa("customer API auth gate", "medium", "GET /api/customer/requests"),
            qa("admin API auth gate", "medium", "GET /api/admin/customers"),
            qa("responsive layout", "medium", "browser check desktop and mobile")
          ],
          evidence: ["build logs", "API responses", "browser screenshots", "console logs", "database setup output"]
        }
      }
    ],
    fixer: [
      {
        kind: "fix_plan",
        title: "Repair Loop Plan",
        summary: "Converts failed QA checks into focused repairs and reruns.",
        data: {
          triageOrder: ["build blockers", "auth/data leaks", "broken primary workflow", "responsive overflow", "polish"],
          repairSteps: ["reproduce failure", "patch smallest surface", "rerun exact check", "rerun related checks", "record residual risk"],
          rollbackRule: "Do not revert unrelated user changes; repair the affected generated surface."
        }
      }
    ],
    deployment: [
      {
        kind: "deployment_plan",
        title: "Deployment Gate Plan",
        summary: "Defines commands, required environment variables, and release gates.",
        data: {
          requiredEnv: ["DATABASE_URL", "AUTH_SECRET", "APP_ENGINE_OWNER_EMAIL", "VERCEL_TOKEN", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"],
          commands: [
            "npm run typecheck",
            "npm run build",
            "npm run db:setup",
            "vercel pull --yes --environment=preview --token=$VERCEL_TOKEN",
            "vercel build --token=$VERCEL_TOKEN",
            "vercel deploy --prebuilt --token=$VERCEL_TOKEN"
          ],
          releaseGates: ["env configured", "database setup applied", "QA passed", "preview smoke test passed", "release notes recorded"]
        }
      }
    ]
  };

  return artifacts[role.slug] || [];
}

function entity(name: string, purpose: string, fields: string[], indexes: string[]) {
  return { name, purpose, fields, indexes };
}

function workflow(name: string, steps: string[]) {
  return { name, steps };
}

function page(path: string, purpose: string, dataSources: string[]) {
  return { path, purpose, dataSources };
}

function api(method: string, path: string, purpose: string, auth: string) {
  return { method, path, purpose, auth };
}

function qa(title: string, severity: string, command: string) {
  return { title, severity, command };
}
