# Phase Issue Generation

AppEngine may turn an approved `phase_creation_approval` into bounded, reviewable phase issue drafts.

This step produces a `phase_issue_generation` artifact. It is phase issue draft/generation only. It does not create GitHub issues, trigger Codex build work, build UI, deploy production, create paid resources, apply migrations, add secrets, change env vars, change repository visibility, or auto-merge generated app code.

## Purpose

Phase Issue Generation answers:

- Which final packet is the source?
- Which phase issue drafts were generated?
- What order should the phases run in?
- What labels should be applied later if the owner approves issue creation?
- What guardrails apply to each phase?
- What is the next safe action?

This step lets AppEngine prepare reviewable work without waking up build agents automatically.

## Input Artifact

The input artifact is `phase_creation_approval`.

Required input fields:

- `kind: "phase_creation_approval"`
- `schemaVersion`
- `sourceArtifact.kind: "final_packet_materialization"`
- `sourceArtifact.candidateSlug`
- `sourceArtifact.candidateType`
- `sourceArtifact.finalPacketType`
- `candidate.name`
- `candidate.slug`
- `candidate.type`
- `candidate.summary`
- `candidate.needAddressed`
- `candidate.desiredTransformation`
- `finalPacket.kind`
- `finalPacket.status`
- `approvalStatus`
- all phase creation approval check statuses and notes
- `decision.approvedForPhaseCreation`
- `decision.phaseIssuesCreated`
- `decision.codexBuildTriggered`
- `decision.ownerApprovalRequired`
- `guardrails.approvalGateOnly`

The generator must fail honestly when required approval fields are missing.

## Proceed Rule

The generator may proceed only when:

- `approvalStatus: "approved_for_phase_creation"`
- `decision.approvedForPhaseCreation: true`
- all approval checks are `pass`

It must fail honestly when `approvalStatus` is one of:

- `needs_revision`
- `rejected`
- `blocked_by_security`
- `blocked_by_cost`
- `blocked_by_scope`

## Supported Final Packet Types

The generator supports:

- `app_build_packet`
- `vnext_packet`
- `non_app_solution_plan`

## Phase Issue Drafts

For `app_build_packet` and `vnext_packet`, generate bounded phase issue drafts such as:

- `architecture`
- `provider_cost`
- `data_model`
- `identity_auth`
- `ui_design`
- `build`
- `verification`
- `release_gate`

For `non_app_solution_plan`, generate bounded non-code phase issue drafts such as:

- `discovery`
- `solution_design`
- `workflow_process_design`
- `content_resource_plan`
- `implementation_checklist`
- `review_measurement`

Phase drafts are not GitHub issues until a later explicit issue-creation step is approved.

## Owner-Readable Output

The owner-readable output should be concise:

```text
Phase Issue Generation

Candidate: Church Care Follow-Up
Source final packet: non_app_solution_plan
Generated phase drafts: discovery, solution_design, workflow_process_design, content_resource_plan, implementation_checklist, review_measurement
Labels to apply later: ai:plan
Next safe action: review_phase_issue_drafts
Guardrails: draft issues only, no GitHub issues created, no Codex build, no deploy
```

## Machine-Readable Output Contract

Agents should produce a `phase_issue_generation` artifact:

```json
{
  "kind": "phase_issue_generation",
  "schemaVersion": 1,
  "sourceArtifact": {
    "kind": "phase_creation_approval",
    "candidateSlug": "church-care-follow-up",
    "candidateType": "workflow_process_candidate",
    "finalPacketType": "non_app_solution_plan",
    "approvalStatus": "approved_for_phase_creation"
  },
  "candidate": {
    "name": "Church Care Follow-Up",
    "slug": "church-care-follow-up",
    "type": "workflow_process_candidate",
    "summary": "Clarify and track a care follow-up solution candidate.",
    "needAddressed": "timely care coordination",
    "desiredTransformation": "people receive timely care and stay connected"
  },
  "sourceFinalPacket": {
    "kind": "non_app_solution_plan",
    "status": "final_review_ready"
  },
  "phaseOrder": ["discovery", "solution_design"],
  "labelsToApply": ["ai:plan"],
  "phaseIssueDrafts": [
    {
      "phase": "discovery",
      "order": 1,
      "title": "[church-care-follow-up] Discovery",
      "recommendedLabel": "ai:plan",
      "recommendedLabels": ["ai:plan"],
      "guardrails": [
        "No Codex build work.",
        "No production deploy.",
        "No paid resources."
      ],
      "body": "Issue-ready phase draft body..."
    }
  ],
  "decision": {
    "generationStatus": "phase_issue_drafts_ready",
    "nextSafeAction": "review_phase_issue_drafts",
    "phaseIssueDraftsGenerated": true,
    "githubIssuesCreated": false,
    "codexBuildTriggered": false,
    "ownerApprovalRequired": true
  },
  "ownerReadableReport": "Phase Issue Generation...",
  "guardrails": {
    "phaseIssueDraftGenerationOnly": true,
    "noUi": true,
    "noGithubIssuesCreated": true,
    "noAutomaticCodexBuildExecution": true,
    "noProductionDeploy": true,
    "noPaidResources": true,
    "noMigrations": true,
    "noSecretsOrEnvChanges": true,
    "repositoryVisibilityUnchanged": true,
    "noGeneratedCodeAutoMerge": true
  }
}
```

## Follow-Up Requirements

Generated phase issue drafts must include:

- source candidate
- source final packet type
- phase order
- recommended labels
- phase-specific guardrails
- required source-of-truth files
- clear non-goals
- next safe action

Every phase issue draft must include a `## Required Source Of Truth To Load` section.

## Required Source Files

Every generated phase issue draft must list:

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
- `source-of-truth/phase-issue-generation.md`
- `source-of-truth/app-portfolio-registry.md`

Phase-specific drafts should add phase-specific standards such as `app-build-packet`, `app-improvement-vnext-packet`, provider/cost, identity/auth, design quality, compatibility, release gate, or deployment environment standards when relevant.

## Guardrails

Phase issue generation must not:

- create GitHub issues automatically
- trigger Codex build work automatically
- build UI
- deploy production
- create paid resources
- apply migrations
- add secrets or env vars
- change repository visibility
- auto-merge generated app code
- claim implementation has started

## Success Criteria

The generator is working when:

1. Approved App Build Packets produce bounded app phase issue drafts.
2. Approved vNext Packets produce bounded vNext phase issue drafts.
3. Approved Non-App Solution Plans produce bounded non-code phase issue drafts.
4. Non-approved statuses fail honestly.
5. Missing approval fields fail honestly.
6. Owner-readable output shows source final packet, generated phase list, phase order, labels, guardrails, and next safe action.
7. No GitHub issues, build work, deployments, migrations, paid resources, secrets, env changes, repository visibility changes, or auto-merges occur.
