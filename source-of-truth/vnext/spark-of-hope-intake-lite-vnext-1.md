# Spark of Hope Intake Lite vNext 1

## Context Gate

- Decision: Go for planning and scoped follow-up only.
- Source issue: `#63`.
- Source issue URL: `https://github.com/lincolnnunnally/AppEngine/issues/63`.
- Trigger label: `ai:plan`.
- Agent mode: `planner`.
- App: Spark of Hope Intake Lite.
- App slug: `spark-of-hope-intake-lite`.
- Current version: `v1-preview-mock`.
- Target version: `v1.1-preview-controlled-persistence`.
- Charter: `source-of-truth/charters/spark-of-hope-intake-lite.md`.
- Tool classification: Direct Transformation Tool.
- Live GitHub verification: blocked by sandbox network restrictions during `npm run source:check`.
- Local source check: `SOURCE_CHECK_OFFLINE=true npm run source:check` passed.
- Local branch state during this run: `main...origin/main`, working tree clean before edits.

## Required Source Files Read

- `agents/manifest.yaml`
- `agents/context/output-contracts.md`
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
- `db/generated-apps/spark-of-hope-intake-lite/README.md`
- `db/generated-apps/spark-of-hope-intake-lite/001_schema.sql`
- `src/app/api/spark-of-hope-intake-lite/stories/route.ts`
- `src/app/spark-of-hope-intake-lite/page.tsx`

## Ecosystem Design Gates

| Gate | Answer |
| --- | --- |
| What barrier does this remove? | Preview submissions currently disappear after validation, which blocks reviewer/admin validation of safe persistence behavior. |
| What need does this address? | Story sharers and reviewers need a controlled preview storage path that preserves privacy boundaries before production or real-user storage is approved. |
| How does this help someone move toward life? | A hopeful story can move from a one-time mock check toward being received, protected, and reviewable by approved people in preview. |
| How does this help someone become a source of life for others? | Reviewers and encouragement volunteers can begin validating a careful response workflow without exposing stories publicly or collecting uncontrolled data. |

## Current State

- The public route exists at `/spark-of-hope-intake-lite` and carries `data-app-marker="spark-of-hope-intake-lite"` for preview verification.
- `POST /api/spark-of-hope-intake-lite/stories` validates public intake payloads and returns `mode: "preview_mock"`, `stored: false`.
- The generated schema slice exists under `db/generated-apps/spark-of-hope-intake-lite/`, but it is review-only, is not wired into `npm run db:setup`, and was not applied by this planner run.
- The schema already separates story content, contact details, consent, status events, audit events, roles, permissions, review assignments, and encouragement response records.
- No owner approval is recorded for production deployment, paid resources, real migrations, real-user storage, or automatic generated-code merge.

## First Useful Scope

Plan and then build a bounded persistence slice that can be reviewed in a draft PR:

1. Keep mock mode as the default behavior.
2. Add controlled preview persistence only behind explicit server-side configuration.
3. Store only approved preview/test submissions in a disposable preview or local database until owner approval for real user data is recorded.
4. Write data to the existing planned table boundaries:
   - story text: `soh_lite_story_submissions.story_body`
   - contact details: `soh_lite_story_contacts`
   - consent choices and privacy copy version: `soh_lite_story_consents`
   - workflow status: `soh_lite_story_submissions.review_status` and `soh_lite_status_events`
   - audit metadata: `soh_lite_audit_events.safe_metadata`
5. Keep audit/status metadata private-safe: no story body, contact values, raw request payloads, secrets, raw IPs, or raw user agents.
6. Require preview verification for visible behavior changes and keep production blocked.

## Non-Goals

- Do not restart Spark of Hope Intake Lite.
- Do not turn the pilot into the full Spark of Hope product.
- Do not deploy production.
- Do not create paid provider resources.
- Do not apply migrations automatically.
- Do not run schema files against production.
- Do not store real user data until the persistence plan and owner approval are recorded.
- Do not send email, SMS, notifications, or automated encouragement responses.
- Do not add public story feeds, social sharing, payments, donations, counseling, crisis, medical, legal, or emergency workflows.
- Do not expose secrets, database URLs, private story content, private contact data, provider tokens, or credentials in issues, comments, logs, artifacts, or API responses.

