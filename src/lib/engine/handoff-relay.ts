import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { updateProjectMemoryFromHandoff } from "./project-memory";

export type HandoffFeedbackChoice =
  | "good_direction"
  | "wrong_direction"
  | "incomplete"
  | "needs_redesign"
  | "duplicate_work"
  | "unnecessary_complexity";

export type HandoffRelaySummary = {
  kind: "handoff_relay_summary";
  schemaVersion: 1;
  id: string;
  receivedAt: string;
  source: "codex_handoff_paste";
  rawText: string;
  extracted: {
    prNumber: number | null;
    prTitle: string;
    branch: string;
    mergeStatus: string;
    verificationResults: string[];
    completedWork: string[];
    guardrailsPreserved: string[];
    risks: string[];
    blockers: string[];
    dependencies: string[];
  };
  projectState: {
    currentStatus: string;
    latestCompletedMilestone: string;
    openPrs: string[];
    recommendedNextAction: string;
    remainingMajorMilestones: string[];
  };
  nextPrompt: {
    prompt: string;
    reason: string;
    dependencies: string[];
    expectedOutcome: string;
  };
  feedback: {
    status: "unreviewed" | "reviewed";
    choices: HandoffFeedbackChoice[];
    note: string;
    improvementCandidate: string;
    updatedAt: string | null;
  };
  ownerReadableSummary: string;
  guardrails: {
    ownerApprovalOnly: true;
    noAutomaticCodexExecution: true;
    noGitHubIssueCreation: true;
    noLabelChanges: true;
    noProductionDeploy: true;
    noPaidResources: true;
    noMigrations: true;
    noSecretsOrEnvChanges: true;
    repositoryVisibilityUnchanged: true;
    noGeneratedAppAutoMerge: true;
  };
};

type StoreShape = {
  handoffs: HandoffRelaySummary[];
};

const storeDir = join(process.cwd(), ".app-engine");
const storePath = join(storeDir, "handoff-relay.json");
let memoryStore: StoreShape = { handoffs: [] };

export function createHandoffRelaySummary(rawText: string, now = new Date()): HandoffRelaySummary {
  const text = rawText.trim();

  if (text.length < 12) {
    throw new Error("Paste a Codex handoff with enough detail to summarize.");
  }

  const prNumber = extractPrNumber(text);
  const prTitle = extractPrTitle(text, prNumber);
  const branch = extractBranch(text);
  const mergeStatus = extractMergeStatus(text);
  const verificationResults = extractSectionLines(text, [
    "verification",
    "checks",
    "tested",
    "validation",
    "source:check",
    "typecheck",
    "build",
    "smoke"
  ]);
  const completedWork = extractSectionLines(text, ["what changed", "summary", "completed", "it adds", "changed", "work"]);
  const guardrailsPreserved = extractGuardrails(text);
  const risks = extractSectionLines(text, ["risk", "risks", "remaining risk", "caveat"]);
  const blockers = extractSectionLines(text, ["blocker", "blocked", "failed", "failure", "pending", "needs attention"]);
  const dependencies = extractSectionLines(text, ["dependency", "depends", "after", "before", "next likely", "next step"]);
  const openPrs = prNumber && !/merged/i.test(mergeStatus) ? [`PR #${prNumber}: ${prTitle}`] : [];
  const currentStatus = deriveCurrentStatus({ mergeStatus, blockers, verificationResults });
  const latestCompletedMilestone = deriveMilestone({ prNumber, prTitle, mergeStatus, completedWork });
  const recommendedNextAction = deriveRecommendedNextAction({ mergeStatus, blockers, verificationResults, dependencies });
  const remainingMajorMilestones = deriveRemainingMilestones(text);
  const nextPrompt = buildNextPrompt({
    prNumber,
    prTitle,
    branch,
    mergeStatus,
    blockers,
    dependencies,
    recommendedNextAction,
    completedWork
  });

  return {
    kind: "handoff_relay_summary",
    schemaVersion: 1,
    id: createId(now),
    receivedAt: now.toISOString(),
    source: "codex_handoff_paste",
    rawText: text,
    extracted: {
      prNumber,
      prTitle,
      branch,
      mergeStatus,
      verificationResults: limit(verificationResults),
      completedWork: limit(completedWork),
      guardrailsPreserved: limit(guardrailsPreserved),
      risks: limit(risks),
      blockers: limit(blockers),
      dependencies: limit(dependencies)
    },
    projectState: {
      currentStatus,
      latestCompletedMilestone,
      openPrs,
      recommendedNextAction,
      remainingMajorMilestones
    },
    nextPrompt,
    feedback: {
      status: "unreviewed",
      choices: [],
      note: "",
      improvementCandidate: "",
      updatedAt: null
    },
    ownerReadableSummary: buildOwnerSummary({ prNumber, prTitle, mergeStatus, currentStatus, recommendedNextAction }),
    guardrails: defaultGuardrails()
  };
}

