import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.HANDOFF_RELAY_INPUT || "";
const outputPath = process.env.HANDOFF_RELAY_OUTPUT || "";
const markdownPath = process.env.HANDOFF_RELAY_MARKDOWN_OUTPUT || "";
const rawText = inputPath ? fs.readFileSync(path.resolve(inputPath), "utf8") : process.env.HANDOFF_RELAY_TEXT || "";

const summary = createSummary(rawText);

if (outputPath) writeFile(outputPath, JSON.stringify(summary, null, 2));
if (markdownPath) writeFile(markdownPath, renderMarkdown(summary));

console.log(`handoff-relay-summary ok: ${summary.extracted.prNumber ? `PR #${summary.extracted.prNumber}` : summary.id}`);

function createSummary(text) {
  const raw = String(text || "").trim();

  if (raw.length < 12) {
    throw new Error("Handoff relay summary needs pasted handoff text.");
  }

  const prNumber = extractPrNumber(raw);
  const prTitle = extractPrTitle(raw, prNumber);
  const branch = extractBranch(raw);
  const mergeStatus = extractMergeStatus(raw);
  const verificationResults = extractLines(raw, ["verification", "source:check", "typecheck", "build", "smoke", "passed", "green"]);
  const completedWork = extractLines(raw, ["summary", "what changed", "adds", "added", "completed", "changed"]);
  const guardrailsPreserved = extractGuardrails(raw);
  const risks = extractLines(raw, ["risk", "caveat"]);
  const blockers = extractLines(raw, ["blocked", "blocker", "failed", "pending", "needs attention"]);
  const dependencies = extractLines(raw, ["depends", "dependency", "after", "before", "next"]);
  const recommendedNextAction = blockers.length
    ? "Create one focused fix prompt after owner approval."
    : /merged/i.test(mergeStatus)
      ? "Proceed to the next approved feature from updated main."
      : "Review the drafted prompt and send it manually if it is right.";

  return {
    kind: "handoff_relay_summary",
    schemaVersion: 1,
    id: `handoff_${Date.now().toString(36)}`,
    source: "codex_handoff_paste",
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
      currentStatus: blockers.length ? "Needs focused review" : /merged/i.test(mergeStatus) ? "Latest handoff appears merged" : "Captured for owner review",
      latestCompletedMilestone: prNumber ? `PR #${prNumber}: ${prTitle}` : "Handoff captured",
      openPrs: prNumber && !/merged/i.test(mergeStatus) ? [`PR #${prNumber}: ${prTitle}`] : [],
      recommendedNextAction,
      remainingMajorMilestones: ["owner approval", "next safe Codex prompt", "verification evidence", "guardrails preserved"]
    },
    nextPrompt: {
      prompt: [
        prNumber ? `Review PR #${prNumber}: ${prTitle}.` : `Review this AppEngine handoff: ${prTitle}.`,
        branch !== "not found" ? `Branch: ${branch}.` : "",
        `Current merge status: ${mergeStatus}.`,
        blockers[0] ? `Address this blocker first: ${blockers[0]}.` : recommendedNextAction,
        "Do not trigger Codex automatically, create GitHub issues, apply labels, deploy production, create paid resources, apply migrations, change secrets/env vars, change repo visibility, or auto-merge generated app code."
      ]
        .filter(Boolean)
        .join("\n\n"),
      reason: "Owner stays in approval control while AppEngine reduces handoff interpretation work.",
      dependencies: dependencies.length ? limit(dependencies, 5) : ["Owner reviews and manually sends this prompt."],
      expectedOutcome: "A reviewed next Codex prompt with guardrails preserved."
    },
    guardrails: {
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
    }
  };
}

function renderMarkdown(summary) {
  return [
    "# Handoff Relay Summary",
    "",
    `PR: ${summary.extracted.prNumber ? `#${summary.extracted.prNumber}` : "not detected"}`,
    `Title: ${summary.extracted.prTitle}`,
    `Branch: ${summary.extracted.branch}`,
    `Status: ${summary.projectState.currentStatus}`,
    "",
    "## Next Prompt",
    summary.nextPrompt.prompt,
    "",
    "## Guardrails",
    "- Owner approval only.",
    "- No automatic Codex execution.",
    "- No GitHub issue creation, label changes, production deploy, paid resources, migrations, secrets/env changes, repo visibility changes, or auto-merge."
  ].join("\n");
}

function extractPrNumber(text) {
  const match = text.match(/\bPR\s*#?(\d+)\b/i) || text.match(/\/pull\/(\d+)/i);
  return match ? Number(match[1]) : null;
}

function extractPrTitle(text, prNumber) {
  const line = prNumber ? findLine(text, [new RegExp(`PR\\s*#?${prNumber}[^\\n]*`, "i")]) : findLine(text, [/PR\s*Title/i, /^Title\s*:/i]);
  const cleaned = cleanLine(line)
    .replace(/^PR\s*Title\s*:?\s*/i, "")
    .replace(/^Title\s*:?\s*/i, "")
    .replace(/^PR\s*#?\d+\s*[-:–]?\s*/i, "")
    .replace(/\s+looks\s+(right|good|strong).*$/i, "")
    .trim();

  return cleaned || "Untitled handoff";
}

function extractBranch(text) {
  const match = text.match(/\bbranch\s*[:=]\s*([A-Za-z0-9._/-]+)/i) || text.match(/\b(codex\/[A-Za-z0-9._/-]+)/i);
  return match ? match[1].replace(/[),.]+$/, "") : "not found";
}

function extractMergeStatus(text) {
  if (/\bmerged\b/i.test(text)) return "merged";
  if (/\bmergeable\b|\bready to merge\b/i.test(text)) return "mergeable";
  if (/\bdraft\b/i.test(text)) return "draft";
  if (/\bblocked\b|\bdo not merge\b/i.test(text)) return "blocked";
  return "unknown";
}

function extractLines(text, keywords) {
  return text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length > 3 && keywords.some((keyword) => line.toLowerCase().includes(keyword.toLowerCase())));
}

function extractGuardrails(text) {
  const guardrails = [
    "no automatic Codex execution",
    "no GitHub issue creation",
    "no label changes",
    "no production deploy",
    "no paid resources",
    "no migrations",
    "no secrets",
    "no env changes",
    "no auto-merge",
    "owner approval"
  ];
  const lines = extractLines(text, guardrails);

  return lines.length ? lines : guardrails.filter((guardrail) => text.toLowerCase().includes(guardrail.toLowerCase()));
}

function findLine(text, patterns) {
  return text.split(/\r?\n/).find((line) => patterns.some((pattern) => pattern.test(line))) || "";
}

function cleanLine(line) {
  return line
    .replace(/^[-*]\s*/, "")
    .replace(/^#+\s*/, "")
    .replace(/`/g, "")
    .trim();
}

function limit(values, count = 8) {
  return [...new Set(values.filter(Boolean))].slice(0, count);
}

function writeFile(filePath, content) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${content}\n`);
}
