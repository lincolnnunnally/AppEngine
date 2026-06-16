import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const reviewQueueModule = await import(
  pathToFileURL(path.join(root, "src/lib/spark-of-hope-intake-lite/review-queue.ts")).href
);

const { createSparkReviewQueueItem, getApprovedSparkPreviewItems, sparkReviewStatuses, updateSparkReviewQueueStatus } =
  reviewQueueModule;

const baseItem = createSparkReviewQueueItem({
  reference: "SOH-LITE-APPROVED-001",
  storyTitle: "A safe approved story",
  categoryOrStruggle: "Discouragement",
  hopeOutcome: "A reminder of hope",
  submittedAt: "2026-06-16T12:00:00.000Z"
});

const allStatuses = sparkReviewStatuses.map((status, index) =>
  updateSparkReviewQueueStatus(
    {
      ...baseItem,
      id: `item-${status}`,
      safeIdentifier: `SOH-LITE-${index}`,
      titleOrName: `Story ${status}`
    },
    status
  )
);

const approvedItems = getApprovedSparkPreviewItems(allStatuses);
assert(approvedItems.length === 1, "only one item should be approved for preview");
assert(approvedItems[0].status === "approved_for_preview", "approved preview list must only include approved status");
assert(!approvedItems.some((item) => item.status === "hidden"), "hidden items must not appear in public preview");
assert(!approvedItems.some((item) => item.status === "needs_review"), "needs_review items must not appear in public preview");
assert(!approvedItems.some((item) => item.status === "needs_followup"), "needs_followup items must not appear in public preview");
assert(!approvedItems.some((item) => item.status === "new"), "new items must not appear in public preview");

const serializedApproved = JSON.stringify(approvedItems).toLowerCase();
assert(!serializedApproved.includes("email"), "approved preview must not expose email fields");
assert(!serializedApproved.includes("storybody"), "approved preview must not expose story body fields");

const page = fs.readFileSync(path.join(root, "src/app/spark-of-hope-intake-lite/page.tsx"), "utf8");
assert(page.includes('data-testid="spark-approved-preview"'), "Spark page should expose approved preview marker");
assert(page.includes("approvedPreviewItems"), "Spark page should render approved preview items");
assert(page.includes("getApprovedSparkPreviewItems"), "Spark page should use approved-only filter helper");
assert(page.includes("No approved preview stories yet."), "Spark page should include approved preview empty state");
assert(page.includes("New, hidden"), "Spark page should explain non-approved statuses stay out of public preview");

const source = fs.readFileSync(path.join(root, "source-of-truth/vnext/spark-approved-preview-safety.md"), "utf8");
assert(source.includes("Only items with status `approved_for_preview`"), "source of truth should define approved-only rule");
assert(source.includes("No public publishing beyond the approved preview list."), "source should preserve publishing guardrail");
assert(source.includes("local/mock"), "source should declare local/mock persistence");

console.log("spark-approved-preview smoke ok");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
