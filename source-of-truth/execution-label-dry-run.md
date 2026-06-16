# Execution Label Dry Run

AppEngine may preview the exact label changes that would start an approved published phase issue, but it must not apply labels.

This step produces an `execution_label_dry_run` artifact. It is dry-run only. It does not add labels, trigger Codex build work, build UI, deploy production, create paid resources, apply migrations, add secrets, change env vars, change repository visibility, or auto-merge generated app code.

## Purpose

Execution Label Dry Run answers:

- Which approved phase issue would receive a label later?
- What labels does the issue currently have?
- Which labels would be proposed?
- Which labels are explicitly blocked?
- Why is the preview considered safe?
- What is the next safe action?

This dry run is the preview step before any real GitHub label mutation is allowed.

## Input Artifact

The input artifact is `phase_start_approval`.

Required input fields:

- `kind: "phase_start_approval"`
- `schemaVersion`
- `sourceArtifact.kind: "published_phase_issue_registry"`
- `sourceArtifact.candidateSlug`
- `sourceArtifact.candidateType`
- `sourceArtifact.finalPacketType`
- `candidate.name`
- `candidate.slug`
- `candidate.type`
- `targetIssue.issueNumber`
- `targetIssue.url`
- `targetIssue.phase`
- `targetIssue.phaseOrder`
- `targetIssue.labels`
- `approvalStatus`
- `approvalChecks`
- `decision.approvedForManualPhaseStart`
- `decision.labelsAdded`
- `decision.executionLabelsApproved`
- `decision.codexBuildTriggered`
- `ownerReadableReport`
- `guardrails.approvalGateOnly`

The dry run must fail honestly when required phase start approval fields are missing.

## Proceed Rule

The dry run may proceed only when:

- `approvalStatus: "approved_for_manual_phase_start"`
- `decision.approvedForManualPhaseStart: true`
- `decision.labelsAdded: false`
- `decision.executionLabelsApproved: false`
- `decision.codexBuildTriggered: false`
- all approval checks are `pass`

It must fail honestly when approval status is one of:

- `needs_revision`
- `rejected`
- `blocked_by_security`
- `blocked_by_cost`
- `blocked_by_scope`

## Label Proposal Rules

Default proposed execution label:

- `ai:build`

Current labels must be preserved in the preview.

The dry run may show `ai:build` as a proposed future label, but it must not apply it and must not treat the preview as execution approval.

Blocked labels include:

- `ai:fix`
- unsupported labels

The dry run must report blocked labels instead of silently dropping them.

## Owner-Readable Output

The owner-readable output should be concrete:

```text
Execution Label Dry Run

Target issue: #101
URL: https://github.com/lincolnnunnally/AppEngine/issues/101
Current labels: ai:plan
Proposed labels: ai:plan, ai:build
Labels to add later: ai:build
Blocked labels: none
Safety reason: Dry-run only. No labels were applied and Codex was not triggered.
Next safe action: review_execution_label_dry_run
```

## Machine-Readable Output Contract

Agents should produce an `execution_label_dry_run` artifact:

```json
{
  "kind": "execution_label_dry_run",
  "schemaVersion": 1,
  "sourceArtifact": {
    "kind": "phase_start_approval",
    "candidateSlug": "church-care-follow-up",
    "candidateType": "workflow_process_candidate",
    "finalPacketType": "non_app_solution_plan",
    "approvalStatus": "approved_for_manual_phase_start"
  },
  "targetIssue": {
    "issueNumber": 101,
    "url": "https://github.com/lincolnnunnally/AppEngine/issues/101",
    "phase": "discovery",
    "phaseOrder": 1
  },
  "currentLabels": ["ai:plan"],
  "requestedLabels": ["ai:build"],
  "proposedLabels": ["ai:plan", "ai:build"],
  "labelsToAdd": ["ai:build"],
  "labelsExplicitlyBlocked": [],
  "safetyReason": "Dry-run only. No labels were applied and Codex was not triggered.",
  "decision": {
    "dryRunStatus": "label_changes_ready_for_owner_review",
    "nextSafeAction": "review_execution_label_dry_run",
    "labelsApplied": false,
    "codexBuildTriggered": false,
    "ownerApprovalRequiredForLabeling": true
  },
  "ownerReadableReport": "Execution Label Dry Run...",
  "guardrails": {
    "dryRunOnly": true,
    "noLabelChanges": true,
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

## Failure Rules

The dry run must fail honestly when:

- input artifact is not `phase_start_approval`
- approval status is not `approved_for_manual_phase_start`
- approval checks are missing or not all `pass`
- target issue number or URL is missing
- current labels are missing
- source artifact traceability is missing
- previous gate says labels were already added
- previous gate says execution labels were already approved
- any indication Codex build work was triggered

## Guardrails

Execution Label Dry Run must not:

- apply labels
- call the GitHub label API
- trigger Codex build work
- build UI
- deploy production
- create paid resources
- apply migrations
- add secrets or env vars
- change repository visibility
- auto-merge generated app code

## Success Criteria

The dry run is working when:

1. Approved phase start output can produce an `execution_label_dry_run`.
2. Owner-readable output shows target issue, current labels, proposed labels, blocked labels, safety reason, and next safe action.
3. Non-approved phase start output fails honestly.
4. Unsupported labels are explicitly blocked.
5. No labels are applied.
6. `codexBuildTriggered` remains false.
7. No production deploy, paid resources, migrations, secrets/env changes, repository visibility changes, or generated app auto-merge happen.
