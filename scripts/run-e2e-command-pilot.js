import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const outputRoot =
  process.env.PILOT_OUTPUT_DIR ||
  fs.mkdtempSync(path.join(os.tmpdir(), "appengine-e2e-pilot-"));
const pilotOutput = process.env.PILOT_APP_BUILD_OUTPUT || path.join(outputRoot, "pilot-app-build.json");
const mode = process.env.PILOT_MODE || "dry_run";
const pilotName = process.env.PILOT_APP_NAME || "Spark of Hope Intake Lite";
const pilotSlug = process.env.PILOT_APP_SLUG || "spark-of-hope-intake-lite";
const sourceIssueNumber = process.env.SOURCE_ISSUE_NUMBER || "3000";
const sourceIssueUrl = process.env.SOURCE_ISSUE_URL || "https://github.com/lincolnnunnally/AppEngine/issues/3000";

if (mode !== "dry_run") {
  throw new Error("The E2E pilot command is dry-run only. Refusing production-impacting mode.");
}

const paths = {
  handoffInput: path.join(outputRoot, "chatgpt-handoff-input.json"),
  handoffPacket: path.join(outputRoot, "chatgpt-handoff-packet.json"),
  issueBody: path.join(outputRoot, "chatgpt-handoff-issue.md"),
  issueJson: path.join(outputRoot, "chatgpt-handoff-issue.json"),
  intakePacket: path.join(outputRoot, "intake-packet.json"),
  intakeFollowUps: path.join(outputRoot, "intake-follow-ups.json"),
  buildPacket: path.join(outputRoot, "app-build-packet.json"),
  buildFollowUps: path.join(outputRoot, "app-build-follow-ups.json"),
  codexOutput: path.join(outputRoot, "codex-output.md"),
  followUpDryRun: path.join(outputRoot, "follow-up-issues.json")
};

fs.mkdirSync(outputRoot, { recursive: true });

writeJson(paths.handoffInput, {
  requestType: "new_app",
  rawRequest: `Start AppEngine build for ${pilotName}.`,
  rawConversationSummary:
    "Lincoln wants a small, mission-aligned first real AppEngine pilot proving the ChatGPT-to-GitHub-to-Codex loop can create a handoff issue, route through intake, produce an App Build Packet, and generate follow-up issues without manual copy and paste.",
  selectedApp: {
    name: pilotName,
    slug: pilotSlug,
    status: "new"
  },
  newAppSlug: pilotSlug,
  intakeConfidence: 0.9,
  missingContext: ["real GitHub issue number until pilot issue is created"]
});

runNode("scripts/create-chatgpt-handoff-packet.js", {
  CHATGPT_HANDOFF_INPUT: paths.handoffInput,
  CHATGPT_HANDOFF_PACKET_OUTPUT: paths.handoffPacket,
  CHATGPT_HANDOFF_ISSUE_OUTPUT: paths.issueBody,
  CHATGPT_HANDOFF_ISSUE_JSON_OUTPUT: paths.issueJson
});

const issue = readJson(paths.issueJson);

runNode("scripts/create-intake-packet.js", {
  INTAKE_REQUEST: fs.readFileSync(paths.issueBody, "utf8"),
  INTAKE_PACKET_OUTPUT: paths.intakePacket,
  INTAKE_FOLLOWUPS_OUTPUT: paths.intakeFollowUps
});

const intakePacket = readJson(paths.intakePacket);

if (intakePacket.selectedWorkflow.packetKind !== "app_build_packet") {
  throw new Error(`Pilot expected app_build_packet, received ${intakePacket.selectedWorkflow.packetKind}`);
}

runNode("scripts/create-app-build-packet.js", {
  APP_BUILD_PACKET_OUTPUT: paths.buildPacket,
  APP_BUILD_PACKET_FOLLOWUPS_OUTPUT: paths.buildFollowUps,
  APP_NAME: pilotName,
  APP_SLUG: pilotSlug,
  APP_PURPOSE:
    "Help a person or church collect one hopeful story, preserve the story safely, and prepare a small encouragement response workflow.",
  APP_AUDIENCE: "people sharing hopeful stories|church staff reviewing stories|encouragement volunteers",
  APP_HELPED: "people who need encouragement|churches collecting stories|support teams",
  APP_BOUNDARIES: "do not become a full church CRM|do not ingest real private stories in the pilot|do not deploy production",
  APP_SUCCESS_DEFINITION:
    "A dry-run App Build Packet creates safe phased follow-up issues for story intake, review, encouragement, testing, release gate, and Super Admin registration.",
  APP_DEPLOYMENT_TARGET: "Vercel preview planning only; production deployment is blocked until owner approval.",
  APP_MONTHLY_COST_CEILING: "zero paid resources during pilot dry run"
});

const handoffPacket = readJson(paths.handoffPacket);
const buildPacket = readJson(paths.buildPacket);
const buildFollowUps = readJson(paths.buildFollowUps);
const pilotFollowUps = buildFollowUps.followUpTasks.slice(0, 6);

writeCodexOutput({
  outputPath: paths.codexOutput,
  handoffPacket,
  intakePacket,
  buildPacket,
  followUpTasks: pilotFollowUps
});

runNode("scripts/create-follow-up-issues.js", {
  CODEX_OUTPUT_FILE: paths.codexOutput,
  FOLLOW_UP_DRY_RUN: "true",
  FOLLOW_UP_OUTPUT: paths.followUpDryRun,
  MAX_FOLLOW_UP_ISSUES: "10",
  SOURCE_ISSUE_NUMBER: sourceIssueNumber,
  SOURCE_ISSUE_URL: sourceIssueUrl
});

