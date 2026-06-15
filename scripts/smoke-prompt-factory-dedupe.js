import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-prompt-dedupe-"));
const now = "2026-06-15T12:00:00.000Z";

runStep("opened with ai:plan label runs once as canonical opened event", () => {
  const result = runGate("opened-ai-plan.env", {
    GITHUB_EVENT_NAME: "issues",
    GITHUB_EVENT_ACTION: "opened",
    ISSUE_LABELS_JSON: JSON.stringify(["ai:plan"]),
    LABEL_NAME: "",
    ISSUE_CREATED_AT: now,
    PROMPT_FACTORY_NOW: now
  });

  assertEqual(result.should_run, "true", "opened ai issue should run");
  assertEqual(result.trigger_label, "ai:plan", "opened ai issue selects ai label");
  assertEqual(result.canonical_event_action, "opened", "opened ai issue is canonical opened action");
});

runStep("immediate labeled echo from phone-created ai issue is skipped", () => {
  const result = runGate("duplicate-labeled.env", {
    GITHUB_EVENT_NAME: "issues",
    GITHUB_EVENT_ACTION: "labeled",
    ISSUE_LABELS_JSON: JSON.stringify(["ai:plan"]),
    LABEL_NAME: "ai:plan",
    ISSUE_CREATED_AT: "2026-06-15T11:59:30.000Z",
    PROMPT_FACTORY_NOW: now,
    DEDUPE_WINDOW_SECONDS: "120"
  });

  assertEqual(result.should_run, "false", "immediate labeled echo should be skipped");
  assertEqual(result.canonical_event_action, "opened", "duplicate points back to opened as canonical action");
  assertIncludes(result.skip_reason, "opened event is canonical", "duplicate skip reason explains opened canonical run");
});

runStep("opened without ai label does not run until an ai label exists", () => {
  const result = runGate("opened-without-ai.env", {
    GITHUB_EVENT_NAME: "issues",
    GITHUB_EVENT_ACTION: "opened",
    ISSUE_LABELS_JSON: JSON.stringify(["bug"]),
    LABEL_NAME: "",
    ISSUE_CREATED_AT: now,
    PROMPT_FACTORY_NOW: now
  });

  assertEqual(result.should_run, "false", "opened non-ai issue should not run");
  assertIncludes(result.skip_reason, "no supported ai label", "opened non-ai skip reason");
});

runStep("manually adding ai label later runs exactly once", () => {
  const result = runGate("manual-label-later.env", {
    GITHUB_EVENT_NAME: "issues",
    GITHUB_EVENT_ACTION: "labeled",
    ISSUE_LABELS_JSON: JSON.stringify(["bug", "ai:plan"]),
    LABEL_NAME: "ai:plan",
    ISSUE_CREATED_AT: "2026-06-15T11:30:00.000Z",
    PROMPT_FACTORY_NOW: now,
    DEDUPE_WINDOW_SECONDS: "120"
  });

  assertEqual(result.should_run, "true", "label added later should run");
  assertEqual(result.canonical_event_action, "labeled", "label added later is canonical labeled action");
});

runStep("edited existing ai issue runs when the issue is still ai-routable", () => {
  const result = runGate("edited-ai.env", {
    GITHUB_EVENT_NAME: "issues",
    GITHUB_EVENT_ACTION: "edited",
    ISSUE_LABELS_JSON: JSON.stringify(["ai:plan"]),
    LABEL_NAME: "",
    ISSUE_CREATED_AT: "2026-06-15T11:30:00.000Z",
    PROMPT_FACTORY_NOW: now
  });

  assertEqual(result.should_run, "true", "edited ai issue should run");
  assertEqual(result.canonical_event_action, "edited", "edited ai issue keeps edited action");
});

runStep("workflow keeps phone-first and owner status behavior", () => {
  const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/ai-prompt-factory.yml"), "utf8");

  assertIncludes(workflow, "id: prompt_gate", "workflow has prompt factory gate step");
  assertIncludes(workflow, "node scripts/should-run-prompt-factory.js", "workflow runs dedupe guard");
  assertIncludes(workflow, "needs.gate.outputs.should_run == 'true'", "Codex job only runs after gate approval");
  assertIncludes(workflow, "Create phone-first preflight record", "phone-first preflight remains in Codex job");
  assertIncludes(workflow, "Persist agent-run summaries", "owner status persistence remains in Codex job");
});

console.log(`prompt-factory dedupe smoke ok (${smokeRoot})`);

function runGate(fileName, env) {
  const outputPath = path.join(smokeRoot, fileName);

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/should-run-prompt-factory.js")], {
    cwd: repoRoot,
    env: { ...process.env, ...env, GITHUB_OUTPUT: outputPath },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return readGithubOutput(outputPath);
}

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function readGithubOutput(filePath) {
  const output = {};

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    output[line.slice(0, separatorIndex)] = line.slice(separatorIndex + 1);
  }

  return output;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(value, expected, message) {
  if (!String(value).includes(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(value)} to include ${JSON.stringify(expected)}`);
  }
}
