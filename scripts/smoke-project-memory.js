import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-project-memory-"));

runStep("project memory source and UI are discoverable", () => {
  assertFileIncludes("source-of-truth/project-memory-engine.md", ["project_memory", "Project Memory Engine"]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/project-memory-engine.md", "project_memory"]);
  assertFileIncludes("agents/context/output-contracts.md", ["project_memory"]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["project_memory"]);
  assertFileIncludes("src/lib/engine/project-memory.ts", ["updateProjectMemoryFromHandoff", "addProjectMemoryFeedback"]);
  assertFileIncludes("src/components/engine/handoff-relay-control-center.tsx", ["data-testid=\"project-memory-engine\"", "Save Project Memory"]);
  assertFileIncludes("src/app/api/engine/project-memory/feedback/route.ts", ["addProjectMemoryFeedback"]);
});

runStep("handoff summary updates project memory", () => {
  const handoffInput = path.join(smokeRoot, "handoff.txt");
  const handoffOutput = path.join(smokeRoot, "handoff-summary.json");
  const memoryOutput = path.join(smokeRoot, "project-memory.json");

  fs.writeFileSync(
    handoffInput,
    [
      "PR #94 merged: Handoff Relay Reducer.",
      "Branch: codex/handoff-relay-reducer",
      "Verification: source:check passed, smoke:handoff-relay passed, typecheck passed, build passed.",
      "What changed: Owner Control Center can summarize handoffs and draft next prompts.",
      "Architecture decision: store handoff summaries in local/mock persistence only.",
      "Design preference: keep the owner view warm, clean, approachable, and mobile friendly.",
      "Blocker: Vercel preview status may still be pending.",
      "Next action: build Project Memory Engine."
    ].join("\n")
  );

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-handoff-relay-summary.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HANDOFF_RELAY_INPUT: handoffInput,
      HANDOFF_RELAY_OUTPUT: handoffOutput
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-project-memory.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PROJECT_MEMORY_HANDOFF: handoffOutput,
      PROJECT_MEMORY_OUTPUT: memoryOutput
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const memory = JSON.parse(fs.readFileSync(memoryOutput, "utf8"));

  assertEqual(memory.kind, "project_memory", "artifact kind");
  assertIncludes(memory.latestProjectState.latestProgress, "PR #94", "latest progress");
  assertArrayTextIncludes(memory.completedMilestones, "Owner Control Center", "completed work memory");
  assertIncludes(memory.latestProjectState.recommendedNextAction, "focused fix", "next action");
  assertArrayTextIncludes(memory.currentBlockers, "Vercel preview", "blocker");
  assertArrayTextIncludes(memory.architectureDecisions, "local/mock persistence", "architecture decision");
  assertArrayTextIncludes(memory.designPreferences, "warm, clean, approachable", "design preference");
  assertEqual(memory.guardrails.noGitHubIssueCreation, true, "no GitHub issue guardrail");
  assertIncludes(memory.summaries.executive, "AppEngine is", "executive summary");
  assertIncludes(memory.summaries.technical, "Architecture", "technical summary");
  assertIncludes(memory.summaries.projectStatus, "Current blocker", "project status summary");
});

runStep("owner feedback becomes memory items", () => {
  const memoryInput = path.join(smokeRoot, "project-memory.json");
  const memoryOutput = path.join(smokeRoot, "project-memory-feedback.json");

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-project-memory.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PROJECT_MEMORY_INPUT: memoryInput,
      PROJECT_MEMORY_FEEDBACK_CHOICES: "important_decision,lesson_learned,keep_doing_this,future_improvement",
      PROJECT_MEMORY_FEEDBACK_NOTE: "Remember that owner-facing summaries reduce Lincoln's middleman role.",
      PROJECT_MEMORY_OUTPUT: memoryOutput
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const memory = JSON.parse(fs.readFileSync(memoryOutput, "utf8"));

  assertArrayTextIncludes(memory.majorDecisions, "middleman role", "important decision feedback");
  assertArrayTextIncludes(memory.lessonsLearned, "middleman role", "lesson feedback");
  assertArrayTextIncludes(memory.acceptedApproaches, "middleman role", "keep doing this feedback");
  assertArrayTextIncludes(memory.futureImprovements, "middleman role", "future improvement feedback");
  assertArrayTextIncludes(memory.ownerFeedback, "middleman role", "owner feedback list");
});

runStep("missing input fails honestly", () => {
  assertThrows(() => {
    execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-project-memory.js")], {
      cwd: repoRoot,
      env: {
        ...process.env,
        PROJECT_MEMORY_OUTPUT: path.join(smokeRoot, "empty.json")
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  }, "needs a handoff summary or owner feedback");
});

console.log(`project-memory smoke ok (${smokeRoot})`);

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function assertFileIncludes(relativePath, expectedValues) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

  for (const expected of expectedValues) {
    assertIncludes(content, expected, `${relativePath} includes ${expected}`);
  }
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

function assertArrayTextIncludes(values, expected, message) {
  if (!Array.isArray(values) || !values.some((entry) => String(entry.text || entry).includes(expected))) {
    throw new Error(`${message}: expected ${JSON.stringify(values)} to include text ${JSON.stringify(expected)}`);
  }
}

function assertThrows(fn, expectedMessage) {
  try {
    fn();
  } catch (caught) {
    const message = caught.stderr ? String(caught.stderr) : caught.message;
    assertIncludes(message, expectedMessage, "expected thrown message");
    return;
  }

  throw new Error(`expected function to throw ${expectedMessage}`);
}
