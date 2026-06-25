// Owner-approved execution dispatcher — DRY RUN.
//
// This is roadmap step #2 from orchestrator-autonomous-execution-plan.md, the
// highest-leverage handoff-burden reducer: replace Lincoln's copy/paste of a
// prepared builder prompt into Codex with a controlled, owner-approved GitHub
// workflow-dispatch DRAFT.
//
// It is a DRY RUN: it never dispatches anything. It composes the existing
// persistence-activation-readiness (the roadmap's #1 prerequisite) and a
// prepared handoff prompt, and produces the draft dispatch the owner could
// approve. Dispatch stays disabled until durable persistence is active AND the
// owner explicitly approves — and even then the actual `gh workflow run` is a
// separate, manual, owner action. Nothing here triggers Codex, deploys, labels,
// issues, or paid resources.

import { createPersistenceActivationReadiness } from "./persistence-activation-readiness";

export type ExecutionDispatcherStatus = "blocked_pending_prerequisites" | "ready_for_owner_approved_dispatch";

export type ExecutionDispatcherCheck = {
  id: string;
  label: string;
  status: "passed" | "blocked";
  evidence: string;
};

export type ExecutionDispatcherDryRun = {
  kind: "execution_dispatcher_dry_run";
  schemaVersion: 1;
  generatedAt: string;
  status: ExecutionDispatcherStatus;
  // The dispatch this WOULD send if approved — a draft only, never sent here.
  dispatchDraft: {
    targetWorkflow: ".github/workflows/ai-prompt-factory.yml";
    ref: "main";
    inputs: { mode: string; task: string };
  };
  checks: ExecutionDispatcherCheck[];
  blockedReasons: string[];
  dispatched: false; // ALWAYS false — this is a dry run / draft
  executionEnabled: false; // dispatch stays disabled until owner-approved + env flag, by a separate manual step
  ownerReadableSummary: string;
  nextSafeAction: string;
  guardrails: {
    planningOnly: true;
    dryRunNeverDispatches: true;
    noAutomaticCodexExecution: true;
    ownerApprovalRequiredToDispatch: true;
    noProductionDeploy: true;
    noNewPaidResources: true;
    noLabelChanges: true;
    noGitHubIssueCreation: true;
  };
};

export type ExecutionDispatcherInput = {
  // The prepared builder prompt (e.g. from a build_execution_builder_handoff_export).
  handoffPrompt?: string;
  handoffId?: string;
  // Explicit owner approval for THIS dispatch (not a standing setting).
  ownerApprovedDispatch?: boolean;
  env?: Record<string, string | undefined>;
};

export function createExecutionDispatcherDryRun(
  input: ExecutionDispatcherInput = {},
  now = new Date()
): ExecutionDispatcherDryRun {
  const persistence = createPersistenceActivationReadiness(now);
  const hasHandoff = Boolean(input.handoffPrompt?.trim());

  const checks: ExecutionDispatcherCheck[] = [
    check(
      "durable_persistence_ready",
      "Durable persistence is active so unattended-run state survives",
      persistence.status === "ready_for_owner_review",
      `persistence_activation_readiness=${persistence.status}`
    ),
    check(
      "prepared_handoff_present",
      "A prepared builder prompt is present to dispatch",
      hasHandoff,
      hasHandoff ? `handoff ${input.handoffId || "(inline)"} present` : "No prepared handoff/prompt provided."
    ),
    check(
      "owner_approved_dispatch",
      "Owner has explicitly approved this dispatch",
      Boolean(input.ownerApprovedDispatch),
      input.ownerApprovedDispatch ? "Owner approved this dispatch draft." : "Owner approval for dispatch is missing."
    )
  ];

  const blockedReasons = checks.filter((item) => item.status === "blocked").map((item) => `${item.id}: ${item.evidence}`);
  const status: ExecutionDispatcherStatus = blockedReasons.length
    ? "blocked_pending_prerequisites"
    : "ready_for_owner_approved_dispatch";

  const task = (input.handoffPrompt || "").trim().slice(0, 2000) || "(no prepared builder prompt yet)";

  return {
    kind: "execution_dispatcher_dry_run",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    status,
    dispatchDraft: {
      targetWorkflow: ".github/workflows/ai-prompt-factory.yml",
      ref: "main",
      inputs: { mode: "manual", task }
    },
    checks,
    blockedReasons,
    dispatched: false,
    executionEnabled: false,
    ownerReadableSummary: blockedReasons.length
      ? "Execution dispatch is blocked. This is a dry run — it never dispatches. Resolve the prerequisites first (durable persistence comes first per the roadmap)."
      : "Prerequisites met. This is the draft dispatch the owner can approve; even then it is dispatched only by a separate, explicit, manual owner action — never automatically.",
    nextSafeAction: blockedReasons.length
      ? `Resolve: ${blockedReasons[0]}`
      : "Owner reviews this draft and, if approved, runs the ai-prompt-factory workflow with these inputs manually. No automatic dispatch.",
    guardrails: {
      planningOnly: true,
      dryRunNeverDispatches: true,
      noAutomaticCodexExecution: true,
      ownerApprovalRequiredToDispatch: true,
      noProductionDeploy: true,
      noNewPaidResources: true,
      noLabelChanges: true,
      noGitHubIssueCreation: true
    }
  };
}

function check(id: string, label: string, passed: boolean, evidence: string): ExecutionDispatcherCheck {
  return { id, label, status: passed ? "passed" : "blocked", evidence };
}
