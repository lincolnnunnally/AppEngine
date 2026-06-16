# Final Packet Materialization

AppEngine must convert an approved `packet_draft_approval` into the correct final review-ready planning packet without creating phase issues or starting implementation.

This step produces a `final_packet_materialization` artifact. It is final packet creation only. It does not create phase issues, trigger Codex build work, build UI, deploy production, create paid resources, apply migrations, add secrets, change env vars, change repository visibility, or auto-merge generated app code.

## Purpose

Final Packet Materialization answers:

- Which approved packet draft is becoming final?
- What final packet type is being created?
- Why is the packet ready?
- What guardrails remain active?
- What is the next safe action before phase creation or build work?

This step prevents AppEngine from jumping from approval directly into phase issues or implementation.

## Input Artifact

The input artifact is `packet_draft_approval`.

Required input fields:

- `kind: "packet_draft_approval"`
- `schemaVersion`
- `sourceArtifact.kind: "candidate_packet_bridge"`
- `sourceArtifact.candidateSlug`
- `sourceArtifact.candidateType`
- `sourceArtifact.selectedDraftKind`
- `candidate.name`
- `candidate.slug`
- `candidate.type`
- `candidate.summary`
- `candidate.needAddressed`
- `candidate.desiredTransformation`
- `packetDraft.kind`
- `packetDraft.status`
- `packetDraft.summary`
- `approvalStatus`
- all approval check statuses and notes
- `decision.readyForFinalPacket`
- `decision.finalPacketType`
- `decision.nextSafeAction`
- `decision.finalPacketCreated`
- `decision.phaseIssuesCreated`
- `decision.codexBuildTriggered`
- `decision.ownerApprovalRequired`
- `guardrails.approvalGateOnly`

The materializer must fail honestly when required approval fields are missing.

## Proceed Rule

The materializer may proceed only when:

- `approvalStatus: "approved_for_final_packet"`
- `decision.readyForFinalPacket: true`
- all approval checks are `pass`

It must fail honestly when `approvalStatus` is one of:

- `needs_revision`
- `rejected`
- `blocked_by_security`
- `blocked_by_cost`
- `blocked_by_scope`

## Final Packet Types

The materializer can create one final planning packet:

- `app_build_packet`
- `vnext_packet`
- `non_app_solution_plan`

These are final planning packets, not implementation authorization.

## Owner-Readable Output

The owner-readable output should be concise:

```text
Final Packet Materialization

Candidate: Church Care Follow-Up
Approved packet type: non_app_solution_plan
Why ready: packet draft approval passed all required checks
Next safe action: request_phase_creation_approval
Guardrails: final packet only, no phase issues, no build, no deploy
```

## Machine-Readable Output Contract

Agents should produce a `final_packet_materialization` artifact:

```json
{
  "kind": "final_packet_materialization",
  "schemaVersion": 1,
  "sourceArtifact": {
    "kind": "packet_draft_approval",
    "candidateSlug": "church-care-follow-up",
    "candidateType": "workflow_process_candidate",
    "approvalStatus": "approved_for_final_packet",
    "approvedDraftKind": "non_app_solution_plan_draft"
  },
  "candidate": {
    "name": "Church Care Follow-Up",
    "slug": "church-care-follow-up",
    "type": "workflow_process_candidate",
    "summary": "Clarify and track a care follow-up solution candidate.",
    "needAddressed": "timely care coordination",
    "desiredTransformation": "people receive timely care and stay connected"
  },
  "finalPacketType": "non_app_solution_plan",
  "finalPacket": {
    "kind": "non_app_solution_plan",
    "schemaVersion": 1,
    "status": "final_review_ready",
    "candidateSlug": "church-care-follow-up",
    "summary": "Final non-app solution plan ready for phase-creation approval."
  },
  "decision": {
    "materializationStatus": "final_packet_ready",
    "nextSafeAction": "request_phase_creation_approval",
    "finalPacketCreated": true,
    "phaseIssuesCreated": false,
    "codexBuildTriggered": false,
    "ownerApprovalRequired": true
  },
  "ownerReadableReport": "Final Packet Materialization...",
  "followUpTasks": [],
  "guardrails": {
    "finalPacketCreationOnly": true,
    "noUi": true,
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

## Next Safe Action

The next safe action after final packet materialization is:

```text
request_phase_creation_approval
```

That later approval decides whether phase issues may be created. This materializer must not create phase issues.

The required later approval is `source-of-truth/phase-creation-approval-gate.md`.

## Follow-Up Issue Requirements

Any follow-up issue from this materializer must be a final-packet review or phase-creation approval request, not implementation.

It must include:

- source candidate
- approved packet type
- final packet summary
- why the packet is ready
- remaining guardrails
- next safe action
- required source-of-truth files

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
- `source-of-truth/final-packet-materialization.md`
- `source-of-truth/phase-creation-approval-gate.md`
- `source-of-truth/app-portfolio-registry.md`
- `source-of-truth/app-build-packet.md` when final packet type is `app_build_packet`
- `source-of-truth/app-improvement-vnext-packet.md` when final packet type is `vnext_packet`

## Guardrails

Final packet materialization must not:

- build UI
- create phase issues
- trigger Codex build work
- deploy production
- create paid resources
- apply migrations
- add secrets or env vars
- change repository visibility
- auto-merge generated app code
- treat final packet creation as implementation approval

## Success Criteria

The materializer is working when:

1. Approved App Build Packet drafts become final `app_build_packet` planning packets.
2. Approved vNext Packet drafts become final `vnext_packet` planning packets.
3. Approved Non-App Solution Plan drafts become final `non_app_solution_plan` planning packets.
4. Non-approved statuses fail honestly.
5. Missing approval fields fail honestly.
6. The owner can see the source candidate, approved packet type, why it is ready, remaining guardrails, and next safe action.
7. No phase issues, build work, deployments, migrations, paid resources, secrets, env changes, repository visibility changes, or auto-merges occur.
