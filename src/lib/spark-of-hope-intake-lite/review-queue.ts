export const sparkReviewStatuses = [
  "new",
  "needs_review",
  "approved_for_preview",
  "needs_followup",
  "hidden"
] as const;

export type SparkReviewStatus = (typeof sparkReviewStatuses)[number];

export type SparkReviewQueueItem = {
  id: string;
  safeIdentifier: string;
  titleOrName: string;
  categoryOrStruggle: string;
  hopeOutcome: string;
  status: SparkReviewStatus;
  submittedAt: string;
  safetyModerationNote: string;
  ownerReviewNotes: string;
};

export const sparkReviewQueueStorageKey = "spark-of-hope-intake-lite.review-queue.v1";

export const sparkReviewQueueGuardrails = [
  "No public publishing by default.",
  "No private story body, email, or contact details appear in the queue.",
  "No automatic sharing, mentor matching, or follow-up action.",
  "Review status changes stay local/mock until persistence is explicitly approved."
];

export function createSparkReviewQueueItem({
  reference,
  preferredName,
  storyTitle,
  categoryOrStruggle,
  hopeOutcome,
  submittedAt
}: {
  reference?: string | null;
  preferredName?: string | null;
  storyTitle?: string | null;
  categoryOrStruggle?: string | null;
  hopeOutcome?: string | null;
  submittedAt?: string;
}): SparkReviewQueueItem {
  const safeIdentifier = cleanQueueText(reference) || `SOH-LOCAL-${Date.now()}`;
  const titleOrName = cleanQueueText(storyTitle) || cleanQueueText(preferredName) || safeIdentifier;

  return {
    id: safeIdentifier,
    safeIdentifier,
    titleOrName,
    categoryOrStruggle: cleanQueueText(categoryOrStruggle) || "Not specified",
    hopeOutcome: cleanQueueText(hopeOutcome) || "Not provided yet",
    status: "new",
    submittedAt: submittedAt || new Date().toISOString(),
    safetyModerationNote:
      "Private preview only. Do not publish, auto-share, expose contact details, or start mentor matching from this queue.",
    ownerReviewNotes:
      "Review for safety, consent, clarity, and whether the story needs follow-up before it can be used in any preview workflow."
  };
}

export function updateSparkReviewQueueStatus(
  item: SparkReviewQueueItem,
  status: SparkReviewStatus
): SparkReviewQueueItem {
  return {
    ...item,
    status
  };
}

export function buildSparkReviewQueueNextPrompt(items: SparkReviewQueueItem[]) {
  const needsReviewCount = items.filter((item) => item.status === "new" || item.status === "needs_review").length;
  const approvedCount = items.filter((item) => item.status === "approved_for_preview").length;

  return [
    "Next Spark of Hope Intake Lite improvement:",
    "",
    "Review the local Spark Review Queue Lite behavior and propose the next safe persistence/admin improvement.",
    "",
    `Current queue summary: ${items.length} local/mock item(s), ${needsReviewCount} needing review, ${approvedCount} approved for preview.`,
    "",
    "Guardrails:",
    "- Keep production blocked.",
    "- Do not create paid resources.",
    "- Do not apply migrations.",
    "- Do not expose private story body, email, or contact details.",
    "- Do not auto-share stories or start mentor matching.",
    "- Do not trigger Codex, create GitHub issues, or apply labels automatically.",
    "",
    "Expected result:",
    "Recommend the next bounded Spark improvement that moves from local/mock review toward controlled persistence only after review gates."
  ].join("\n");
}

export function isSparkReviewStatus(value: string): value is SparkReviewStatus {
  return sparkReviewStatuses.includes(value as SparkReviewStatus);
}

function cleanQueueText(value?: string | null) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}
