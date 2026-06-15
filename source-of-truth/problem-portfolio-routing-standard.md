# Problem Intake To Portfolio Routing Standard

AppEngine should place every accepted problem, vision, or hybrid intake into the portfolio as a safe, reviewable solution candidate before app-building begins.

This standard connects `problem_solution_intake` to `app_portfolio_registry`. It is planning/routing only. It does not authorize public intake UI, implementation, production deployment, paid resources, migrations, secrets, env var changes, repository visibility changes, or generated app auto-merge.

## Purpose

Problem-to-portfolio routing answers:

- What kind of solution candidate did the clarified problem or vision become?
- Should the candidate become a new app, existing app improvement, website, workflow/process, automation, content/resource, community/ministry model, or multi-part ecosystem solution?
- What portfolio entry or candidate record should track it?
- What review gates must pass before a build packet, vNext packet, website plan, automation plan, process plan, content plan, or ministry/community model can proceed?
- What should Lincoln see in one owner-readable routing report?

## Input Artifact

The input artifact is `problem_solution_intake`.

Required input fields:

- `kind: "problem_solution_intake"`
- `mode`
- `rawRequest`
- `problem.summary`
- `problem.affectedPeople`
- `problem.barriers`
- `problem.needAddressed`
- `problem.desiredTransformation`
- `problem.movementTowardLife`
- `solutionShape.primary`
- `solutionShape.rationale`
- `routing.nextSafeAction`
- `guardrails.planningOnly`

If required input fields are missing, routing must fail honestly and create a focused planning follow-up instead of inventing a candidate.

## Destination Artifact

The destination/tracking artifact is `app_portfolio_registry`.

Routing should not overwrite the portfolio. It should recommend one of these portfolio actions:

- `add_candidate`: add a new solution candidate that is not ready for a build packet.
- `update_candidate`: update an existing candidate's state, issue, PR, or next action.
- `link_existing_app`: connect the intake to an existing app entry and route to vNext review.
- `split_candidate`: split a multi-part ecosystem solution into multiple candidate records.
- `block_until_review`: pause because required context, ownership, or guardrails are missing.

## Candidate Types

Every accepted intake must become exactly one candidate type:

- `new_app_candidate`
- `existing_app_improvement`
- `website_candidate`
- `workflow_process_candidate`
- `automation_candidate`
- `content_resource_candidate`
- `ministry_community_model_candidate`
- `multi_part_ecosystem_solution`

## Candidate Type Rules

Use these rules:

| Input signal | Candidate type |
| --- | --- |
| `solutionShape.primary = app` and `existingAppFit.status = existing` | `existing_app_improvement` |
| `solutionShape.primary = app` and no existing app is selected | `new_app_candidate` |
| `solutionShape.primary = website` | `website_candidate` |
| `solutionShape.primary = workflow_process` | `workflow_process_candidate` |
| `solutionShape.primary = automation` | `automation_candidate` |
| `solutionShape.primary = content_resource` | `content_resource_candidate` |
| `solutionShape.primary = community_ministry_model` | `ministry_community_model_candidate` |
| `solutionShape.primary = multi_part_ecosystem_solution` | `multi_part_ecosystem_solution` |

When `solutionShape.secondary` contains multiple meaningful pieces, the routing report should identify the secondary candidates and recommend whether later routing should split them.

## Required Review Gates Before Build Packets

No candidate may become an App Build Packet, vNext Packet, or implementation issue until required review gates pass.

All candidates require:

- `source_of_truth_gate`: required source files are loaded.
- `problem_clarity_gate`: problem, affected people, barriers, need, and desired transformation are understandable.
- `owner_review_gate`: Lincoln can see and approve the candidate direction.
- `portfolio_registry_gate`: candidate is tracked in or ready to be written to `app_portfolio_registry`.
- `boundary_gate`: app/ecosystem boundaries are respected and purpose bleed is blocked.
- `cost_guardrail_gate`: no paid-resource path is implied without provider/cost review.
- `security_privacy_gate`: data, privacy, secrets, and access risks are identified before build.

Additional gates by candidate:

- App candidates: `app_selection_gate`, `app_build_packet_gate`, `identity_auth_gate`, `super_admin_gate`, `provider_cost_gate`, `release_gate`.
- Existing app improvements: `existing_app_context_gate`, `vnext_packet_gate`, `release_history_gate`.
- Website candidates: `domain_hosting_gate`, `content_ownership_gate`, `preview_review_gate`.
- Workflow/process candidates: `process_owner_gate`, `manual_workflow_test_gate`.
- Automation candidates: `integration_permission_gate`, `runtime_cost_gate`, `failure_mode_gate`.
- Content/resource candidates: `content_source_gate`, `editorial_review_gate`.
- Ministry/community model candidates: `care_safety_gate`, `leadership_owner_gate`, `relational_boundaries_gate`.
- Multi-part ecosystem solutions: `solution_split_gate`, `connection_review_gate`, `systems_review_gate`.

## Owner-Readable Routing Report

The owner-readable report should be concise:

```text
Problem Intake To Portfolio Routing

Candidate: Church Care Follow-Up
Type: workflow_process_candidate + app secondary
Portfolio action: add_candidate
Why: the human care workflow must be clarified before software supports it
Review gates before build: source_of_truth_gate, problem_clarity_gate, owner_review_gate, portfolio_registry_gate, process_owner_gate
Next safe action: create_planning_issue
Owner decision needed: approve candidate direction before packet creation
Guardrails: planning only, no production, no paid resources, no migrations
```

