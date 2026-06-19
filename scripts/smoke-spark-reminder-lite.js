import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const reminderModule = await import(
  pathToFileURL(path.join(root, "src/lib/spark-of-hope-intake-lite/reminder-queue.ts")).href
);

const {
  buildSparkReminderNextPrompt,
  createSparkReminderQueueItem,
  sparkReminderQueueGuardrails,
  sparkReminderStatuses,
  updateSparkReminderStatus
} = reminderModule;

const noneItem = createSparkReminderQueueItem({
  reference: "SOH-LITE-NO-REMINDER",
  storyTitle: "No reminder",
  preference: "none"
});
assert(noneItem === null, "no reminder preference should not create a reminder item");

const reminderItem = createSparkReminderQueueItem({
  reference: "SOH-LITE-REMINDER-001",
  preferredName: "Preview contributor",
  storyTitle: "A hopeful follow-up",
  preference: "one_month",
  reminderNote: "Ask whether they want to share a follow-up testimony later.",
  submittedAt: "2026-06-16T12:00:00.000Z"
});

assert(reminderItem, "reminder preference should create a reminder item");
assertEqual(reminderItem.status, "pending_review", "default reminder status");
assertEqual(reminderItem.preference, "one_month", "stored preference");
assertIncludes(reminderItem.preferenceLabel, "one month", "preference label");
assertIncludes(reminderItem.safetyNote, "No reminder is sent automatically", "safety note");

const readyItem = updateSparkReminderStatus(reminderItem, "ready_to_remind");
assertEqual(readyItem.status, "ready_to_remind", "status update");
for (const status of ["pending_review", "ready_to_remind", "reminder_noted", "closed"]) {
  assert(sparkReminderStatuses.includes(status), `missing reminder status: ${status}`);
}

const prompt = buildSparkReminderNextPrompt([reminderItem, readyItem]);
assertIncludes(prompt, "Do not send emails, texts, push notifications", "prompt notification guardrail");
assertIncludes(prompt, "local/mock", "prompt local/mock guardrail");

const guardrails = sparkReminderQueueGuardrails.join("\n");
assertIncludes(guardrails, "No emails, texts, push notifications", "guardrail notifications");
assertIncludes(guardrails, "No private story body", "guardrail privacy");

const page = fs.readFileSync(path.join(root, "src/app/spark-of-hope/page.tsx"), "utf8");
if (page.includes('data-app-marker="spark-of-hope-mvp-v0-1"')) {
  assertIncludes(page, 'data-testid="spark-reminder-lite"', "Spark MVP page should preserve reminder marker");
  console.log("spark-reminder-lite smoke ok (legacy surface superseded by Spark MVP)");
  process.exit(0);
}

assertIncludes(page, 'data-testid="spark-reminder-lite"', "Spark page reminder marker");
assertIncludes(page, "reminderPreference", "Spark page captures reminder preference");
assertIncludes(page, "Copyable reminder prompt", "Spark page renders reminder prompt");
assertIncludes(page, "does not send", "Spark page explains no notifications");

const source = fs.readFileSync(path.join(root, "source-of-truth/vnext/spark-reminder-lite.md"), "utf8");
assertIncludes(source, "No emails, texts, push notifications", "source notification guardrail");
assertIncludes(source, "local/mock", "source local/mock scope");

console.log("spark-reminder-lite smoke ok");

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
