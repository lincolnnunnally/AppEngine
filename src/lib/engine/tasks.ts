export type EngineTask = {
  agent: string;
  title: string;
  description: string;
  dependsOn: string[];
};

export const defaultTaskGraph: EngineTask[] = [
  {
    agent: "product",
    title: "Create customer/problem brief",
    description: "Define target buyer, pain, paid outcome, MVP boundary, and non-goals.",
    dependsOn: []
  },
  {
    agent: "business",
    title: "Identify profit levers",
    description: "Suggest pricing, onboarding, expansion, and retention features.",
    dependsOn: []
  },
  {
    agent: "architecture",
    title: "Choose system architecture",
    description: "Define stack, routes, services, background jobs, and integration boundaries.",
    dependsOn: ["product"]
  },
  {
    agent: "template",
    title: "Select reusable app templates",
    description: "Attach auth, admin, customer account, onboarding, billing, dashboard, and notifications modules.",
    dependsOn: ["product", "architecture"]
  },
  {
    agent: "database",
    title: "Draft Neon data model",
    description: "Create entities, relationships, indexes, ownership, migrations, and seed data.",
    dependsOn: ["architecture", "template"]
  },
  {
    agent: "auth",
    title: "Plan customer and admin authentication",
    description: "Define sign-in, roles, sessions, protected routes, and admin/customer account boundaries.",
    dependsOn: ["architecture", "template"]
  },
  {
    agent: "design",
    title: "Design workflows",
    description: "Map customer portal, admin console, onboarding, dashboard, states, and responsive layouts.",
    dependsOn: ["template"]
  },
  {
    agent: "frontend",
    title: "Build app surfaces",
    description: "Implement customer account, admin console, planner, task board, QA, and export surfaces.",
    dependsOn: ["design", "auth"]
  },
  {
    agent: "backend",
    title: "Build app services",
    description: "Implement project APIs, task orchestration, auth checks, Neon persistence, and worker adapters.",
    dependsOn: ["database", "auth"]
  },
  {
    agent: "qa",
    title: "Run acceptance suite",
    description: "Verify app build, sign-in, admin/customer routes, browser flows, console, and responsive layouts.",
    dependsOn: ["frontend", "backend"]
  },
  {
    agent: "fixer",
    title: "Patch QA findings",
    description: "Fix defects, rerun failed checks, and protect against regressions.",
    dependsOn: ["qa"]
  },
  {
    agent: "deployment",
    title: "Prepare deployment",
    description: "Validate env vars, migrations, Vercel settings, release notes, and production verification.",
    dependsOn: ["qa", "fixer"]
  }
];
