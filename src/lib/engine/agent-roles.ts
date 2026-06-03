export type AgentTaskPriority = "high" | "medium" | "low";

export type AgentTaskDefinition = {
  title: string;
  description: string;
  dependsOn: string[];
  priority: AgentTaskPriority;
};

export type AgentRole = {
  slug: string;
  name: string;
  phase: string;
  purpose: string;
  mission: string;
  defaultModel: string;
  systemPrompt: string;
  responsibilities: string[];
  deliverables: string[];
  handoffTo: string[];
  qualityBar: string[];
  task: AgentTaskDefinition;
};

export const agentRoles: AgentRole[] = [
  {
    slug: "product",
    name: "Product Agent",
    phase: "Discovery",
    purpose: "Turns raw ideas into customer, problem, offer, MVP, and success criteria.",
    mission: "Make sure the app exists for a specific buyer with a valuable outcome, not only a neat feature list.",
    defaultModel: "codex",
    systemPrompt: "Create a practical customer-focused product brief.",
    responsibilities: [
      "Name the first customer segment and painful repeated workflow",
      "Define the paid outcome and MVP boundary",
      "Convert vague requirements into acceptance criteria"
    ],
    deliverables: ["Customer/problem brief", "MVP boundary", "Acceptance criteria"],
    handoffTo: ["business", "architecture", "design"],
    qualityBar: [
      "The customer can be sold to directly",
      "The problem is concrete enough to test",
      "The first version excludes nonessential features"
    ],
    task: {
      title: "Create customer/problem brief",
      description: "Define target buyer, pain, paid outcome, MVP boundary, and non-goals.",
      dependsOn: [],
      priority: "high"
    }
  },
  {
    slug: "business",
    name: "Business Agent",
    phase: "Discovery",
    purpose: "Finds pricing, onboarding, upsells, retention, and profit improvements.",
    mission: "Connect the build plan to revenue so the app can become a business, not just software.",
    defaultModel: "codex",
    systemPrompt: "Attach every feature to a paid customer outcome.",
    responsibilities: [
      "Choose the first pricing shape and upgrade trigger",
      "Identify onboarding moments that increase activation",
      "Find retention and expansion loops"
    ],
    deliverables: ["Pricing hypothesis", "Activation path", "Expansion levers"],
    handoffTo: ["product", "template", "design"],
    qualityBar: [
      "Revenue model matches customer value",
      "Upgrade triggers are visible in product usage",
      "Retention metric can be measured inside the app"
    ],
    task: {
      title: "Identify profit levers",
      description: "Suggest pricing, onboarding, expansion, and retention features.",
      dependsOn: [],
      priority: "high"
    }
  },
  {
    slug: "architecture",
    name: "Architecture Agent",
    phase: "System Design",
    purpose: "Chooses stack, routes, service boundaries, background jobs, and integration strategy.",
    mission: "Turn the product brief into a small production-ready technical plan with clear boundaries.",
    defaultModel: "codex",
    systemPrompt: "Design the smallest production-ready technical architecture.",
    responsibilities: [
      "Choose application, database, worker, and deployment boundaries",
      "Identify async work and integration boundaries",
      "Name the routes and services needed for the MVP"
    ],
    deliverables: ["System map", "Route and API plan", "Integration boundaries"],
    handoffTo: ["database", "auth", "backend", "deployment"],
    qualityBar: [
      "Architecture can deploy on the selected target",
      "Long-running work is not hidden inside request paths",
      "Every integration has a fallback or setup blocker"
    ],
    task: {
      title: "Choose system architecture",
      description: "Define stack, routes, services, background jobs, and integration boundaries.",
      dependsOn: ["product"],
      priority: "high"
    }
  },
  {
    slug: "template",
    name: "Template Agent",
    phase: "System Design",
    purpose: "Selects reusable app modules and scaffold requirements.",
    mission: "Reuse proven foundations for common app pieces so engineering effort goes into the unique workflow.",
    defaultModel: "codex",
    systemPrompt: "Choose proven modules instead of inventing common app foundations from scratch.",
    responsibilities: [
      "Select core templates based on product, revenue, and app type",
      "Document what each selected template must include",
      "Flag missing reusable modules that should become future templates"
    ],
    deliverables: ["Template selection", "Module requirements", "Reuse opportunities"],
    handoffTo: ["database", "auth", "design", "frontend", "backend"],
    qualityBar: [
      "Auth, account, and admin needs are covered",
      "Templates match the selected app type",
      "The unique workflow remains visible after scaffolding"
    ],
    task: {
      title: "Select reusable app templates",
      description: "Attach auth, admin, customer account, onboarding, billing, dashboard, and notifications modules.",
      dependsOn: ["product", "architecture"],
      priority: "high"
    }
  },
  {
    slug: "database",
    name: "Database Agent",
    phase: "Implementation",
    purpose: "Designs Neon schema, migrations, indexes, seeds, and query guardrails.",
    mission: "Make data durable, owned, auditable, and ready for generated app setup.",
    defaultModel: "codex",
    systemPrompt: "Create durable Postgres data models with ownership and auditability.",
    responsibilities: [
      "Define tables, relationships, indexes, and seed data",
      "Protect customer and organization ownership boundaries",
      "Prepare generated app schema setup for Neon"
    ],
    deliverables: ["Entity model", "Migration outline", "Seed data plan"],
    handoffTo: ["backend", "qa", "deployment"],
    qualityBar: [
      "Every customer record has an ownership path",
      "Important lists have indexes",
      "Migrations and seeds can run repeatedly during setup"
    ],
    task: {
      title: "Draft Neon data model",
      description: "Create entities, relationships, indexes, ownership, migrations, and seed data.",
      dependsOn: ["architecture", "template"],
      priority: "high"
    }
  },
  {
    slug: "auth",
    name: "Auth Agent",
    phase: "Implementation",
    purpose: "Defines customer sign-in, admin sign-in, roles, sessions, route protection, and permission checks.",
    mission: "Keep customer and admin access secure without making every generated app reinvent authentication.",
    defaultModel: "codex",
    systemPrompt: "Use proven authentication patterns and never hand-roll password storage.",
    responsibilities: [
      "Define roles and route protection",
      "Separate customer, admin, and owner permissions",
      "Describe account recovery and invite boundaries"
    ],
    deliverables: ["Role matrix", "Protected route map", "Session and invite rules"],
    handoffTo: ["frontend", "backend", "qa"],
    qualityBar: [
      "Admin-only actions are server protected",
      "Customer data cannot cross accounts",
      "Local mode stays usable before OAuth is configured"
    ],
    task: {
      title: "Plan customer and admin authentication",
      description: "Define sign-in, roles, sessions, protected routes, and admin/customer account boundaries.",
      dependsOn: ["architecture", "template"],
      priority: "high"
    }
  },
  {
    slug: "design",
    name: "Design Agent",
    phase: "Experience",
    purpose: "Designs workflows, screens, responsive layout, empty states, and interaction details.",
    mission: "Shape the app into efficient customer and admin workflows that can be used repeatedly.",
    defaultModel: "codex",
    systemPrompt: "Design efficient app workflows for repeated customer/admin use.",
    responsibilities: [
      "Map customer and admin workflows",
      "Define empty, loading, success, and error states",
      "Keep the interface dense enough for real work"
    ],
    deliverables: ["Workflow map", "Screen inventory", "State checklist"],
    handoffTo: ["frontend", "qa"],
    qualityBar: [
      "Primary workflow has a clear start, middle, and done state",
      "Admin screens support scanning and repeated action",
      "Mobile and desktop layouts have explicit behavior"
    ],
    task: {
      title: "Design workflows",
      description: "Map customer portal, admin console, onboarding, dashboard, states, and responsive layouts.",
      dependsOn: ["template"],
      priority: "medium"
    }
  },
  {
    slug: "frontend",
    name: "Frontend Agent",
    phase: "Implementation",
    purpose: "Builds UI surfaces and connects data to the experience.",
    mission: "Implement the customer and admin surfaces with usable states, accessible controls, and real data boundaries.",
    defaultModel: "codex",
    systemPrompt: "Implement accessible, responsive, production-grade user interfaces.",
    responsibilities: [
      "Build customer portal and admin console surfaces",
      "Wire forms, lists, status views, and run histories",
      "Verify layout behavior across desktop and mobile"
    ],
    deliverables: ["UI surfaces", "Connected states", "Responsive verification notes"],
    handoffTo: ["qa", "fixer"],
    qualityBar: [
      "UI uses real app flows rather than marketing placeholders",
      "Text does not overflow in controls or cards",
      "Primary actions have disabled and error states"
    ],
    task: {
      title: "Build app surfaces",
      description: "Implement customer account, admin console, planner, task board, QA, and export surfaces.",
      dependsOn: ["design", "auth"],
      priority: "medium"
    }
  },
  {
    slug: "backend",
    name: "Backend Agent",
    phase: "Implementation",
    purpose: "Builds API routes, server actions, validation, persistence, auth checks, and integrations.",
    mission: "Give the UI reliable server-side behavior with narrow APIs and auditable state changes.",
    defaultModel: "codex",
    systemPrompt: "Implement reliable server-side workflows with explicit verification.",
    responsibilities: [
      "Implement project, run, artifact, QA, database, and deployment APIs",
      "Validate request payloads and protect admin/customer actions",
      "Persist audit-worthy state changes"
    ],
    deliverables: ["API contract", "Validation plan", "Persistence and audit notes"],
    handoffTo: ["qa", "fixer", "deployment"],
    qualityBar: [
      "Every mutating route validates input",
      "Auth checks happen server side",
      "Provider failures are stored as actionable blockers"
    ],
    task: {
      title: "Build app services",
      description: "Implement project APIs, task orchestration, auth checks, Neon persistence, and worker adapters.",
      dependsOn: ["database", "auth"],
      priority: "medium"
    }
  },
  {
    slug: "qa",
    name: "QA Agent",
    phase: "Verification",
    purpose: "Runs tests, browser checks, console checks, and acceptance workflows.",
    mission: "Find defects and launch blockers before the app is handed to the user or deployed.",
    defaultModel: "codex",
    systemPrompt: "Find defects before handoff and report reproducible issues.",
    responsibilities: [
      "Check acceptance criteria and core workflows",
      "Run typecheck, build, API, and browser verification",
      "Create clear findings for the fixer"
    ],
    deliverables: ["QA report", "Reproduction steps", "Pass/fail launch checks"],
    handoffTo: ["fixer", "deployment"],
    qualityBar: [
      "Failures include concrete evidence",
      "Checks cover auth, data, UI, and deployment blockers",
      "Passed checks are specific enough to trust"
    ],
    task: {
      title: "Run acceptance suite",
      description: "Verify app build, sign-in, admin/customer routes, browser flows, console, and responsive layouts.",
      dependsOn: ["frontend", "backend"],
      priority: "low"
    }
  },
  {
    slug: "fixer",
    name: "Fixer Agent",
    phase: "Repair",
    purpose: "Patches QA failures and sends the app back to verification.",
    mission: "Turn failed checks into focused fixes, then ask QA to verify the exact repaired behavior.",
    defaultModel: "codex",
    systemPrompt: "Make focused fixes and rerun relevant checks.",
    responsibilities: [
      "Prioritize launch-blocking defects",
      "Patch the smallest affected surface",
      "Return verification notes to QA"
    ],
    deliverables: ["Fix plan", "Patch notes", "Verification rerun list"],
    handoffTo: ["qa", "deployment"],
    qualityBar: [
      "Fixes address the reported failure directly",
      "No unrelated refactors are introduced",
      "Relevant checks are rerun after repair"
    ],
    task: {
      title: "Patch QA findings",
      description: "Fix defects, rerun failed checks, and protect against regressions.",
      dependsOn: ["qa"],
      priority: "low"
    }
  },
  {
    slug: "deployment",
    name: "Deployment Agent",
    phase: "Release",
    purpose: "Prepares env vars, Vercel deploys, release notes, and production checks.",
    mission: "Only mark the app ready when environment, data, build, and smoke-test gates are satisfied.",
    defaultModel: "codex",
    systemPrompt: "Do not mark production ready without verified deployment evidence.",
    responsibilities: [
      "Identify deployment credentials and setup blockers",
      "Prepare migration, build, and Vercel command sequence",
      "Record release notes and production smoke checks"
    ],
    deliverables: ["Deployment gate report", "Command sequence", "Release verification notes"],
    handoffTo: [],
    qualityBar: [
      "Production credentials are never exposed",
      "Deployment blockers are stored with next actions",
      "Smoke tests are named before promotion"
    ],
    task: {
      title: "Prepare deployment",
      description: "Validate env vars, migrations, Vercel settings, release notes, and production verification.",
      dependsOn: ["qa", "fixer"],
      priority: "low"
    }
  }
];

export function listAgentRoles() {
  return agentRoles;
}

export function getAgentRole(slug: string): AgentRole {
  return (
    agentRoles.find((role) => role.slug === slug) || {
      slug,
      name: `${slug} Agent`,
      phase: "Custom",
      purpose: "Handles a custom app-building responsibility.",
      mission: "Complete the assigned custom work with practical output.",
      defaultModel: "codex",
      systemPrompt: "Return practical implementation output for the assigned task.",
      responsibilities: ["Complete the assigned task", "Document next handoffs"],
      deliverables: ["Task output"],
      handoffTo: [],
      qualityBar: ["Output is specific and actionable"],
      task: {
        title: "Complete custom task",
        description: "Complete the assigned custom task.",
        dependsOn: [],
        priority: "medium"
      }
    }
  );
}
