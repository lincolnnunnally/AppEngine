# Owner Status Report Standard

AppEngine should never require Lincoln to read GitHub Actions logs, raw artifacts, deployment IDs, or scattered PR comments to understand the current state of an app build.

At every major phase, AppEngine should produce an `owner_status_report` that answers:

- Where is the app?
- What state is it in?
- What version is it?
- What is blocking progress?
- What is the next safe action?

## Required Inputs

The report should be generated from the durable machine-readable artifacts AppEngine already uses:

- `build_completion_plan`
- `deployment_lifecycle`
- `preview_verification`
- `cost_governance`

When one of those artifacts is missing, the report should say so through blocker/status fields instead of pretending the state is known.

## Required Fields

```json
{
  "kind": "owner_status_report",
  "schemaVersion": 1,
  "app": {
    "name": "Spark of Hope Intake Lite",
    "slug": "spark-of-hope-intake-lite"
  },
  "ownerReadable": {
    "whereIsTheApp": "Review here: https://review.spark-of-hope.example.test/spark-of-hope-intake-lite",
    "state": "review_ready / review_ready",
    "version": "v1",
    "blockingProgress": "Owner review is required before release approval.",
    "nextSafeAction": "await_owner_review"
  },
  "currentState": "review_ready",
  "deploymentState": "review_ready",
  "currentVersion": "v1",
  "reviewUrl": "https://review.spark-of-hope.example.test/spark-of-hope-intake-lite",
  "productionUrl": "approval-gated",
  "deploymentUrl": "https://spark-build-preview.example.test",
  "blockedReason": "Owner review is required before release approval.",
  "blockers": [],
  "nextSafeAction": "await_owner_review",
  "evidenceLinks": [],
  "guardrails": {
    "productionDeployBlocked": true,
    "paidResourcesBlocked": true,
    "migrationsBlocked": true,
    "autoMergeBlocked": true,
    "protectedPreviewBypassLinksPubliclyBlocked": true
  }
}
```

## Owner-Readable Summary

The markdown form should be short enough to paste directly into an issue comment.

It must include:

- App
- State
- Version
- Review URL or clear unknown/blocked status
- Production status
- Next safe action
- Blockers
- Evidence links
- Safety guardrails

## Rules

- Do not expose secrets, API keys, tokens, private billing data, private user data, or protected deployment bypass/share links.
- Do not claim production is live unless release-gate approval and production evidence are recorded.
- Do not claim preview/review is ready unless `preview_verification` and `deployment_lifecycle` agree on the reviewable URL and state.
- Do not make Lincoln search GitHub Actions, Vercel, workflow logs, deployment IDs, or raw artifacts to know where the app is.
- If the state is unknown, report it as unknown and create or recommend the next safe action.

## Success

Lincoln can understand AppEngine state from one report:

```text
Where is it?
What version is it?
Is it review or production?
What is blocked?
What happens next?
```
