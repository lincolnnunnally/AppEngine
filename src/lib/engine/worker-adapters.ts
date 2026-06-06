import { buildLocalStructuredArtifacts, type AgentStructuredArtifact } from "./agent-artifacts";
import { getAgentRole, type AgentRole } from "./agent-roles";
import { isLocalMode } from "./local-mode";
import type { EngineTask } from "./tasks";

export type WorkerProvider = "local" | "openai" | "anthropic";

export type AgentJobContext = {
  projectName: string;
  idea: string;
  customer: string;
  problem: string;
  appType: string;
  recommendedTarget: string;
  templates: string[];
  completedAgents?: AgentCompletedHandoff[];
};

export type AgentCompletedHandoff = {
  agent: string;
  task: string;
  summary: string;
  recommendations?: string[];
  artifacts?: string[];
  structuredArtifacts?: AgentStructuredArtifact[];
  handoffs?: string[];
};

export type AgentJobResult = {
  provider: WorkerProvider;
  agent: string;
  phase?: string;
  task: string;
  status: "completed" | "needs_attention" | "failed";
  summary: string;
  recommendations: string[];
  artifacts: string[];
  structuredArtifacts?: AgentStructuredArtifact[];
  handoffs?: string[];
  qualityChecks?: string[];
  raw?: unknown;
};

type WorkerAdapter = {
  provider: WorkerProvider;
  runTask(task: EngineTask, context: AgentJobContext): Promise<AgentJobResult>;
};

type ProviderPayload = Record<string, unknown>;

export function getWorkerProvider(): WorkerProvider {
  const requestedProvider = process.env.APP_ENGINE_WORKER_PROVIDER?.toLowerCase();

  if (requestedProvider === "local") return "local";
  if (requestedProvider === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (requestedProvider === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (isLocalMode()) return "local";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "local";
}

export function getWorkerAdapter(): WorkerAdapter {
  const provider = getWorkerProvider();

  if (provider === "openai") return new OpenAiWorkerAdapter();
  if (provider === "anthropic") return new AnthropicWorkerAdapter();
  return new LocalWorkerAdapter();
}

export function getLocalWorkerAdapter(): WorkerAdapter {
  return new LocalWorkerAdapter();
}

class LocalWorkerAdapter implements WorkerAdapter {
  provider = "local" as const;

  async runTask(task: EngineTask, context: AgentJobContext): Promise<AgentJobResult> {
    const role = getAgentRole(task.agent);
    const summary = summarizeLocalTask(role, task, context);

    return {
      provider: this.provider,
      agent: task.agent,
      phase: role.phase,
      task: task.title,
      status: "completed",
      summary,
      recommendations: buildLocalRecommendations(role, context),
      artifacts: buildLocalArtifacts(role, task, context),
      structuredArtifacts: buildLocalStructuredArtifacts(role, task, context),
      handoffs: buildLocalHandoffs(role),
      qualityChecks: role.qualityBar
    };
  }
}

class OpenAiWorkerAdapter implements WorkerAdapter {
  provider = "openai" as const;

  async runTask(task: EngineTask, context: AgentJobContext): Promise<AgentJobResult> {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-5.1",
          instructions: buildWorkerInstructions(task),
          input: buildWorkerPrompt(task, context),
          max_output_tokens: 900
        }),
        signal: AbortSignal.timeout(getWorkerTimeoutMs())
      });
      const { payload, parseError } = await readProviderPayload(response);

      if (!response.ok || parseError) {
        return buildFailedResult(this.provider, task, getProviderErrorMessage(payload, parseError || "OpenAI worker request failed"), payload);
      }

      return normalizeWorkerText(this.provider, task, context, extractOpenAiText(payload), payload);
    } catch (caught) {
      return buildFailedResult(this.provider, task, getCaughtErrorMessage(caught, "OpenAI worker request failed"), {
        error: String(caught)
      });
    }
  }
}

