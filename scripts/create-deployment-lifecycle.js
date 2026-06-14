import fs from "node:fs";
import path from "node:path";
import { buildDeploymentLifecycle, validateDeploymentLifecycle } from "./lib/deployment-lifecycle.js";

const combinedOutput = process.env.DEPLOYMENT_LIFECYCLE_OUTPUT || "";
const artifactOutput = process.env.DEPLOYMENT_LIFECYCLE_ARTIFACT_OUTPUT || "";
const inputPath = process.env.DEPLOYMENT_LIFECYCLE_INPUT || "";
const packetPath = process.env.DEPLOYMENT_LIFECYCLE_PACKET || "";
const previewVerificationPath = process.env.PREVIEW_VERIFICATION_INPUT || "";

const input = readInput(inputPath);
const packet = readInput(packetPath);
const previewVerification = readInput(previewVerificationPath);
const packetApp = packet.app || packet.content?.app || {};
const appName = input.appName || input.name || packetApp.name || process.env.APP_NAME || "Example App";
const slug = input.appSlug || input.slug || packetApp.slug || process.env.APP_SLUG || slugify(appName);
const lifecycle = buildDeploymentLifecycle({
  input,
  packet,
  previewVerification,
  appName,
  slug,
  relatedPreviewUrl: input.relatedPreviewUrl || process.env.BUILD_RELATED_PREVIEW_URL || ""
});

validateDeploymentLifecycle(lifecycle);

const output = {
  agent: "planner",
  status: lifecycle.discovery.reviewUrlKnown ? "completed" : "needs_follow_up",
  summary: lifecycle.discovery.reviewUrlKnown
    ? `Deployment lifecycle recorded for ${appName}; owner review URL: ${lifecycle.reviewUrl}.`
    : `Deployment lifecycle recorded for ${appName}, but owner review URL is unknown.`,
  artifacts: [
    {
      kind: "deployment_lifecycle",
      title: `${appName} Deployment Lifecycle`,
      content: lifecycle
    }
  ],
  findings: lifecycle.discovery.reviewUrlKnown
    ? []
    : [
        {
          severity: "high",
          title: "Owner review URL is missing",
          details: "AppEngine cannot claim the build is reviewable until a review URL is known and accessible.",
          recommendedLabel: "ai:fix"
        }
      ],
  followUpTasks: lifecycle.discovery.reviewUrlKnown
    ? []
    : [
        {
          title: `[${slug}] Define owner review URL`,
          recommendedLabel: "ai:fix",
          body: buildReviewUrlFollowUp(lifecycle)
        }
      ],
  handoffTo: lifecycle.discovery.reviewUrlKnown ? ["workflow_tester"] : ["fixer"]
};

if (combinedOutput) writeJson(combinedOutput, output);
if (artifactOutput) writeJson(artifactOutput, lifecycle);

console.log(`deployment-lifecycle ok: ${appName} (${slug})`);
console.log(`state: ${lifecycle.deploymentState}`);
console.log(`review: ${lifecycle.reviewUrl}`);

function buildReviewUrlFollowUp(lifecycle) {
  return [
    `Define the owner review URL for ${lifecycle.app.name}.`,
    "",
    "AppEngine must know exactly where Lincoln reviews the current build before preview verification can pass.",
    "",
    "## Current Lifecycle",
    `- Review URL: ${lifecycle.reviewUrl}`,
    `- Production URL: ${lifecycle.productionUrl}`,
    `- Deployment URL: ${lifecycle.deploymentUrl}`,
    `- Deployment state: ${lifecycle.deploymentState}`,
    `- Current version: ${lifecycle.currentVersion}`,
    "",
    "## Required Source Of Truth To Load",
    "- source-of-truth/00-why-we-build.md",
    "- source-of-truth/01-ecosystem-philosophy.md",
    "- source-of-truth/02-global-principles.md",
    "- source-of-truth/03-life-produces-life.md",
    "- source-of-truth/04-app-purpose-rules.md",
    "- source-of-truth/05-ecosystem-design-gates.md",
    "- source-of-truth/app-url-lifecycle-standard.md",
    "- source-of-truth/build-completion-orchestrator.md",
    "- source-of-truth/deployment-environment-standard.md",
    "- agents/context/output-contracts.md",
    "",
    "## Guardrails",
    "- Do not deploy production.",
    "- Do not create paid resources.",
    "- Do not apply migrations.",
    "- Do not merge generated app code automatically.",
    "- Do not post protected Vercel bypass/share links publicly."
  ].join("\n");
}

function readInput(filePath) {
  if (!filePath) return {};
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return {};
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
}

function slugify(value) {
  return String(value || "app")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "app";
}
