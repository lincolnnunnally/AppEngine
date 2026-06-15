# Spark of Hope Intake Lite vNext 1

## Context Gate

- Source issue: `#63`
- App: Spark of Hope Intake Lite
- App slug: `spark-of-hope-intake-lite`
- Current version: `v1-preview-mock`
- Target version: `v1.1-preview-controlled-persistence`
- Decision: proceed with a bounded implementation slice.
- Guardrails: production blocked, paid resources blocked, real migrations review-gated, no secrets or environment changes, no auto-merge.

## Required Source Files Loaded

- `source-of-truth/00-why-we-build.md`
- `source-of-truth/01-ecosystem-philosophy.md`
- `source-of-truth/02-global-principles.md`
- `source-of-truth/03-life-produces-life.md`
- `source-of-truth/04-app-purpose-rules.md`
- `source-of-truth/05-ecosystem-design-gates.md`
- `source-of-truth/app-improvement-vnext-packet.md`
- `source-of-truth/build-completion-orchestrator.md`
- `source-of-truth/cost-governance-model-routing.md`
- `source-of-truth/deployment-environment-standard.md`
- `source-of-truth/release-gate-standard.md`
- `source-of-truth/charters/spark-of-hope-intake-lite.md`
- `source-of-truth/architecture/spark-of-hope-intake-lite.md`
- `source-of-truth/data-model/spark-of-hope-intake-lite.md`
- `source-of-truth/identity-auth/spark-of-hope-intake-lite.md`
- `source-of-truth/design/spark-of-hope-intake-lite.md`
- `source-of-truth/provider-cost/spark-of-hope-intake-lite.md`
- `agents/context/output-contracts.md`

## Ecosystem Design Gates

| Gate | Answer |
| --- | --- |
| What barrier does this remove? | The mock intake route validates a story but discards it, so the team cannot review persistence behavior safely. |
| What need does this address? | Story sharers and reviewers need controlled preview storage that keeps story content, contact details, consent, status, and audit metadata separate. |
| How does this help someone move toward life? | A hopeful story can be received with care and prepared for private review without becoming public or production data. |
| How does this help someone become a source of life for others? | Approved reviewers can begin validating the encouragement workflow while protecting the dignity and privacy of the story sharer. |

## Implementation Slice

This vNext slice adds a controlled persistence path to the existing public story API.

- Default behavior remains `preview_mock`.
- Controlled preview persistence activates only when `SOH_LITE_PERSISTENCE_MODE` is set to an approved preview value.
- Controlled preview persistence also requires a configured server-side database URL and `SOH_LITE_PRIVACY_COPY_VERSION`.
- Missing preview persistence configuration fails safe with `stored: false`.
- No migrations are applied by this work.
- The existing generated app schema files remain inert and review-only.
- No production deployment, paid resource creation, secret changes, or auto-merge is introduced.

## Runtime Modes

| Mode | Default | Storage | Purpose |
| --- | --- | --- | --- |
| `preview_mock` | Yes | None | Validate the form and return a reference without writing data. |
| `preview_controlled_persistence` | No | Review-approved preview database only | Store approved preview/test submissions in the planned table boundaries. |
| `production` | No | Blocked | Not allowed until release gate and owner approval are recorded. |

## Persistence Boundary

Controlled preview persistence writes a story submission with a non-guessable public reference, then stores related data in separate tables:

- `soh_lite_story_submissions`: story title/body, source, review status, privacy status.
- `soh_lite_story_contacts`: preferred name/email and safe-to-contact flag.
- `soh_lite_story_consents`: consent choices and privacy copy version.
- `soh_lite_status_events`: private-safe workflow transition summary.
- `soh_lite_audit_events`: private-safe metadata only.

Audit/status metadata must not contain story body, contact values, raw request payloads, secrets, raw IPs, raw user agents, or provider credentials.

## vNext Packet

