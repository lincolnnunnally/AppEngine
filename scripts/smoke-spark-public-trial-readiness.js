import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

const readinessModule = await import(pathToFileURL(path.join(root, "src/lib/spark-of-hope-intake-lite/public-trial-readiness.ts")).href);
const { getSparkPublicTrialReadiness, sparkPublicTrialSafetyLanguage } = readinessModule;

const emptyGate = getSparkPublicTrialReadiness({ reviewQueueItems: [], approvedPreviewItems: [] });
assertEqual(emptyGate.kind, "spark_public_trial_readiness", "artifact kind");
assertEqual(emptyGate.readyForLimitedPublicTesting, false, "empty gate should not pass");
assertEqual(emptyGate.gateStatus, "not_ready", "empty gate status");
assertIncludes(emptyGate.ownerReadableSummary, "not ready", "not-ready owner summary");
assertIncludes(sparkPublicTrialSafetyLanguage.notEmergencySupport, "not emergency support", "emergency disclaimer");
assertIncludes(sparkPublicTrialSafetyLanguage.crisisSupportPlaceholder, "Do not add hotline numbers", "crisis placeholder");
assert(!/\b(988|911|1-800|800-)\b/.test(sparkPublicTrialSafetyLanguage.crisisSupportPlaceholder), "placeholder should not include hotline numbers yet");

const approvedItem = {
  id: "SOH-APPROVED-1",
  safeIdentifier: "SOH-APPROVED-1",
  titleOrName: "A careful preview story",
  categoryOrStruggle: "Discouragement",
  hopeOutcome: "A next step toward hope",
  status: "approved_for_preview",
  submittedAt: "2026-06-16T00:00:00.000Z",
  safetyModerationNote: "Safe for preview metadata only.",
  ownerReviewNotes: "Owner approved metadata preview.",
  followUpNotes: "No follow-up needed.",
  recommendedNextStep: "Keep in approved preview list."
};
const reviewOnlyItem = {
  ...approvedItem,
  id: "SOH-PRIVATE-1",
  safeIdentifier: "SOH-PRIVATE-1",
  status: "needs_review"
};
const readyGate = getSparkPublicTrialReadiness({ reviewQueueItems: [approvedItem, reviewOnlyItem], approvedPreviewItems: [approvedItem] });
assertEqual(readyGate.readyForLimitedPublicTesting, true, "ready gate should pass with approved item");
assertEqual(readyGate.gateStatus, "ready_for_limited_public_testing", "ready gate status");
assert(readyGate.checklist.every((item) => item.status === "pass"), "ready checklist should pass");
assertIncludes(readyGate.guardrails.join("\n"), "No public launch", "launch guardrail");
assertIncludes(readyGate.guardrails.join("\n"), "No crisis hotline numbers", "crisis guardrail");

const page = read("src/app/spark-of-hope/page.tsx");
if (page.includes('data-app-marker="spark-of-hope-mvp-v0-1"')) {
  assertIncludes(page, 'data-testid="spark-public-trial-readiness"', "Spark MVP page should preserve trial readiness marker");
  console.log("spark-public-trial-readiness smoke ok (legacy surface superseded by Spark MVP)");
  process.exit(0);
}

assertIncludes(page, 'data-testid="spark-public-trial-readiness"', "page should expose trial readiness marker");
assertIncludes(page, "Not emergency support", "page should show emergency-support safety language");
assertIncludes(page, "crisisSupportPlaceholder", "page should include crisis-support placeholder copy");
assertIncludes(page, "publicTrialReadiness.checklist", "page should render readiness checklist");

const styles = read("src/app/styles.css");
assertIncludes(styles, ".spark-public-trial-section", "styles should define public trial section");
assertIncludes(styles, ".spark-public-trial-grid", "styles should define readiness grid");

const source = read("source-of-truth/vnext/spark-public-trial-readiness.md");
assertIncludes(source, "spark_public_trial_readiness", "source should document artifact");
assertIncludes(source, "Do not add hotline numbers", "source should preserve hotline placeholder rule");

const packageJson = read("package.json");
assertIncludes(packageJson, "smoke:spark-public-trial-readiness", "package should expose smoke script");

console.log("spark-public-trial-readiness smoke ok");

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

function assertIncludes(value, phrase, label) {
  if (!String(value || "").includes(phrase)) {
    throw new Error(`${label}: expected to include "${phrase}"`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
