import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-handoff-relay-"));

runStep("source standard and UI route are discoverable", () => {
  assertFileIncludes("source-of-truth/handoff-relay-reducer.md", ["handoff_relay_summary", "noAutomaticCodexExecution"]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/handoff-relay-reducer.md", "handoff_relay_summary"]);
  assertFileIncludes("agents/context/output-contracts.md", ["handoff_relay_summary"]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["handoff_relay_summary"]);
  assertFileIncludes("src/app/owner-control-center/page.tsx", ["HandoffRelayControlCenter"]);
  assertFileIncludes("src/components/engine/handoff-relay-control-center.tsx", ["data-testid=\"handoff-relay-reducer\"", "Copy Prompt"]);
});

runStep("handoff summary extracts PR state and prompt", () => {
  const inputPath = path.join(smokeRoot, "handoff.txt");
  const outputPath = path.join(smokeRoot, "handoff-summary.json");
  const markdownPath = path.join(smokeRoot, "handoff-summary.md");

  fs.writeFileSync(
    inputPath,
    [
      "PR #93 looks right and is mergeable.",
      "Branch: codex/design-intent-engine",
      "Verification: source:check passed, typecheck passed, build passed.",
      "What changed: added the Design Intent Engine foundation.",
      "Guardrails: no production deploy, no paid resources, no migrations, no secrets/env changes.",
      "Next action: merge PR #93, then continue with Handoff Relay Reducer."
    ].join("\n")
  );

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-handoff-relay-summary.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HANDOFF_RELAY_INPUT: inputPath,
      HANDOFF_RELAY_OUTPUT: outputPath,
      HANDOFF_RELAY_MARKDOWN_OUTPUT: markdownPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const summary = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const markdown = fs.readFileSync(markdownPath, "utf8");

  assertEqual(summary.kind, "handoff_relay_summary", "artifact kind");
  assertEqual(summary.extracted.prNumber, 93, "PR number");
  assertEqual(summary.extracted.branch, "codex/design-intent-engine", "branch");
  assertEqual(summary.extracted.mergeStatus, "mergeable", "merge status");
  assertArrayIncludes(summary.extracted.guardrailsPreserved, "Guardrails: no production deploy, no paid resources, no migrations, no secrets/env changes.", "guardrails");
  assertIncludes(summary.nextPrompt.prompt, "Do not trigger Codex automatically", "prompt guardrail");
  assertEqual(summary.guardrails.noGitHubIssueCreation, true, "no issue creation guardrail");
  assertIncludes(markdown, "Handoff Relay Summary", "markdown summary");
});

runStep("missing handoff text fails honestly", () => {
  const inputPath = path.join(smokeRoot, "empty.txt");
  const outputPath = path.join(smokeRoot, "empty-summary.json");
  fs.writeFileSync(inputPath, "short");

  assertThrows(() => {
    execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-handoff-relay-summary.js")], {
      cwd: repoRoot,
      env: {
        ...process.env,
        HANDOFF_RELAY_INPUT: inputPath,
        HANDOFF_RELAY_OUTPUT: outputPath
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  }, "needs pasted handoff text");
});

console.log(`handoff-relay-reducer smoke ok (${smokeRoot})`);

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

function assertArrayIncludes(values, expected, message) {
  if (!Array.isArray(values) || !values.includes(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(values)} to include ${JSON.stringify(expected)}`);
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
