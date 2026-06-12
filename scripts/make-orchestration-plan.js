import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const manifest = parseAgentManifest(fs.readFileSync(path.join(repoRoot, "agents/manifest.yaml"), "utf8"));
const outputPath = path.resolve(repoRoot, process.env.PLAN_OUTPUT || "orchestration-plan.json");
const triggerLabel = process.env.TRIGGER_LABEL || process.env.GITHUB_LABEL || "";
const workflowAgents = triggerLabel ? manifest.labelWorkflows[triggerLabel] || [] : [];
const issueLabels = parseJsonArray(process.env.ISSUE_LABELS_JSON || "[]");
const now = new Date().toISOString();

const plan = {
  createdAt: now,
  source: {
    issueNumber: process.env.TASK_NUMBER || "",
    issueTitle: process.env.TASK_TITLE || "",
    issueUrl: process.env.TASK_URL || "",
    labels: issueLabels,
    triggerLabel,
    eventName: process.env.GITHUB_EVENT_NAME || ""
  },
  sourceOfTruth: {
    manifest: "agents/manifest.yaml",
    sharedContextFiles: manifest.sharedContextFiles,
    appCharter: "source-of-truth/charters/appengine.md",
    contextGateRequired: workflowAgents.includes("context_gate")
  },
  workflow: {
    primaryAgent: process.env.AGENT_MODE || selectPrimaryAgent(workflowAgents),
    agents: workflowAgents,
    outputLocation: "GitHub Actions artifact: agent-run",
    followUpPolicy: "Create GitHub issues from agent followUpTasks when structured output is present."
  },
  safety: {
    productionDeployAllowed: false,
    secretsAllowedInOutput: false,
    requiresPullRequest: true
  }
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`);
console.log(`Wrote orchestration plan to ${outputPath}`);

function selectPrimaryAgent(workflow) {
  const withoutContextGate = workflow.filter((agent) => agent !== "context_gate");
  return withoutContextGate[withoutContextGate.length - 1] || workflow[workflow.length - 1] || "";
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseAgentManifest(source) {
  const parsedManifest = {
    sharedContextFiles: [],
    labelWorkflows: {}
  };
  let section = "";
  let currentFlowKey = "";

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;

    const topLevelMatch = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (topLevelMatch) {
      section = topLevelMatch[1];
      currentFlowKey = "";
      continue;
    }

    if (section === "shared_context_files") {
      const itemMatch = line.match(/^  -\s*(.+)$/);
      if (itemMatch) parsedManifest.sharedContextFiles.push(itemMatch[1].trim());
      continue;
    }

    if (section === "label_workflows") {
      const flowMatch = line.match(/^  (.+):\s*$/);
      if (flowMatch) {
        currentFlowKey = flowMatch[1].trim();
        parsedManifest.labelWorkflows[currentFlowKey] = [];
        continue;
      }

      const itemMatch = line.match(/^    -\s*(.+)$/);
      if (itemMatch && currentFlowKey) {
        parsedManifest.labelWorkflows[currentFlowKey].push(itemMatch[1].trim());
      }
    }
  }

  return parsedManifest;
}
