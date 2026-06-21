import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { classifyIntake } from "./lib/intake-classify.js";
import { evaluateBuildPromptGate } from "./lib/gate-evidence.js";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-intake-consolidation-"));

runStep("test 1: opportunity_intake creates/references a problem_intake_gate packet", () => {
  assertFileIncludes("src/lib/engine/opportunity-intake.ts", [
    "createProblemIntakeGateRecord",
    "const gatePacketId = gateRecord.id",
    "gatePacketId: record.gatePacketId"
  ]);
});

runStep("test 2: problem_intake_lite references the gate and is marked deprecated", () => {
  assertFileIncludes("src/lib/engine/problem-intake-lite.ts", [
    "createProblemIntakeGateRecord",
    "gatePacketId: gateRecord.id",
    "deprecationNotice",
    "compatibility adapter"
  ]);
});

runStep("test 3: create-intake-packet matches gate request type and next phase", () => {
  const cases = [
    { request: "Fix the broken visitor follow-up status in ChurchConnect.", appName: "ChurchConnect" },
    { request: "Build a brand new app to coordinate volunteer meal deliveries." },
    { request: "People keep falling through the cracks when they ask for help." }
  ];

  for (const testCase of cases) {
    const out = path.join(smokeRoot, `intake-${slug(testCase.request)}.json`);
    runNode("scripts/create-intake-packet.js", {
      INTAKE_REQUEST: testCase.request,
      INTAKE_PACKET_OUTPUT: out,
      ...(testCase.appName ? { APP_NAME: testCase.appName } : {})
    });
    const packet = readJson(out);
    const expected = classifyIntake({ rawRequest: testCase.request, appName: testCase.appName });

    assertTrue(packet.gateClassification, "packet has gateClassification");
    assertEqual(packet.gateClassification.requestType, expected.requestType, `requestType for "${testCase.request}"`);
    assertEqual(packet.gateClassification.nextSafePhase, expected.nextSafePhase, `nextSafePhase for "${testCase.request}"`);
    // Next phase is always a pre-build phase.
    assertTrue(
      ["clarify_problem", "prior_work_check", "solution_candidate_review"].includes(packet.gateClassification.nextSafePhase),
      "next phase is pre-build"
    );
  }
});

runStep("test 3b: classifier contract matches the gate's documented behavior", () => {
  // These expectations mirror src/lib/engine/problem-intake-gate.ts.
  assertEqual(classifyIntake({ rawRequest: "Fix the broken thing", appName: "ChurchConnect" }).requestType, "fix", "fix type");
  assertEqual(classifyIntake({ rawRequest: "Build a new app for X" }).requestType, "app_idea", "app_idea type");
  assertEqual(classifyIntake({ rawRequest: "Add a feature to allow users to export" }).requestType, "feature_request", "feature type");
  assertEqual(classifyIntake({ rawRequest: "Improve the onboarding to be easier" }).requestType, "improvement_request", "improvement type");
  // No problem/person provided -> needs clarification -> clarify_problem (never a build phase).
  assertEqual(classifyIntake({ rawRequest: "Build a new app for X" }).nextSafePhase, "clarify_problem", "minimal intake clarifies first");
  assertEqual(
    classifyIntake({
      rawRequest: "Build a new app for X",
      problemBeingSolved: "Teams cannot coordinate work",
      intendedPerson: "Operations teams"
    }).nextSafePhase,
    "prior_work_check",
    "complete app idea routes to prior_work_check"
  );
});

runStep("test 4: ChatGPT handoff cannot feed ai:build without a gate packet", () => {
  const issueJson = path.join(smokeRoot, "handoff-issue.json");
  const packetJson = path.join(smokeRoot, "handoff-packet.json");
  runNode("scripts/create-chatgpt-handoff-packet.js", {
    HANDOFF_REQUEST_TYPE: "new_app",
    HANDOFF_RAW_REQUEST: "Build a new visitor capture app.",
    CHATGPT_HANDOFF_PACKET_OUTPUT: packetJson,
    CHATGPT_HANDOFF_ISSUE_JSON_OUTPUT: issueJson
  });
  const packet = readJson(packetJson);
  const issue = readJson(issueJson);

  assertEqual(packet.recommendedLabel, "ai:plan", "handoff recommends ai:plan");
  assertTrue(!issue.labels.includes("ai:build"), "handoff never carries ai:build");
  assertTrue(packet.guardrails.gatePacketRequiredBeforeBuild === true, "gate packet required guardrail");
  assertEqual(packet.gatePacket.status, "required_before_build", "gate packet required before build");

  // The handoff issue body (no real gate packet + prior_work_check) must fail the
  // Codex builder gate, so it cannot feed ai:build directly.
  const builderGate = evaluateBuildPromptGate({ mode: "builder", taskBody: issue.body });
  assertEqual(builderGate.allowed, false, "ungated handoff body cannot produce a build prompt");
});

runStep("test 5: one canonical intake store behind the gate", () => {
  // Both alternate front doors write through the canonical gate creator; the
  // problem_intake_gate store is the single source of truth.
  for (const file of ["src/lib/engine/opportunity-intake.ts", "src/lib/engine/problem-intake-lite.ts"]) {
    assertFileIncludes(file, ["createProblemIntakeGateRecord"]);
  }
  assertFileIncludes("src/lib/engine/problem-intake-gate.ts", ['kind: "problem_intake_gate" as const']);
});

console.log(`intake-consolidation smoke ok (${smokeRoot})`);

function runNode(scriptPath, env) {
  return execFileSync(process.execPath, [path.join(repoRoot, scriptPath)], {
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

function assertFileIncludes(relativePath, expectedValues) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  for (const expected of expectedValues) {
    if (!content.includes(expected)) {
      throw new Error(`${relativePath} should include ${JSON.stringify(expected)}`);
    }
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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24);
}
