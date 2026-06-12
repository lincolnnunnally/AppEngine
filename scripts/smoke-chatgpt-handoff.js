import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-chatgpt-handoff-"));

const knownApps = [
  {
    name: "Spark of Hope",
    slug: "spark-of-hope",
    aliases: ["spark", "spark stories"],
    currentVersion: "v1",
    charterPath: "source-of-truth/charters/spark-of-hope.md",
    registrySource: "Super Admin registry: spark-of-hope",
    releaseHistorySource: "Release history: spark-of-hope",
    monitoringSource: "Monitoring report: spark-of-hope",
    openIssuesSource: "GitHub issues: app:spark-of-hope",
    knownIssues: ["story intake needs clearer church workflow"]
  },
  {
    name: "Toner Management",
    slug: "toner-management",
    aliases: ["toner", "printer toner"],
    currentVersion: "v1",
    charterPath: "source-of-truth/charters/toner-management.md",
    registrySource: "Super Admin registry: toner-management",
    releaseHistorySource: "Release history: toner-management",
    monitoringSource: "Monitoring report: toner-management",
    openIssuesSource: "GitHub issues: app:toner-management",
    knownIssues: ["service package chooser needs follow-up"]
  }
];

runStep("new app handoff creates issue body intake can route", () => {
  const result = createHandoff("new-app", {
    requestType: "new_app",
    rawRequest: "Start AppEngine build for Hope Stories",
    rawConversationSummary: "Lincoln wants a new hopeful story-sharing app for churches.",
    selectedApp: {
      name: "Hope Stories",
      slug: "hope-stories",
      status: "new"
    },
    newAppSlug: "hope-stories",
    intakeConfidence: 0.86,
    missingContext: ["audience details", "success definition"]
  });

  assertEqual(result.packet.kind, "chatgpt_handoff_packet", "new handoff kind");
  assertEqual(result.packet.requestType, "new_app", "new handoff request type");
  assertEqual(result.packet.recommendedLabel, "ai:plan", "new handoff label");
  assertIncludes(result.packet.issue.title, "New app: Hope Stories", "new issue title");
  assertIncludes(result.issueBody, "## Machine Handoff", "new issue has machine handoff");
  assertIncludes(result.issueBody, "source-of-truth/app-build-packet.md", "new issue loads app build packet standard");

  const intake = routeIssueBodyThroughIntake("new-app", result.issueBody, []);
  assertEqual(intake.kind, "intake_packet", "new intake kind");
  assertEqual(intake.requestType, "new_app", "new intake request type");
  assertEqual(intake.inferredApp.status, "new", "new intake status");
  assertEqual(intake.inferredApp.slug, "hope-stories", "new intake slug");
  assertEqual(intake.selectedWorkflow.packetKind, "app_build_packet", "new intake route");
});

runStep("vNext improvement handoff creates issue body intake can route", () => {
  const result = createHandoff("vnext", {
    requestType: "improvement",
    rawRequest: "Improve Spark of Hope story intake for churches",
    rawConversationSummary: "ChatGPT clarified that this is an improvement to the existing Spark of Hope app.",
    selectedApp: {
      name: "Spark of Hope",
      slug: "spark-of-hope",
      status: "existing"
    },
    intakeConfidence: 0.93
  });

  assertIncludes(result.packet.issue.title, "Improve: Spark of Hope", "vNext issue title");
  assertIncludes(result.issueBody, "existing app -> intake_packet -> vnext_packet", "vNext issue route");

  const intake = routeIssueBodyThroughIntake("vnext", result.issueBody, knownApps);
  assertEqual(intake.requestType, "improvement", "vNext intake request type");
  assertEqual(intake.inferredApp.slug, "spark-of-hope", "vNext intake app");
  assertEqual(intake.selectedWorkflow.packetKind, "vnext_packet", "vNext intake route");
  assertEqual(intake.appContext.charterLoaded, true, "vNext loaded charter");
});

runStep("bug fix handoff stays issue-first and routes through intake", () => {
  const result = createHandoff("fix", {
    requestType: "fix",
    rawRequest: "Fix broken reminder emails in Toner Management",
    rawConversationSummary: "The conversation identified a bug in the existing Toner Management reminder workflow.",
    selectedApp: {
      name: "Toner Management",
      slug: "toner-management",
      status: "existing"
    },
    intakeConfidence: 0.91
  });

  assertIncludes(result.packet.issue.title, "Fix: Toner Management", "fix issue title");
  assertEqual(result.packet.recommendedLabel, "ai:plan", "fix still enters through plan label");

  const intake = routeIssueBodyThroughIntake("fix", result.issueBody, knownApps);
  assertEqual(intake.requestType, "fix", "fix intake request type");
  assertEqual(intake.inferredApp.slug, "toner-management", "fix intake app");
  assertEqual(intake.selectedWorkflow.packetKind, "vnext_packet", "fix intake route");
});

