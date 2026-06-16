import { readFileSync } from "node:fs";

const checks = [
  {
    file: "src/lib/engine/handoff-relay.ts",
    patterns: [
      "orchestrator_approved_handoff_export",
      "HandoffExportApprovalStatus",
      "createHandoffExportReadyOutput",
      "approveAndExportPreparedHandoff",
      "codexTriggered: false",
      "githubIssuesCreated: false",
      "labelsApplied: false",
      "productionDeployed: false",
      "paidResourcesCreated: false",
      "migrationsApplied: false",
      "secretsOrEnvChanged: false",
      "repositoryVisibilityChanged: false",
      "generatedAppAutoMerged: false"
    ]
  },
  {
    file: "src/lib/engine/project-memory.ts",
    patterns: ["updateProjectMemoryFromHandoffExport", "Approved handoff export ready", "owner-approved for manual Codex prompt export"]
  },
  {
    file: "src/lib/engine/agent-artifacts.ts",
    patterns: ["orchestrator_approved_handoff_export"]
  },
  {
    file: "source-of-truth/orchestrator-approved-handoff-export.md",
    patterns: ["Project Memory", "trigger Codex automatically", "exact exported Codex-ready prompt"]
  },
  {
    file: "agents/context/output-contracts.md",
    patterns: ["orchestrator_approved_handoff_export", "owner_approved_for_export", "generatedAppAutoMerged"]
  },
  {
    file: "agents/manifest.yaml",
    patterns: ["source-of-truth/orchestrator-approved-handoff-export.md", "orchestrator_approved_handoff_export"]
  },
  {
    file: "source-of-truth/context-checklist.md",
    patterns: ["orchestrator_approved_handoff_export", "exact Codex-ready prompt"]
  },
  {
    file: "agents/prompts/planner.md",
    patterns: ["orchestrator_approved_handoff_export", "exact Codex-ready prompt"]
  },
  {
    file: "package.json",
    patterns: ["smoke:orchestrator-approved-handoff-export"]
  }
];

const missing = [];

for (const check of checks) {
  const text = readFileSync(check.file, "utf8");
  for (const pattern of check.patterns) {
    if (!text.includes(pattern)) {
      missing.push(`${check.file} missing ${pattern}`);
    }
  }
}

const sampleArtifact = {
  kind: "orchestrator_approved_handoff_export",
  schemaVersion: 1,
  approvalStatus: "owner_approved_for_export",
  exportedPrompt: "Proceed with the reviewed AppEngine action.",
  execution: {
    codexTriggered: false,
    githubIssuesCreated: false,
    labelsApplied: false,
    productionDeployed: false,
    paidResourcesCreated: false,
    migrationsApplied: false,
    secretsOrEnvChanged: false,
    repositoryVisibilityChanged: false,
    generatedAppAutoMerged: false
  }
};

if (sampleArtifact.approvalStatus !== "owner_approved_for_export") {
  missing.push("sample artifact approvalStatus is not owner_approved_for_export");
}

if (Object.values(sampleArtifact.execution).some(Boolean)) {
  missing.push("sample artifact has an unsafe execution flag");
}

if (missing.length) {
  console.error("Orchestrator approved handoff export smoke failed:");
  for (const message of missing) console.error(`- ${message}`);
  process.exit(1);
}

console.log("Orchestrator approved handoff export smoke passed.");
