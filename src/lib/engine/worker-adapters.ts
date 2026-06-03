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
};

export type AgentJobResult = {
  provider: WorkerProvider;
  agent: string;
  task: string;
  status: "completed" | "needs_attention" | "failed";
  summary: string;
  recommendations: string[];
  artifacts: string[];
  raw?: unknown;
};

type WorkerAdapter = {
  provider: WorkerProvider;
  runTask(task: EngineTask, context: AgentJobContext): Promise<AgentJobResult>;
};

export function getWorkerProvider(): WorkerProvider {
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

class LocalWorkerAdapter implements WorkerAdapter {
  provider = "local" as const;

  async runTask(task: EngineTask, context: AgentJobContext): Promise<AgentJobResult> {
    const summary = summarizeLocalTask(task, context);

    return {
      provider: this.provider,
      agent: task.agent,
      task: task.title,
      status: "completed",
      summary,
      recommendations: buildLocalRecommendations(task.agent, context),
      artifacts: [summary]
    };
  }
}

class OpenAiWorkerAdapter implements WorkerAdapter {
  provider = "openai" as const;

  async runTask(task: EngineTask, context: AgentJobContext): Promise<AgentJobResult> {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.1",
        instructions: buildWorkerInstructions(),
        input: buildWorkerPrompt(task, context),
        max_output_tokens: 900
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      return buildFailedResult(this.provider, task, payload?.error?.message || "OpenAI worker request failed", payload);
    }

    return normalizeWorkerText(this.provider, task, extractOpenAiText(payload), payload);
  }
}

class AnthropicWorkerAdapter implements WorkerAdapter {
  provider = "anthropic" as const;

  async runTask(task: EngineTask, context: AgentJobContext): Promise<AgentJobResult> {
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
        system: buildWorkerInstructions(),
        messages: [
          {
            role: "user",
            content: buildWorkerPrompt(task, context)
          }
        ]
      })
    });

    const payload = await response.json();

    if (!response.ok) {
      return buildFailedResult(this.provider, task, payload?.error?.message || "Anthropic worker request failed", payload);
    }

    return normalizeWorkerText(this.provider, task, extractAnthropicText(payload), payload);
  }
}

function buildWorkerInstructions() {
  return [
    "You are one specialist agent inside an automated app-building engine.",
    "Return practical implementation output for your assigned task.",
    "Be specific about product value, technical choices, files, data, QA, and deployment handoffs.",
    "Do not write marketing copy. Do not ask the user questions.",
    "Return short sections: Summary, Recommendations, Artifacts."
  ].join(" ");
}

function buildWorkerPrompt(task: EngineTask, context: AgentJobContext) {
  return [
    `Agent: ${task.agent}`,
    `Task: ${task.title}`,
    `Description: ${task.description}`,
    `Project: ${context.projectName}`,
    `Idea: ${context.idea}`,
    `Customer: ${context.customer}`,
    `Problem: ${context.problem}`,
    `App type: ${context.appType}`,
    `Target stack: ${context.recommendedTarget}`,
    `Templates: ${context.templates.join(", ")}`,
    task.dependsOn.length ? `Dependencies: ${task.dependsOn.join(", ")}` : "Dependencies: none"
  ].join("\n");
}

function normalizeWorkerText(provider: WorkerProvider, task: EngineTask, text: string, raw: unknown): AgentJobResult {
  const cleanText = text.trim() || summarizeLocalTask(task, {
    projectName: "Project",
    idea: "Generated app",
    customer: "target customers",
    problem: "the core workflow",
    appType: "app",
    recommendedTarget: "Next.js + Neon",
    templates: []
  });

  return {
    provider,
    agent: task.agent,
    task: task.title,
    status: "completed",
    summary: firstNonEmptyLine(cleanText),
    recommendations: extractSectionLines(cleanText, "Recommendations").slice(0, 5),
    artifacts: extractSectionLines(cleanText, "Artifacts").slice(0, 5),
    raw
  };
}

function buildFailedResult(provider: WorkerProvider, task: EngineTask, message: string, raw: unknown): AgentJobResult {
  return {
    provider,
    agent: task.agent,
    task: task.title,
    status: "failed",
    summary: message,
    recommendations: ["Retry the worker task after checking provider credentials, model access, and rate limits."],
    artifacts: [],
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
    if (/^[#*_\s-]*(summary|recommendations|artifacts)\b/i.test(line) && sectionLines.length) {
      break;
    }

    const cleanLine = line.replace(/^[-*\d.\s]+/, "").trim();

    if (cleanLine) {
      sectionLines.push(cleanLine);
    }
  }

  return sectionLines;
}

function summarizeLocalTask(task: EngineTask, context: AgentJobContext) {
  return `${task.agent} agent completed "${task.title}" for ${context.projectName}, focused on ${context.customer} solving ${context.problem}.`;
}

function buildLocalRecommendations(agent: string, context: AgentJobContext) {
  const common = `Keep ${context.appType} scoped to ${context.customer} and the paid outcome.`;
  const recommendations: Record<string, string[]> = {
    product: [common, "Convert assumptions into acceptance criteria before implementation."],
    business: ["Define first paid tier, upgrade trigger, and retention metric.", common],
    architecture: [`Use ${context.recommendedTarget} as the default deployment boundary.`, "Keep long-running work behind worker adapters."],
    template: [`Start from ${context.templates.join(", ") || "core"} templates.`, "Track template selections as reusable project artifacts."],
    database: ["Apply migrations before provider-backed runs.", "Persist every task, artifact, QA check, and deployment event."],
    auth: ["Require customer/admin role checks on page and API routes.", "Keep owner/admin access auditable."],
    design: ["Build customer and admin workflows as repeated-use surfaces.", "Verify mobile and desktop states before release."],
    frontend: ["Ship cockpit, customer account, admin console, and run-history views first."],
    backend: ["Expose narrow APIs for planning, runs, QA, artifacts, and deployments."],
    qa: ["Run browser, API, auth, persistence, and deployment smoke checks after every build run."],
    fixer: ["Turn every failed QA check into a concrete repair task."],
    deployment: ["Require env, migration, build, and smoke-test gates before production promotion."]
  };

  return recommendations[agent] || [common];
}
