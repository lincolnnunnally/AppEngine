# Candidate To Packet Bridge

AppEngine must turn an approved `solution_candidate_review` into the correct review-ready packet draft without starting implementation.

This bridge produces a `candidate_packet_bridge` artifact. It is planning/packet-draft only. It does not create phase issues, trigger Codex build work, deploy production, create paid resources, apply migrations, add secrets, change env vars, change repository visibility, or auto-merge generated app code.

## Purpose

The Candidate To Packet Bridge answers:

- Which packet draft should this approved candidate become?
- Why was that packet type selected?
- What source review approved it?
- What owner review is still required before real packet creation or phase expansion?
- What guardrails remain active?

The bridge prevents AppEngine from jumping from candidate approval directly into implementation.

## Input Artifact

The input artifact is `solution_candidate_review`.

Required input fields:

- `kind: "solution_candidate_review"`
- `sourceArtifact.kind: "problem_portfolio_routing"`
- `sourceArtifact.candidateSlug`
- `sourceArtifact.candidateType`
- `candidate.name`
- `candidate.slug`
- `candidate.type`
- `candidate.summary`
- `candidate.needAddressed`
- `candidate.desiredTransformation`
- `readinessStatus`
- all review factor statuses
- `decision.ready`
- `decision.nextSafeAction`
- `decision.nextArtifact`
- `decision.ownerApprovalRequired`
- `guardrails.planningReviewOnly`

## Allowed Readiness Statuses

The bridge may proceed only when `readinessStatus` is one of:

- `ready_for_app_build_packet`
- `ready_for_vnext_packet`
- `ready_for_non_app_solution_plan`

The bridge must fail honestly when `readinessStatus` is one of:

- `needs_clarification`
- `blocked_by_security`
- `blocked_by_cost`
- `blocked_by_scope`

The bridge must also fail honestly when required review fields are missing.

## Packet Draft Types

The bridge can create one of these review-ready drafts:

- `app_build_packet_draft`
- `vnext_packet_draft`
- `non_app_solution_plan_draft`

These are drafts inside the `candidate_packet_bridge` artifact. They are not final packet artifacts, and they do not authorize implementation.

## Selection Rules

| Readiness status | Packet draft type |
| --- | --- |
| `ready_for_app_build_packet` | `app_build_packet_draft` |
| `ready_for_vnext_packet` | `vnext_packet_draft` |
| `ready_for_non_app_solution_plan` | `non_app_solution_plan_draft` |

## Owner-Readable Bridge Output

The owner-readable output should be concise:

```text
Candidate To Packet Bridge

Candidate: Church Care Follow-Up
Selected draft: non_app_solution_plan_draft
Why: solution candidate review approved a workflow/process candidate, not an app build
Owner approval required: yes, review the draft before packet creation or phase expansion
Next safe action: review_packet_draft
Guardrails: packet draft only, no phase issues, no build, no deploy
```

## Machine-Readable Output Contract

Agents should produce a `candidate_packet_bridge` artifact:

```json
{
  "kind": "candidate_packet_bridge",
  "schemaVersion": 1,
  "sourceArtifact": {
    "kind": "solution_candidate_review",
    "candidateSlug": "church-care-follow-up",
    "candidateType": "workflow_process_candidate",
    "readinessStatus": "ready_for_non_app_solution_plan"
  },
  "candidate": {
    "name": "Church Care Follow-Up",
    "slug": "church-care-follow-up",
    "type": "workflow_process_candidate",
    "summary": "Clarify and track a care follow-up solution candidate.",
    "needAddressed": "timely care coordination",
    "desiredTransformation": "people receive timely care and stay connected"
  },
  "selectedDraft": {
    "kind": "non_app_solution_plan_draft",
    "reason": "The approved candidate is a workflow/process path.",
    "ownerApprovalRequired": true
  },
  "packetDraft": {
    "kind": "non_app_solution_plan_draft",
    "schemaVersion": 1,
    "status": "review_ready_draft",
    "candidateSlug": "church-care-follow-up",
    "summary": "Draft non-app solution plan for owner review.",
    "recommendedNextStep": "review_packet_draft"
  },
  "decision": {
    "bridgeStatus": "draft_ready",
    "nextSafeAction": "review_packet_draft",
    "phaseIssuesCreated": false,
    "codexBuildTriggered": false,
    "ownerApprovalRequired": true
  },
  "ownerReadableReport": "Candidate To Packet Bridge...",
  "followUpTasks": [],
  "guardrails": {
    "planningPacketDraftOnly": true,
    "noUi": true,
    "noFinalPacketsCreated": true,
    "noPhaseIssuesCreated": true,
    "noCodexBuildTriggered": true,
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

Every `candidate_packet_bridge` artifact must include:

- `kind`
- `schemaVersion`
- `sourceArtifact.kind`
- `sourceArtifact.candidateSlug`
- `sourceArtifact.candidateType`
- `sourceArtifact.readinessStatus`
- `candidate.name`
- `candidate.slug`
- `candidate.type`
- `candidate.summary`
- `candidate.needAddressed`
- `candidate.desiredTransformation`
- `selectedDraft.kind`
- `selectedDraft.reason`
- `packetDraft.kind`
- `packetDraft.status`
- `decision.bridgeStatus`
- `decision.nextSafeAction`
- `decision.phaseIssuesCreated`
- `decision.codexBuildTriggered`
- `decision.ownerApprovalRequired`
- `ownerReadableReport`
- all guardrails

## Follow-Up Issue Requirements

Any later follow-up issue created from the bridge must be a packet-draft review issue, not a phase issue.

It must include:

- candidate name and type
- readiness status
- selected packet draft type
- packet draft summary
- owner review requirement
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
- `source-of-truth/candidate-to-packet-bridge.md`
- `source-of-truth/app-portfolio-registry.md`
- `source-of-truth/app-build-packet.md` when selected draft is `app_build_packet_draft`
- `source-of-truth/app-improvement-vnext-packet.md` when selected draft is `vnext_packet_draft`

## Guardrails

Candidate to packet bridge must not:

- build UI
- create final App Build Packets
- create final vNext Packets
- create final non-app solution plans
- create phase issues
- trigger Codex build work
- deploy production
- create paid resources
- apply migrations
- add secrets or env vars
- change repository visibility
- auto-merge generated app code
- bridge blocked or unclear candidates
- claim a packet is final before owner review

## Success Criteria

The bridge is working when:

1. `ready_for_app_build_packet` creates an `app_build_packet_draft`.
2. `ready_for_vnext_packet` creates a `vnext_packet_draft`.
3. `ready_for_non_app_solution_plan` creates a `non_app_solution_plan_draft`.
4. Non-ready statuses fail honestly.
5. Missing required review fields fail honestly.
6. The owner can see why the packet type was selected.
7. No phase issues, build work, deployments, migrations, paid resources, secrets, env changes, repository visibility changes, or auto-merges occur.
