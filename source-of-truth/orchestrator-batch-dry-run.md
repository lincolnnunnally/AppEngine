# Orchestrator Batch Runner Dry Run

## Goal

Let AppEngine prepare multiple queued orchestrator actions in one dry-run batch without executing them.

## Artifact

Agents and local helpers may produce an `orchestrator_batch_dry_run` artifact.

The artifact must include:

- `kind`: `orchestrator_batch_dry_run`
- `schemaVersion`
- `id`
- `createdAt`
- `status`: `prepared` or `no_safe_actions`
- `storage`: `local_mock`
- `dryRunOnly`: `true`
- `selectionLimit`: `3`
- `selectedActionIds`
- `preparedHandoffDrafts`
- `skippedActions`
- `execution`
- `nextSafeAction`
- `ownerReadableSummary`
- `guardrails`

## Selection Rules

- Select only queued orchestrator actions.
- Select at most three safe queued actions per dry-run batch.
- Skip blocked, completed, owner-approved, and already-prepared actions.
- Skip queued actions that have no prompt.
- Preserve source action id, source run id, action name, reason, expected outcome, dependencies, guardrails, and confidence level.

## Execution Rules

The dry run must always record:

- `codexTriggered: false`
- `githubIssuesCreated: false`
- `labelsApplied: false`
- `productionDeployed: false`
- `paidResourcesCreated: false`
- `migrationsApplied: false`
- `secretsOrEnvChanged: false`
- `repositoryVisibilityChanged: false`
- `autoMerged: false`

## Guardrails

- Dry-run only.
- No automatic Codex execution.
- No GitHub issue creation.
- No label changes.
- No production deploy.
- No paid resources.
- No migrations.
- No secrets or environment changes.
- No repository visibility changes.
- No auto-merge.

## Owner-Readable Output

The owner-readable output must explain:

- which actions were selected
- which actions were skipped and why
- that handoff drafts were prepared only
- that no external mutation happened
- the next safe action
