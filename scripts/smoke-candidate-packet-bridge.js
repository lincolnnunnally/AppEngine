import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-candidate-packet-bridge-"));

runStep("standard is discoverable", () => {
  assertFileIncludes("source-of-truth/candidate-to-packet-bridge.md", [
    "solution_candidate_review",
    "candidate_packet_bridge",
    "app_build_packet_draft",
    "vnext_packet_draft",
    "non_app_solution_plan_draft",
    "noPhaseIssuesCreated",
    "noCodexBuildTriggered"
  ]);

  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/candidate-to-packet-bridge.md", "candidate_packet_bridge"]);
  assertFileIncludes("agents/context/output-contracts.md", ["candidate_packet_bridge"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["candidate_packet_bridge"]);
});

runStep("ready app review creates App Build Packet draft", () => {
  const result = runBridge("app-ready.json", solutionCandidateReview({
    readinessStatus: "ready_for_app_build_packet",
    candidateType: "new_app_candidate",
    candidateName: "Church Care Follow Up"
  }));

  assertEqual(result.kind, "candidate_packet_bridge", "bridge artifact kind");
  assertEqual(result.sourceArtifact.kind, "solution_candidate_review", "source artifact kind");
  assertEqual(result.selectedDraft.kind, "app_build_packet_draft", "selected draft kind");
  assertEqual(result.packetDraft.kind, "app_build_packet_draft", "packet draft kind");
  assertEqual(result.decision.phaseIssuesCreated, false, "phase issues guardrail");
  assertEqual(result.decision.codexBuildTriggered, false, "Codex build guardrail");
  assertEqual(result.guardrails.noFinalPacketsCreated, true, "final packet guardrail");
});

runStep("ready vNext review creates vNext Packet draft", () => {
  const result = runBridge("vnext-ready.json", solutionCandidateReview({
    readinessStatus: "ready_for_vnext_packet",
    candidateType: "existing_app_improvement",
    candidateName: "Spark Of Hope Intake Lite",
    candidateSlug: "spark-of-hope-intake-lite"
  }));

  assertEqual(result.selectedDraft.kind, "vnext_packet_draft", "selected draft kind");
  assertEqual(result.packetDraft.kind, "vnext_packet_draft", "packet draft kind");
  assertArrayIncludes(result.packetDraft.requiredContextBeforeFinalPacket, "release history", "release history required before final packet");
});

runStep("ready non-app review creates Non-App Solution Plan draft", () => {
  const result = runBridge("non-app-ready.json", solutionCandidateReview({
    readinessStatus: "ready_for_non_app_solution_plan",
    candidateType: "workflow_process_candidate",
    primaryShape: "workflow_process",
    candidateName: "Care Follow Up Workflow"
  }));

  assertEqual(result.selectedDraft.kind, "non_app_solution_plan_draft", "selected draft kind");
  assertEqual(result.packetDraft.kind, "non_app_solution_plan_draft", "packet draft kind");
  assertEqual(result.packetDraft.plan.likelyWorkType, "workflow_process_plan", "non-app work type");
});

runStep("non-ready statuses fail honestly", () => {
  for (const readinessStatus of ["needs_clarification", "blocked_by_security", "blocked_by_cost", "blocked_by_scope"]) {
    assertThrows(() => {
      runBridge(`${readinessStatus}.json`, solutionCandidateReview({
        readinessStatus,
        decisionReady: false
      }));
    }, `readinessStatus ${readinessStatus} is not approved`);
  }
});

runStep("missing review fields fail honestly", () => {
  const review = solutionCandidateReview({
    readinessStatus: "ready_for_app_build_packet",
    candidateType: "new_app_candidate"
  });
  delete review.review.costProviderImpact;

  assertThrows(() => {
    runBridge("missing-review-field.json", review);
  }, "review.costProviderImpact.status");
});

console.log(`candidate-packet-bridge smoke ok (${smokeRoot})`);

function runBridge(name, artifact) {
  const inputPath = path.join(smokeRoot, name);
  const outputPath = path.join(smokeRoot, name.replace(".json", "-bridge.json"));
  const markdownPath = path.join(smokeRoot, name.replace(".json", "-bridge.md"));
  const followUpsPath = path.join(smokeRoot, name.replace(".json", "-followups.json"));

  writeJson(inputPath, artifact);

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-candidate-packet-bridge.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      CANDIDATE_PACKET_BRIDGE_INPUT: inputPath,
      CANDIDATE_PACKET_BRIDGE_OUTPUT: outputPath,
      CANDIDATE_PACKET_BRIDGE_MARKDOWN_OUTPUT: markdownPath,
      CANDIDATE_PACKET_BRIDGE_FOLLOWUPS_OUTPUT: followUpsPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const result = readJson(outputPath);
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const followUps = readJson(followUpsPath);

  assertIncludes(markdown, "Candidate To Packet Bridge", "markdown owner report");
  assertEqual(followUps.followUpTasks.length, 1, "bridge follow-up count");
  assertIncludes(followUps.followUpTasks[0].body, "source-of-truth/candidate-to-packet-bridge.md", "follow-up source files");
  assertIncludes(followUps.followUpTasks[0].body, "Do not create phase issues yet.", "phase issue guardrail");

  return result;
}

function solutionCandidateReview({
  readinessStatus,
  candidateType = "new_app_candidate",
  primaryShape = "app",
  candidateName = "Church Care Follow Up",
  candidateSlug = "",
  decisionReady = true
}) {
  const slug = candidateSlug || slugify(candidateName);

  return {
    kind: "solution_candidate_review",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "problem_portfolio_routing",
      candidateSlug: slug,
      candidateType,
      sourceMode: "problem_first",
      rawRequest: "Churches keep dropping follow-up after someone asks for help."
    },
    candidate: {
      name: candidateName,
      slug,
      type: candidateType,
      summary: `${candidateType.replace(/_/g, " ")} for church care follow-up.`,
      affectedPeople: ["people asking for help", "church staff", "volunteers"],
      barriers: ["ownership gaps", "visibility gaps"],
      needAddressed: "timely care coordination",
      desiredTransformation: "people receive timely care and stay connected",
      solutionShape: {
        primary: primaryShape,
        secondary: []
      }
    },
    readinessStatus,
    review: passReview(),
    decision: {
      ready: decisionReady,
      blockers: decisionReady ? [] : [{ factor: "example", status: readinessStatus, reason: "Not ready." }],
      missingContext: decisionReady ? [] : ["clarification or blocker resolution"],
      nextSafeAction: nextSafeActionFor(readinessStatus),
      nextArtifact: nextArtifactFor(readinessStatus),
      ownerApprovalRequired: true,
      reason: decisionReady ? "Candidate review passed." : "Candidate review did not pass."
    },
    ownerReadableReport: "Solution Candidate Review",
    followUpTasks: [],
    guardrails: {
      planningReviewOnly: true,
      noUi: true,
      noAppBuildPacketsCreated: true,
      noVnextPacketsCreated: true,
      noProductionDeploy: true,
      noPaidResources: true,
      noMigrations: true,
      noSecretsOrEnvChanges: true,
      repositoryVisibilityUnchanged: true,
      noGeneratedCodeAutoMerge: true
    }
  };
}