runStep("design improvement and release handoffs use issue templates", () => {
  const design = createHandoff("design", {
    requestType: "design_improvement",
    rawRequest: "Make Spark of Hope story intake easier to use on phones",
    rawConversationSummary: "The request is a design and UX improvement to the existing app.",
    selectedApp: {
      name: "Spark of Hope",
      slug: "spark-of-hope",
      status: "existing"
    }
  });

  assertIncludes(design.packet.issue.title, "Design: Spark of Hope", "design issue title");
  assertIncludes(design.issueBody, "source-of-truth/design-quality-gate.md", "design issue loads design gate");
  assertIncludes(design.issueBody, "source-of-truth/ux-review-standard.md", "design issue loads UX review");

  const designIntake = routeIssueBodyThroughIntake("design", design.issueBody, knownApps);
  assertEqual(designIntake.inferredApp.slug, "spark-of-hope", "design intake app");
  assertEqual(designIntake.selectedWorkflow.packetKind, "vnext_packet", "design intake route");

  const release = createHandoff("release", {
    requestType: "launch_release",
    rawRequest: "Prepare Spark of Hope for release",
    rawConversationSummary: "The request is to move the existing app toward preview or launch gates.",
    selectedApp: {
      name: "Spark of Hope",
      slug: "spark-of-hope",
      status: "existing"
    }
  });

  assertIncludes(release.packet.issue.title, "Release: Spark of Hope", "release issue title");
  assertIncludes(release.issueBody, "source-of-truth/release-gate-standard.md", "release issue loads release gate");

  const releaseIntake = routeIssueBodyThroughIntake("release", release.issueBody, knownApps);
  assertEqual(releaseIntake.inferredApp.slug, "spark-of-hope", "release intake app");
  assertEqual(releaseIntake.selectedWorkflow.packetKind, "vnext_packet", "release intake route");
});

runStep("handoff redacts secret-like values before issue creation", () => {
  const result = createHandoff("secret", {
    requestType: "new_app",
    rawRequest: "Start AppEngine build for Secret Safe App with OPENAI_API_KEY=sk-testsecret1234567890",
    rawConversationSummary: "The user pasted github_token=ghp_testsecret1234567890 during planning.",
    selectedApp: {
      name: "Secret Safe App",
      slug: "secret-safe-app",
      status: "new"
    },
    newAppSlug: "secret-safe-app"
  });

  const serialized = JSON.stringify(result.packet);
  assertIncludes(serialized, "[REDACTED_SECRET]", "secret handoff redacts values");
  assertDoesNotInclude(serialized, "sk-testsecret", "secret handoff removes OpenAI-like key");
  assertDoesNotInclude(serialized, "ghp_testsecret", "secret handoff removes GitHub-like token");
  assertIncludes(result.packet.securityNotes.join("; "), "secret-like content redacted", "secret handoff notes redaction");
});

console.log(`chatgpt-handoff smoke ok (${smokeRoot})`);

function createHandoff(name, input) {
  const inputPath = path.join(smokeRoot, `${name}-input.json`);
  const packetOutput = path.join(smokeRoot, `${name}-packet.json`);
  const issueOutput = path.join(smokeRoot, `${name}-issue.md`);
  const issueJsonOutput = path.join(smokeRoot, `${name}-issue.json`);

  writeJson(inputPath, input);

  runNode("scripts/create-chatgpt-handoff-packet.js", {
    CHATGPT_HANDOFF_INPUT: inputPath,
    CHATGPT_HANDOFF_PACKET_OUTPUT: packetOutput,
    CHATGPT_HANDOFF_ISSUE_OUTPUT: issueOutput,
    CHATGPT_HANDOFF_ISSUE_JSON_OUTPUT: issueJsonOutput
  });

  return {
    packet: readJson(packetOutput),
    issue: readJson(issueJsonOutput),
    issueBody: fs.readFileSync(issueOutput, "utf8")
  };
}

function routeIssueBodyThroughIntake(name, issueBody, apps) {
  const intakeOutput = path.join(smokeRoot, `${name}-intake.json`);

  runNode("scripts/create-intake-packet.js", {
    INTAKE_REQUEST: issueBody,
    INTAKE_PACKET_OUTPUT: intakeOutput,
    INTAKE_KNOWN_APPS: JSON.stringify(apps)
  });

  return readJson(intakeOutput);
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

function runNode(scriptPath, env) {
  return execFileSync(process.execPath, [path.join(repoRoot, scriptPath)], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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

function assertDoesNotInclude(value, expected, message) {
  if (String(value).includes(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(value)} not to include ${JSON.stringify(expected)}`);
  }
}