## Persistence Design

### Runtime Modes

| Mode | Default | Storage | Use |
| --- | --- | --- | --- |
| `preview_mock` | Yes | None | Current safe preview behavior; validates and returns a reference with `stored: false`. |
| `preview_controlled_persistence` | No | Disposable local/preview database only | Review-gated persistence test path after an implementation PR adds server-side feature flags and safe database writes. |
| `production` | No | Blocked | Not allowed until Release Gate and owner approval are recorded. |

### Configuration Contract

The implementation follow-up should define variable names only, without values:

- `SOH_LITE_PERSISTENCE_MODE`: `mock` by default; `preview` may enable controlled preview persistence.
- `SOH_LITE_PRIVACY_COPY_VERSION`: required for persisted consent records.
- `DATABASE_URL`: required only for the server-side preview persistence path; secret value must never be printed.

If `SOH_LITE_PERSISTENCE_MODE` is absent or not set to the approved preview value, the API must keep returning mock behavior with `stored: false`.

### Write Contract

When controlled preview persistence is explicitly enabled, the public story API should:

1. Validate exactly as the current mock route does or stricter.
2. Generate a non-guessable `public_reference`.
3. Insert one `soh_lite_story_submissions` row with `source = 'public_form'`, `review_status = 'new'`, and `privacy_status = 'private'`.
4. Insert one `soh_lite_story_contacts` row only for provided contact fields, with `safe_to_contact` tied to `mayContact`.
5. Insert one `soh_lite_story_consents` row with `may_review`, `may_contact`, `may_prepare_encouragement`, `may_share_beyond_pilot = false`, and the configured privacy copy version.
6. Insert one `soh_lite_status_events` row with private-safe summary text.
7. Insert one `soh_lite_audit_events` row with IDs, mode, status, and policy decisions only.
8. Return JSON that includes `ok`, `mode`, `stored`, `reference`, `reviewStatus`, and a public-safe message.

All writes should happen in a transaction or fail as a unit. Failed persistence must not create partial story/contact/consent records.

### Read Contract

This vNext scope does not require public or admin read screens. Review/admin queue implementation remains a later scoped follow-up unless the implementation issue explicitly includes a preview-safe read endpoint.

`GET /api/spark-of-hope-intake-lite/stories` may report public-safe capability metadata such as mode, storage disabled/enabled state, accepted methods, and production blocked status. It must not return story content, contact data, counts that expose private activity, database URLs, stack traces, or provider details.

## Acceptance Criteria

- A `vnext_packet` exists for Spark of Hope Intake Lite vNext 1.
- A `build_completion_plan` identifies `create_implementation_issue` as the next safe action after this planning artifact.
- A `cost_governance` artifact exists before model-heavy planning/build work continues.
- Persistence design separates story content, contact details, consent, status, and audit metadata according to the data model.
- Preview storage behavior is explicitly scoped, feature-flagged, and review-gated.
- Mock mode remains the default and remains safe with no database configured.
- Any migration or schema work remains review-only unless owner approval is recorded.
- No production rollout, public launch, paid resources, real migration application, or automatic generated-code merge is approved.
- Preview verification remains required for visible route or API changes.

## Test Path

- `SOURCE_CHECK_OFFLINE=true npm run source:check` when network is unavailable; `npm run source:check` when network is available.
- `npm run typecheck`.
- `npm run build`.
- `npm run generated-apps:guard`.
- API test path for mock mode:
  - `GET /api/spark-of-hope-intake-lite/stories` returns public-safe metadata with production blocked.
  - valid `POST` returns `stored: false` when persistence mode is not enabled.
  - invalid `POST` returns validation error and no write attempt.
- API test path for controlled preview persistence:
  - with a mocked or disposable database client and preview mode enabled, valid `POST` writes story, contact, consent, status event, and audit event separately.
  - contact fields are not written into story rows.
  - story body and contact values are not written into audit/status safe metadata.
  - persistence failure returns a safe error and leaves no partial records.
