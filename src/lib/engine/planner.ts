import { z } from "zod";
import { selectTemplates } from "./templates";
import { defaultTaskGraph } from "./tasks";

export const analyzeIdeaInput = z.object({
  idea: z.string().min(8),
  targetCustomer: z.string().optional(),
  problem: z.string().optional(),
  revenueModel: z.string().default("Not sure yet"),
  appType: z.string().default("Auto detect")
});

export type AnalyzeIdeaInput = z.infer<typeof analyzeIdeaInput>;

export function analyzeIdea(input: AnalyzeIdeaInput) {
  const appType = detectAppType(input.idea, input.appType);
  const recommendedTarget = chooseBuildTarget(input.idea);
  const templates = selectTemplates(`${input.idea} ${input.revenueModel} ${appType}`);
  const personalOrFree = isPersonalOrFree(input, appType);
  const customer = input.targetCustomer || (personalOrFree ? "you and people with the same goal" : "the first focused customer segment");
  const problem = input.problem || (personalOrFree ? "staying consistent when comfort is easier than progress" : "the most expensive repeated workflow");

  return {
    title: deriveTitle(input.idea),
    customer,
    problem,
    appType,
    recommendedTarget,
    auth: {
      provider: "Auth.js with Neon-backed account and session data",
      roles: getRolesForAppType(appType, personalOrFree),
      protectedRoutes: personalOrFree ? ["/app", "/account", "/api/customer/*"] : ["/app", "/account", "/admin", "/api/admin/*", "/api/customer/*"]
    },
    templates,
    tasks: defaultTaskGraph.map((task, index) => ({
      ...task,
      status: "todo",
      priority: task.priority || (index < 6 ? "high" : index < 10 ? "medium" : "low")
    })),
    qaChecks: buildQaChecks(personalOrFree),
    readinessScore: input.targetCustomer && input.problem ? 32 : 24,
    stack: [
      "Next.js App Router",
      "TypeScript",
      "Neon Postgres",
      "Auth.js",
      "Drizzle ORM or SQL migrations",
      "Playwright verification",
      "Vercel deployment"
    ],
    nextActions: [
      "Create project record in Neon",
      "Attach selected templates",
      "Create task graph",
      "Run architecture, database, auth, design, frontend, backend, QA, fixer, and deployment agents"
    ],
    valueProposition: personalOrFree
      ? `Help ${customer} solve ${problem} with a focused, tested app that supports the real habit loop.`
      : `Help ${customer} solve ${problem} with a finished, tested, account-based app instead of a prototype.`
  };
}

function buildQaChecks(personalOrFree = false) {
  return [
    {
      title: personalOrFree ? "User and desired outcome" : "Customer and paid outcome",
      description: personalOrFree
        ? "Primary user, motivation trigger, success state, and personal outcome are explicit."
        : "Target customer, painful problem, and business outcome are explicit.",
      severity: "high",
      status: "pending"
    },
    {
      title: "Authentication and roles",
      description: "Customer/admin sign-in, roles, sessions, and protected routes are defined.",
      severity: "high",
      status: "pending"
    },
    {
      title: "Neon persistence",
      description: "Project, template, task, run, artifact, QA, deployment, and audit records can be persisted.",
      severity: "high",
      status: "pending"
    },
    {
      title: "Primary workflow completion",
      description: "The generated app has a start, middle, success state, and recovery path.",
      severity: "high",
      status: "pending"
    },
    {
      title: "Responsive customer/admin UI",
      description: "Customer and admin surfaces fit desktop and mobile without horizontal overflow.",
      severity: "medium",
      status: "pending"
    },
    {
      title: "Deployment readiness",
      description: "Env vars, migrations, build command, Vercel target, and smoke test are known.",
      severity: "medium",
      status: "pending"
    }
  ];
}

function detectAppType(idea: string, selectedType: string) {
  if (selectedType && selectedType !== "Auto detect") return selectedType;
  const text = idea.toLowerCase();
  if (
    text.includes("dream board") ||
    text.includes("vision board") ||
    text.includes("habit") ||
    text.includes("motivation") ||
    text.includes("focus") ||
    text.includes("personal") ||
    text.includes("journal")
  ) {
    return "Personal productivity app";
  }
  if (text.includes("marketplace") || text.includes("vendor") || text.includes("supplier")) return "Marketplace";
  if (text.includes("customer portal") || text.includes("customer-facing") || text.includes("client portal")) return "SaaS customer portal";
  if (text.includes("ai") || text.includes("agent") || text.includes("generate") || text.includes("automation")) return "AI workflow app";
  if (text.includes("internal") || text.includes("back office") || text.includes("operations team")) return "Internal operations tool";
  return "SaaS customer portal";
}

function isPersonalOrFree(input: AnalyzeIdeaInput, appType: string) {
  const text = `${input.idea} ${input.revenueModel} ${appType}`.toLowerCase();

  return (
    appType === "Personal productivity app" ||
    text.includes("free") ||
    text.includes("personal") ||
    text.includes("not sure") ||
    text.includes("dream board") ||
    text.includes("vision board")
  );
}

function getRolesForAppType(appType: string, personalOrFree: boolean) {
  if (personalOrFree) {
    return ["owner", "member"];
  }

  if (appType === "Marketplace") {
    return ["owner", "admin", "customer", "vendor"];
  }

  return ["owner", "admin", "customer"];
}

function chooseBuildTarget(idea: string) {
  const text = idea.toLowerCase();
  if (text.includes("heavy") || text.includes("scrape") || text.includes("long-running") || text.includes("queue")) {
    return "Vercel + Neon + Auth.js + Hetzner workers";
  }
  return "Vercel + Neon + Auth.js";
}

function deriveTitle(idea: string) {
  return idea
    .replace(/[^a-z0-9 ]/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !["the", "and", "for", "with", "that", "this"].includes(word.toLowerCase()))
    .slice(0, 3)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