class AnthropicWorkerAdapter implements WorkerAdapter {
  provider = "anthropic" as const;

  async runTask(task: EngineTask, context: AgentJobContext): Promise<AgentJobResult> {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY || ""
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
          max_tokens: 900,
          system: buildWorkerInstructions(task),
          messages: [
            {
              role: "user",
              content: buildWorkerPrompt(task, context)
            }
          ]
        }),
        signal: AbortSignal.timeout(getWorkerTimeoutMs())
      });
      const { payload, parseError } = await readProviderPayload(response);

      if (!response.ok || parseError) {
        return buildFailedResult(this.provider, task, getProviderErrorMessage(payload, parseError || "Anthropic worker request failed"), payload);
      }

      return normalizeWorkerText(this.provider, task, context, extractAnthropicText(payload), payload);
    } catch (caught) {
      return buildFailedResult(this.provider, task, getCaughtErrorMessage(caught, "Anthropic worker request failed"), {
        error: String(caught)
      });
    }
  }
}

async function readProviderPayload(response: Response): Promise<{ payload: ProviderPayload; parseError?: string }> {
  const text = await response.text();

  if (!text) {
    return { payload: {} };
  }

  try {
    return { payload: JSON.parse(text) as ProviderPayload };
  } catch {
    return {
      payload: {
        error: {
          message: summarizeProviderText(text)
        },
        raw: text.slice(0, 500)
      },
      parseError: "Provider returned a non-JSON response."
    };
  }
}

