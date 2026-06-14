# Cost Governance and Model Routing Standard

AppEngine must be financially aware before it becomes more autonomous.

This standard governs AI/API credit usage for agent work. It is separate from provider cost review, which governs generated-app infrastructure such as Vercel, Render, Neon, storage, email, payments, analytics, and monitoring.

## Purpose

Prevent AppEngine from consuming model/API credits without visible budget context, task classification, threshold behavior, and owner approval when spend crosses agreed limits.

Every autonomous run that advances planning, implementation, review, debugging, design, preview verification, release, or monitoring should either produce or inherit a `cost_governance` artifact.

## Required Artifact

### cost_governance

The artifact tracks:

- Monthly budget
- Monthly spend
- Project spend
- App spend
- Issue spend
- Remaining budget
- Estimated next spend when known
- Model routing strategy
- Current task class
- Recommended model class
- Warning threshold
- Pause threshold
- Owner approval threshold
- Budget-aware next action
- Owner approval requirement
- Safety guardrails

## Model Routing Strategy

Agents must classify model work before choosing a model or continuing an expensive task.

### Cheap Tasks

Use deterministic scripts, cached artifacts, or the least expensive capable model.

Examples:

- Issue routing
- Label selection
- Formatting
- Artifact cleanup
- Metadata cleanup
- Prompt packaging

### Medium Tasks

Use balanced models when judgment matters but broad generation is not required.

Examples:

- Review
- Summarization
- Validation
- Source checks
- Preview verification
- Workflow test synthesis

### Expensive Tasks

Use higher-capability models only when the task genuinely needs them.

Examples:

- Architecture
- Implementation
- Debugging
- Design generation
- Schema design
- Complex MVP build work

## Spend Thresholds

Default threshold behavior:

- Warning threshold: 50 percent of monthly budget
- Pause threshold: 80 percent of monthly budget
- Owner approval threshold: 90 percent of monthly budget

Projects may override these thresholds through the `cost_governance` artifact or approved environment configuration.

## Budget-Aware Next Actions

Cost governance uses these budget actions:

- `continue`: budget is acceptable for the selected task class.
- `continue_with_cheaper_model`: proceed only with a cheaper capable model, deterministic script, cache, or smaller scoped prompt.
- `pause`: stop autonomous progress until budget posture is reviewed.
- `request_approval`: require owner approval before more AI/API credits are consumed.

The Build Completion Orchestrator must consider the budget action before advancing the next build action.

If the budget action is `pause`, the build completion plan should set `nextSafeAction` to `pause_for_budget`.

If the budget action is `request_approval`, the build completion plan should set `nextSafeAction` to `request_budget_approval`.

If the budget action is `continue_with_cheaper_model`, the build completion plan may continue the normal build action, but it must record the cheaper-model requirement in the embedded `cost_governance` artifact.

## Owner Approval Required

Owner approval is required when:

- Projected spend reaches the owner approval threshold.
- The estimated next spend exceeds remaining budget.
- Enforcement mode is enabled and an expensive task has no configured budget.
- An agent proposes a higher-cost model after a warning, pause, or approval threshold has been reached.

Owner approval must be recorded in a durable source such as a GitHub issue, pull request comment, or approved configuration change.

## Guardrails

Agents must not:

- Hide model/API spend decisions in prose only.
- Continue expensive tasks when the artifact says `pause` or `request_approval`.
- Treat provider cost review as a substitute for model/API credit governance.
- Include API keys, model tokens, account billing secrets, private invoices, or payment credentials in artifacts.
- Use production deployment, paid resources, migrations, or auto-merge to bypass budget approval.

Agents should:

- Prefer deterministic scripts before model calls for cheap tasks.
- Reuse durable artifacts before re-asking a model.
- Shrink prompts and scope when warning thresholds are reached.
- Record the model routing class and next budget action in build completion plans.

## Machine Shape

Agents should produce cost governance artifacts with this shape:

```json
{
  "kind": "cost_governance",
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
  "monthlyBudget": 100,
  "monthlySpend": 30,
  "projectSpend": 22,
  "appSpend": 12,
  "issueSpend": 1,
  "remainingBudget": 70,
  "estimatedNextSpend": 0.05,
  "projectedMonthlySpend": 30.05,
  "projectedSpendRatio": 0.3005,
  "spendThresholds": {
    "warningPercent": 0.5,
    "pausePercent": 0.8,
    "ownerApprovalPercent": 0.9
  },
  "thresholdStatus": "within_budget",
  "modelRouting": {
    "taskType": "issue_routing",
    "taskClass": "cheap",
    "recommendedClass": "cheap"
  },
  "nextBudgetAction": "continue",
  "ownerApprovalRequired": false,
  "blockedReason": "",
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

## Build Completion Contract

Every `build_completion_plan` should embed a `costGovernance` object and expose `budgetAwareNextSafeAction`.

The build plan must not continue autonomous work when cost governance returns `pause` or `request_approval`.
