import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-build-packet-"));
const packetOutput = path.join(smokeRoot, "app-build-packet.json");
const followUpsOutput = path.join(smokeRoot, "packet-follow-ups.json");
const codexOutput = path.join(smokeRoot, "codex-output.md");
const issuesOutput = path.join(smokeRoot, "dry-run-issues.json");

const requiredPhaseIds = [
  "discovery",
  "charter",
  "architecture",
  "provider_cost",
  "data_model",
  "identity_auth",
  "ui_design",
  "design_quality",
  "ux_review",
  "compatibility",
  "mvp_build",
  "testing",
  "review",
  "deployment_environment",
  "deployment",
  "release_gate",
  "monitoring",
  "super_admin_registration"
];

runStep("packet creation", () => {
  runNode("scripts/create-app-build-packet.js", {
    APP_BUILD_PACKET_OUTPUT: packetOutput,
    APP_BUILD_PACKET_FOLLOWUPS_OUTPUT: followUpsOutput,
    APP_NAME: "Kind Help Desk",
    APP_SLUG: "kind-help-desk",
    APP_PURPOSE: "Help small service teams receive requests, organize follow-up, and serve people clearly.",
    APP_AUDIENCE: "small nonprofit teams|church staff|service coordinators",
    APP_HELPED: "people asking for help|teams coordinating service",
    APP_BARRIER_REMOVED: "Remove scattered request intake and unclear follow-up ownership.",
    APP_NEED_ADDRESSED: "Small service teams need a simple way to receive, triage, assign, and resolve help requests.",
    APP_MOVEMENT_TOWARD_LIFE: "People asking for help move from confusion toward being heard, assigned, and served.",
    APP_TRANSFORMATION_OUTCOME: "Service teams become more capable of helping people consistently.",
    APP_TOOL_CLASSIFICATION: "support_tool",
    APP_BOUNDARIES: "do not become a full CRM|do not absorb unrelated ministry apps|do not store private notes without privacy rules",
    APP_SUCCESS_DEFINITION: "A coordinator can receive, triage, assign, resolve, and monitor one request from the Super Admin surface.",
    APP_DEPLOYMENT_TARGET: "Vercel preview first; production only after owner approval."
  });

  const packet = readJson(packetOutput);

  assertEqual(packet.kind, "app_build_packet", "packet kind");
  assertEqual(packet.schemaVersion, 1, "packet schema version");
  assertEqual(packet.app.slug, "kind-help-desk", "packet slug");
  assertEqual(packet.app.barrierRemoved, "Remove scattered request intake and unclear follow-up ownership.", "packet barrier removed");
  assertEqual(packet.app.needAddressed, "Small service teams need a simple way to receive, triage, assign, and resolve help requests.", "packet need addressed");
  assertEqual(packet.app.movementTowardLife, "People asking for help move from confusion toward being heard, assigned, and served.", "packet movement toward life");
  assertEqual(packet.app.transformationOutcome, "Service teams become more capable of helping people consistently.", "packet transformation outcome");
  assertEqual(packet.app.toolClassification, "support_tool", "packet tool classification");
  assertIncludes(packet.app.boundaries.join(" "), "do not become a full CRM", "packet boundaries");
  assertArrayIncludes(packet.sourceOfTruth.requiredFiles, "source-of-truth/00-why-we-build.md", "packet requires why we build");
  assertArrayIncludes(packet.sourceOfTruth.requiredFiles, "source-of-truth/01-ecosystem-philosophy.md", "packet requires ecosystem philosophy");
  assertArrayIncludes(packet.sourceOfTruth.requiredFiles, "source-of-truth/04-app-purpose-rules.md", "packet requires app purpose rules");
  assertArrayIncludes(packet.sourceOfTruth.requiredFiles, "source-of-truth/05-ecosystem-design-gates.md", "packet requires ecosystem design gates");
  assertArrayIncludes(packet.sourceOfTruth.requiredFiles, "source-of-truth/cost-governance-model-routing.md", "packet requires cost governance standard");
  assertEqual(packet.guardrails.noGiantCodexTask, true, "packet forbids giant Codex task");
  assertEqual(packet.guardrails.preventGoalBleed, true, "packet prevents app-goal bleeding");
  assertEqual(packet.app.identityAuth.required, true, "packet requires Identity/Auth plan");
  assertEqual(packet.app.identityAuth.kind, "identity_auth_plan", "packet embeds identity artifact");
  assertEqual(packet.app.identityAuth.auth.provider, "Auth.js", "packet identity provider");
  assertArrayIncludes(packet.app.identityAuth.roles.map((role) => role.role), "owner", "packet owner role");
  assertArrayIncludes(packet.app.identityAuth.roles.map((role) => role.role), "admin", "packet admin role");
  assertArrayIncludes(packet.app.identityAuth.roles.map((role) => role.role), "customer", "packet customer role");
  assertArrayIncludes(packet.app.identityAuth.protectedRoutes.map((route) => route.path), "/admin", "packet protected admin route");
  assertEqual(packet.app.superAdminIntegration.required, true, "packet requires Super Admin integration");
  assertEqual(packet.app.superAdminRegistry.required, true, "packet requires Super Admin registry");
  assertEqual(packet.app.superAdminRegistry.kind, "super_admin_registry_entry", "packet embeds registry artifact");
  assertEqual(packet.app.superAdminRegistry.status, "planned", "packet registry status");
  assertEqual(packet.app.superAdminRegistry.release.version, "v1", "packet registry release version");
  assertArrayIncludes(packet.app.superAdminRegistry.superAdminActions, "view logs", "packet registry logs action");
  assertEqual(packet.app.providerCostReview.kind, "provider_cost_review", "packet embeds provider cost artifact");
  assertEqual(packet.app.providerCostReview.costPosture.preview, "free_or_low_cost", "packet preview cost posture");
  assertEqual(packet.app.providerCostReview.costPosture.production, "approval_required", "packet production cost posture");
  assertArrayIncludes(packet.app.providerCostReview.providers.map((item) => item.area), "frontend", "packet provider frontend");
  assertArrayIncludes(packet.app.providerCostReview.providers.map((item) => item.area), "database", "packet provider database");
  assertEqual(packet.app.providerCostReview.guardrails.noPaidResourcesWithoutApproval, true, "packet paid provider guardrail");
  assertEqual(packet.app.deploymentEnvironment.kind, "deployment_environment_plan", "packet embeds deployment environment artifact");
  assertEqual(packet.app.deploymentEnvironment.frontend.provider, "Vercel", "packet frontend provider");
  assertEqual(packet.app.deploymentEnvironment.frontend.productionUrl, "approval-gated", "packet production URL is gated");
  assertArrayIncludes(packet.app.deploymentEnvironment.environmentVariables.map((item) => item.name), "DATABASE_URL", "packet database env var");
  assertEqual(packet.app.deploymentEnvironment.guardrails.productionRequiresReleaseGate, true, "packet production requires release gate");
  assertEqual(packet.app.designReview.kind, "design_review", "packet embeds design review artifact");
  assertEqual(packet.app.designReview.reviewers.designerRequired, true, "packet requires designer review");
  assertEqual(packet.app.designReview.reviewers.customerPerspectiveRequired, true, "packet requires customer perspective review");
  assertArrayIncludes(packet.app.designReview.qualityChecks.map((check) => check.id), "clear_primary_action", "packet design clear primary action");
  assertArrayIncludes(packet.app.designReview.stateChecks, "empty states", "packet design empty states");
  assertArrayIncludes(packet.app.designReview.workflowTestChecks, "admin screens", "packet design admin checks");
  assertEqual(packet.app.designReview.guardrails.blocksReleaseGateApproval, true, "packet design blocks release gate");
  assertEqual(packet.app.compatibilityTestPlan.kind, "compatibility_test_plan", "packet embeds compatibility artifact");
  assertArrayIncludes(packet.app.compatibilityTestPlan.browserSupport.map((item) => item.id), "iphone_safari", "packet compatibility iPhone Safari");
  assertArrayIncludes(packet.app.compatibilityTestPlan.browserSupport.map((item) => item.id), "ipad_safari", "packet compatibility iPad Safari");
  assertArrayIncludes(packet.app.compatibilityTestPlan.browserSupport.map((item) => item.id), "chrome_desktop", "packet compatibility Chrome desktop");
  assertArrayIncludes(packet.app.compatibilityTestPlan.checks.map((check) => check.id), "touch_targets", "packet compatibility touch targets");
  assertArrayIncludes(packet.app.compatibilityTestPlan.checks.map((check) => check.id), "forms_validation", "packet compatibility forms");
  assertArrayIncludes(packet.app.compatibilityTestPlan.checks.map((check) => check.id), "auth_flows", "packet compatibility auth flows");
  assertArrayIncludes(packet.app.compatibilityTestPlan.checks.map((check) => check.id), "admin_screens", "packet compatibility admin screens");
  assertEqual(packet.app.compatibilityTestPlan.guardrails.blocksReleaseGateApproval, true, "packet compatibility blocks release gate");
  assertEqual(packet.app.releaseGate.kind, "release_gate_plan", "packet embeds release gate artifact");
  assertEqual(packet.app.releaseGate.versioning.launchVersion, "v1", "packet launch version");
  assertEqual(packet.app.releaseGate.guardrails.ownerApprovalBeforeProduction, true, "packet owner approval guardrail");
  assertEqual(packet.app.deploymentEnvironment.frontend.previewAccess, "public_by_default", "packet preview access policy");
  assertEqual(packet.app.deploymentEnvironment.guardrails.publicPreviewByDefault, true, "packet public preview guardrail");
  assertEqual(packet.app.releaseGate.guardrails.costReviewBeforeProvisioning, true, "packet provider/cost release guardrail");
  assertEqual(packet.app.releaseGate.guardrails.costGovernanceBeforeModelHeavyWork, true, "packet cost governance release guardrail");
  assertEqual(packet.app.releaseGate.guardrails.designReviewBeforeRelease, true, "packet release requires design review");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "provider_cost_review", "packet provider cost gate");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "cost_governance", "packet cost governance gate");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "design_quality", "packet design quality gate");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "customer_perspective_review", "packet customer perspective gate");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "compatibility", "packet compatibility gate");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "safari_mobile", "packet Safari mobile gate");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "common_browsers", "packet common browsers gate");
  assertArrayIncludes(packet.app.releaseGate.gates.map((gate) => gate.id), "production_approval", "packet production approval gate");
  assertArrayIncludes(packet.app.superAdminIntegration.requirements, "management", "Super Admin management requirement");
  assertArrayIncludes(packet.app.superAdminIntegration.requirements, "monitoring", "Super Admin monitoring requirement");
  assertArrayIncludes(packet.app.superAdminIntegration.requirements, "health", "Super Admin health requirement");
  assertArrayIncludes(packet.app.superAdminIntegration.requirements, "logs", "Super Admin logs requirement");
  assertArrayIncludes(packet.app.superAdminIntegration.requirements, "users", "Super Admin users requirement");
  assertArrayIncludes(packet.app.superAdminIntegration.requirements, "billing/status if needed", "Super Admin billing/status requirement");
  assertArrayIncludes(packet.app.superAdminIntegration.requirements, "admin actions", "Super Admin admin actions requirement");

  for (const id of requiredPhaseIds) {
    assertArrayIncludes(packet.phases.map((phase) => phase.id), id, `packet includes ${id} phase`);
  }

  assertEqual(packet.followUpTasks.length, requiredPhaseIds.length, "one follow-up per phase");
  assertArrayIncludes(packet.followUpTasks.map((task) => task.recommendedLabel), "ai:plan", "packet creates planning follow-ups");
  assertArrayIncludes(packet.followUpTasks.map((task) => task.recommendedLabel), "ai:build", "packet creates build follow-ups");
  assertArrayIncludes(packet.followUpTasks.map((task) => task.recommendedLabel), "ai:review", "packet creates review follow-ups");
  assertArrayIncludes(packet.followUpTasks.map((task) => task.recommendedLabel), "ai:monitor", "packet creates monitor follow-ups");
});