function getProviderErrorMessage(payload: ProviderPayload, fallback: string) {
  const error = payload.error;

  if (typeof error === "object" && error && "message" in error) {
    const message = String((error as { message?: unknown }).message || "").trim();

    if (message) {
      return message;
    }
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return fallback;
}

function getCaughtErrorMessage(caught: unknown, fallback: string) {
  if (caught instanceof Error && caught.message.trim()) {
    return `${fallback}: ${caught.message}`;
  }

  return fallback;
}

function summarizeProviderText(text: string) {
  const compact = text.replace(/\s+/g, " ").trim();

  if (/upstream|connect|timeout|reset|temporar/i.test(compact)) {
    return "Provider connection failed upstream. Retry the worker run or switch to local worker mode while provider access is unstable.";
  }

  return compact.slice(0, 180) || "Provider returned an unreadable response.";
}

function getWorkerTimeoutMs() {
  const value = Number(process.env.APP_ENGINE_WORKER_TIMEOUT_MS || 12000);

  return Number.isFinite(value) && value > 1000 ? value : 12000;
}

function buildWorkerInstructions(task: EngineTask) {
  const role = getAgentRole(task.agent);

  return [
    "You are one specialist agent inside an automated app-building engine.",
    `Your role is ${role.name}: ${role.purpose}`,
    `Mission: ${role.mission}`,
    `Role instruction: ${role.systemPrompt}`,
    "Be specific about product value, technical choices, files, data, QA, and deployment handoffs.",
    "Do not write marketing copy. Do not ask the user questions.",
    "Return short sections: Summary, Recommendations, Artifacts, Handoffs."
  ].join(" ");
}

function buildWorkerPrompt(task: EngineTask, context: AgentJobContext) {
  const role = getAgentRole(task.agent);

  return [
    `Agent: ${task.agent}`,
    `Agent name: ${role.name}`,
    `Phase: ${role.phase}`,
    `Task: ${task.title}`,
    `Description: ${task.description}`,
    `Project: ${context.projectName}`,
    `Idea: ${context.idea}`,
    `Customer: ${context.customer}`,
    `Problem: ${context.problem}`,
    `App type: ${context.appType}`,
    `Target stack: ${context.recommendedTarget}`,
    `Templates: ${context.templates.join(", ")}`,
    `Responsibilities: ${role.responsibilities.join("; ")}`,
    `Expected artifacts: ${role.deliverables.join("; ")}`,
    `Quality bar: ${role.qualityBar.join("; ")}`,
    task.dependsOn.length ? `Dependencies: ${task.dependsOn.join(", ")}` : "Dependencies: none",
    context.completedAgents?.length
      ? `Completed handoffs:\n${context.completedAgents.map((agent) => `- ${agent.agent}: ${agent.summary}`).join("\n")}`
      : "Completed handoffs: none"
  ].join("\n");
}

function normalizeWorkerText(provider: WorkerProvider, task: EngineTask, context: AgentJobContext, text: string, raw: unknown): AgentJobResult {
  const role = getAgentRole(task.agent);
  const fallbackContext = {
    projectName: "Project",
    idea: "Generated app",
    customer: "target customers",
    problem: "the core workflow",
    appType: "app",
    recommendedTarget: "Next.js + Neon",
    templates: []
  };
  const cleanText = text.trim() || summarizeLocalTask(role, task, fallbackContext);
  const recommendations = extractSectionLines(cleanText, "Recommendations").slice(0, 5);
  const artifacts = extractSectionLines(cleanText, "Artifacts").slice(0, 5);
  const handoffs = extractSectionLines(cleanText, "Handoffs").slice(0, 5);

  return {
    provider,
    agent: task.agent,
    phase: role.phase,
    task: task.title,
    status: "completed",
    summary: firstNonEmptyLine(cleanText),
    recommendations: recommendations.length ? recommendations : buildLocalRecommendations(role, context),
    artifacts: artifacts.length ? artifacts : buildLocalArtifacts(role, task, context),
    structuredArtifacts: buildLocalStructuredArtifacts(role, task, context),
    handoffs: handoffs.length ? handoffs : buildLocalHandoffs(role),
    qualityChecks: role.qualityBar,
    raw
  };
}

function buildFailedResult(provider: WorkerProvider, task: EngineTask, message: string, raw: unknown): AgentJobResult {
  const role = getAgentRole(task.agent);

  return {
    provider,
    agent: task.agent,
    phase: role.phase,
    task: task.title,
    status: "failed",
    summary: message,
    recommendations: ["Retry the worker task after checking provider credentials, model access, and rate limits."],
    artifacts: [],
    structuredArtifacts: [],
    handoffs: [],
    qualityChecks: role.qualityBar,
    raw
  };
}

function extractOpenAiText(payload: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }) {
  if (payload.output_text) return payload.output_text;

  return (
    payload.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text || "")
      .filter(Boolean)
      .join("\n") || ""
  );
}

function extractAnthropicText(payload: { content?: Array<{ type?: string; text?: string }> }) {
  return payload.content?.map((content) => content.text || "").filter(Boolean).join("\n") || "";
}

function firstNonEmptyLine(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find(Boolean) || "Worker completed the assigned task.";
}

