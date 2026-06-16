import type { SparkReviewQueueItem } from "./review-queue";

export type SparkPublicTrialChecklistItem = {
  id: string;
  label: string;
  status: "pass" | "needs_review";
  note: string;
};

export type SparkPublicTrialReadiness = {
  kind: "spark_public_trial_readiness";
  readyForLimitedPublicTesting: boolean;
  gateStatus: "ready_for_limited_public_testing" | "not_ready";
  ownerReadableSummary: string;
  safetyLanguage: {
    previewOnly: string;
    notEmergencySupport: string;
    crisisSupportPlaceholder: string;
  };
  checklist: SparkPublicTrialChecklistItem[];
  guardrails: string[];
};

export const sparkPublicTrialSafetyLanguage = {
  previewOnly: "Preview only. Spark of Hope Intake Lite is being tested with limited review, not publicly launched.",
  notEmergencySupport: "This form is not emergency support, crisis counseling, or a replacement for local professional help.",
  crisisSupportPlaceholder:
    "Crisis-support resources will be added after owner review. Do not add hotline numbers until the crisis-support copy is approved."
};

export const sparkPublicTrialGuardrails = [
  "No public launch from this checklist.",
  "No emergency-support claim.",
  "No crisis hotline numbers until owner-approved crisis-support copy exists.",
  "No private story body, email, or contact details in public preview areas.",
  "No public sharing unless an item is explicitly approved for preview.",
  "No mentor matching, outbound reminders, paid resources, migrations, production deploys, secrets/env changes, or automatic Codex triggers."
];

export function getSparkPublicTrialReadiness({
  reviewQueueItems,
  approvedPreviewItems
}: {
  reviewQueueItems: SparkReviewQueueItem[];
  approvedPreviewItems: SparkReviewQueueItem[];
}): SparkPublicTrialReadiness {
  const approvedCount = approvedPreviewItems.length;
  const hasHiddenOrReviewOnlyItems = reviewQueueItems.some((item) => item.status !== "approved_for_preview");
  const checklist: SparkPublicTrialChecklistItem[] = [
    {
      id: "safety-language-visible",
      label: "Preview and emergency-support safety language is visible",
      status: "pass",
      note: "The page states preview-only status and says the form is not emergency support."
    },
    {
      id: "crisis-placeholder-visible",
      label: "Crisis-support placeholder is present without hotline numbers",
      status: "pass",
      note: "The placeholder waits for owner-approved crisis-support copy before any numbers are added."
    },
    {
      id: "approved-only-public-list",
      label: "Public preview list is approved-only",
      status: approvedCount > 0 ? "pass" : "needs_review",
      note:
        approvedCount > 0
          ? `${approvedCount} approved item${approvedCount === 1 ? "" : "s"} can appear in the preview list.`
          : "No approved preview items exist yet, so public testing should remain limited to form and safety copy review."
    },
    {
      id: "private-items-stay-private",
      label: "Non-approved items stay private",
      status: "pass",
      note: hasHiddenOrReviewOnlyItems
        ? "Review-only, follow-up, hidden, and new items are excluded from the public-facing approved preview list."
        : "No non-approved review items are currently stored in local/mock review state."
    },
    {
      id: "mock-local-only",
      label: "Local/mock storage remains the default",
      status: "pass",
      note: "The trial gate does not enable production storage, paid providers, migrations, outbound messages, or public launch."
    }
  ];
  const readyForLimitedPublicTesting = checklist.every((item) => item.status === "pass");

  return {
    kind: "spark_public_trial_readiness",
    readyForLimitedPublicTesting,
    gateStatus: readyForLimitedPublicTesting ? "ready_for_limited_public_testing" : "not_ready",
    ownerReadableSummary: readyForLimitedPublicTesting
      ? "Spark is ready for a limited public trial review of the preview form and approved-only story list."
      : "Spark is not ready for limited public testing until at least one item is owner-approved for preview and safety copy remains visible.",
    safetyLanguage: sparkPublicTrialSafetyLanguage,
    checklist,
    guardrails: sparkPublicTrialGuardrails
  };
}
