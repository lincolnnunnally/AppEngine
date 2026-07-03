# App Portfolio Registry Standard

AppEngine should know every app it manages.

The portfolio registry is the owner-facing map across the whole ecosystem. It does not replace each app's charter, Super Admin registry entry, deployment lifecycle, build completion plan, preview verification, or owner status report. It indexes those records so Lincoln can see the state of the entire app portfolio from one place.

## Purpose

The registry answers:

- What apps does AppEngine manage?
- Where does the owner review each app?
- Where does production live, if approved?
- What version is current?
- What state is each app in?
- What is blocking progress?
- What is the next safe action?
- Which source-of-truth files, issues, and pull requests explain the state?

## Required App Fields

Every app portfolio entry must track:

- app name
- app slug
- review URL
- production URL
- current version
- deployment state
- build state
- next safe action
- source-of-truth files
- linked issues
- linked pull requests

## Source Priority

Agents should assemble portfolio entries from durable records in this order:

1. App charter
2. App Build Packet or vNext Packet
3. Super Admin registry entry
4. Deployment lifecycle
5. Build completion plan
6. Preview verification
7. Owner status report
8. GitHub issues and pull requests

When sources disagree, agents must not silently choose the most optimistic value. They should mark the entry as blocked or stale and create a focused follow-up task to reconcile the state.

## Artifact Shape

Agents should produce an `app_portfolio_registry` artifact with this shape:

```json
{
  "kind": "app_portfolio_registry",
  "schemaVersion": 1,
  "generatedAt": "2026-06-15T00:00:00.000Z",
  "owner": "Lincoln",
  "summary": {
    "totalApps": 1,
    "reviewReadyApps": 1,
    "productionLiveApps": 0,
    "blockedApps": 0,
    "byDeploymentState": {
      "review_ready": 1
    },
    "byBuildState": {
      "preview_verified": 1
    },
    "nextSafeActions": {
      "await_owner_review": 1
    }
  },
  "apps": [
    {
      "name": "Spark of Hope Intake Lite",
      "slug": "spark-of-hope-intake-lite",
      "reviewUrl": "https://review.spark-of-hope.example",
      "productionUrl": "approval-gated",
      "currentVersion": "v1.1",
      "deploymentState": "review_ready",
      "buildState": "preview_verified",
      "nextSafeAction": "await_owner_review",
      "sourceOfTruthFiles": [
        "source-of-truth/charters/spark-of-hope-intake-lite.md",
        "source-of-truth/vnext/spark-of-hope-intake-lite-vnext-1.md"
      ],
      "linkedIssues": [
        {
          "number": 63,
          "title": "Spark of Hope Intake Lite vNext 1",
          "url": "https://github.com/lincolnnunnally/AppEngine/issues/63"
        }
      ],
      "linkedPRs": [
        {
          "number": 74,
          "title": "Spark of Hope Intake Lite vNext: controlled preview persistence",
          "url": "https://github.com/lincolnnunnally/AppEngine/pull/74",
          "state": "merged"
        }
      ],
      "blockers": [],
      "evidenceLinks": [],
      "lastUpdated": "2026-06-15T00:00:00.000Z"
    }
  ],
  "guardrails": {
    "noSecretsInRegistry": true,
    "noPrivateUserData": true,
    "productionApprovalRequired": true,
    "protectedPreviewBypassLinksBlocked": true,
    "appBoundariesRequired": true
  }
}
```

## State Rules

Allowed `deploymentState` values:

- `build_preview`
- `review_ready`
- `review_blocked`
- `approved_for_release`
- `production_live`
- `production_blocked`
- `failed_needs_fix`
- `unknown`

Allowed `buildState` values:

- `planned`
- `ready_for_build`
- `draft_pr_open`
- `preview_pending`
- `preview_verified`
- `review_blocked`
- `release_blocked`
- `owner_approval_required`
- `ready_for_vnext`
- `failed_needs_fix`
- `unknown`

Allowed `nextSafeAction` values should match the Build Completion Orchestrator when possible:

- `create_planning_issue`
- `create_implementation_issue`
- `create_draft_pr`
- `wait_for_preview`
- `verify_preview`
- `verify_review_url`
- `run_review_gates`
- `create_fix_issue`
- `await_owner_review`
- `stop_for_owner_approval`
- `pause_for_budget`
- `request_budget_approval`
- `prepare_release_gate`
- `create_vnext_packet`
- `unknown`

