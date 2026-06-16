export type AutonomyRoadmapStage =
  | "intake"
  | "memory"
  | "orchestrator"
  | "action_queue"
  | "handoff"
  | "execution"
  | "result"
  | "memory_update";

export type ManualHandoffPoint = {
  id: string;
  stage: AutonomyRoadmapStage;
  currentManualStep: string;
  automationValue: "low" | "medium" | "high" | "highest";
  risk: "low" | "medium" | "high";
  recommendedAutomation: string;
  ownerApprovalStillRequired: boolean;
};

export type OrchestratorAutonomyRoadmap = {
  kind: "orchestrator_autonomy_roadmap";
  schemaVersion: 1;
  generatedAt: string;
  status: "planning_only";
  workflow: Array<{
    stage: AutonomyRoadmapStage;
    currentState: string;
    nextAutomationStep: string;
  }>;
  manualHandoffPoints: ManualHandoffPoint[];
  rankedAutomationValue: ManualHandoffPoint[];
  ownerReadableSummary: string;
  nextRecommendedPRs: string[];
  guardrails: {
    planningOnly: true;
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

export function createOrchestratorAutonomyRoadmap(now = new Date()): OrchestratorAutonomyRoadmap {
  const manualHandoffPoints = buildManualHandoffPoints();

  return {
    kind: "orchestrator_autonomy_roadmap",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    status: "planning_only",
    workflow: [
      {
        stage: "intake",
        currentState: "Problem/vision intake can be captured and routed, but owner-triggered flows are still safest.",
        nextAutomationStep: "Allow approved intake records to enqueue orchestrator actions without execution labels."
      },
      {
        stage: "memory",
        currentState: "Project Memory updates from handoffs, trials, reviews, and orchestrator activity.",
        nextAutomationStep: "Persist memory durably before any unattended execution loop."
      },
      {
        stage: "orchestrator",
        currentState: "Manual Orchestrator can select next safe action and explain decision trace.",
        nextAutomationStep: "Let orchestrator run on approved safe triggers while preserving owner stop conditions."
      },
      {
        stage: "action_queue",
        currentState: "Action queue stores local/mock recommended actions and batch dry-runs.",
        nextAutomationStep: "Add explicit approval state for execution-ready queued actions."
      },
      {
        stage: "handoff",
        currentState: "Prepared handoffs can be saved, exported, and copied by Lincoln.",
        nextAutomationStep: "Replace copy/paste handoff with a controlled GitHub workflow dispatch draft."
      },
      {
        stage: "execution",
        currentState: "Execution remains manual through Codex prompts and PR review.",
        nextAutomationStep: "Add a disabled-by-default execution dispatcher that only supports safe planning actions."
      },
      {
        stage: "result",
        currentState: "Results are currently summarized by PR comments, handoffs, and owner review.",
        nextAutomationStep: "Parse workflow/PR results into structured result artifacts."
      },
      {
        stage: "memory_update",
        currentState: "Memory updates exist but are local/mock.",
        nextAutomationStep: "Update memory from structured result artifacts after durable persistence readiness."
      }
    ],
    manualHandoffPoints,
    rankedAutomationValue: [...manualHandoffPoints].sort(compareAutomationValue),
    ownerReadableSummary:
      "The highest-leverage autonomy gain is replacing Lincoln's copy/paste handoff with owner-approved workflow dispatch drafts, but durable persistence and explicit execution approvals must come first.",
    nextRecommendedPRs: [
      "Durable persistence activation readiness",
      "Owner-approved execution dispatcher dry run",
      "Structured result ingestion into Project Memory"
    ],
    guardrails: {
      planningOnly: true,
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

function buildManualHandoffPoints(): ManualHandoffPoint[] {
  return [
    {
      id: "copy_prepared_handoff_to_codex",
      stage: "handoff",
      currentManualStep: "Lincoln copies a prepared Codex prompt from Handoff Inbox and sends it manually.",
      automationValue: "highest",
      risk: "medium",
      recommendedAutomation: "Create owner-approved workflow dispatch drafts that can run only after explicit approval.",
      ownerApprovalStillRequired: true
    },
    {
      id: "interpret_pr_result",
      stage: "result",
      currentManualStep: "Lincoln or ChatGPT interprets PR summaries and tells AppEngine what happened.",
      automationValue: "high",
      risk: "medium",
      recommendedAutomation: "Parse PR/workflow results into structured result artifacts and update Project Memory.",
      ownerApprovalStillRequired: false
    },
    {
      id: "choose_next_queue_action",
      stage: "action_queue",
      currentManualStep: "Lincoln chooses whether queued actions should become prepared handoffs.",
      automationValue: "high",
      risk: "medium",
      recommendedAutomation: "Allow low-risk queued actions to become prepared handoffs automatically, never execution.",
      ownerApprovalStillRequired: true
    },
    {
      id: "trigger_orchestrator_run",
      stage: "orchestrator",
      currentManualStep: "Lincoln presses Run next safe step.",
      automationValue: "medium",
      risk: "low",
      recommendedAutomation: "Run orchestrator automatically after approved result ingestion or owner feedback.",
      ownerApprovalStillRequired: false
    },
    {
      id: "approve_execution_label_or_dispatch",
      stage: "execution",
      currentManualStep: "Lincoln decides whether any prepared action should execute.",
      automationValue: "medium",
      risk: "high",
      recommendedAutomation: "Keep execution approval explicit until persistence, auth, monitoring, and launch blockers are resolved.",
      ownerApprovalStillRequired: true
    }
  ];
}

function compareAutomationValue(left: ManualHandoffPoint, right: ManualHandoffPoint) {
  const rank = { highest: 0, high: 1, medium: 2, low: 3 };
  return rank[left.automationValue] - rank[right.automationValue];
}
