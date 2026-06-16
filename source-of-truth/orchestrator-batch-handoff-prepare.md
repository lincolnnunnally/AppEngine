# Orchestrator Batch Handoff Prepare

## Goal

Move from batch dry-run handoff drafts to owner-reviewable Handoff Inbox entries without executing anything.

## Artifact

Agents and local helpers may produce an `orchestrator_batch_handoff_prepare` artifact.

The artifact must include:

- `kind`: `orchestrator_batch_handoff_prepare`
- `schemaVersion`
- `id`
- `createdAt`
- `status`: `prepared` or `failed_honestly`
- `sourceDryRunId`
- `storage`: `local_mock`
- `selectionLimit`: `3`
- `selectedActionIds`
- `preparedHandoffs`
- `updatedActions`
- `skippedActions`
- `execution`
- `nextSafeAction`
- `ownerReadableSummary`
- `guardrails`

## Input

The only valid input is an `orchestrator_batch_dry_run` artifact with:

- `status: prepared`
- `dryRunOnly: true`
- one or more `preparedHandoffDrafts`

## Preparation Rules

- Prepare at most three handoffs per batch.
- Only still-queued local/mock actions may become prepared handoffs.
- Actions that are missing, blocked, completed, owner-approved, or already prepared must be skipped.
- Prepared handoffs must appear in the Handoff Inbox as `handoff_relay_summary` records with source `orchestrator_prepared_handoff`.
- Prepared action statuses must move from `queued` to `prepared_handoff`.
- Project Memory must be updated when handoffs are prepared.

## Execution Rules

The prepare step must always record:

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

- Manual preparation only.
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

- which dry-run batch was used
- which actions became prepared handoffs
- which actions were skipped and why
- that handoffs are waiting in the Handoff Inbox
- that no external mutation happened
- the next safe action