if (!fs.existsSync(paths.followUpDryRun)) {
  throw new Error("Pilot follow-up dry run did not produce follow-up issue output.");
}

const dryRun = readJson(paths.followUpDryRun);

const pilot = {
  kind: "pilot_app_build",
  schemaVersion: 1,
  pilot: {
    name: pilotName,
    slug: pilotSlug,
    mode,
    scope: "Small bounded first app build pilot"
  },
  issue: {
    title: issue.title,
    number: sourceIssueNumber,
    url: sourceIssueUrl,
    bodyPath: outputPath(paths.issueBody),
    label: issue.labels?.[0] || "ai:plan"
  },
  artifacts: {
    chatgptHandoffPacket: outputPath(paths.handoffPacket),
    intakePacket: outputPath(paths.intakePacket),
    buildPacket: outputPath(paths.buildPacket),
    followUpDryRun: outputPath(paths.followUpDryRun)
  },
  workflow: {
    selectedPacket: intakePacket.selectedWorkflow.packetKind,
    selectedAgent: "planner",
    followUpIssues: dryRun.issues.map((item) => ({
      title: item.title,
      label: item.label
    }))
  },
  prs: [],
  release: {
    status: "not_deployed",
    productionDeployAllowed: false,
    previewDeployPlanned: true
  },
  blockers: ["Real GitHub issue has not been created in this dry run.", "Generated app code is not merged until review."],
  nextAction: "Review dry-run follow-up issues, then create the real GitHub issue with ai:plan.",
  guardrails: {
    dryRunOnly: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noGeneratedCodeMergeWithoutReview: true,
    noSecrets: true
  }
};

validatePilot(pilot);
writeJson(pilotOutput, pilot);

console.log(`e2e-pilot ok: ${pilot.pilot.name}`);
console.log(`output: ${pilotOutput}`);
console.log(`follow-ups: ${pilot.workflow.followUpIssues.length}`);

function writeCodexOutput({ outputPath, handoffPacket, intakePacket, buildPacket, followUpTasks }) {
  const artifactSummaries = [
    {
      kind: "chatgpt_handoff_packet",
      title: `${pilotName} ChatGPT Handoff Packet`,
      content: {
        kind: handoffPacket.kind,
        requestType: handoffPacket.requestType,
        selectedApp: handoffPacket.selectedApp,
        recommendedLabel: handoffPacket.recommendedLabel,
        sourceOfTruthFiles: handoffPacket.sourceOfTruthFiles
      }
    },
    {
      kind: "intake_packet",
      title: `${pilotName} Intake Packet`,
      content: {
        kind: intakePacket.kind,
        requestType: intakePacket.requestType,
        inferredApp: intakePacket.inferredApp,
        selectedWorkflow: intakePacket.selectedWorkflow,
        nextIssueLabels: intakePacket.nextIssueLabels
      }
    },
    {
      kind: "app_build_packet",
      title: `${pilotName} App Build Packet`,
      content: {
        kind: buildPacket.kind,
        app: buildPacket.app,
        version: buildPacket.version,
        deploymentTarget: buildPacket.deploymentTarget,
        phases: buildPacket.phases.map((phase) => ({
          id: phase.id,
          name: phase.name,
          label: phase.label
        }))
      }
    }
  ];

  const output = [
    "E2E pilot dry-run output",
    "",
    "```json",
    JSON.stringify(
      {
        agent: "planner",
        status: "needs_follow_up",
        summary: "Created a pilot App Build Packet from a ChatGPT handoff issue through intake.",
        artifacts: artifactSummaries,
        findings: [],
        followUpTasks,
        handoffTo: ["planner", "builder", "workflow_tester", "code_reviewer", "monitor"]
      },
      null,
      2
    ),
    "```",
    ""
  ].join("\n");

  fs.writeFileSync(outputPath, output);
}

function validatePilot(pilot) {
  const missing = [];

  for (const [label, value] of [
    ["kind", pilot.kind],
    ["pilot.name", pilot.pilot?.name],
    ["pilot.slug", pilot.pilot?.slug],
    ["issue.title", pilot.issue?.title],
    ["workflow.selectedPacket", pilot.workflow?.selectedPacket],
    ["release.status", pilot.release?.status],
    ["nextAction", pilot.nextAction]
  ]) {
    if (!value) missing.push(label);
  }

  if (pilot.kind !== "pilot_app_build") missing.push("kind=pilot_app_build");
  if (pilot.pilot.mode !== "dry_run") missing.push("pilot.mode=dry_run");
  if (pilot.workflow.selectedPacket !== "app_build_packet") missing.push("workflow.selectedPacket=app_build_packet");
  if (!Array.isArray(pilot.workflow.followUpIssues) || pilot.workflow.followUpIssues.length === 0) missing.push("workflow.followUpIssues");
  if (pilot.release.productionDeployAllowed) missing.push("release.productionDeployAllowed=false");
  if (!pilot.guardrails.dryRunOnly || !pilot.guardrails.noProductionDeploy || !pilot.guardrails.noPaidResources || !pilot.guardrails.noGeneratedCodeMergeWithoutReview || !pilot.guardrails.noSecrets) {
    missing.push("guardrails");
  }

  if (missing.length) throw new Error(`Pilot app build artifact missing required fields: ${missing.join(", ")}`);
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function outputPath(filePath) {
  return path.relative(path.resolve(outputRoot), path.resolve(filePath));
}
