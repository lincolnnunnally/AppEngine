# Packet Draft Approval Gate

AppEngine must review a `candidate_packet_bridge` draft before it becomes a final App Build Packet, final vNext Packet, or final Non-App Solution Plan.

This gate produces a `packet_draft_approval` artifact. It is approval-gate only. It does not create final packets, create phase issues, trigger Codex build work, deploy production, create paid resources, apply migrations, add secrets, change env vars, change repository visibility, or auto-merge generated app code.

## Purpose

The Packet Draft Approval Gate answers:

- Is the packet draft clear enough to become a final packet?
- Is the selected packet type correct?
- Does the solution shape fit the actual problem and transformation?
- Are audience, data/security/privacy, cost/provider, scope, and reviewability ready?
- What owner notes or approval conditions must be recorded before the next packet step?

The gate prevents AppEngine from treating a draft packet as executable work too early.

## Input Artifact

The input artifact is `candidate_packet_bridge`.

Required input fields:

- `kind: "candidate_packet_bridge"`
- `schemaVersion`
- `sourceArtifact.kind: "solution_candidate_review"`
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
- `selectedDraft.ownerApprovalRequired`
- `packetDraft.kind`
- `packetDraft.status`
- `decision.bridgeStatus`
- `decision.nextSafeAction`
- `decision.phaseIssuesCreated`
- `decision.codexBuildTriggered`
- `decision.ownerApprovalRequired`
- `guardrails.planningPacketDraftOnly`

The gate must fail honestly when required bridge fields are missing.

## Supported Packet Draft Types

The approval gate supports:

- `app_build_packet_draft`
- `vnext_packet_draft`
- `non_app_solution_plan_draft`

The gate must fail honestly for unknown draft kinds or when `selectedDraft.kind` does not match `packetDraft.kind`.

## Approval Statuses

Every `packet_draft_approval` must use one of these statuses:

- `approved_for_final_packet`
- `needs_revision`
- `rejected`
- `blocked_by_security`
- `blocked_by_cost`
- `blocked_by_scope`

Only `approved_for_final_packet` may recommend the next planning step toward a final packet. Even then, this gate does not create the final packet.

## Required Approval Checks

Every approval must check:

- `problemTransformationClarity`
- `correctPacketType`
- `solutionShapeFit`
- `audienceUserClarity`
- `dataSecurityPrivacyReadiness`
- `providerCostReadiness`
- `scopeRealism`
- `reviewability`
- `ownerApprovalNotes`

Each check must include:

- `status`
- `notes`

Allowed check statuses are:

- `pass`
- `needs_revision`
- `rejected`
- `blocked_by_security`
- `blocked_by_cost`
- `blocked_by_scope`

Missing check status or notes must fail honestly.

## Owner-Readable Approval Output

The owner-readable output should be concise:

```text
Packet Draft Approval

Candidate: Church Care Follow-Up
Draft type: non_app_solution_plan_draft
Status: approved_for_final_packet
Next safe action: prepare_final_packet_request
Owner approval required: yes, before final packet creation
Guardrails: approval gate only, no final packet, no phase issues, no build, no deploy
```

When the gate does not approve the draft, the output must clearly say why and what the next safe action is.

## Machine-Readable Output Contract

Agents should produce a `packet_draft_approval` artifact:

```json
{
  "kind": "packet_draft_approval",
  "schemaVersion": 1,
  "sourceArtifact": {
    "kind": "candidate_packet_bridge",
    "candidateSlug": "church-care-follow-up",
    "candidateType": "workflow_process_candidate",
    "selectedDraftKind": "non_app_solution_plan_draft"
  },
  "candidate": {
    "name": "Church Care Follow-Up",
    "slug": "church-care-follow-up",
    "type": "workflow_process_candidate",
    "summary": "Clarify and track a care follow-up solution candidate.",
    "needAddressed": "timely care coordination",
    "desiredTransformation": "people receive timely care and stay connected"
  },
  "packetDraft": {
    "kind": "non_app_solution_plan_draft",
    "status": "review_ready_draft",
    "summary": "Draft non-app solution plan for owner review."
  },
  "approvalStatus": "approved_for_final_packet",
  "approvalChecks": {
    "problemTransformationClarity": {
      "status": "pass",
      "notes": "Problem and desired transformation are clear."
    }
  },
  "decision": {
    "readyForFinalPacket": true,
    "finalPacketType": "non_app_solution_plan",
    "nextSafeAction": "prepare_final_packet_request",
    "finalPacketCreated": false,
    "phaseIssuesCreated": false,
    "codexBuildTriggered": false,
    "ownerApprovalRequired": true
  },
  "ownerReadableReport": "Packet Draft Approval...",
  "followUpTasks": [],
  "guardrails": {
    "approvalGateOnly": true,
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

## Decision Rules

Approval status is determined from the required approval checks:

- Any `blocked_by_security` check makes the artifact `blocked_by_security`.
- Any `blocked_by_cost` check makes the artifact `blocked_by_cost`.
- Any `blocked_by_scope` check makes the artifact `blocked_by_scope`.
- Any `rejected` check makes the artifact `rejected`.
- Any `needs_revision` check makes the artifact `needs_revision`.
- All checks must be `pass` to produce `approved_for_final_packet`.

## Next Safe Actions

| Approval status | Next safe action |
| --- | --- |
| `approved_for_final_packet` | `prepare_final_packet_request` |
| `needs_revision` | `create_packet_draft_revision_issue` |
| `rejected` | `record_packet_draft_rejection` |
| `blocked_by_security` | `create_security_review_issue` |
| `blocked_by_cost` | `create_cost_review_issue` |
| `blocked_by_scope` | `create_scope_review_issue` |

## Follow-Up Issue Requirements

Any follow-up issue from this gate must be a review or revision issue, not a phase issue and not implementation.

It must include:

- candidate name and type
- selected packet draft type
- approval status
- failing or blocking checks
- owner approval notes
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
- `source-of-truth/packet-draft-approval-gate.md`
- `source-of-truth/app-portfolio-registry.md`

## Guardrails

Packet draft approval must not:

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
- claim a packet is executable until owner/reviewer approval is recorded

## Success Criteria

The gate is working when:

1. `app_build_packet_draft` can be approved without creating a final packet.
2. `vnext_packet_draft` can be approved without creating a final packet.
3. `non_app_solution_plan_draft` can be approved without creating a final packet.
4. `needs_revision`, `rejected`, `blocked_by_security`, `blocked_by_cost`, and `blocked_by_scope` are represented honestly.
5. Missing bridge or approval fields fail honestly.
6. The owner can see what was approved, what is blocked, and what the next safe action is.
7. No final packets, phase issues, build work, deployments, migrations, paid resources, secrets, env changes, repository visibility changes, or auto-merges occur.
