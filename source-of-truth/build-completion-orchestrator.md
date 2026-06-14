# Build Completion Orchestrator Standard

The Build Completion Orchestrator is the missing center between planning and launch.

Its job is to decide the next safe action from:

```text
idea
-> intake
-> App Build Packet or vNext Packet
-> planning phases
-> implementation draft PR
-> preview
-> review gates
-> release gate
-> monitored app
```

It does not replace owner judgment. It reduces repetitive handoff work by making AppEngine state, blockers, evidence, and next actions explicit.

## Required Artifacts

### build_completion_plan

Every generated app or vNext path should produce or update a `build_completion_plan` before moving from planning into implementation, preview, review, release, or vNext work.

The artifact must track:

- App name
- App slug
- Source issue
- Current phase
- Current state
- Next safe action
- Blocked reason
- Whether owner approval is required
- Related PR
- Related preview URL
- Required gates
- Passed gates
- Failed gates
- Follow-up tasks
- Evidence links
- Safety guardrails

### preview_verification

Preview success must not be claimed from a root URL alone.

Preview deployments are public by default. Production stays protected until approved. The preview verifier should use a normal public preview URL and must not rely on protected Vercel bypass/share links as proof unless an app-specific owner-approved exception is recorded.

A preview passes only when:

- Vercel deployment state is `READY`
- Preview root URL is available
- Expected route returns HTTP 200
- Expected route is not the wrong root page
- Expected route contains an app marker text or test id
- Mock/API endpoint returns expected JSON when applicable
- Commit SHA is recorded
- Checked URL is recorded
- Timestamp is recorded
- Public preview content is safe: no secrets, real private user data, production writes, paid provider actions, or migrations are exposed
- Result is persisted in durable `agent-run` artifacts

For Spark of Hope Intake Lite, the expected route is:

```text
/spark-of-hope-intake-lite
```

### cost_governance

Every build completion plan should embed a `cost_governance` artifact before autonomous agent work consumes meaningful AI/API credits.

The artifact must track:

- Monthly budget
- Monthly spend
- Project spend
- App spend
- Issue spend
- Remaining budget
- Model routing class
- Warning, pause, and owner approval thresholds
- Budget-aware next action

Cost governance is distinct from provider cost review. Provider cost review governs generated-app infrastructure costs. Cost governance governs model/API credit consumption by AppEngine agents.

## Build States

Use these state values:

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

## Next Safe Actions

Use these action values:

- `create_planning_issue`
- `create_implementation_issue`
- `create_draft_pr`
- `wait_for_preview`
- `verify_preview`
- `run_review_gates`
- `create_fix_issue`
- `stop_for_owner_approval`
- `pause_for_budget`
- `request_budget_approval`
- `prepare_release_gate`
- `create_vnext_packet`

Agents should stop guessing what happens next. They should update the build completion plan and follow the next safe action.

Budget-aware actions use this meaning:

- `pause_for_budget`: stop autonomous progress because AI/API spend reached the pause threshold.
- `request_budget_approval`: stop until owner approval records a higher budget, spend cap, or cheaper routing decision.

## Safe Auto-Progress

These actions may safely auto-progress when source-of-truth checks pass and artifacts are durable:

- Create planning issues
- Create implementation issues
- Create draft PRs
- Wait for preview
- Verify preview routes
- Run review gates
- Create focused fix issues
- Prepare release-gate artifacts without production deployment
- Create vNext packets

## Owner Approval Required

These actions always require owner approval:

- Production deployment
- Paid resource creation
- Real provider provisioning
- Database migrations against real providers
- Secret or environment variable changes
- Custom domain activation
- Merging generated app code
- Public launch status
- Any action involving real user data

## Guardrails

The build completion plan must keep these blocked unless owner approval is recorded:

- Production deploy
- Paid resources
- Migrations
- Auto-merge of generated code
- Protected Vercel bypass/share links in public comments
- Treating protected preview access as a successful public preview
- AI/API credit consumption beyond configured cost governance thresholds

If any blocked action is requested, the next safe action is `stop_for_owner_approval`.

If cost governance says `pause`, the next safe action is `pause_for_budget`.

If cost governance says `request_approval`, the next safe action is `request_budget_approval`.

## Machine Shape

Agents should produce build completion artifacts with this shape:

```json
{
  "kind": "build_completion_plan",
  "schemaVersion": 1,
  "app": {
    "name": "App name",
    "slug": "app-slug"
  },
  "sourceIssue": {
    "number": 56,
    "title": "Source issue title",
    "url": "https://github.com/owner/repo/issues/56"
  },
  "currentPhase": "mvp_build",
  "currentState": "ready_for_build",
  "nextSafeAction": "create_implementation_issue",
  "blockedReason": "",
  "ownerApprovalRequired": false,
  "relatedPr": null,
  "relatedPreviewUrl": null,
  "requiredGates": [],
  "passedGates": [],
  "failedGates": [],
  "followUpTasks": [],
  "evidenceLinks": {},
  "safety": {
    "productionDeployAllowed": false,
    "paidResourcesAllowed": false,
    "migrationsAllowed": false,
    "autoMergeAllowed": false
  },
  "costGovernance": {
    "kind": "cost_governance",
    "monthlyBudget": 100,
    "monthlySpend": 30,
    "projectSpend": 22,
    "appSpend": 12,
    "issueSpend": 1,
    "remainingBudget": 70,
    "modelRouting": {
      "taskClass": "cheap",
      "recommendedClass": "cheap"
    },
    "nextBudgetAction": "continue"
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

Agents should produce preview verification artifacts with this shape:

```json
{
  "kind": "preview_verification",
  "schemaVersion": 1,
  "status": "passed",
  "summary": "Preview route passed route-specific verification.",
  "previewRootUrl": "https://preview.example.app",
  "expectedRoute": "/spark-of-hope-intake-lite",
  "checkedUrl": "https://preview.example.app/spark-of-hope-intake-lite",
  "commitSha": "abc123",
  "deploymentState": "READY",
  "checkedAt": "2026-06-14T00:00:00.000Z",
  "checks": [
    {
      "id": "expected_route_http_200",
      "status": "passed",
      "details": "Route status: 200"
    }
  ],
  "guardrails": {
    "rootUrlAloneCannotPass": true,
    "route404Fails": true,
    "markerRequired": true,
    "commitShaRequired": true,
    "productionDeployBlocked": true,
    "paidResourcesBlocked": true,
    "migrationsBlocked": true,
    "protectedPreviewBypassLinksPubliclyBlocked": true
  }
}
```

## False Success Prevention

Agents must not claim preview success when:

- Only the root URL works.
- The expected route returns 404.
- The expected route returns the wrong page.
- The marker text or test id is missing.
- Vercel is not `READY`.
- The commit SHA is unknown.
- The checked URL is not recorded.
- Evidence is only in runner-local paths.

Failed preview verification must create a focused `ai:fix` follow-up task.