function passReview() {
  return {
    problemClarity: { status: "pass", notes: "Problem, affected people, barrier, and need are clear." },
    intendedTransformation: { status: "pass", notes: "The intended transformation is clear." },
    audienceUser: { status: "pass", notes: "Primary audience is specific enough." },
    solutionShape: { status: "pass", notes: "The solution shape is appropriate." },
    dataSecurityPrivacyNeeds: { status: "pass", notes: "No sensitive data path is authorized yet." },
    costProviderImpact: { status: "pass", notes: "No paid provider action is authorized." },
    buildComplexity: { status: "pass", notes: "Scope is bounded for a packet draft." },
    appEcosystemFit: { status: "pass", notes: "App and ecosystem boundaries are clear." },
    ownerApprovalRequirements: { status: "pass", notes: "Owner approval is required before final packet creation." }
  };
}

function nextSafeActionFor(readinessStatus) {
  const actions = {
    needs_clarification: "create_clarification_issue",
    ready_for_app_build_packet: "create_app_build_packet_issue",
    ready_for_vnext_packet: "create_vnext_packet_issue",
    ready_for_non_app_solution_plan: "create_non_app_solution_plan_issue",
    blocked_by_security: "create_security_review_issue",
    blocked_by_cost: "create_cost_review_issue",
    blocked_by_scope: "create_scope_review_issue"
  };

  return actions[readinessStatus] || "create_clarification_issue";
}

function nextArtifactFor(readinessStatus) {
  const artifacts = {
    ready_for_app_build_packet: "app_build_packet_request",
    ready_for_vnext_packet: "vnext_packet_request",
    ready_for_non_app_solution_plan: "non_app_solution_plan_request"
  };

  return artifacts[readinessStatus] || "focused_review_follow_up";
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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertFileIncludes(relativePath, expectedValues) {
  const text = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  for (const expected of expectedValues) assertIncludes(text, expected, `${relativePath} includes ${expected}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(value, expected, message) {
  if (!String(value).includes(expected)) {
    throw new Error(`${message}: expected content to include ${JSON.stringify(expected)}`);
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
    assertIncludes(caught.message, expectedMessage, "expected thrown message");
    return;
  }

  throw new Error(`expected function to throw ${expectedMessage}`);
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "solution-candidate";
}
