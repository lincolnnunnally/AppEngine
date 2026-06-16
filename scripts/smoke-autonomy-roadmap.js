import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

runStep("autonomy roadmap artifact includes exact workflow", () => {
  assertFileIncludes("src/lib/engine/orchestrator-autonomy-roadmap.ts", [
    "orchestrator_autonomy_roadmap",
    "intake",
    "memory",
    "orchestrator",
    "action_queue",
    "handoff",
    "execution",
    "result",
    "memory_update"
  ]);
});

runStep("manual handoff points are ranked by automation value", () => {
  assertFileIncludes("src/lib/engine/orchestrator-autonomy-roadmap.ts", [
    "manualHandoffPoints",
    "rankedAutomationValue",
    "copy_prepared_handoff_to_codex",
    "interpret_pr_result",
    "choose_next_queue_action",
    "approve_execution_label_or_dispatch"
  ]);
});

runStep("roadmap preserves owner approval and execution guardrails", () => {
  assertFileIncludes("src/lib/engine/orchestrator-autonomy-roadmap.ts", [
    "planningOnly: true",
    "noAutomaticCodexExecution: true",
    "noGitHubIssueCreation: true",
    "noLabelChanges: true",
    "noProductionDeploy: true"
  ]);
});

runStep("source of truth documents workflow and automation order", () => {
  assertFileIncludes("source-of-truth/orchestrator-autonomous-execution-plan.md", [
    "intake",
    "-> memory",
    "-> orchestrator",
    "-> action queue",
    "-> handoff",
    "-> execution",
    "-> result",
    "-> memory update",
    "reduce Lincoln's copy/paste relay burden"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["smoke:autonomy-roadmap"]);
});

console.log("autonomy-roadmap smoke ok");

function assertFileIncludes(filePath, expected) {
  const source = fs.readFileSync(path.join(root, filePath), "utf8");
  for (const phrase of expected) {
    if (!source.includes(phrase)) {
      throw new Error(`${filePath} missing ${phrase}`);
    }
  }
}

function runStep(label, fn) {
  try {
    fn();
    console.log(`ok - ${label}`);
  } catch (error) {
    console.error(`not ok - ${label}`);
    throw error;
  }
}