```json
{
  "kind": "vnext_packet",
  "schemaVersion": 1,
  "app": {
    "name": "Spark of Hope Intake Lite",
    "slug": "spark-of-hope-intake-lite",
    "currentVersion": "v1-preview-mock",
    "targetVersion": "v1.1-preview-controlled-persistence",
    "charterPath": "source-of-truth/charters/spark-of-hope-intake-lite.md"
  },
  "change": {
    "requestType": "feature",
    "summary": "Move preview story submission from mock-only handling to controlled, review-gated preview persistence.",
    "barrierRemoved": "Mock-only submissions disappear after validation.",
    "needAddressed": "Safe private review requires controlled preview storage before production or real-user data is approved.",
    "movementTowardLife": "Hopeful stories can be received and protected for private encouragement review.",
    "transformationOutcome": "Stories are stewarded responsibly without public launch, production writes, or uncontrolled data exposure.",
    "nonGoals": [
      "Do not restart the app.",
      "Do not deploy production.",
      "Do not create paid resources.",
      "Do not apply migrations automatically.",
      "Do not store real user data without owner approval.",
      "Do not auto-merge generated app code."
    ]
  },
  "providerCostDelta": {
    "newPaidResourcesExpected": false,
    "costReviewRequired": true,
    "approvalRequiredForNewPaidResources": true
  },
  "guardrails": {
    "preserveExistingCharter": true,
    "preventGoalBleed": true,
    "releaseGateRequired": true,
    "monitoringUpdateRequired": true
  }
}
```

## Cost Governance

```json
{
  "kind": "cost_governance",
  "schemaVersion": 1,
  "app": {
    "name": "Spark of Hope Intake Lite",
    "slug": "spark-of-hope-intake-lite"
  },
  "sourceIssue": {
    "number": "63",
    "title": "Spark of Hope Intake Lite vNext 1",
    "url": "https://github.com/lincolnnunnally/AppEngine/issues/63"
  },
  "taskClass": "medium",
  "nextBudgetAction": "continue",
  "newPaidResourcesExpected": false,
  "ownerApprovalRequired": false,
  "guardrails": {
    "noBillingApiAccessRequired": true,
    "noSecretsRead": true,
    "paidResourcesBlocked": true
  }
}
```

## Deployment Lifecycle

```json
{
  "kind": "deployment_lifecycle",
  "schemaVersion": 1,
  "app": {
    "name": "Spark of Hope Intake Lite",
    "slug": "spark-of-hope-intake-lite"
  },
  "reviewUrl": "https://app-engine-git-codex-spark-vne-cde7c6-lincolnnunnallys-projects.vercel.app",
  "productionUrl": "approval-gated",
  "deploymentUrl": "https://app-engine-git-codex-spark-vne-cde7c6-lincolnnunnallys-projects.vercel.app",
  "deploymentState": "review_ready",
  "currentVersion": "v1.1-preview-controlled-persistence",
  "reviewVersion": "v1.1-preview-controlled-persistence",
  "productionVersion": "not_released",
  "approvalRequired": true,
  "lastDeploymentTimestamp": "tracked-in-preview-verification-artifact",
  "guardrails": {
    "productionDeployBlockedUntilApproval": true,
    "paidResourcesBlockedUntilApproval": true,
    "migrationsBlockedUntilApproval": true,
    "generatedCodeAutoMergeBlocked": true,
    "protectedPreviewBypassLinksPubliclyBlocked": true
  }
}
```

## Build Completion Plan

```json
{
  "kind": "build_completion_plan",
  "schemaVersion": 1,
  "app": {
    "name": "Spark of Hope Intake Lite",
    "slug": "spark-of-hope-intake-lite"
  },
  "sourceIssue": {
    "number": "63",
    "title": "Spark of Hope Intake Lite vNext 1",
    "url": "https://github.com/lincolnnunnally/AppEngine/issues/63"
  },
  "currentPhase": "review",
  "currentState": "preview_verified",
  "nextSafeAction": "run_review_gates",
  "blockedReason": "",
  "ownerApprovalRequired": false,
  "relatedPr": "https://github.com/lincolnnunnally/AppEngine/pull/74",
  "relatedPreviewUrl": "https://app-engine-git-codex-spark-vne-cde7c6-lincolnnunnallys-projects.vercel.app",
  "reviewUrl": "https://app-engine-git-codex-spark-vne-cde7c6-lincolnnunnallys-projects.vercel.app/spark-of-hope-intake-lite",
  "productionUrl": "approval-gated",
  "deploymentState": "review_ready",
  "currentVersion": "v1.1-preview-controlled-persistence",
  "requiredGates": [
    "preview_verification",
    "code_review",
    "design_review_if_ui_copy_changed",
    "customer_perspective_review_if_ui_copy_changed",
    "compatibility_review",
    "release_gate"
  ],
  "passedGates": [
    "preview_verification",
    "spark_intake_persistence_smoke",
    "generated_apps_guard",
    "typecheck",
    "build"
  ],
  "failedGates": [],
  "budgetAwareNextSafeAction": "continue",
  "guardrails": {
    "productionDeployBlocked": true,
    "paidResourcesBlocked": true,
    "migrationsBlocked": true,
    "autoMergeBlocked": true,
    "protectedPreviewBypassLinksPubliclyBlocked": true
  }
}
```

