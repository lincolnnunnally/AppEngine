# Phase Start Approval Gate

AppEngine must review a `published_phase_issue_registry` before any published phase issue may receive an execution label later.

This gate produces a `phase_start_approval` artifact. It is approval-gate only. It does not add labels, trigger Codex build work, build UI, deploy production, create paid resources, apply migrations, add secrets, change env vars, change repository visibility, or auto-merge generated app code.

## Purpose

Phase Start Approval answers:

- Does the target issue exist in the published phase issue registry?
- Is the requested phase allowed to start based on phase order?
- Are previous required phases complete or explicitly not required?
- Are guardrails present?
- Are acceptance criteria present?
- Are secrets, env vars, migrations, production deploys, and paid-resource risks still blocked?
- Are owner approval notes present?
- What is the next safe action?

This gate is the checkpoint before a later manual label step. It does not apply `ai:build`, `ai:fix`, or any other execution label.

## Input Artifact

The input artifact is `published_phase_issue_registry`.

Required input fields:

- `kind: "published_phase_issue_registry"`
- `schemaVersion`
- `sourceArtifact.kind: "phase_issue_publisher_manual"`
- `sourceArtifact.candidateSlug`
- `sourceArtifact.candidateType`
- `sourceArtifact.finalPacketType`
- `sourcePacket.kind`
- `sourcePacket.status`
- `candidate.name`
- `candidate.slug`
- `candidate.type`
- `publishedIssues`
- `phaseOrder`
- `issueLabels`
- `currentStatus`
- `nextSafeAction`
- `decision.codexBuildTriggered`
- `guardrails.registryOnly`

The gate must fail honestly when required registry fields are missing.

## Start Request

The gate also requires a start request that identifies the target issue and supplies approval evidence.

Required start request fields:

- `targetIssueNumber` or `targetPhase`
- `ownerApprovalNotes`
- `completedPhases`
- `notRequiredPhases`
- `acceptanceCriteriaPresent`
- `riskReview.noSecretsEnvRisk`
- `riskReview.noMigrationRisk`
- `riskReview.noProductionDeployRisk`
- `riskReview.noPaidResourceRisk`

## Approval Statuses

Every `phase_start_approval` must use one of these statuses:

- `approved_for_manual_phase_start`
- `needs_revision`
- `rejected`
- `blocked_by_security`
- `blocked_by_cost`
- `blocked_by_scope`

Only `approved_for_manual_phase_start` may recommend a later manual execution-label step. Even then, this gate does not add the label.

## Required Approval Checks

Every approval must check:

- `issueExistsInRegistry`
- `phaseOrderRespected`
- `previousRequiredPhasesComplete`
- `guardrailsPresent`
- `acceptanceCriteriaPresent`
- `riskSafety`
- `ownerApprovalNotesPresent`

Each check must include:

- `status`
- `notes`

Allowed check statuses are:

- `pass`
- `needs_revision`
- `rejected`
- `blocked_by_security`
- `blocked_by_cost`
- `blocked_by_scope`

## Owner-Readable Approval Output

The owner-readable output should be concrete:

```text
Phase Start Approval

Candidate: Church Care Follow-Up
Target issue: #101
Target phase: discovery
Status: approved_for_manual_phase_start
Next safe action: await_manual_execution_label
Labels added: no
Codex build triggered: no
```

When the gate does not approve phase start, the output must clearly say why and what the next safe action is.

## Machine-Readable Output Contract

Agents should produce a `phase_start_approval` artifact:

```json
{
  "kind": "phase_start_approval",
  "schemaVersion": 1,
  "sourceArtifact": {
    "kind": "published_phase_issue_registry",
    "candidateSlug": "church-care-follow-up",
    "candidateType": "workflow_process_candidate",
    "finalPacketType": "non_app_solution_plan"
  },
  "candidate": {
    "name": "Church Care Follow-Up",
    "slug": "church-care-follow-up",
    "type": "workflow_process_candidate"
  },
  "targetIssue": {
    "issueNumber": 101,
    "url": "https://github.com/lincolnnunnally/AppEngine/issues/101",
    "phase": "discovery",
    "phaseOrder": 1,
    "labels": ["ai:plan"]
  },
  "approvalStatus": "approved_for_manual_phase_start",
  "approvalChecks": {
    "issueExistsInRegistry": {
      "status": "pass",
      "notes": "Target issue exists in the published phase issue registry."
    }
  },
  "phaseOrder": ["discovery", "solution_design"],
  "completedPhases": [],
  "notRequiredPhases": [],
  "decision": {
    "approvedForManualPhaseStart": true,
    "nextSafeAction": "await_manual_execution_label",
    "labelsAdded": false,
    "executionLabelsApproved": false,
    "codexBuildTriggered": false,
    "ownerApprovalRequiredForLabeling": true
  },
  "ownerReadableReport": "Phase Start Approval...",
  "followUpTasks": [],
  "guardrails": {
    "approvalGateOnly": true,
    "noLabelChanges": true,
    "noExecutionLabelsAdded": true,
    "noCodexBuildTriggered": true,
    "noProductionDeploy": true,
    "noPaidResources": true,
    "noMigrations": true,
    "noSecretsOrEnvChanges": true,
    "repositoryVisibilityUnchanged": true,
    "noGeneratedCodeAutoMerge": true
  }
}
```

## Failure And Block Rules

The gate must fail honestly when:

- input artifact is not `published_phase_issue_registry`
- required registry fields are missing
- target issue is not in the registry
- phase order is not respected
- previous required phases are not complete or marked not required
- guardrails are missing
- acceptance criteria are missing
- owner approval notes are missing
- secrets/env, migration, production deploy, or paid-resource risk is present
- source labels include `ai:build`, `ai:fix`, or another execution label
- any indication Codex build work already triggered

## Guardrails

Phase Start Approval must not:

- add labels
- add `ai:build`, `ai:fix`, or any execution label
- trigger Codex build work
- build UI
- deploy production
- create paid resources
- apply migrations
- add secrets or env vars
- change repository visibility
- auto-merge generated app code

## Success Criteria

The gate is working when:

1. A valid published issue can be approved for a later manual phase-start label.
2. The artifact records target issue, phase order, checks, status, guardrails, owner notes, and next safe action.
3. Missing target issue produces `needs_revision`.
4. Incomplete previous required phases produce `needs_revision`.
5. Security, cost, or scope risks block approval with the correct status.
6. No labels are added.
7. `codexBuildTriggered` remains false.
8. No Codex build work, production deploy, paid resources, migrations, secrets/env changes, repository visibility changes, or generated app auto-merge happen.