## URL / Domain Facts (optional `domain` block)

Every app entry should carry a `domain` block recording where the app stands on its own
web address, so the owner dashboard can show the whole portfolio's URL situation without
anyone re-deriving it from registrar dashboards:

```json
"domain": {
  "intendedDomain": "laser.engrave.market",
  "urlStatus": "domain_owned_not_serving",
  "nextStep": "Add laser.engrave.market to the Vercel project so the already-set DNS starts serving.",
  "note": "engrave.market owned on DreamHost; subdomain DNS set but nothing serves it yet.",
  "factsFrom": "owner-2026-07-03"
}
```

Field rules:

- `intendedDomain` — the domain this app is meant to live at; `""` when no domain has been
  chosen yet. A domain must appear on at most ONE app (milstead.us and milstead.church are
  different apps — the drift this rule exists to prevent).
- `urlStatus` — exactly one of:
  - `live` — the intended domain is serving the app (or a predecessor site) today.
  - `deployed_awaiting_domain` — the app answers only on a temporary host
    (`*.vercel.app`, `*.emergent.host`, …) and needs a real domain attached.
  - `domain_owned_not_serving` — the domain is owned/registered but nothing serves it
    (parked, zero DNS, or DNS set with no service bound).
  - `awaiting_url` — no domain is owned yet (an intended-but-unconfirmed name may still be
    recorded in `intendedDomain`).
- `nextStep` — the concrete owner action for this URL, a plain-language sentence. Required.
- `note` — caveats that change what the owner should do (`""` when none).
- `factsFrom` — provenance of the facts (e.g. `owner-2026-07-03`); update it when the facts
  are re-confirmed.

`summary.byUrlStatus` may roll these up; when present it must match the actual per-app
counts (enforced by `npm run smoke:portfolio-url-status`). The `domain` block records
*facts about the address*, independent of `deploymentState` (kidsneeddad.com is `live`
while the app build is still `production_blocked` — the domain serves an old brand; both
facts are true and both are shown). Live health checking stays with the ops attention
queue — this block is the owner's recorded intent, not a probe result.

## Owner View

The portfolio registry should support a concise owner-facing view:

```text
App Portfolio

Spark of Hope Intake Lite
- Review: https://review.spark-of-hope.example
- Production: blocked/not live yet
- Version: v1.1
- State: review_ready / preview_verified
- Next: await_owner_review
```

Lincoln should not need to search GitHub Actions, Vercel, branch names, deployment IDs, PR comments, issue comments, or raw artifacts to find an app's current review URL or next safe action.

## Update Triggers

Agents should create or update the portfolio registry when:

- a new App Build Packet is created
- a vNext Packet is created
- a Super Admin registry entry changes
- deployment lifecycle state changes
- preview verification passes or fails
- owner status report changes
- a generated-app PR is opened, updated, merged, or blocked
- a release gate changes state
- monitoring finds drift or incidents

## Safety

The portfolio registry must not contain:

- API keys
- tokens
- passwords
- secret values
- private user data
- private story content
- private billing data
- protected Vercel bypass/share links

Public review URLs may appear when preview deployments are meant to be owner-reviewable. Production URLs may appear only as approved public URLs or approval-gated placeholders.

## Failure Conditions

Agents must block or flag the portfolio registry when:

- an app has no slug
- an app has no source-of-truth files
- review URL is unknown while the app is marked review-ready
- production URL is marked live without approval evidence
- deployment state and build state contradict each other
- linked issues or PRs are missing for active work
- one app's purpose, URLs, issues, PRs, or source files bleed into another app
- a protected preview bypass/share link is used as owner review evidence

## Success Criteria

The standard is working when:

1. AppEngine can produce an `app_portfolio_registry` artifact.
2. Every managed app has name, slug, URLs, version, deployment state, build state, next safe action, source files, issues, and PRs.
3. The owner can see portfolio state from one report.
4. Missing or contradictory app state becomes a focused follow-up task instead of hidden confusion.
5. The registry is secret-free and app-boundary-safe.