## Owner Status Report

```json
{
  "kind": "owner_status_report",
  "schemaVersion": 1,
  "app": {
    "name": "Spark of Hope Intake Lite",
    "slug": "spark-of-hope-intake-lite"
  },
  "currentState": "preview_verified",
  "deploymentState": "review_ready",
  "currentVersion": "v1.1-preview-controlled-persistence",
  "reviewUrl": "https://app-engine-git-codex-spark-vne-cde7c6-lincolnnunnallys-projects.vercel.app/spark-of-hope-intake-lite",
  "productionUrl": "approval-gated",
  "blockingProgress": "Review gates are required before merge or release advancement.",
  "nextSafeAction": "run_review_gates",
  "ownerReadable": {
    "whereIsTheApp": "Review here: https://app-engine-git-codex-spark-vne-cde7c6-lincolnnunnallys-projects.vercel.app/spark-of-hope-intake-lite",
    "production": "Production: blocked/not live yet.",
    "whatHappensIfApproved": "Approval can allow merge of this preview slice, not production launch."
  },
  "guardrails": {
    "productionDeployBlocked": true,
    "paidResourcesBlocked": true,
    "migrationsBlocked": true,
    "autoMergeBlocked": true
  }
}
```

## Preview Verification

```json
{
  "kind": "preview_verification",
  "schemaVersion": 1,
  "status": "passed",
  "summary": "Preview route /spark-of-hope-intake-lite passed route-specific verification.",
  "previewRootUrl": "https://app-engine-git-codex-spark-vne-cde7c6-lincolnnunnallys-projects.vercel.app",
  "reviewUrl": "https://app-engine-git-codex-spark-vne-cde7c6-lincolnnunnallys-projects.vercel.app",
  "productionUrl": "approval-gated",
  "expectedRoute": "/spark-of-hope-intake-lite",
  "checkedUrl": "https://app-engine-git-codex-spark-vne-cde7c6-lincolnnunnallys-projects.vercel.app/spark-of-hope-intake-lite",
  "commitSha": "recorded-in-durable-preview-verification-artifact",
  "deploymentState": "READY",
  "checkedAt": "recorded-in-durable-preview-verification-artifact",
  "checks": [
    {
      "id": "vercel_deployment_ready",
      "status": "passed",
      "details": "Deployment state: READY"
    },
    {
      "id": "expected_route_http_200",
      "status": "passed",
      "details": "Route status: 200"
    },
    {
      "id": "expected_marker_present",
      "status": "passed",
      "details": "Marker: data-app-marker=\"spark-of-hope-intake-lite\""
    },
    {
      "id": "expected_api_http_200",
      "status": "passed",
      "details": "API status: 200"
    },
    {
      "id": "expected_api_json",
      "status": "passed",
      "details": "Expected API subset: {\"ok\":true,\"mode\":\"preview_mock\",\"stored\":false,\"production\":\"blocked\"}"
    }
  ],
  "http": {
    "route": {
      "status": 200,
      "finalUrl": "https://app-engine-git-codex-spark-vne-cde7c6-lincolnnunnallys-projects.vercel.app/spark-of-hope-intake-lite",
      "markerFound": true
    },
    "api": {
      "status": 200,
      "finalUrl": "https://app-engine-git-codex-spark-vne-cde7c6-lincolnnunnallys-projects.vercel.app/api/spark-of-hope-intake-lite/stories",
      "json": {
        "ok": true,
        "mode": "preview_mock",
        "stored": false,
        "production": "blocked",
        "storage": "disabled",
        "reviewStatus": "not_started"
      }
    }
  },
  "lifecycleDeploymentState": "review_ready",
  "guardrails": {
    "rootUrlAloneCannotPass": true,
    "route404Fails": true,
    "markerRequired": true,
    "productionDeployBlocked": true,
    "paidResourcesBlocked": true,
    "migrationsBlocked": true,
    "protectedPreviewBypassLinksPubliclyBlocked": true
  }
}
```

## Acceptance Criteria

- Mock mode remains the default with no database configured.
- Controlled preview persistence is opt-in and fails safe when not fully configured.
- Story content, contact details, consent, status event, and audit event writes stay separated.
- Audit/status metadata remains private-safe.
- Generated app SQL artifacts remain inert and are not wired into setup workflows.
- Preview verification is required before claiming the PR is review-ready.
- Production remains blocked.
