export const sparkReminderPreferences = ["none", "one_week", "one_month", "after_encouragement"] as const;
export const sparkReminderStatuses = ["pending_review", "ready_to_remind", "reminder_noted", "closed"] as const;

export type SparkReminderPreference = (typeof sparkReminderPreferences)[number];
export type SparkReminderStatus = (typeof sparkReminderStatuses)[number];

export type SparkReminderQueueItem = {
  id: string;
  safeIdentifier: string;
  titleOrName: string;
  preference: SparkReminderPreference;
  preferenceLabel: string;
  status: SparkReminderStatus;
  submittedAt: string;
  reminderNote: string;
  ownerReviewNote: string;
  safetyNote: string;
};

export const sparkReminderQueueStorageKey = "spark-of-hope-intake-lite.reminder-queue.v1";

export const sparkReminderQueueGuardrails = [
  "Local/mock reminder queue only.",
  "No emails, texts, push notifications, or external reminders are sent.",
  "No private story body, email, or contact details appear in reminder items.",
  "Reminder items are owner-review prompts, not automation triggers."
];

export function createSparkReminderQueueItem({
  reference,
  preferredName,
  storyTitle,
  preference,
  reminderNote,
  submittedAt
}: {
  reference?: string | null;
  preferredName?: string | null;
  storyTitle?: string | null;
  preference?: string | null;
  reminderNote?: string | null;
  submittedAt?: string;
}): SparkReminderQueueItem | null {
  const safePreference = normalizeReminderPreference(preference);
  if (safePreference === "none") return null;

  const safeIdentifier = cleanReminderText(reference) || `SOH-REMINDER-${Date.now()}`;
  const titleOrName = cleanReminderText(storyTitle) || cleanReminderText(preferredName) || safeIdentifier;

  return {
    id: `${safeIdentifier}-reminder`,
    safeIdentifier,
    titleOrName,
    preference: safePreference,
    preferenceLabel: labelForReminderPreference(safePreference),
    status: "pending_review",
    submittedAt: submittedAt || new Date().toISOString(),
    reminderNote: cleanReminderText(reminderNote) || "Contributor asked for a gentle follow-up reminder.",
    ownerReviewNote: "Review privately before any manual encouragement or testimony follow-up.",
    safetyNote: "No reminder is sent automatically. This queue stores safe metadata only."
  };
}

export function updateSparkReminderStatus(
  item: SparkReminderQueueItem,
  status: SparkReminderStatus
): SparkReminderQueueItem {
  return {
    ...item,
    status
  };
}

export function isSparkReminderStatus(value: string): value is SparkReminderStatus {
  return sparkReminderStatuses.includes(value as SparkReminderStatus);
}

export function isSparkReminderPreference(value: string): value is SparkReminderPreference {
  return sparkReminderPreferences.includes(value as SparkReminderPreference);
}

export function buildSparkReminderNextPrompt(items: SparkReminderQueueItem[]) {
  const pendingCount = items.filter((item) => item.status === "pending_review").length;
  const readyCount = items.filter((item) => item.status === "ready_to_remind").length;

  return [
    "Next Spark of Hope reminder improvement:",
    "",
    "Review the local/mock contributor reminder queue and propose the next safe manual follow-up workflow.",
    "",
    `Current reminder summary: ${items.length} local/mock reminder item(s), ${pendingCount} pending review, ${readyCount} ready for manual reminder review.`,
    "",
    "Guardrails:",
    "- Do not send emails, texts, push notifications, or external reminders.",
    "- Do not expose private story body, email, or contact details.",
    "- Do not publish stories from reminder status.",
    "- Do not trigger Codex, create GitHub issues, apply labels, deploy, migrate, or create paid resources.",
    "",
    "Expected result:",
    "Recommend the next bounded Spark reminder improvement that stays owner-reviewed and local/mock."
  ].join("\n");
}

function normalizeReminderPreference(value?: string | null): SparkReminderPreference {
  const normalized = cleanReminderText(value);
  return isSparkReminderPreference(normalized) ? normalized : "none";
}

function labelForReminderPreference(value: SparkReminderPreference) {
  const labels: Record<SparkReminderPreference, string> = {
    none: "No reminder requested",
    one_week: "Check back in about one week",
    one_month: "Check back in about one month",
    after_encouragement: "Check back after encouragement is prepared"
  };

  return labels[value];
}

function cleanReminderText(value?: string | null) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 500) : "";
}
