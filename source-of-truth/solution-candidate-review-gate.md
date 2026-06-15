# Solution Candidate Review Gate

AppEngine must review every portfolio-tracked solution candidate before it becomes an App Build Packet, vNext Packet, or non-app solution plan.

This gate uses `problem_portfolio_routing` as its input and produces a `solution_candidate_review` artifact. It is planning/review only. It does not create app build packets, vNext packets, public intake UI, implementation work, production deployments, paid resources, migrations, secrets, env var changes, repository visibility changes, or generated app auto-merge.

## Purpose

The Solution Candidate Review Gate prevents AppEngine from turning every idea into code too early.

It answers:

- Is the problem clear enough to proceed?
- Is the intended transformation clear enough to protect the mission?
- Is the audience or user specific enough?
- Is the solution shape still the right fit?
- Are data, security, privacy, cost, provider, and scope risks understood?
- Does this candidate fit the right app or ecosystem boundary?
- What owner approval is required before the next packet or plan?
- What is the correct next kind of work?

## Input Artifact

The input artifact is `problem_portfolio_routing`.

Required input fields:

- `kind: "problem_portfolio_routing"`
- `sourceArtifact.kind: "problem_solution_intake"`
- `candidate.name`
- `candidate.slug`
- `candidate.type`
- `candidate.summary`
- `candidate.affectedPeople`
- `candidate.barriers`
- `candidate.needAddressed`
- `candidate.desiredTransformation`
- `candidate.solutionShape.primary`
- `portfolioDestination.kind: "app_portfolio_registry"`
- `portfolioDestination.action`
- `requiredReviewGates`
- `routing.nextSafeAction`
- `routing.ownerApprovalRequired`
- `guardrails.planningOnly`

If required input fields are missing, the review must fail honestly with `needs_clarification` instead of inventing readiness.

## Review Factors

Every candidate review must evaluate:

- `problemClarity`: problem, affected people, barrier, and need are understandable.
- `intendedTransformation`: desired transformation and movement toward life are clear.
- `audienceUser`: primary audience, owner, or user is specific enough.
- `solutionShape`: app, vNext, website, process, automation, content, ministry/community, or multi-part shape is still appropriate.
- `dataSecurityPrivacyNeeds`: data sensitivity, access boundaries, privacy needs, and secret risks are understood.
- `costProviderImpact`: provider needs, cost posture, and paid-resource risk are understood.
- `buildComplexity`: scope is small enough for the next packet or plan.
- `appEcosystemFit`: app boundaries, ecosystem fit, and purpose-bleed risks are understood.
- `ownerApprovalRequirements`: what Lincoln must approve before the next packet or plan is clear.

## Readiness Statuses

The review must produce exactly one readiness status:

- `needs_clarification`
- `ready_for_app_build_packet`
- `ready_for_vnext_packet`
- `ready_for_non_app_solution_plan`
- `blocked_by_security`
- `blocked_by_cost`
- `blocked_by_scope`

Use these rules:

| Condition | Status |
| --- | --- |
| Required input or review factors are missing or unclear | `needs_clarification` |
| Data, security, privacy, or secret risk blocks the next step | `blocked_by_security` |
| Cost, provider, budget, or paid-resource risk blocks the next step | `blocked_by_cost` |
| Scope is too broad, ambiguous, or crosses boundaries | `blocked_by_scope` |
| Candidate type is `new_app_candidate` and all review factors pass | `ready_for_app_build_packet` |
| Candidate type is `existing_app_improvement` and all review factors pass | `ready_for_vnext_packet` |
| Candidate type is non-app and all review factors pass | `ready_for_non_app_solution_plan` |

Blocked statuses outrank readiness. If a candidate is both unclear and blocked, choose the strongest blocker and list the missing context in the review.

## Owner-Readable Review Output

The owner-readable report should be concise:

```text
Solution Candidate Review

Candidate: Church Care Follow-Up
Status: ready_for_non_app_solution_plan
Recommended next step: create_non_app_solution_plan_issue
Why: the problem is clear and a workflow/process plan should come before software
Owner approval required: yes, approve the candidate direction before packet creation
Blockers: none
Guardrails: planning/review only, no production, no paid resources, no migrations
```

## Machine-Readable Output Contract

Agents should produce a `solution_candidate_review` artifact:

