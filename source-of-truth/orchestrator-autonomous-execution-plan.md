# Orchestrator Autonomous Execution Plan

## Goal

Move AppEngine from handoff export toward controlled autonomous execution without allowing unsafe automation.

This standard is planning-only. It does not trigger Codex, create GitHub issues, apply labels, deploy, migrate, create paid resources, change secrets/env vars, or auto-merge.

## Workflow

The target workflow is:

```text
intake
-> memory
-> orchestrator
-> action queue
-> handoff
-> execution
-> result
-> memory update
```

## Artifact

`orchestrator_autonomy_roadmap`

Required fields:

- `kind`
- `schemaVersion`
- `generatedAt`
- `status`
- `workflow`
- `manualHandoffPoints`
- `rankedAutomationValue`
- `ownerReadableSummary`
- `nextRecommendedPRs`
- `guardrails`

## Remaining Manual Handoff Points

The roadmap must identify:

- copying prepared handoffs to Codex
- interpreting PR/workflow results
- choosing which queued actions become handoffs
- manually triggering orchestrator runs
- approving execution labels or workflow dispatch

Each handoff point should include:

- current manual step
- automation value
- risk
- recommended automation
- whether owner approval remains required

## Automation Priority

Highest-value automation should reduce Lincoln's copy/paste relay burden first, not bypass owner judgment.

Recommended order:

1. Durable persistence readiness
2. Owner-approved execution dispatcher dry run
3. Structured PR/workflow result ingestion
4. Automatic orchestrator rerun after approved result ingestion
5. Execution labels or dispatch only after explicit owner approval

## Guardrails

The plan must keep these blocked:

- automatic Codex execution
- GitHub issue creation
- label changes
- production deployment
- paid resources
- migrations
- secrets/env changes
- repository visibility changes
- generated app auto-merge
