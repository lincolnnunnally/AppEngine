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
  getApprovedSparkPreviewItems,
  sparkReviewStatuses,
  updateSparkReviewQueueFollowUp,
  updateSparkReviewQueueStatus
} = reviewQueueModule;

const requiredStatuses = ["follow_up_needed", "encouragement_sent", "ready_for_public_preview"];
for (const status of requiredStatuses) {
  assert(sparkReviewStatuses.includes(status), `missing Spark follow-up status: ${status}`);
}

const baseItem = createSparkReviewQueueItem({
  reference: "SOH-LITE-FOLLOW-UP-001",
  storyTitle: "A follow-up story",
  categoryOrStruggle: "Recovery or rebuilding",
  hopeOutcome: "A careful next step",
  submittedAt: "2026-06-16T12:00:00.000Z"
});

assert(baseItem.followUpNotes === "No follow-up notes yet.", "new items should include default follow-up notes");
assert(
  baseItem.recommendedNextStep === "Review privately before any encouragement or preview action.",
  "new items should include a default recommended next step"
);

const updatedFollowUp = updateSparkReviewQueueFollowUp(baseItem, {
  followUpNotes: "Ask whether the person wants encouragement before any preview step.",
  recommendedNextStep: "Mark follow_up_needed and keep private."
});

assert(updatedFollowUp.followUpNotes.includes("Ask whether"), "follow-up notes should update");
assert(updatedFollowUp.recommendedNextStep.includes("follow_up_needed"), "recommended next step should update");

const allStatuses = sparkReviewStatuses.map((status, index) =>
  updateSparkReviewQueueStatus(
    {
      ...baseItem,
      id: `item-${status}`,
      safeIdentifier: `SOH-LITE-FOLLOW-UP-${index}`,
      titleOrName: `Story ${status}`
    },
    status
  )
);

const approvedItems = getApprovedSparkPreviewItems(allStatuses);
assert(approvedItems.length === 1, "only approved_for_preview should appear in public preview");
assert(approvedItems[0].status === "approved_for_preview", "approved preview filter must use approved_for_preview");
for (const status of requiredStatuses) {
  assert(!approvedItems.some((item) => item.status === status), `${status} must not appear publicly`);
}

const prompt = buildSparkReviewQueueNextPrompt([
  updatedFollowUp,
  updateSparkReviewQueueStatus(baseItem, "ready_for_public_preview"),
  updateSparkReviewQueueStatus(baseItem, "approved_for_preview")
]);
assert(prompt.includes("needing follow-up"), "next prompt should summarize follow-up work");
assert(prompt.includes("ready for public preview review"), "next prompt should summarize ready-for-preview review");
assert(
  prompt.includes("approved_for_preview"),
  "next prompt should preserve approved-only public preview guardrail"
);

const page = fs.readFileSync(path.join(root, "src/app/spark-of-hope/page.tsx"), "utf8");
assert(page.includes("Follow-up notes"), "Spark page should render follow-up notes");
assert(page.includes("Recommended next step"), "Spark page should render recommended next step");
assert(page.includes("updateSparkReviewQueueFollowUp"), "Spark page should update follow-up metadata locally");

const source = fs.readFileSync(path.join(root, "source-of-truth/vnext/spark-follow-up-review.md"), "utf8");
assert(source.includes("Public preview remains limited to `approved_for_preview`"), "source should define public preview boundary");
assert(source.includes("local/mock"), "source should preserve local/mock persistence");

console.log("spark-follow-up-review smoke ok");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
