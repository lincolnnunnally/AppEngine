import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const manifest = parseAgentManifest(fs.readFileSync(path.join(repoRoot, "agents/manifest.yaml"), "utf8"));
const modeAliases = new Map([
  ["customer-perspective", "customer_perspective"],
  ["workflow-tester", "workflow_tester"],
  ["code-reviewer", "code_reviewer"],
  ["reviewer", "code_reviewer"],
  ["review", "code_reviewer"]
]);

const dispatchMode = normalizeMode(process.env.DISPATCH_MODE || "");
const labelName = process.env.LABEL_NAME || "";
const issueLabels = parseIssueLabels(process.env.ISSUE_LABELS_JSON || "[]");
const selectedLabel = selectTriggerLabel(labelName, issueLabels, manifest);
const workflow = selectedLabel ? manifest.labelWorkflows[selectedLabel] || [] : [];
const mode = dispatchMode || selectPrimaryAgent(workflow) || "planner";
const output = process.env.GITHUB_OUTPUT;

if (!dispatchMode && !selectedLabel) {
  console.error("No supported ai:* label found on issue.");
  process.exit(1);
}

writeOutput("mode", normalizeMode(mode));
writeOutput("issue_number", process.env.ISSUE_NUMBER || "");
writeOutput("trigger_label", selectedLabel);
writeOutput("workflow_agents", workflow.join(","));
console.log(`Selected ${normalizeMode(mode)} for ${selectedLabel || "manual dispatch"}.`);

function selectTriggerLabel(eventLabel, labels, parsedManifest) {
  if (eventLabel && parsedManifest.labelWorkflows[eventLabel]) return eventLabel;

  const labelSet = new Set(labels);
  return Object.keys(parsedManifest.labelWorkflows).find((label) => labelSet.has(label)) || "";
}

function selectPrimaryAgent(workflowAgents) {
  const withoutContextGate = workflowAgents.filter((agent) => agent !== "context_gate");
  return withoutContextGate[withoutContextGate.length - 1] || workflowAgents[workflowAgents.length - 1] || "";
}

function normalizeMode(mode) {
  return modeAliases.get(mode) || mode.replace(/-/g, "_");
}

function parseIssueLabels(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((label) => typeof label === "string") : [];
  } catch {
    return [];
  }
}

function writeOutput(key, value) {
  if (!output) {
    console.log(`${key}=${value}`);
    return;
  }

  fs.appendFileSync(output, `${key}=${value}\n`);
}

function parseAgentManifest(source) {
  const parsedManifest = {
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

    if (section !== "label_workflows") continue;

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

  return parsedManifest;
}
