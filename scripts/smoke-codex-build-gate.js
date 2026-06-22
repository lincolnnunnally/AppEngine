import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { evaluateBuildPromptGate, hasGatePacketReference, hasPriorWorkApproval } from "./lib/gate-evidence.js";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-codex-build-gate-"));

const validGateBody = [
  "## Gate Packet",
  'kind: "problem_intake_gate"  id: intake-2026-06-21-churchconnect-abc123',
  "",
  "## Prior-Work Check",
  "verdict: build_new",
  "passed: true"
].join("\n");

runStep("evidence helpers detect gate packet + passed prior-work", () => {
  assertTrue(hasGatePacketReference(validGateBody), "gate packet reference detected");
  assertTrue(hasPriorWorkApproval(validGateBody), "passed prior-work detected");
  assertTrue(!hasGatePacketReference("just an idea, build it"), "no false gate reference");
  assertTrue(!hasPriorWorkApproval("prior_work_check: not run"), "unpassed prior-work rejected");
});

runStep("builder mode requires gate evidence; other modes do not", () => {
  assertEqual(evaluateBuildPromptGate({ mode: "builder", taskBody: "build me an app" }).allowed, false, "ungated builder blocked");
  assertEqual(evaluateBuildPromptGate({ mode: "builder", taskBody: validGateBody }).allowed, true, "gated builder allowed");
  assertEqual(evaluateBuildPromptGate({ mode: "planner", taskBody: "build me an app" }).allowed, true, "planner allowed without gate");
});

runStep("ai:build prompt generation fails closed without a gate packet", () => {
  const out = path.join(smokeRoot, "ungated-build-prompt.md");
  assertThrows(
    () => runMakePrompt({ AGENT_MODE: "builder", TASK_BODY: "Build a new visitor capture app.", PROMPT_OUTPUT: out }),
    "Codex build prompt blocked"
  );
  assertTrue(!fs.existsSync(out), "no build prompt written when ungated");
});

runStep("ai:build prompt generation succeeds with a valid gate packet", () => {
  const out = path.join(smokeRoot, "gated-build-prompt.md");
  runMakePrompt({ AGENT_MODE: "builder", TASK_BODY: validGateBody, PROMPT_OUTPUT: out });
  assertTrue(fs.existsSync(out), "build prompt written when gated");
});

runStep("ai:plan prompt generation does not require a gate packet", () => {
  const out = path.join(smokeRoot, "plan-prompt.md");
  runMakePrompt({ AGENT_MODE: "planner", TASK_BODY: "Clarify a new idea.", PROMPT_OUTPUT: out });
  assertTrue(fs.existsSync(out), "plan prompt written without gate");
});

console.log(`codex-build-gate smoke ok (${smokeRoot})`);

function runMakePrompt(env) {
  execFileSync(process.execPath, [path.join(repoRoot, "scripts/make-codex-prompt.js")], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
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

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, label) {
  if (!value) throw new Error(`expected: ${label}`);
}

function assertThrows(fn, expectedMessage) {
  try {
    fn();
  } catch (caught) {
    if (!String(caught.message).includes(expectedMessage)) {
      throw new Error(`Expected error to include "${expectedMessage}", received "${caught.message}"`);
    }
    return;
  }
  throw new Error(`Expected function to throw including "${expectedMessage}"`);
}
