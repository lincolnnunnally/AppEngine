# Manual Orchestrator Run Button

The Manual Orchestrator Run Button is the first owner-controlled orchestrator step inside AppEngine.

It lets Lincoln press one button so AppEngine can:

- read current project state
- inspect Project Memory
- inspect pasted handoff summaries
- inspect real project trials
- derive design intent and portfolio context
- choose the next safe action
- explain why that action was selected
- draft the next Codex/action prompt
- store the result as an artifact
- update Project Memory

It does not run Codex automatically.

## Purpose

This feature reduces Lincoln's prompt relay burden without removing owner stewardship.

AppEngine should help answer:

- Where are we?
- What is safe to do next?
- Why is that the next step?
- What prompt/action should Lincoln approve?

## Artifact Contract

Agents and tools may produce an `orchestrator_run` artifact:

```json
{
  "kind": "orchestrator_run",
  "schemaVersion": 1,
  "id": "orchestrator_run_...",
  "createdAt": "2026-06-16T00:00:00.000Z",
  "status": "ran_successfully",
  "selectedNextSafeAction": "review_latest_trial_and_prepare_next_packet",
  "reason": "A real-project trial exists and no blockers are active.",
  "projectStateSummary": {
    "currentState": "Manual orchestrator ran successfully",
    "latestProgress": "Latest owner-reviewed milestone",
    "currentBlockers": [],
    "recommendedNextAction": "Prepare the next owner-reviewed packet."
  },
  "inputArtifacts": {
    "projectMemory": {
      "kind": "project_memory",
      "status": "available",
      "summary": "Current memory summary",
      "sourceFiles": ["source-of-truth/project-memory-engine.md"]
    },
    "handoffRelaySummary": {
      "kind": "handoff_relay_summary",
      "status": "available",
      "summary": "Latest handoff summary",
      "sourceFiles": ["source-of-truth/handoff-relay-reducer.md"]
    },
    "realProjectTrial": {
      "kind": "real_project_trial",
      "status": "available",
      "summary": "Latest trial summary",
      "sourceFiles": ["source-of-truth/real-project-trial-runner.md"]
    },
    "designIntentProfile": {
      "kind": "design_intent_profile",
      "status": "derived",
      "summary": "Design intent used for the next step",
      "sourceFiles": ["source-of-truth/design-intent-engine.md"]
    },
    "appPortfolioRegistry": {
      "kind": "app_portfolio_registry",
      "status": "derived",
      "summary": "Portfolio context used for routing",
      "sourceFiles": ["source-of-truth/app-portfolio-registry.md"]
    }
  },
  "nextActionPrompt": {
    "prompt": "Copyable owner-reviewed prompt",
    "reason": "Why this prompt was generated",
    "expectedOutcome": "What should happen if Lincoln approves it",
    "dependencies": ["source-of-truth/manual-orchestrator-run-button.md"]
  },
  "evidence": ["Why AppEngine chose this step"],
  "ownerReadableSummary": "Short owner summary",
  "guardrails": {
    "manualButtonOnly": true,
    "ownerApprovalOnly": true,
    "noAutomaticCodexExecution": true,
    "noGitHubIssueCreation": true,
    "noLabelChanges": true,
    "noProductionDeploy": true,
    "noPaidResources": true,
    "noMigrations": true,
    "noSecretsOrEnvChanges": true,
    "repositoryVisibilityUnchanged": true,
    "noGeneratedAppAutoMerge": true
  }
}
```

## Statuses

- `ready_to_run`: the orchestrator has enough context to run but has not acted.
- `ran_successfully`: the orchestrator selected a next safe action and generated a prompt.
- `needs_owner_approval`: the next safe action is known but requires explicit owner decision before continuing.
- `blocked`: the orchestrator found a blocker and should not progress.
- `failed_honestly`: the orchestrator could not create a trustworthy result.

## Inputs

The orchestrator should use:

- `project_memory`
- `handoff_relay_summary`
- `real_project_trial`
- `design_intent_profile`
- `app_portfolio_registry`

If an input is missing, the orchestrator must say so plainly and choose the safest useful next action.

## Owner Control Center

Owner Control Center should include:

- a Manual Orchestrator section
- a Run next safe step button
- current decision
- why that decision was selected
- evidence used
- input artifacts and statuses
- a copyable generated prompt
- orchestrator run history

## Guardrails

The Manual Orchestrator must not:

- trigger Codex automatically
- create GitHub issues
- apply labels
- deploy production
- create paid resources
- apply migrations
- add secrets or env vars
- change repository visibility
- auto-merge generated app code

The generated prompt may recommend a next action, but Lincoln must approve and send it manually.

## Success Criteria

The feature works when Lincoln can press one button, see what AppEngine decided and why, copy a next prompt, and see Project Memory update without AppEngine taking any external action automatically.
