import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const manifest = parseAgentManifest(fs.readFileSync(path.join(repoRoot, "agents/manifest.yaml"), "utf8"));
const eventName = process.env.GITHUB_EVENT_NAME || "";
const eventAction = process.env.GITHUB_EVENT_ACTION || "";
const dispatchMode = process.env.DISPATCH_MODE || "";
const labelName = process.env.LABEL_NAME || "";
const issueLabels = parseJsonArray(process.env.ISSUE_LABELS_JSON || "[]");
const issueCreatedAt = process.env.ISSUE_CREATED_AT || "";
const dedupeWindowSeconds = parsePositiveInteger(process.env.DEDUPE_WINDOW_SECONDS, 120);
const selectedLabel = selectTriggerLabel(labelName, issueLabels, manifest);
const now = parseDate(process.env.PROMPT_FACTORY_NOW) || new Date();
const issueCreatedDate = parseDate(issueCreatedAt);
const issueAgeSeconds = issueCreatedDate ? Math.max(0, Math.floor((now.getTime() - issueCreatedDate.getTime()) / 1000)) : null;
const decision = decideRun({
  dedupeWindowSeconds,
  dispatchMode,
  eventAction,
  eventName,
  issueAgeSeconds,
  labelName,
  selectedLabel
});

writeOutput("should_run", String(decision.shouldRun));
writeOutput("skip_reason", decision.skipReason);
writeOutput("trigger_label", selectedLabel);
writeOutput("canonical_event_action", decision.canonicalEventAction || eventAction || "manual");
writeOutput("issue_age_seconds", issueAgeSeconds === null ? "" : String(issueAgeSeconds));

if (decision.shouldRun) {
  console.log(`prompt factory gate: run ${selectedLabel || dispatchMode || "manual"} via ${decision.canonicalEventAction || eventAction || "manual"}`);
} else {
  console.log(`prompt factory gate: skip (${decision.skipReason})`);
}

function decideRun(input) {
  if (input.eventName === "workflow_dispatch" || input.dispatchMode) {
    return {
      shouldRun: true,
      skipReason: "",
      canonicalEventAction: "workflow_dispatch"
    };
  }

  if (input.eventName !== "issues") {
    return {
      shouldRun: false,
      skipReason: "unsupported event"
    };
  }

  if (!input.selectedLabel) {
    return {
      shouldRun: false,
      skipReason: "no supported ai label"
    };
  }

  if (input.eventAction === "opened") {
    return {
      shouldRun: true,
      skipReason: "",
      canonicalEventAction: "opened"
    };
  }

  if (input.eventAction === "labeled") {
    if (!input.labelName || input.labelName !== input.selectedLabel) {
      return {
        shouldRun: false,
        skipReason: "labeled event did not add the selected ai label"
      };
    }

    if (typeof input.issueAgeSeconds === "number" && input.issueAgeSeconds <= input.dedupeWindowSeconds) {
      return {
        shouldRun: false,
        skipReason: "opened event is canonical for newly created ai-labeled issue",
        canonicalEventAction: "opened"
      };
    }

    return {
      shouldRun: true,
      skipReason: "",
      canonicalEventAction: "labeled"
    };
  }

  if (input.eventAction === "edited" || input.eventAction === "reopened") {
    return {
      shouldRun: true,
      skipReason: "",
      canonicalEventAction: input.eventAction
    };
  }

  return {
    shouldRun: false,
    skipReason: `unsupported issue action: ${input.eventAction || "unknown"}`
  };
}

function selectTriggerLabel(eventLabel, labels, parsedManifest) {
  if (eventLabel && parsedManifest.labelWorkflows[eventLabel]) return eventLabel;

  const labelSet = new Set(labels);
  return Object.keys(parsedManifest.labelWorkflows).find((label) => labelSet.has(label)) || "";
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

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function writeOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) {
    console.log(`${key}=${value}`);
    return;
  }

  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${String(value).replace(/\r?\n/g, " ")}\n`);
}
