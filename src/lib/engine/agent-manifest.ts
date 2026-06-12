import { readFileSync } from "node:fs";
import { join } from "node:path";

export type ManifestAgent = {
  id: string;
  name: string;
  prompt: string;
  purpose: string;
  runsOn: string[];
  outputs: string[];
};

export type AgentManifest = {
  version: number;
  name: string;
  purpose: string;
  operatingPrinciples: string[];
  sharedContextFiles: string[];
  agents: ManifestAgent[];
  recommendedFlow: Record<string, string[]>;
  labels: Record<string, string>;
  labelWorkflows: Record<string, string[]>;
};

export type SharedAgentContext = {
  fileName: string;
  path: string;
  content: string;
};

const agentsDir = join(process.cwd(), "agents");
const manifestPath = join(agentsDir, "manifest.yaml");

export function loadAgentManifest(): AgentManifest {
  return parseAgentManifest(readFileSync(manifestPath, "utf8"));
}

export function getManifestAgent(agentId: string, manifest = loadAgentManifest()) {
  return manifest.agents.find((agent) => agent.id === agentId) || null;
}

export function getAgentsForTrigger(triggerLabel: string, manifest = loadAgentManifest()) {
  const workflow = manifest.labelWorkflows[triggerLabel];

  if (workflow?.length) {
    return workflow.map((agentId) => getManifestAgent(agentId, manifest)).filter((agent): agent is ManifestAgent => Boolean(agent));
  }

  const eventName = labelToRunEvent(triggerLabel);
  return manifest.agents.filter((agent) => agent.runsOn.includes(eventName));
}

export function getDefaultWorkflow(manifest = loadAgentManifest()) {
  const [firstFlow] = Object.values(manifest.recommendedFlow);
  const ids = firstFlow?.length ? firstFlow : manifest.agents.map((agent) => agent.id);

  return ids.map((agentId) => getManifestAgent(agentId, manifest)).filter((agent): agent is ManifestAgent => Boolean(agent));
}

export function loadAgentPrompt(agent: ManifestAgent) {
  return readFileSync(resolveAgentFilePath(agent.prompt), "utf8").trim();
}

export function loadSharedAgentContext(manifest = loadAgentManifest()): SharedAgentContext[] {
  return manifest.sharedContextFiles
    .map((contextPath) => ({
      fileName: contextPath.split("/").pop() || contextPath,
      path: contextPath,
      content: readFileSync(resolveAgentFilePath(contextPath), "utf8").trim()
    }))
    .filter((context) => context.content.length > 0);
}

export function parseAgentManifest(source: string): AgentManifest {
  const manifest: AgentManifest = {
    version: 1,
    name: "",
    purpose: "",
    operatingPrinciples: [],
    sharedContextFiles: [],
    agents: [],
    recommendedFlow: {},
    labels: {},
    labelWorkflows: {}
  };

  let section = "";
  let currentAgent: Partial<ManifestAgent> | null = null;
  let currentAgentListKey: "runsOn" | "outputs" | null = null;
  let currentFlowKey = "";
  let currentBlock: "purpose" | "" = "";

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, "");
    if (!line.trim()) {
      currentBlock = "";
      continue;
    }

    if (currentBlock === "purpose" && line.startsWith("  ")) {
      manifest.purpose = [manifest.purpose, line.trim()].filter(Boolean).join(" ");
      continue;
    }

    const topLevelMatch = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (topLevelMatch) {
      section = topLevelMatch[1];
      currentAgent = null;
      currentAgentListKey = null;
      currentFlowKey = "";
      const value = topLevelMatch[2].trim();

      if (section === "version") manifest.version = Number.parseInt(value, 10) || 1;
      if (section === "name") manifest.name = parseScalar(value);
      if (section === "purpose" && value === ">") currentBlock = "purpose";
      if (section === "purpose" && value !== ">") manifest.purpose = parseScalar(value);
      continue;
    }

    if (section === "operating_principles") {
      const item = parseListItem(line, 2);
      if (item) manifest.operatingPrinciples.push(item);
      continue;
    }

    if (section === "shared_context_files") {
      const item = parseListItem(line, 2);
      if (item) manifest.sharedContextFiles.push(item);
      continue;
    }

    if (section === "agents") {
      const agentMatch = line.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
      if (agentMatch) {
        currentAgent = {
          id: agentMatch[1],
          name: titleizeAgentId(agentMatch[1]),
          prompt: "",
          purpose: "",
          runsOn: [],
          outputs: []
        };
        manifest.agents.push(currentAgent as ManifestAgent);
        currentAgentListKey = null;
        continue;
      }

      if (!currentAgent) continue;

      const propertyMatch = line.match(/^    ([a-zA-Z_]+):\s*(.*)$/);
      if (propertyMatch) {
        const property = propertyMatch[1];
        const value = propertyMatch[2].trim();

        if (property === "prompt") currentAgent.prompt = parseScalar(value);
        if (property === "purpose") currentAgent.purpose = parseScalar(value);
        if (property === "runs_on") {
          currentAgent.runsOn = [];
          currentAgentListKey = "runsOn";
        }
        if (property === "outputs") {
          currentAgent.outputs = [];
          currentAgentListKey = "outputs";
        }
        continue;
      }

      const item = parseListItem(line, 6);
      if (item && currentAgentListKey) {
        currentAgent[currentAgentListKey] = [...(currentAgent[currentAgentListKey] || []), item];
      }
      continue;
    }

    if (section === "recommended_flow" || section === "label_workflows") {
      const flowMatch = line.match(/^  (.+):\s*$/);
      if (flowMatch) {
        currentFlowKey = parseScalar(flowMatch[1]);
        const target = section === "recommended_flow" ? manifest.recommendedFlow : manifest.labelWorkflows;
        target[currentFlowKey] = [];
        continue;
      }

      const item = parseListItem(line, 4);
      if (item && currentFlowKey) {
        const target = section === "recommended_flow" ? manifest.recommendedFlow : manifest.labelWorkflows;
        target[currentFlowKey].push(item);
      }
      continue;
    }

    if (section === "labels") {
      const labelMatch = line.match(/^  (ai:[^:]+):\s*(.+)$/);
      if (labelMatch) manifest.labels[labelMatch[1]] = parseScalar(labelMatch[2]);
    }
  }

  return manifest;
}

function labelToRunEvent(label: string) {
  return `issue_labeled_${label.replace("ai:", "ai_").replace(/-/g, "_")}`;
}

function parseListItem(line: string, indent: number) {
  const match = line.match(new RegExp(`^ {${indent}}-\\s*(.+)$`));
  return match ? parseScalar(match[1]) : "";
}

function parseScalar(value: string) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function titleizeAgentId(agentId: string) {
  return agentId
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveAgentFilePath(filePath: string) {
  return join(agentsDir, filePath.replace(/^agents\//, ""));
}
