import { createAgentPromptPackage, type AgentPromptPackage, type PromptFactoryIssue } from "./prompt-factory";
import { getAgentsForTrigger, getDefaultWorkflow, getManifestAgent, loadAgentManifest, type ManifestAgent } from "./agent-manifest";

export type AgentOutputRecord = {
  agent: string;
  status: "completed" | "blocked" | "needs_follow_up";
  summary?: string;
  findings?: Array<{
    title: string;
    details?: string;
    severity?: "low" | "medium" | "high";
    recommendedLabel?: string;
  }>;
  followUpTasks?: Array<{
    title: string;
    body: string;
    recommendedLabel?: string;
  }>;
  handoffTo?: string[];
};

export type AgentExecutionStep = {
  agent: ManifestAgent;
  batch: number;
  dependsOn: string[];
  externalDependencies: string[];
  promptPackage: AgentPromptPackage;
};

export type AgentExecutionPlan = {
  triggerLabel?: string;
  requestedAgent?: string;
  batches: Array<{
    batch: number;
    agents: AgentExecutionStep[];
  }>;
  followUpTasks: Array<{
    title: string;
    body: string;
    recommendedLabel: string;
    sourceAgent: string;
  }>;
};

const defaultFixLabel = "ai:fix";

export function createAgentExecutionPlan(input: {
  triggerLabel?: string;
  requestedAgent?: string;
  issue?: PromptFactoryIssue;
  outputs?: AgentOutputRecord[];
}): AgentExecutionPlan {
  const manifest = loadAgentManifest();
  const selectedAgents = selectAgents(manifest.agents, input.triggerLabel, input.requestedAgent);
  const selectedIds = new Set(selectedAgents.map((agent) => agent.id));
  const remaining = new Map(selectedAgents.map((agent) => [agent.id, agent]));
  const batches: AgentExecutionPlan["batches"] = [];
  let batch = 1;

  while (remaining.size) {
    const readyAgents = [...remaining.values()].filter((agent) => !remainingDependsOnPreviousSelection(agent, selectedIds, remaining));
    const batchAgents = readyAgents.length ? readyAgents : [...remaining.values()];

    const steps = batchAgents.map((agent) => ({
      agent,
      batch,
      dependsOn: getPriorSelectedAgentIds(agent, selectedIds),
      externalDependencies: [],
      promptPackage: createAgentPromptPackage({
        agentType: agent.id,
        triggerLabel: input.triggerLabel,
        issue: input.issue
      })
    }));

    batches.push({
      batch,
      agents: steps
    });

    for (const agent of batchAgents) {
      remaining.delete(agent.id);
    }

    batch += 1;
  }

  return {
    triggerLabel: input.triggerLabel,
    requestedAgent: input.requestedAgent,
    batches,
    followUpTasks: createFollowUpTasks(input.outputs || [])
  };
}

function selectAgents(agents: ManifestAgent[], triggerLabel?: string, requestedAgent?: string) {
  const manifest = loadAgentManifest();

  if (requestedAgent) {
    return collectAgentWithDependencies(requestedAgent, agents);
  }

  if (triggerLabel) {
    const triggeredAgents = getAgentsForTrigger(triggerLabel, manifest);
    if (triggeredAgents.length) return triggeredAgents;
  }

  return getDefaultWorkflow(manifest);
}

function collectAgentWithDependencies(agentId: string, agents: ManifestAgent[]) {
  const selected = new Map<string, ManifestAgent>();

  function visit(id: string) {
    if (selected.has(id)) return;
    const agent = getManifestAgent(id, {
      version: 1,
      name: "",
      purpose: "",
      operatingPrinciples: [],
      sharedContextFiles: [],
      agents,
      recommendedFlow: {},
      labels: {},
      labelWorkflows: {}
    });
    if (!agent) return;

    selected.set(agent.id, agent);
  }

  visit(agentId);
  return [...selected.values()];
}

function remainingDependsOnPreviousSelection(agent: ManifestAgent, selectedIds: Set<string>, remaining: Map<string, ManifestAgent>) {
  return getPriorSelectedAgentIds(agent, selectedIds).some((agentId) => remaining.has(agentId));
}

function getPriorSelectedAgentIds(agent: ManifestAgent, selectedIds: Set<string>) {
  const selectedOrder = [...selectedIds];
  const currentIndex = selectedOrder.indexOf(agent.id);

  if (currentIndex <= 0) return [];
  return selectedOrder.slice(0, currentIndex);
}

function createFollowUpTasks(outputs: AgentOutputRecord[]) {
  return outputs.flatMap((output) => {
    const explicitTasks =
      output.followUpTasks?.map((task) => ({
        title: task.title,
        body: task.body,
        recommendedLabel: task.recommendedLabel || defaultFixLabel,
        sourceAgent: output.agent
      })) || [];

    const findingTasks =
      output.findings?.map((finding) => ({
        title: finding.title,
        body: finding.details || output.summary || "Follow up on this agent finding.",
        recommendedLabel: finding.recommendedLabel || defaultFixLabel,
        sourceAgent: output.agent
      })) || [];

    const blockedTask =
      output.status === "blocked"
        ? [
            {
              title: `${output.agent} is blocked`,
              body: output.summary || "The agent reported a blocker that needs follow-up.",
              recommendedLabel: defaultFixLabel,
              sourceAgent: output.agent
            }
          ]
        : [];

    return [...explicitTasks, ...findingTasks, ...blockedTask];
  });
}