runStep("phased follow-up dry run", () => {
  const followUps = readJson(followUpsOutput);
  fs.writeFileSync(
    codexOutput,
    [
      "App Build Packet follow-up output",
      "",
      "```json",
      JSON.stringify(
        {
          agent: "planner",
          status: "needs_follow_up",
          summary: "Created a phased App Build Packet.",
          artifacts: [
            {
              kind: "app_build_packet",
              title: "Kind Help Desk App Build Packet",
              content: readJson(packetOutput)
            }
          ],
          findings: [],
          followUpTasks: followUps.followUpTasks,
          handoffTo: ["planner", "builder", "workflow_tester", "code_reviewer", "monitor"]
        },
        null,
        2
      ),
      "```",
      ""
    ].join("\n")
  );

  runNode("scripts/create-follow-up-issues.js", {
    CODEX_OUTPUT_FILE: codexOutput,
    FOLLOW_UP_DRY_RUN: "true",
    FOLLOW_UP_OUTPUT: issuesOutput,
    MAX_FOLLOW_UP_ISSUES: "20",
    SOURCE_ISSUE_NUMBER: "999",
    SOURCE_ISSUE_URL: "https://github.com/lincolnnunnally/AppEngine/issues/999"
  });

  const dryRun = readJson(issuesOutput);
  assertEqual(dryRun.issues.length, requiredPhaseIds.length, "dry run creates one issue per packet phase");
  assertIncludes(dryRun.issues[0].body, "App Build Packet", "dry-run issue includes packet context");
  assertIncludes(dryRun.issues[0].body, "## Required Source Of Truth To Load", "dry-run issue lists required source of truth");
  assertIncludes(dryRun.issues[0].body, "source-of-truth/00-why-we-build.md", "dry-run issue includes why we build");
  assertIncludes(dryRun.issues[0].body, "source-of-truth/01-ecosystem-philosophy.md", "dry-run issue includes ecosystem philosophy");
  assertIncludes(dryRun.issues[0].body, "source-of-truth/04-app-purpose-rules.md", "dry-run issue includes app purpose rules");
  assertIncludes(dryRun.issues[0].body, "source-of-truth/05-ecosystem-design-gates.md", "dry-run issue includes ecosystem design gates");
  assertIncludes(dryRun.issues[0].body, "Identity/Auth", "dry-run issue includes identity/auth requirements");
  assertIncludes(dryRun.issues[0].body, "Super Admin", "dry-run issue includes Super Admin requirements");
  assertIncludes(dryRun.issues[0].body, "Provider/Cost", "dry-run issue includes provider/cost requirements");
  assertIncludes(dryRun.issues[0].body, "Deployment Environment", "dry-run issue includes deployment environment requirements");
  assertIncludes(dryRun.issues[0].body, "Design Quality", "dry-run issue includes design quality requirements");
  assertIncludes(dryRun.issues[0].body, "Compatibility", "dry-run issue includes compatibility requirements");
  assertIncludes(dryRun.issues[0].body, "Release Gate", "dry-run issue includes release gate requirements");
  assertIncludes(dryRun.issues[0].body, "Do not turn this phase into a full-app build.", "dry-run issue includes phase guardrail");
  assertIncludes(dryRun.issues[0].body, "Do not invent auth outside the Identity/Auth Standard.", "dry-run issue includes auth guardrail");
  assertIncludes(dryRun.issues[0].body, "Do not create new paid provider resources", "dry-run issue includes provider cost guardrail");
  assertIncludes(dryRun.issues[0].body, "Launch MVP as v1", "dry-run issue includes v1 guardrail");
  assertArrayIncludes(dryRun.issues.map((issue) => issue.title), "[kind-help-desk] Phase: Provider/Cost", "dry-run creates provider cost issue");
  assertArrayIncludes(dryRun.issues.map((issue) => issue.title), "[kind-help-desk] Phase: Design Quality", "dry-run creates design quality issue");
  assertArrayIncludes(dryRun.issues.map((issue) => issue.title), "[kind-help-desk] Phase: UX Review", "dry-run creates UX review issue");
  assertArrayIncludes(dryRun.issues.map((issue) => issue.title), "[kind-help-desk] Phase: Compatibility", "dry-run creates compatibility issue");
  assertIncludes(dryRun.issues[0].body, "Source issue: #999", "dry-run issue includes source issue");
  assertArrayIncludes(dryRun.issues.map((issue) => issue.label), "ai:build", "dry-run issues include build label");
  assertArrayIncludes(dryRun.issues.map((issue) => issue.label), "ai:review", "dry-run issues include review label");
  assertArrayIncludes(dryRun.issues.map((issue) => issue.label), "ai:monitor", "dry-run issues include monitor label");
});

console.log(`app-build-packet smoke ok (${smokeRoot})`);

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function runNode(scriptPath, env) {
  return execFileSync(process.execPath, [path.join(repoRoot, scriptPath)], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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