export async function listHandoffRelaySummaries() {
  const store = await readStore();

  return store.handoffs.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

export async function saveHandoffRelaySummary(rawText: string) {
  const store = await readStore();
  const summary = createHandoffRelaySummary(rawText);
  store.handoffs = [summary, ...store.handoffs].slice(0, 50);
  await writeStore(store);
  await updateProjectMemoryFromHandoff(summary);

  return summary;
}

export async function updateHandoffRelayFeedback(handoffId: string, choices: HandoffFeedbackChoice[], note: string) {
  const store = await readStore();
  const index = store.handoffs.findIndex((handoff) => handoff.id === handoffId);

  if (index === -1) {
    throw new Error("Handoff not found.");
  }

  const safeChoices = choices.filter(isFeedbackChoice);
  const safeNote = note.trim().slice(0, 1200);
  const improvementCandidate = buildImprovementCandidate(store.handoffs[index], safeChoices, safeNote);

  store.handoffs[index] = {
    ...store.handoffs[index],
    feedback: {
      status: "reviewed",
      choices: safeChoices,
      note: safeNote,
      improvementCandidate,
      updatedAt: new Date().toISOString()
    }
  };

  await writeStore(store);

  return store.handoffs[index];
}

function extractPrNumber(text: string) {
  const match = text.match(/\bPR\s*#?(\d+)\b/i) || text.match(/\/pull\/(\d+)/i);
  return match ? Number(match[1]) : null;
}

function extractPrTitle(text: string, prNumber: number | null) {
  const titleLine =
    findLine(text, [/^#+\s*PR\b/i, /\bPR\s*Title\b/i, /\btitle\s*:/i]) ||
    (prNumber ? findLine(text, [new RegExp(`PR\\s*#?${prNumber}[^\\n]*`, "i")]) : "");
  const cleaned = cleanLine(titleLine)
    .replace(/^PR\s*Title\s*:?\s*/i, "")
    .replace(/^Title\s*:?\s*/i, "")
    .replace(/^PR\s*#?\d+\s*[-:–]?\s*/i, "")
    .replace(/\s+looks\s+(right|good|strong).*$/i, "")
    .trim();

  if (cleaned.length >= 4) return cleaned.slice(0, 120);

  const createPrLine = findLine(text, [/create\s+PR\s*:/i]);
  return createPrLine ? cleanLine(createPrLine).replace(/create\s+PR\s*:\s*/i, "").slice(0, 120) : "Untitled handoff";
}

function extractBranch(text: string) {
  const branchMatch =
    text.match(/\bbranch\s*[:=]\s*([A-Za-z0-9._/-]+)/i) ||
    text.match(/\bhead\s*[:=]\s*([A-Za-z0-9._/-]+)/i) ||
    text.match(/\b(codex\/[A-Za-z0-9._/-]+)/i);

  return branchMatch ? branchMatch[1].replace(/[),.]+$/, "") : "not found";
}

function extractMergeStatus(text: string) {
  if (/\bmerged\b|\bconfirmed merged\b|\bmerge commit\b/i.test(text)) return "merged";
  if (/\bmergeable\b|\bready to merge\b/i.test(text)) return "mergeable";
  if (/\bdraft\b/i.test(text)) return "draft";
  if (/\bblocked\b|\bnot merge\b|\bdo not merge\b/i.test(text)) return "blocked";
  if (/\bopen\b/i.test(text)) return "open";
  return "unknown";
}

function extractSectionLines(text: string, keywords: string[]) {
  const lines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length > 3);

  return lines.filter((line) => keywords.some((keyword) => line.toLowerCase().includes(keyword.toLowerCase())));
}

function extractGuardrails(text: string) {
  const guardrailPhrases = [
    "no automatic Codex execution",
    "no GitHub issue creation",
    "no label changes",
    "no production deploy",
    "production blocked",
    "no paid resources",
    "no migrations",
    "no secrets",
    "no env changes",
    "no repository visibility",
    "no auto-merge",
    "owner approval"
  ];
  const found = extractSectionLines(text, guardrailPhrases);

  if (found.length) return found;

  return guardrailPhrases.filter((phrase) => text.toLowerCase().includes(phrase.toLowerCase()));
}

function deriveCurrentStatus({
  mergeStatus,
  blockers,
  verificationResults
}: {
  mergeStatus: string;
  blockers: string[];
  verificationResults: string[];
}) {
  if (blockers.length) return "Needs owner review or focused fix";
  if (/merged/i.test(mergeStatus)) return "Latest handoff appears merged";
  if (/mergeable/i.test(mergeStatus) && verificationResults.length) return "Ready for owner merge decision";
  if (/blocked/i.test(mergeStatus)) return "Blocked";
  return "Captured for review";
}

function deriveMilestone({
  prNumber,
  prTitle,
  mergeStatus,
  completedWork
}: {
  prNumber: number | null;
  prTitle: string;
  mergeStatus: string;
  completedWork: string[];
}) {
  if (/merged/i.test(mergeStatus) && prNumber) return `PR #${prNumber} merged: ${prTitle}`;
  if (completedWork[0]) return completedWork[0];
  if (prNumber) return `PR #${prNumber}: ${prTitle}`;
  return "Handoff captured";
}

function deriveRecommendedNextAction({
  mergeStatus,
  blockers,
  verificationResults,
  dependencies
}: {
  mergeStatus: string;
  blockers: string[];
  verificationResults: string[];
  dependencies: string[];
}) {
  if (blockers.length) return "Review the blocker and create one focused fix prompt only after owner approval.";
  if (/mergeable/i.test(mergeStatus) && verificationResults.length) return "Owner should decide whether to merge before starting the next feature.";
  if (/merged/i.test(mergeStatus)) return "Proceed to the next approved feature or phase from updated main.";
  if (dependencies.length) return "Resolve listed dependencies before asking Codex to continue.";
  return "Review the drafted prompt, adjust it if needed, then send it manually.";
}

function deriveRemainingMilestones(text: string) {
  const defaults = [
    "Confirm owner approval",
    "Run the next safe PR or phase",
    "Record verification evidence",
    "Keep production and paid resources blocked until explicitly approved"
  ];

  const explicit = extractSectionLines(text, ["remaining", "milestone", "next"]);
  return limit(explicit.length ? explicit : defaults, 6);
}

function buildNextPrompt({
  prNumber,
  prTitle,
  branch,
  mergeStatus,
  blockers,
  dependencies,
  recommendedNextAction,
  completedWork
}: {
  prNumber: number | null;
  prTitle: string;
  branch: string;
  mergeStatus: string;
  blockers: string[];
  dependencies: string[];
  recommendedNextAction: string;
  completedWork: string[];
}) {
  const prompt = [
    prNumber ? `Review PR #${prNumber}: ${prTitle}.` : `Review this AppEngine handoff: ${prTitle}.`,
    branch !== "not found" ? `Branch: ${branch}.` : "",
    `Current merge status: ${mergeStatus}.`,
    completedWork.length ? `Completed work to preserve: ${completedWork.slice(0, 3).join(" | ")}.` : "",
    blockers.length ? `Address this blocker first: ${blockers[0]}.` : recommendedNextAction,
    dependencies.length ? `Dependencies to confirm: ${dependencies.slice(0, 3).join(" | ")}.` : "",
    "Do not trigger Codex automatically, create GitHub issues, apply labels, deploy production, create paid resources, apply migrations, change secrets/env vars, change repo visibility, or auto-merge generated app code.",
    "After the work is done, provide the owner-facing summary, verification evidence, preserved guardrails, and next safe action."
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    prompt,
    reason: blockers.length
      ? "The handoff contains a blocker, so the safest next move is a focused fix prompt."
      : "The prompt preserves the latest handoff state while keeping Lincoln in approval control.",
    dependencies: dependencies.length ? limit(dependencies, 5) : ["Owner reviews and manually sends this prompt."],
    expectedOutcome: blockers.length
      ? "A focused follow-up that resolves the blocker without expanding scope."
      : "A clear next Codex action with guardrails preserved and no automatic execution."
  };
}

function buildOwnerSummary({
  prNumber,
  prTitle,
  mergeStatus,
  currentStatus,
  recommendedNextAction
}: {
  prNumber: number | null;
  prTitle: string;
  mergeStatus: string;
  currentStatus: string;
  recommendedNextAction: string;
}) {
  const target = prNumber ? `PR #${prNumber}` : "This handoff";
  return `${target} ${prTitle ? `(${prTitle}) ` : ""}is marked ${mergeStatus}. ${currentStatus}. Next: ${recommendedNextAction}`;
}

function buildImprovementCandidate(summary: HandoffRelaySummary, choices: HandoffFeedbackChoice[], note: string) {
  if (!choices.length && !note) return "";

  return [
    `Improvement candidate from ${summary.id}`,
    `Feedback: ${choices.map(formatFeedbackChoice).join(", ") || "note only"}`,
    note ? `Owner note: ${note}` : "",
    `Suggested area: ${summary.projectState.recommendedNextAction}`
  ]
    .filter(Boolean)
    .join("\n");
}

function defaultGuardrails(): HandoffRelaySummary["guardrails"] {
  return {
    ownerApprovalOnly: true,
    noAutomaticCodexExecution: true,
    noGitHubIssueCreation: true,
    noLabelChanges: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true,
    noGeneratedAppAutoMerge: true
  };
}

function cleanLine(line: string) {
  return line
    .replace(/^[-*]\s*/, "")
    .replace(/^#+\s*/, "")
    .replace(/^>\s*/, "")
    .replace(/`/g, "")
    .trim();
}

function findLine(text: string, patterns: RegExp[]) {
  return text.split(/\r?\n/).find((line) => patterns.some((pattern) => pattern.test(line))) || "";
}

function limit(values: string[], count = 8) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, count);
}

function formatFeedbackChoice(choice: HandoffFeedbackChoice) {
  return choice.replace(/_/g, " ");
}

function isFeedbackChoice(value: string): value is HandoffFeedbackChoice {
  return [
    "good_direction",
    "wrong_direction",
    "incomplete",
    "needs_redesign",
    "duplicate_work",
    "unnecessary_complexity"
  ].includes(value);
}

async function readStore(): Promise<StoreShape> {
  if (process.env.VERCEL === "1") return memoryStore;

  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as StoreShape;

    return {
      handoffs: Array.isArray(parsed.handoffs) ? parsed.handoffs : []
    };
  } catch {
    return { handoffs: [] };
  }
}

async function writeStore(store: StoreShape) {
  if (process.env.VERCEL === "1") {
    memoryStore = store;
    return;
  }

  await mkdir(storeDir, { recursive: true });
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function createId(now: Date) {
  return `handoff_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