```json
{
  "kind": "solution_candidate_review",
  "schemaVersion": 1,
  "sourceArtifact": {
    "kind": "problem_portfolio_routing",
    "candidateSlug": "church-care-follow-up",
    "candidateType": "workflow_process_candidate"
  },
  "candidate": {
    "name": "Church Care Follow-Up",
    "slug": "church-care-follow-up",
    "type": "workflow_process_candidate",
    "summary": "Clarify and track a care follow-up solution candidate.",
    "needAddressed": "timely care coordination",
    "desiredTransformation": "people receive timely care and stay connected"
  },
  "readinessStatus": "ready_for_non_app_solution_plan",
  "review": {
    "problemClarity": {
      "status": "pass",
      "notes": "Problem, affected people, barriers, and need are clear."
    },
    "intendedTransformation": {
      "status": "pass",
      "notes": "The desired transformation is clear."
    },
    "audienceUser": {
      "status": "pass",
      "notes": "Primary audience is clear."
    },
    "solutionShape": {
      "status": "pass",
      "notes": "Workflow/process comes before software."
    },
    "dataSecurityPrivacyNeeds": {
      "status": "pass",
      "notes": "No sensitive data path is authorized yet."
    },
    "costProviderImpact": {
      "status": "pass",
      "notes": "No paid provider action is authorized."
    },
    "buildComplexity": {
      "status": "pass",
      "notes": "Scope is bounded to a plan."
    },
    "appEcosystemFit": {
      "status": "pass",
      "notes": "Boundaries are clear."
    },
    "ownerApprovalRequirements": {
      "status": "pass",
      "notes": "Owner approval is required before packet creation."
    }
  },
  "decision": {
    "ready": true,
    "blockers": [],
    "missingContext": [],
    "nextSafeAction": "create_non_app_solution_plan_issue",
    "nextArtifact": "non_app_solution_plan_request",
    "ownerApprovalRequired": true
  },
  "ownerReadableReport": "Solution Candidate Review...",
  "followUpTasks": [],
  "guardrails": {
    "planningReviewOnly": true,
    "noUi": true,
    "noAppBuildPacketsCreated": true,
    "noVnextPacketsCreated": true,
    "noProductionDeploy": true,
    "noPaidResources": true,
    "noMigrations": true,
    "noSecretsOrEnvChanges": true,
    "repositoryVisibilityUnchanged": true,
    "noGeneratedCodeAutoMerge": true
  }
}
```

## Required Fields

Every `solution_candidate_review` artifact must include:

- `kind`
- `schemaVersion`
- `sourceArtifact.kind`
- `sourceArtifact.candidateSlug`
- `sourceArtifact.candidateType`
- `candidate.name`
- `candidate.slug`
- `candidate.type`
- `candidate.summary`
- `candidate.needAddressed`
- `candidate.desiredTransformation`
- `readinessStatus`
- all review factors
- `decision.ready`
- `decision.nextSafeAction`
- `decision.nextArtifact`
- `decision.ownerApprovalRequired`
- `ownerReadableReport`
- all guardrails

## Follow-Up Issue Requirements

Any follow-up issue created from solution candidate review must include:

- candidate name and type
- readiness status
- blockers
- missing context
- review factor results
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
- `source-of-truth/solution-candidate-review-gate.md`
- `source-of-truth/app-portfolio-registry.md`
- `source-of-truth/app-build-packet.md` only after `ready_for_app_build_packet`
- `source-of-truth/app-improvement-vnext-packet.md` only after `ready_for_vnext_packet`

## Guardrails

Solution candidate review must not:

- build UI
- create App Build Packets
- create vNext Packets
- create non-app implementation plans directly
- deploy production
- create paid resources
- apply migrations
- add secrets or env vars
- change repository visibility
- auto-merge generated app code
- claim readiness when required review factors are missing
- force non-app candidates into app packets

## Success Criteria

The gate is working when:

1. A valid `problem_portfolio_routing` can become a `solution_candidate_review`.
2. Ready app candidates route to App Build Packet creation as a next issue, not an immediate packet.
3. Ready existing app improvements route to vNext Packet creation as a next issue, not an immediate packet.
4. Ready non-app candidates route to the right non-app solution plan.
5. Unclear candidates return `needs_clarification`.
6. Security, cost, and scope blockers produce explicit blocked statuses.
7. All guardrails remain active.

After a ready status, use `source-of-truth/candidate-to-packet-bridge.md` to create a review-ready packet draft before any final App Build Packet, vNext Packet, non-app solution plan, phase issue, or build work.