- Preview verification path:
  - expected route: `/spark-of-hope-intake-lite`
  - expected marker: `data-app-marker="spark-of-hope-intake-lite"`
  - expected API: `/api/spark-of-hope-intake-lite/stories`
  - commit SHA, checked URL, Vercel READY state, route HTTP 200, marker text, and public-safe API JSON must be recorded before preview success is claimed.

## Work Breakdown

1. Build a small server-side persistence adapter for Spark of Hope Intake Lite that can run in mock mode or controlled preview mode.
2. Update the public story API to call the adapter after validation, preserving the current mock response when preview persistence is not enabled.
3. Add transaction-style persistence for story, contact, consent, status event, and audit event records aligned with `001_schema.sql`.
4. Add tests for mock mode, controlled preview writes, validation failures, partial-write failures, and private-safe metadata.
5. Update preview/API copy only where needed to distinguish mock preview from controlled preview persistence.
6. Run typecheck, build, generated-app migration guard, and route/API verification.
7. Keep preview verification, code review, design/customer perspective review if UI text changes, compatibility review, and release gate as blockers before any release advancement.

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
  "context": {
    "charterLoaded": true,
    "registryLoaded": true,
    "monitoringLoaded": true,
    "knownIssuesLoaded": true,
    "releaseHistoryLoaded": true,
    "registrySource": "source-of-truth/charters/spark-of-hope-intake-lite.md planned Super Admin entry; issue #63 confirms production remains blocked",
    "monitoringSource": "Current preview route/API behavior; no post-launch monitoring because app is not launched",
    "releaseHistorySource": "Issue #63 states this follows PR #55, AppEngine Milestone 1: First Verified Preview MVP Slice"
  },
  "change": {
    "requestType": "feature",
    "summary": "Move preview story submission from mock-only response handling to controlled, review-gated preview persistence while production remains blocked.",
    "feedbackSource": "GitHub issue #63 after PR #55",
    "barrierRemoved": "Preview submissions currently disappear after validation, which blocks reviewer/admin validation of safe persistence behavior.",
    "needAddressed": "Story sharers and reviewers need a controlled preview storage path that preserves privacy boundaries before any production or real-user storage is approved.",
    "movementTowardLife": "A hopeful story can move from a one-time mock check toward being received, protected, and reviewable by approved people in preview.",
    "transformationOutcome": "Hopeful stories are stewarded responsibly enough for encouragement workflow validation without public launch, production writes, or uncontrolled data exposure.",
    "toolClassification": "direct_transformation",
    "nonGoals": [
      "Do not restart the whole app.",
      "Do not deploy production.",
      "Do not create paid resources.",
      "Do not apply migrations automatically.",
      "Do not store real user data until the persistence plan and owner approval are recorded.",
      "Do not merge generated app code automatically.",
      "Do not turn the pilot into the full Spark of Hope product."
    ]
  },
  "providerCostDelta": {
    "newPaidResourcesExpected": false,
    "costReviewRequired": true,
    "approvalRequiredForNewPaidResources": true
  },
  "buildCompletion": {
    "kind": "build_completion_plan",
    "required": true,
    "costGovernanceRequired": true,
    "initialState": "ready_for_build",
    "nextSafeAction": "create_implementation_issue"
  },
  "guardrails": {
    "doNotRestartWholeApp": true,
    "preventGoalBleed": true,
    "preserveAppPurpose": true,
    "preserveExistingCharter": true,
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
  "monthlyBudget": null,
  "monthlySpend": 0,
  "projectSpend": 0,
  "appSpend": 0,
  "issueSpend": 0,
  "remainingBudget": null,
  "estimatedNextSpend": 0.05,
  "thresholdStatus": "budget_not_configured",
  "modelRouting": {
    "taskType": "schema_design",
    "taskClass": "expensive",
    "recommendedClass": "expensive"
  },
  "nextBudgetAction": "continue",
  "ownerApprovalRequired": false,
  "blockedReason": "AI/API budget is not configured; continue in advisory mode and record spend awareness.",
  "guardrails": {
    "noSecretsInOutput": true,
    "noCreditBurnWithoutArtifact": true,
    "useCheapestCapableModel": true,
    "ownerApprovalBeforePauseOrApprovalThreshold": true,
    "productionDeployBlocked": true,
    "paidResourcesBlocked": true,
    "migrationsBlocked": true,
    "autoMergeBlocked": true
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
  "currentPhase": "controlled_preview_persistence_build",
  "currentState": "ready_for_build",
  "nextSafeAction": "create_implementation_issue",
  "blockedReason": "",
  "ownerApprovalRequired": false,
  "relatedPr": null,
  "relatedPreviewUrl": null,
  "requiredGates": [
    { "id": "source_of_truth", "phase": "planning", "status": "required" },
    { "id": "cost_governance", "phase": "planning", "status": "required" },
    { "id": "provider_cost_review", "phase": "planning", "status": "required" },
    { "id": "deployment_environment", "phase": "planning", "status": "required" },
    { "id": "preview_verification", "phase": "preview", "status": "required" },
    { "id": "code_review", "phase": "review", "status": "required" },
    { "id": "release_gate", "phase": "release", "status": "required" },
    { "id": "production_approval", "phase": "release", "status": "required" }
  ],
  "passedGates": ["vnext_packet", "cost_governance", "persistence_plan"],
  "failedGates": [],
  "safety": {
    "productionDeployAllowed": false,
    "paidResourcesAllowed": false,
    "migrationsAllowed": false,
    "autoMergeAllowed": false
  },
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

## Build Spec

```json
{
  "kind": "build_spec",
  "schemaVersion": 1,
  "app": {
    "name": "Spark of Hope Intake Lite",
    "slug": "spark-of-hope-intake-lite",
    "charterPath": "source-of-truth/charters/spark-of-hope-intake-lite.md",
    "toolClassification": "direct_transformation",
    "currentVersion": "v1-preview-mock",
    "targetVersion": "v1.1-preview-controlled-persistence"
  },
  "scope": {
    "summary": "Add controlled preview persistence behind server-side configuration while preserving mock mode as default.",
    "included": [
      "story API persistence adapter",
      "mock mode fallback",
      "preview-only write path",
      "story/contact/consent/status/audit separation",
      "private-safe logging and audit metadata",
      "tests for mode behavior and privacy boundaries"
    ],
    "excluded": [
      "production deployment",
      "paid resources",
      "automatic migration application",
      "real-user storage without owner approval",
      "admin queue UI",
      "email/SMS delivery"
    ]
  },
  "acceptanceCriteria": [
    "Mock mode stays default and works without a database.",
    "Preview persistence writes story, contact, consent, status, and audit records separately.",
    "Audit/status records contain no story body or contact values.",
    "Failed writes do not leave partial records.",
    "Production, paid resources, migrations, and auto-merge remain blocked.",
    "Preview verification is required before claiming visible success."
  ]
}
```

## Codex-Ready Prompt

```text
Build the bounded Spark of Hope Intake Lite vNext 1 implementation slice from source-of-truth/vnext/spark-of-hope-intake-lite-vnext-1.md.

Required source of truth:
- source-of-truth/00-why-we-build.md
- source-of-truth/01-ecosystem-philosophy.md
- source-of-truth/02-global-principles.md
- source-of-truth/03-life-produces-life.md
- source-of-truth/04-app-purpose-rules.md
- source-of-truth/05-ecosystem-design-gates.md
- source-of-truth/app-improvement-vnext-packet.md
- source-of-truth/build-completion-orchestrator.md
- source-of-truth/cost-governance-model-routing.md
- source-of-truth/deployment-environment-standard.md
- source-of-truth/release-gate-standard.md
- source-of-truth/charters/spark-of-hope-intake-lite.md
- source-of-truth/architecture/spark-of-hope-intake-lite.md
- source-of-truth/data-model/spark-of-hope-intake-lite.md
- source-of-truth/identity-auth/spark-of-hope-intake-lite.md
- source-of-truth/provider-cost/spark-of-hope-intake-lite.md
- source-of-truth/vnext/spark-of-hope-intake-lite-vnext-1.md
- db/generated-apps/spark-of-hope-intake-lite/001_schema.sql
- db/generated-apps/spark-of-hope-intake-lite/README.md

Task:
Move the story intake API from mock-only behavior to controlled preview persistence while keeping mock mode as default. Add a server-side persistence adapter that writes to the existing soh_lite table boundaries only when explicit preview persistence configuration is enabled. Persist story content, contact details, consent choices, workflow status, and audit metadata separately. Audit/status safe metadata must not include story body, contact values, secrets, raw request payloads, raw IPs, or raw user agents.

Guardrails:
- Do not deploy production.
- Do not create paid resources.
- Do not apply migrations automatically.
- Do not store real user data unless owner approval is recorded.
- Do not merge generated app code automatically.
- Do not expose secrets, database URLs, private story content, private contact data, tokens, or credentials.
- Do not turn this into the full Spark of Hope product.

Verification:
Run SOURCE_CHECK_OFFLINE=true npm run source:check when network is unavailable, then npm run typecheck, npm run build, and npm run generated-apps:guard. Add or update tests/checks for mock mode, preview persistence mode, validation failure, partial-write failure, private-safe audit/status metadata, and preview route/API verification requirements.
```

## Follow-Up Task

```json
{
  "title": "[spark-of-hope-intake-lite] Build controlled preview persistence",
  "recommendedLabel": "ai:build",
  "body": "## Build Controlled Preview Persistence\n\nCreate the bounded implementation slice for Spark of Hope Intake Lite vNext 1. Keep mock mode as the default, add controlled preview persistence behind explicit server-side configuration, and preserve the story/contact/consent/status/audit separation defined in the vNext packet.\n\n## Required Source Of Truth To Load\n- source-of-truth/00-why-we-build.md\n- source-of-truth/01-ecosystem-philosophy.md\n- source-of-truth/02-global-principles.md\n- source-of-truth/03-life-produces-life.md\n- source-of-truth/04-app-purpose-rules.md\n- source-of-truth/05-ecosystem-design-gates.md\n- source-of-truth/charters/spark-of-hope-intake-lite.md\n- source-of-truth/architecture/spark-of-hope-intake-lite.md\n- source-of-truth/data-model/spark-of-hope-intake-lite.md\n- source-of-truth/identity-auth/spark-of-hope-intake-lite.md\n- source-of-truth/provider-cost/spark-of-hope-intake-lite.md\n- source-of-truth/design/spark-of-hope-intake-lite.md\n- source-of-truth/vnext/spark-of-hope-intake-lite-vnext-1.md\n- source-of-truth/app-improvement-vnext-packet.md\n- source-of-truth/build-completion-orchestrator.md\n- source-of-truth/cost-governance-model-routing.md\n- source-of-truth/deployment-environment-standard.md\n- source-of-truth/release-gate-standard.md\n- db/generated-apps/spark-of-hope-intake-lite/README.md\n- db/generated-apps/spark-of-hope-intake-lite/001_schema.sql\n- agents/manifest.yaml\n- agents/context/output-contracts.md\n\n## Acceptance Criteria\n- Mock mode remains default and works with no database configured.\n- Controlled preview persistence is enabled only by explicit server-side configuration.\n- Valid preview persistence writes story, contact, consent, status, and audit records separately.\n- Audit/status metadata excludes story body, contact values, secrets, raw request payloads, raw IPs, and raw user agents.\n- Failed persistence does not leave partial records.\n- No migration is applied automatically.\n- No production deployment, paid resources, real-user storage without owner approval, or automatic merge occurs.\n- Preview verification remains required before visible success is claimed.\n\n## Guardrails\n- Do not restart the app.\n- Do not import unrelated app goals, data, audiences, or workflows.\n- Do not expose secrets or private data.\n- Do not deploy production.\n- Do not create paid resources.\n- Do not apply migrations.\n- Do not auto-merge generated app code."
}
```