function extractSectionLines(text: string, heading: string) {
  const lines = text.split("\n");
  const headingIndex = lines.findIndex((line) => line.toLowerCase().includes(heading.toLowerCase()));

  if (headingIndex === -1) {
    return [];
  }

  const sectionLines = [];

  for (const line of lines.slice(headingIndex + 1)) {
    if (/^[#*_\s-]*(summary|recommendations|artifacts|handoffs)\b/i.test(line) && sectionLines.length) {
      break;
    }

    const cleanLine = line.replace(/^[-*\d.\s]+/, "").trim();

    if (cleanLine) {
      sectionLines.push(cleanLine);
    }
  }

  return sectionLines;
}

function summarizeLocalTask(role: AgentRole, task: EngineTask, context: AgentJobContext) {
  const priorCount = context.completedAgents?.length || 0;
  const priorNote = priorCount ? ` using ${priorCount} prior agent handoff${priorCount === 1 ? "" : "s"}` : "";

  return `${role.name} completed "${task.title}" for ${context.projectName}${priorNote}, focused on ${context.customer} solving ${context.problem}.`;
}

function buildLocalRecommendations(role: AgentRole, context: AgentJobContext) {
  const common = `Keep the ${context.appType} scoped to ${context.customer} and the paid outcome.`;
  const templates = context.templates.length ? context.templates.join(", ") : "auth, customer account, admin console, onboarding, dashboard";
  const recommendations: Record<string, string[]> = {
    product: [
      common,
      `Make the first release prove that ${context.customer} will pay to solve ${context.problem}.`,
      "Write acceptance criteria before generated files are marked ready."
    ],
    business: [
      "Define the first paid tier, usage limit, upgrade trigger, and retention metric.",
      "Use onboarding to capture the customer goal that proves value later.",
      common
    ],
    architecture: [
      `Use ${context.recommendedTarget} as the default deployment boundary.`,
      "Keep long-running or provider-heavy work behind worker adapters.",
      "Store every generated artifact so QA and deployment can trace what changed."
    ],
    template: [
      `Start from ${templates} modules.`,
      "Treat template selections as project artifacts so future generated apps can reuse them.",
      "Add a new reusable template only when at least two app ideas need the same foundation."
    ],
    database: [
      "Create organization-owned tables first, then customer workflow tables.",
      "Add indexes for dashboard lists, account lookups, run history, and audit timelines.",
      "Make generated schema and seed setup repeatable for Neon branches."
    ],
    auth: [
      "Require customer, admin, and owner checks on both page access and mutating API routes.",
      "Keep local mode open for development, then enforce Auth.js sessions when production env is configured.",
      "Audit owner/admin actions that affect customers, billing, generated apps, or deployments."
    ],
    design: [
      "Design customer and admin workflows as daily-use surfaces, not a marketing page.",
      "Give every workflow empty, loading, success, warning, and blocked states.",
      "Use dense but readable layouts for project history, QA findings, and account management."
    ],
    frontend: [
      "Ship customer account, admin console, run history, generated app, database setup, and launch readiness views first.",
      "Keep primary actions disabled until their prerequisites exist.",
      "Verify responsive layouts after generated app files are created."
    ],
    backend: [
      "Expose narrow APIs for planning, projects, agent runs, QA, exports, database setup, readiness, and deployment.",
      "Persist failed provider calls as actionable blockers instead of losing them in logs.",
      "Validate every mutation with schemas and enforce admin/customer access server side."
    ],
    qa: [
      "Run typecheck, build, API, auth, persistence, generated app, browser, and deployment smoke checks.",
      "Create fixer tasks from failed checks with evidence and reproduction steps.",
      "Do not let deployment pass until generated app output and database setup are both verified."
    ],
    fixer: [
      "Patch the smallest surface that resolves the QA finding.",
      "Rerun the exact failed check before broad verification.",
      "Record the fix and remaining risk in the run report."
    ],
    deployment: [
      "Require env, migration, generated database, build, and smoke-test gates before production promotion.",
      "Keep deployment credentials out of artifacts and logs.",
      "Store release notes with the deployment record."
    ]
  };

  return recommendations[role.slug] || [common];
}

function buildLocalArtifacts(role: AgentRole, task: EngineTask, context: AgentJobContext) {
  const artifacts: Record<string, string[]> = {
    product: [
      `Customer/problem brief: ${context.customer} needs a finished ${context.appType} that removes this blocker: ${context.problem}.`,
      "MVP boundary: sign-in, account workspace, primary workflow, admin management, run history, QA status, and support path.",
      `Acceptance focus: ${task.acceptanceCriteria.join("; ")}.`
    ],
    business: [
      "Pricing hypothesis: start with a subscription tied to active projects, generated app outputs, or usage volume.",
      "Activation path: customer signs in, completes setup, creates the first useful run, and sees launch blockers disappear.",
      "Expansion levers: more seats, more generated apps, deeper automation, premium support, and deployment management."
    ],
    architecture: [
      `System map: ${context.recommendedTarget} with Next.js routes, Neon persistence, Auth.js sessions, and worker adapters.`,
      "Service boundaries: planner, template selection, agent runs, generated app export, database setup, QA, readiness, and deployment.",
      "Async boundary: queue or external worker for long model runs, code generation, browser verification, and deployment execution."
    ],
    template: [
      `Selected modules: ${context.templates.join(", ") || "Authentication + Roles, Customer Account Portal, Admin Console, Guided Onboarding, Operational Dashboard"}.`,
      "Template contract: each module must declare routes, tables, roles, UI states, API needs, and QA checks.",
      "Reuse backlog: payments, notifications, AI run history, marketplace core, support, and audit reporting."
    ],
    database: [
      "Entity model: organizations, users, memberships, projects, templates, tasks, agent runs, artifacts, QA checks, deployments, audit events.",
      "Generated app model: customer accounts, workflow records, status history, notifications, billing or usage events, and admin notes.",
      "Migration plan: engine schema first, selected generated schema second, seed data last."
    ],
    auth: [
      "Role matrix: owner can administer the engine, admin can manage projects and customers, customer can access only their account/workflows.",
      "Protected routes: /account, /admin, /builder, /api/customer/*, /api/admin/*, and mutating engine routes.",
      "Session rule: local mode can bypass admin checks for development, production mode requires Auth.js and an owner email."
    ],
    design: [
      "Workflow map: intake, plan, save project, run agents, generate app, setup database, run QA, prepare deployment, launch readiness.",
      "Screen inventory: builder cockpit, customer account, admin console, project detail, run history, QA findings, deployment gate.",
      "State checklist: empty project, blocked env, local mode, running, completed, failed, retryable, and ready."
    ],
    frontend: [
      "UI surfaces: planner form, health/setup panels, agent bench, task graph, generated app preview, database setup, readiness, latest run.",
      "Interaction contract: actions stay available in the right order and show current status, blocker, and next step.",
      "Responsive note: dense operational panels collapse to one column on small screens."
    ],
    backend: [
      "API contract: analyze, projects, agents, runs, exports, database setup, readiness, autopilot, deployments, setup profile, health.",
      "Persistence contract: each run stores agent output, artifacts, QA findings, readiness changes, deployment blockers, and audit events.",
      "Provider contract: local worker runs without keys; OpenAI or Anthropic workers activate from env vars."
    ],
    qa: [
      "Acceptance suite: customer/problem, auth/roles, persistence, primary workflow, responsive UI, generated app, generated database, deployment.",
      "Evidence plan: typecheck/build output, API responses, browser screenshot, console logs, stored run report, and readiness score.",
      "Fixer queue: every failed check must include severity, details, reproduction path, and expected pass condition."
    ],
    fixer: [
      "Repair queue: sort findings by launch blocker, high severity, shared surface, then polish.",
      "Patch note format: changed files, behavior fixed, verification rerun, and remaining risk.",
      "Rerun list: typecheck, build, relevant API route, browser flow, and readiness check."
    ],
    deployment: [
      "Deployment gate: env vars, generated app database, typecheck, build, migrations, Vercel project link, preview smoke test.",
      "Command sequence: npm run typecheck, npm run build, npm run db:setup, vercel pull, vercel build, vercel deploy.",
      "Release record: preview URL, commit SHA, readiness score, blockers cleared, and post-deploy smoke checks."
    ]
  };

  return artifacts[role.slug] || [`${role.name} artifact: ${task.description}`];
}

function buildLocalHandoffs(role: AgentRole) {
  if (!role.handoffTo.length) {
    return ["No downstream agent handoff remains after release preparation."];
  }

  return role.handoffTo.map((target) => `Hand off ${role.deliverables.join(", ")} to ${target}.`);
}