## Machine-Readable Output Contract

Agents should produce a `problem_portfolio_routing` artifact:

```json
{
  "kind": "problem_portfolio_routing",
  "schemaVersion": 1,
  "sourceArtifact": {
    "kind": "problem_solution_intake",
    "mode": "problem_first",
    "rawRequest": "Churches keep dropping follow-up after someone asks for help."
  },
  "candidate": {
    "name": "Church Care Follow-Up",
    "slug": "church-care-follow-up",
    "type": "workflow_process_candidate",
    "secondaryTypes": ["new_app_candidate"],
    "summary": "Clarify and track a care follow-up solution candidate.",
    "affectedPeople": ["people asking for help", "church staff", "volunteers"],
    "barriers": ["ownership gaps", "visibility gaps"],
    "needAddressed": "timely care coordination",
    "desiredTransformation": "people receive timely care and stay connected",
    "solutionShape": {
      "primary": "workflow_process",
      "secondary": ["app"],
      "rationale": "The care workflow must be clarified before software supports it."
    }
  },
  "portfolioDestination": {
    "kind": "app_portfolio_registry",
    "action": "add_candidate",
    "trackingState": "candidate_review",
    "requiredFields": [
      "name",
      "slug",
      "candidateType",
      "reviewUrl",
      "productionUrl",
      "currentVersion",
      "deploymentState",
      "buildState",
      "nextSafeAction",
      "sourceOfTruthFiles",
      "linkedIssues",
      "linkedPRs"
    ]
  },
  "requiredReviewGates": [
    {
      "id": "source_of_truth_gate",
      "status": "required",
      "blocksBuildPacket": true
    }
  ],
  "routing": {
    "nextSafeAction": "create_planning_issue",
    "recommendedLabel": "ai:plan",
    "nextArtifact": "portfolio_candidate_review",
    "ownerApprovalRequired": true
  },
  "ownerReadableReport": "Candidate Church Care Follow-Up should be tracked as workflow_process_candidate before build.",
  "followUpTasks": [],
  "guardrails": {
    "planningOnly": true,
    "noPublicIntakeUi": true,
    "noProductionDeploy": true,
    "noPaidResources": true,
    "noMigrations": true,
    "noSecretsOrEnvChanges": true,
    "repositoryVisibilityUnchanged": true,
    "noGeneratedCodeAutoMerge": true,
    "requiresReviewBeforeBuildPacket": true
  }
}
```

## Required Fields

Every `problem_portfolio_routing` artifact must include:

- `kind`
- `schemaVersion`
- `sourceArtifact.kind`
- `sourceArtifact.mode`
- `sourceArtifact.rawRequest`
- `candidate.name`
- `candidate.slug`
- `candidate.type`
- `candidate.summary`
- `candidate.affectedPeople`
- `candidate.barriers`
- `candidate.needAddressed`
- `candidate.desiredTransformation`
- `candidate.solutionShape.primary`
- `portfolioDestination.kind`
- `portfolioDestination.action`
- `portfolioDestination.trackingState`
- `requiredReviewGates`
- `routing.nextSafeAction`
- `routing.recommendedLabel`
- `routing.ownerApprovalRequired`
- `ownerReadableReport`
- all guardrails

## Follow-Up Issue Requirements

Any follow-up issue created from problem-to-portfolio routing must include:

- source request
- problem_solution_intake mode
- candidate name and type
- destination portfolio action
- required review gates
- missing context
- next safe action
- required source-of-truth files
- guardrails

Required source-of-truth files:

- `source-of-truth/00-why-we-build.md`
- `source-of-truth/01-ecosystem-philosophy.md`
- `source-of-truth/02-global-principles.md`
- `source-of-truth/03-life-produces-life.md`
- `source-of-truth/04-app-purpose-rules.md`
- `source-of-truth/05-ecosystem-design-gates.md`
- `source-of-truth/problem-to-solution-intake-standard.md`
- `source-of-truth/problem-portfolio-routing-standard.md`
- `source-of-truth/app-selection-standard.md`
- `source-of-truth/app-build-packet.md` when the candidate may become an app
- `source-of-truth/app-improvement-vnext-packet.md` when the candidate is an existing app improvement
- `source-of-truth/app-portfolio-registry.md` after the App Portfolio Registry standard is merged

## Guardrails

Problem-to-portfolio routing must not:

- build intake UI
- deploy production
- create paid resources
- apply migrations
- add secrets or env vars
- change repository visibility
- auto-merge generated app code
- create an App Build Packet before required review gates pass
- create a vNext Packet before existing app context is loaded
- claim a candidate is review-ready without portfolio tracking evidence
- force non-app candidates into software builds

## Success Criteria

The standard is working when:

1. A valid `problem_solution_intake` becomes a tracked solution candidate.
2. AppEngine can distinguish new app candidates from existing app improvements and non-app solution candidates.
3. The destination/tracking artifact is `app_portfolio_registry`.
4. The owner gets a clear routing report.
5. Required review gates block build packets until review is complete.
6. Missing required fields fail honestly.
7. All guardrails remain active.
