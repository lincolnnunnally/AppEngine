import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-solution-candidate-review-"));

runStep("standard is discoverable", () => {
  assertFileIncludes("source-of-truth/solution-candidate-review-gate.md", [
    "problem_portfolio_routing",
    "solution_candidate_review",
    "ready_for_app_build_packet",
    "ready_for_vnext_packet",
    "ready_for_non_app_solution_plan",
    "blocked_by_security",
    "blocked_by_cost",
    "blocked_by_scope"
  ]);

  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/solution-candidate-review-gate.md", "solution_candidate_review"]);
  assertFileIncludes("agents/context/output-contracts.md", ["solution_candidate_review"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["solution_candidate_review"]);
});

runStep("ready new app candidate routes to App Build Packet request", () => {
  const result = runReview("ready-app.json", {
    problem_portfolio_routing: routingArtifact({
      candidateType: "new_app_candidate",
      primary: "app",
      name: "Church Care Follow Up"
    }),
    review: passReview()
  });

  assertEqual(result.kind, "solution_candidate_review", "review artifact kind");
  assertEqual(result.sourceArtifact.kind, "problem_portfolio_routing", "source artifact kind");
  assertEqual(result.readinessStatus, "ready_for_app_build_packet", "readiness status");
  assertEqual(result.decision.nextSafeAction, "create_app_build_packet_issue", "next safe action");
  assertEqual(result.decision.nextArtifact, "app_build_packet_request", "next artifact");
  assertEqual(result.guardrails.noAppBuildPacketsCreated, true, "no app build packet guardrail");
});

runStep("ready existing app candidate routes to vNext Packet request", () => {
  const result = runReview("ready-vnext.json", {
    problem_portfolio_routing: routingArtifact({
      candidateType: "existing_app_improvement",
      primary: "app",
      name: "Spark Of Hope Intake Lite",
      slug: "spark-of-hope-intake-lite"
    }),
    review: passReview()
  });

  assertEqual(result.readinessStatus, "ready_for_vnext_packet", "readiness status");
  assertEqual(result.decision.nextSafeAction, "create_vnext_packet_issue", "next safe action");
  assertEqual(result.decision.nextArtifact, "vnext_packet_request", "next artifact");
  assertEqual(result.guardrails.noVnextPacketsCreated, true, "no vNext packet guardrail");
});

runStep("ready non-app candidate routes to non-app solution plan request", () => {
  const result = runReview("ready-non-app.json", {
    problem_portfolio_routing: routingArtifact({
      candidateType: "workflow_process_candidate",
      primary: "workflow_process",
      name: "Church Care Follow Up"
    }),
    review: passReview()
  });

  assertEqual(result.readinessStatus, "ready_for_non_app_solution_plan", "readiness status");
  assertEqual(result.decision.nextSafeAction, "create_non_app_solution_plan_issue", "next safe action");
  assertEqual(result.decision.nextArtifact, "non_app_solution_plan_request", "next artifact");
});

runStep("missing review fields need clarification", () => {
  const result = runReview("needs-clarification.json", {
    problem_portfolio_routing: routingArtifact({
      candidateType: "new_app_candidate",
      primary: "app",
      name: "Care Coordination"
    }),
    review: {
      ...passReview(),
      audienceUser: { status: "needs_clarification", missing: ["primary audience"], notes: "Primary audience is still too broad." }
    }
  });

  assertEqual(result.readinessStatus, "needs_clarification", "readiness status");
  assertEqual(result.decision.ready, false, "decision ready");
  assertEqual(result.decision.nextSafeAction, "create_clarification_issue", "next safe action");
  assertArrayIncludes(result.decision.missingContext, "primary audience", "missing context");
});

runStep("blocked cases route to focused review follow-ups", () => {
  const security = runReview("blocked-security.json", {
    problem_portfolio_routing: routingArtifact({ candidateType: "new_app_candidate", primary: "app" }),
    review: {
      ...passReview(),
      dataSecurityPrivacyNeeds: { status: "blocked_by_security", notes: "Sensitive care data requires a privacy plan before packet creation." }
    }
  });
  assertEqual(security.readinessStatus, "blocked_by_security", "security status");
  assertEqual(security.decision.nextSafeAction, "create_security_review_issue", "security next safe action");

  const cost = runReview("blocked-cost.json", {
    problem_portfolio_routing: routingArtifact({ candidateType: "new_app_candidate", primary: "app" }),
    review: {
      ...passReview(),
      costProviderImpact: { status: "blocked_by_cost", notes: "The candidate implies paid provider resources without approval." }
    }
  });
  assertEqual(cost.readinessStatus, "blocked_by_cost", "cost status");
  assertEqual(cost.decision.nextSafeAction, "create_cost_review_issue", "cost next safe action");

  const scope = runReview("blocked-scope.json", {
    problem_portfolio_routing: routingArtifact({ candidateType: "multi_part_ecosystem_solution", primary: "multi_part_ecosystem_solution" }),
    review: {
      ...passReview(),
      buildComplexity: { status: "blocked_by_scope", notes: "This is too broad and must be split before any packet." }
    }
  });
  assertEqual(scope.readinessStatus, "blocked_by_scope", "scope status");
  assertEqual(scope.decision.nextSafeAction, "create_scope_review_issue", "scope next safe action");
});

console.log(`solution-candidate-review smoke ok (${smokeRoot})`);

function runReview(name, artifact) {
  const inputPath = path.join(smokeRoot, name);
  const outputPath = path.join(smokeRoot, name.replace(".json", "-review.json"));
  const markdownPath = path.join(smokeRoot, name.replace(".json", "-review.md"));
  const followUpsPath = path.join(smokeRoot, name.replace(".json", "-followups.json"));

  writeJson(inputPath, artifact);

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-solution-candidate-review.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SOLUTION_CANDIDATE_REVIEW_INPUT: inputPath,
      SOLUTION_CANDIDATE_REVIEW_OUTPUT: outputPath,
      SOLUTION_CANDIDATE_REVIEW_MARKDOWN_OUTPUT: markdownPath,
      SOLUTION_CANDIDATE_REVIEW_FOLLOWUPS_OUTPUT: followUpsPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const result = readJson(outputPath);
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const followUps = readJson(followUpsPath);

  assertIncludes(markdown, "Solution Candidate Review", "markdown owner report");
  assertEqual(followUps.followUpTasks.length, 1, "review follow-up count");
  assertIncludes(followUps.followUpTasks[0].body, "source-of-truth/solution-candidate-review-gate.md", "follow-up source files");

  return result;
}

function routingArtifact({ candidateType = "new_app_candidate", primary = "app", name = "Church Care Follow Up", slug = "" } = {}) {
  const candidateSlug = slug || slugify(name);

  return {
    kind: "problem_portfolio_routing",
    schemaVersion: 1,
    sourceArtifact: {
      kind: "problem_solution_intake",
      mode: "problem_first",
      rawRequest: "Churches keep dropping follow-up after someone asks for help."
    },
    candidate: {
      name,
      slug: candidateSlug,
      type: candidateType,
      summary: `${candidateType.replace(/_/g, " ")} for church care follow-up.`,
      affectedPeople: ["people asking for help", "church staff", "volunteers"],
      barriers: ["ownership gaps", "visibility gaps"],
      needAddressed: "timely care coordination",
      desiredTransformation: "people receive timely care and stay connected",
      solutionShape: {
        primary,
        secondary: [],
        rationale: "Clarify the safest next solution path before building."
      }
    },
    portfolioDestination: {
      kind: "app_portfolio_registry",
      action: candidateType === "existing_app_improvement" ? "link_existing_app" : "add_candidate",
      trackingState: "candidate_review",
      requiredFields: ["name", "slug", "candidateType", "reviewUrl", "productionUrl", "currentVersion", "deploymentState", "buildState", "nextSafeAction", "sourceOfTruthFiles", "linkedIssues", "linkedPRs"]
    },
    requiredReviewGates: [
      { id: "source_of_truth_gate", status: "required", blocksBuildPacket: true },
      { id: "problem_clarity_gate", status: "required", blocksBuildPacket: true },
      { id: "owner_review_gate", status: "required", blocksBuildPacket: true },
      { id: "portfolio_registry_gate", status: "required", blocksBuildPacket: true },
      { id: "cost_guardrail_gate", status: "required", blocksBuildPacket: true },
      { id: "security_privacy_gate", status: "required", blocksBuildPacket: true }
    ],
    routing: {
      nextSafeAction: candidateType === "existing_app_improvement" ? "create_vnext_packet" : "create_planning_issue",
      recommendedLabel: "ai:plan",
      nextArtifact: "portfolio_candidate_review",
      ownerApprovalRequired: true,
      reason: "Track this solution candidate in the portfolio and complete review gates before any build packet."
    },
    ownerReadableReport: "Problem Intake To Portfolio Routing",
    followUpTasks: [],
    guardrails: {
      planningOnly: true,
      noPublicIntakeUi: true,
      noProductionDeploy: true,
      noPaidResources: true,
      noMigrations: true,
      noSecretsOrEnvChanges: true,
      repositoryVisibilityUnchanged: true,
      noGeneratedCodeAutoMerge: true,
      requiresReviewBeforeBuildPacket: true
    }
  };
}

function passReview() {
  return {
    problemClarity: { status: "pass", notes: "Problem, affected people, barrier, and need are clear." },
    intendedTransformation: { status: "pass", notes: "The intended transformation is clear." },
    audienceUser: { status: "pass", notes: "Primary audience is specific enough." },
    solutionShape: { status: "pass", notes: "The solution shape is appropriate for the next planning step." },
    dataSecurityPrivacyNeeds: { status: "pass", notes: "No sensitive data path is authorized yet." },
    costProviderImpact: { status: "pass", notes: "No paid provider action is authorized." },
    buildComplexity: { status: "pass", notes: "Scope is bounded for the next planning step." },
    appEcosystemFit: { status: "pass", notes: "App and ecosystem boundaries are clear." },
    ownerApprovalRequirements: { status: "pass", notes: "Owner approval is required before packet creation." }
  };
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

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "solution-candidate";
}
