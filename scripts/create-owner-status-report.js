import fs from "node:fs";
import path from "node:path";
import {
  absorbArtifact,
  buildOwnerStatusReport,
  collectArtifactsFromAgentRun,
  renderOwnerStatusMarkdown,
  validateOwnerStatusReport
} from "./lib/owner-status-report.js";

const agentRunDir = path.resolve(process.env.AGENT_RUN_DIR || "agent-run");
const outputPath = path.resolve(process.env.OWNER_STATUS_REPORT_OUTPUT || path.join(agentRunDir, "owner-status-report.json"));
const markdownOutputPath = path.resolve(process.env.OWNER_STATUS_REPORT_MARKDOWN_OUTPUT || path.join(agentRunDir, "owner-status-report.md"));
const codexOutputFile = path.resolve(process.env.CODEX_OUTPUT_FILE || path.join(agentRunDir, "codex-output.md"));

const artifacts = collectArtifactsFromAgentRun(agentRunDir, codexOutputFile);
const orchestrationPlan = readJsonInput(process.env.ORCHESTRATION_PLAN_INPUT || path.join(agentRunDir, "orchestration-plan.json"));
const phoneFirstPreflight = readJsonInput(process.env.PHONE_FIRST_PREFLIGHT_INPUT || path.join(agentRunDir, "phone-first-preflight.json"));

absorbArtifact(artifacts, readJsonInput(process.env.BUILD_COMPLETION_PLAN_INPUT));
absorbArtifact(artifacts, readJsonInput(process.env.DEPLOYMENT_LIFECYCLE_INPUT));
absorbArtifact(artifacts, readJsonInput(process.env.PREVIEW_VERIFICATION_INPUT));
absorbArtifact(artifacts, readJsonInput(process.env.COST_GOVERNANCE_INPUT));
absorbArtifact(artifacts, orchestrationPlan);
absorbArtifact(artifacts, phoneFirstPreflight);

const report = buildOwnerStatusReport({
  ...artifacts,
  orchestrationPlan,
  phoneFirstPreflight: artifacts.phoneFirstPreflight || phoneFirstPreflight,
  context: {
    appName: process.env.APP_NAME,
    appSlug: process.env.APP_SLUG,
    expectedRoute: process.env.EXPECTED_ROUTE,
    relatedPr: process.env.RELATED_PR,
    sourceIssueUrl: process.env.SOURCE_ISSUE_URL,
    workflowRunUrl: workflowRunUrl()
  }
});
validateOwnerStatusReport(report);

writeJson(outputPath, report);
writeText(markdownOutputPath, renderOwnerStatusMarkdown(report));

console.log(`owner-status-report ok: ${outputPath}`);
console.log(`state: ${report.currentState}`);
console.log(`next: ${report.nextSafeAction}`);

function readJsonInput(filePath) {
  if (!filePath) return null;
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return null;
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function writeJson(filePath, value) {
  writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function workflowRunUrl() {
  if (!process.env.GITHUB_REPOSITORY || !process.env.GITHUB_RUN_ID) return "";
  return `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
}
