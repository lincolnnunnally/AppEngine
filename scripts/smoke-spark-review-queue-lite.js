import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const reviewQueueModule = await import(
  pathToFileURL(path.join(root, "src/lib/spark-of-hope-intake-lite/review-queue.ts")).href
);

const {
  buildSparkReviewQueueNextPrompt,
  createSparkReviewQueueItem,
  sparkReviewQueueGuardrails,
  sparkReviewQueueStorageKey,
  sparkReviewStatuses,
  updateSparkReviewQueueStatus
} = reviewQueueModule;

assert(
  JSON.stringify(sparkReviewStatuses) ===
    JSON.stringify(["new", "needs_review", "approved_for_preview", "needs_followup", "hidden"]),
  "review statuses must match the Spark Review Queue Lite contract"
);

const item = createSparkReviewQueueItem({
  reference: "SOH-LITE-PREVIEW-ABC123",
  preferredName: "Private Person",
  storyTitle: "A hopeful moment",
  categoryOrStruggle: "Discouragement",
  hopeOutcome: "A reminder that someone cares",
  submittedAt: "2026-06-16T12:00:00.000Z"
});

assert(item.status === "new", "new queue items should start in new status");
assert(item.safeIdentifier === "SOH-LITE-PREVIEW-ABC123", "queue item should use the safe public reference");
assert(item.categoryOrStruggle === "Discouragement", "queue item should preserve safe category metadata");
assert(item.hopeOutcome === "A reminder that someone cares", "queue item should preserve safe hope outcome metadata");

const updatedItem = updateSparkReviewQueueStatus(item, "needs_review");
assert(updatedItem.status === "needs_review", "status update should keep review state local and explicit");

const serializedItem = JSON.stringify(item).toLowerCase();
assert(!serializedItem.includes("email"), "queue item must not expose email fields");
assert(!serializedItem.includes("storybody"), "queue item must not expose story body fields");

const prompt = buildSparkReviewQueueNextPrompt([updatedItem]);
assert(prompt.includes("Do not expose private story body"), "next prompt should preserve privacy guardrails");
assert(prompt.includes("Do not trigger Codex"), "next prompt should not trigger Codex automatically");
assert(!prompt.includes("ai:build"), "next prompt should not apply execution labels");

assert(
  sparkReviewQueueGuardrails.some((guardrail) => guardrail.includes("No public publishing")),
  "guardrails should block public publishing by default"
);
assert(sparkReviewQueueStorageKey.includes("review-queue"), "local storage key should be scoped to the review queue");

const page = fs.readFileSync(path.join(root, "src/app/spark-of-hope-intake-lite/page.tsx"), "utf8");
assert(page.includes('data-testid="spark-review-queue-lite"'), "Spark page should expose a review queue test marker");
assert(page.includes("sparkReviewQueueStorageKey"), "Spark page should use local/mock review queue persistence");
assert(page.includes("copySparkReviewPrompt"), "Spark page should include copyable next prompt behavior");
assert(page.includes("categoryOrStruggle"), "Spark page should capture category/struggle metadata");
assert(page.includes("hopeOutcome"), "Spark page should capture hope outcome metadata");

const source = fs.readFileSync(path.join(root, "source-of-truth/vnext/spark-review-queue-lite.md"), "utf8");
assert(source.includes("No public publishing by default."), "source of truth should include publishing guardrail");
assert(source.includes("No mentor matching."), "source of truth should block mentor matching");
assert(source.includes("local/mock"), "source of truth should declare local/mock persistence");

console.log("spark-review-queue-lite smoke ok");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
