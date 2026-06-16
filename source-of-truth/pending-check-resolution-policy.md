# Pending Check Resolution Policy

AppEngine must not stall forever when an outside status provider leaves a check pending after all required verification has passed.

This policy exists for stale pending statuses only. It does not bypass failed checks.

## Purpose

AppEngine should distinguish:

- a failed check that requires a fix
- a required check that has not passed yet
- an advisory external check that is still pending
- an advisory external check that has remained pending beyond the configured timeout

When the only unresolved signal is an external advisory status that has exceeded the timeout, AppEngine may treat the pull request as owner-reviewable with caution. That is not merge approval.

## Required Checks

These checks must pass before a pull request may be considered review-ready:

- `source:check`
- `typecheck`
- `build`
- relevant smoke tests for the changed area
- GitHub PR Verification or equivalent repository verification

If any required check is missing, pending, canceled, skipped unexpectedly, or failed, AppEngine must not call the pull request review-ready.

## Advisory Checks

Advisory checks provide useful external confidence but should not stall owner review forever when required verification has already passed.

Examples:

- Vercel preview status contexts that remain pending after the route-specific preview was already verified elsewhere
- external provider status contexts that do not report failure and do not own the required verification result
- provider comments that lag behind durable artifact evidence

An advisory check may remain visible as pending in GitHub while AppEngine records the reason it is treated as advisory in `pending_check_resolution`.

## Blocking Checks

These always block review-ready or merge-ready claims:

- any failed required check
- any failed Vercel deployment or preview verification
- any failed route-specific preview verification
- any failed security, auth, source-of-truth, build, typecheck, smoke, or GitHub verification check
- any production, migration, secret, paid-resource, or repository-visibility action without explicit owner approval

AppEngine must never relabel a failed check as advisory merely because it is inconvenient.

## Timeout Handling

The stale pending threshold is configurable through:

```text
APPENGINE_PENDING_CHECK_TIMEOUT_MINUTES
```

Default:

```text
45 minutes
```

Before the threshold, AppEngine should wait or ask the owner whether to wait.

After the threshold, AppEngine may produce `pending_check_resolution` with:

```text
status: review_ready_with_advisory_pending
reviewReady: true
```

Only when all required checks passed and the unresolved check is advisory.

## Artifact Contract

Agents and tools may produce a `pending_check_resolution` artifact:

```json
{
  "kind": "pending_check_resolution",
  "schemaVersion": 1,
  "id": "pending_check_resolution_...",
  "createdAt": "2026-06-16T00:00:00.000Z",
  "status": "review_ready_with_advisory_pending",
  "reviewReady": true,
  "timeoutMinutes": 45,
  "requiredChecks": [
    {
      "name": "source:check",
      "category": "required",
      "state": "passed",
      "provider": "local"
    }
  ],
  "advisoryChecks": [
    {
      "name": "Vercel",
      "category": "advisory",
      "state": "pending",
      "provider": "vercel",
      "ageMinutes": 63
    }
  ],
  "blockingChecks": [],
  "pendingChecks": [],
  "failedChecks": [],
  "missingChecks": [],
  "ownerReadableSummary": "Required checks passed. Vercel is still pending beyond the threshold. Owner review may continue, but this is not merge approval.",
  "nextSafeAction": "owner_review_with_advisory_pending_check",
  "evidence": ["Vercel remains pending after 63 minutes"],
  "guardrails": {
    "noAutomaticMerge": true,
    "noBypassFailingChecks": true,
    "requiredChecksMustPass": true,
    "externalPendingOnlyAfterTimeout": true,
    "noProductionDeploy": true,
    "noPaidResources": true,
    "noMigrations": true,
    "noSecretsOrEnvChanges": true,
    "repositoryVisibilityUnchanged": true,
    "noCodexAutoExecution": true
  }
}
```

## Status Values

- `review_ready`: all required checks passed and no unresolved blocking or advisory pending status remains.
- `review_ready_with_advisory_pending`: all required checks passed, no failures exist, and an advisory external check exceeded the timeout.
- `blocked_by_failed_check`: at least one check failed.
- `blocked_by_required_pending`: a required or blocking check is pending, missing, canceled, or otherwise incomplete.
- `waiting_for_timeout`: only advisory external checks are pending, but the timeout has not elapsed.
- `failed_honestly`: AppEngine cannot determine a trustworthy result.

## Owner Control Center

Owner Control Center should explain:

- which checks are required
- which checks are advisory
- which checks are blocking
- whether a pending external status has exceeded the timeout
- that failed checks still block
- that review-ready is not automatic merge approval

Owner-facing language should say:

```text
Required checks passed.
External check still pending beyond the timeout.
This PR can be reviewed, but it is not automatically merge-approved.
```

## Orchestrator Behavior

The orchestrator should use `pending_check_resolution` when choosing the next safe action.

- `blocked_by_failed_check` -> stop and create or request a focused fix.
- `blocked_by_required_pending` -> wait for required checks or create a check-resolution task.
- `waiting_for_timeout` -> wait until the configured threshold.
- `review_ready_with_advisory_pending` -> allow owner review with the pending status clearly marked advisory.
- `review_ready` -> allow normal owner review.

## Guardrails

This policy must not:

- automatically merge pull requests
- bypass failing checks
- call missing required checks acceptable
- deploy production
- create paid resources
- apply migrations
- add secrets or environment variables
- change repository visibility
- trigger Codex automatically

## Success Criteria

AppEngine succeeds when it can say:

- all required checks passed
- a named external status is still pending
- the pending status is advisory and older than the threshold
- owner review may continue
- merge still requires owner decision and all merge rules

AppEngine fails honestly when a check fails, a required check has not passed, or the pending status cannot be safely classified.
