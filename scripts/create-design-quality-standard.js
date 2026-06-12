import fs from "node:fs";
import path from "node:path";

const combinedOutput = process.env.DESIGN_REVIEW_OUTPUT || "";
const designOutput = process.env.DESIGN_REVIEW_ARTIFACT_OUTPUT || "";
const followUpsOutput = process.env.DESIGN_REVIEW_FOLLOWUPS_OUTPUT || "";
const inputPath = process.env.DESIGN_REVIEW_INPUT || "";

const input = readInput(inputPath);
const appName = input.name || process.env.APP_NAME || "Example App";
const slug = input.slug || process.env.APP_SLUG || slugify(appName);
const audience = input.audience || listFromEnv("APP_AUDIENCE", ["Primary users"]);
const emotionalFit =
  input.emotionalFit ||
  process.env.APP_EMOTIONAL_FIT ||
  "Clear, trustworthy, calm, and fitted to the audience's real-life context.";

const designReview =
  input.designReview ||
  buildDesignReview({
    appName,
    slug,
    audience,
    emotionalFit
  });

const followUpTasks = buildFollowUpTasks({ appName, slug, designReview });
const output = {
  agent: "designer",
  status: "needs_follow_up",
  summary: `Created Design Quality Gate and UX Review plan for ${appName}.`,
  artifacts: [
    {
      kind: "design_review",
      title: `${appName} Design Quality Gate`,
      content: designReview
    }
  ],
  findings: [],
  followUpTasks,
  handoffTo: ["customer_perspective", "workflow_tester", "code_reviewer"]
};

validateDesignReview(designReview);

if (combinedOutput) writeJson(combinedOutput, output);
if (designOutput) writeJson(designOutput, designReview);
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks });

console.log(`design-review ok: ${appName} (${slug})`);
console.log(`checks: ${designReview.qualityChecks.map((check) => check.id).join(", ")}`);

function readInput(filePath) {
  if (!filePath) return {};
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return {};
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function listFromEnv(name, fallback) {
  const raw = process.env[name] || "";
  if (!raw.trim()) return fallback;
  return raw
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildDesignReview({ appName, slug, audience, emotionalFit }) {
  return {
    kind: "design_review",
    schemaVersion: 1,
    app: {
      name: appName,
      slug,
      audience
    },
    reviewers: {
      designerRequired: true,
      customerPerspectiveRequired: true,
      designerStatus: "required",
      customerPerspectiveStatus: "required"
    },
    qualityChecks: [
      qualityCheck("simple_navigation", "Can the user understand where they are and where to go next?"),
      qualityCheck("clear_primary_action", "Is the next best action obvious on the main workflow screens?"),
      qualityCheck("mobile_first_layout", "Does the workflow feel complete and comfortable on mobile?"),
      qualityCheck("readable_copy", "Is the copy clear, human, and free of unnecessary technical language?"),
      qualityCheck("accessible_spacing_contrast", "Are spacing, contrast, and text size comfortable and accessible?"),
      qualityCheck("trust_building_elements", "Does the interface explain status, privacy, next steps, and safety where trust matters?"),
      qualityCheck("audience_emotional_fit", "Does the experience feel emotionally right for the people this app serves?")
    ],
    stateChecks: ["mobile", "empty states", "error states", "loading states", "onboarding", "admin screens", "Super Admin status"],
    uxReview: {
      required: true,
      status: "required",
      surfaces: ["first screen", "main workflow", "mobile", "empty states", "error states", "onboarding", "admin screens"],
      emotionalFit,
      releaseBlockingIssues: []
    },
    workflowTestChecks: ["mobile", "empty states", "error states", "onboarding", "admin screens"],
    guardrails: {
      blocksReleaseGateApproval: true,
      requiresDesignerReview: true,
      requiresCustomerPerspectiveReview: true,
      blocksUglyOrConfusingApps: true
    }
  };
}

function qualityCheck(id, question) {
  return {
    id,
    status: "required",
    question
  };
}

function buildFollowUpTasks({ appName, slug, designReview }) {
  return [
    {
      title: `[${slug}] Design Quality Gate`,
      recommendedLabel: "ai:review",
      body: [
        `Run the Design Quality Gate for ${appName}.`,
        "",
        "## Design Quality",
        `- Audience: ${designReview.app.audience.join(", ")}`,
        `- Checks: ${designReview.qualityChecks.map((check) => check.id).join(", ")}`,
        `- State checks: ${designReview.stateChecks.join(", ")}`,
        "",
        "## Required Reviews",
        "- Designer review: required",
        "- Customer Perspective review: required",
        "",
        "## Guardrails",
        "- Block Release Gate approval if the app is technically working but ugly, confusing, inaccessible, or emotionally mismatched.",
        "- Create ai:fix follow-up work for release-blocking design issues."
      ].join("\n")
    },
    {
      title: `[${slug}] Customer Perspective UX review`,
      recommendedLabel: "ai:review",
      body: [
        `Review ${appName} from the target user's perspective.`,
        "",
        "## UX Review",
        `- Emotional fit: ${designReview.uxReview.emotionalFit}`,
        `- Surfaces: ${designReview.uxReview.surfaces.join(", ")}`,
        "- Check trust, clarity, friction, motivation, empty states, error states, onboarding, and admin status.",
        "",
        "## Guardrails",
        "- Do not approve release if users would need explanation to understand what to do.",
        "- Mark confusing, cold, or audience-mismatched experiences as release blockers."
      ].join("\n")
    },
    {
      title: `[${slug}] UX workflow test checks`,
      recommendedLabel: "ai:review",
      body: [
        `Test UX workflow states for ${appName}.`,
        "",
        "## Workflow Test Checks",
        `- Checks: ${designReview.workflowTestChecks.join(", ")}`,
        "- Verify the user path, mobile path, empty state path, error state path, onboarding path, and admin path.",
        "",
        "## Guardrails",
        "- Create ai:fix follow-up work for missing or confusing states.",
        "- Do not mark release ready until design review and UX state checks are complete."
      ].join("\n")
    }
  ];
}

function validateDesignReview(review) {
  const missing = [];

  for (const [label, value] of [
    ["kind", review.kind],
    ["app.name", review.app?.name],
    ["app.slug", review.app?.slug],
    ["reviewers.designerStatus", review.reviewers?.designerStatus],
    ["reviewers.customerPerspectiveStatus", review.reviewers?.customerPerspectiveStatus],
    ["uxReview.status", review.uxReview?.status]
  ]) {
    if (!value) missing.push(label);
  }

  for (const [label, value] of [
    ["app.audience", review.app?.audience],
    ["qualityChecks", review.qualityChecks],
    ["stateChecks", review.stateChecks],
    ["workflowTestChecks", review.workflowTestChecks]
  ]) {
    if (!Array.isArray(value) || value.length === 0) missing.push(label);
  }

  for (const requiredCheck of ["simple_navigation", "clear_primary_action", "mobile_first_layout", "audience_emotional_fit"]) {
    if (!review.qualityChecks?.some((check) => check.id === requiredCheck)) missing.push(`qualityChecks.${requiredCheck}`);
  }

  if (!review.guardrails?.blocksReleaseGateApproval || !review.guardrails?.requiresDesignerReview || !review.guardrails?.requiresCustomerPerspectiveReview) {
    missing.push("guardrails");
  }

  if (missing.length) throw new Error(`Design review is missing required fields: ${missing.join(", ")}`);
}

function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "app";
}
