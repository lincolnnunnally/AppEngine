# Phase Issue Publisher Dry Run

AppEngine may convert an approved `phase_issue_publish_approval` into publish-ready GitHub issue payload previews.

This step produces a `phase_issue_publisher_dry_run` artifact. It is dry-run only. It does not create GitHub issues, trigger Codex build work, build UI, deploy production, create paid resources, apply migrations, add secrets, change env vars, change repository visibility, or auto-merge generated app code.

## Purpose

Phase Issue Publisher Dry Run answers:

- Which phase issue approval is the source?
- Which issue titles would be created?
- Which labels would be applied?
- What is the phase order?
- How does each issue trace back to the source packet?
- What exact GitHub issue payload would be sent later?
- What guardrails still apply?
- What is the next safe action?

This step lets AppEngine show the owner exactly what would happen before any real GitHub issue is created.

## Input Artifact

The input artifact is `phase_issue_publish_approval`.

Required input fields:

- `kind: "phase_issue_publish_approval"`
- `schemaVersion`
- `sourceArtifact.kind: "phase_issue_generation"`
- `sourceArtifact.candidateSlug`
- `sourceArtifact.candidateType`
- `sourceArtifact.finalPacketType`
- `sourceArtifact.generationStatus`
- `candidate.name`
- `candidate.slug`
- `candidate.type`
- `candidate.summary`
- `candidate.needAddressed`
- `candidate.desiredTransformation`
- `sourceFinalPacket.kind`
- `sourceFinalPacket.status`
- `approvalStatus`
- `approvalChecks`
- `phaseIssueSummary.phaseCount`
- `phaseIssueSummary.phaseOrder`
- `phaseIssueSummary.labelsToApply`
- `phaseIssueSummary.draftTitles`
- `phaseIssueDrafts` or source draft payloads from the approval input
- `decision.approvedForIssuePublish`
- `decision.githubIssuesPublished`
- `decision.codexBuildTriggered`
- `decision.codexTriggerLabelsApproved`
- `decision.ownerApprovalRequired`
- `guardrails.approvalGateOnly`

The dry-run publisher must fail honestly when required approval fields or source issue draft payloads are missing.

## Proceed Rule

The dry-run publisher may proceed only when:

- `approvalStatus: "approved_for_issue_publish"`
- `decision.approvedForIssuePublish: true`
- all approval checks are `pass`

It must fail honestly when `approvalStatus` is one of:

- `needs_revision`
- `rejected`
- `blocked_by_security`
- `blocked_by_cost`
- `blocked_by_scope`

## GitHub Issue Payload Preview

The dry-run artifact must include exact issue payload previews for a later real publisher:

```json
{
  "title": "[church-care-follow-up] Discovery",
  "body": "Issue-ready body...",
  "labels": ["ai:plan"],
  "metadata": {
    "phase": "discovery",
    "phaseOrder": 1,
    "candidateSlug": "church-care-follow-up",
    "sourceFinalPacketType": "non_app_solution_plan"
  }
}
```

Payload previews are not GitHub issues. They must not call the GitHub API.

## Owner-Readable Output

The owner-readable output should be concise and concrete:

```text
Phase Issue Publisher Dry Run

Candidate: Church Care Follow-Up
Source final packet: non_app_solution_plan
Issues previewed: 6
Next safe action: review_phase_issue_payloads
GitHub issues created: no
Codex build triggered: no

Issue payload previews:
1. [church-care-follow-up] Discovery
   Labels: ai:plan
   Phase: discovery
```

## Machine-Readable Output Contract

Agents should produce a `phase_issue_publisher_dry_run` artifact:

```json
{
  "kind": "phase_issue_publisher_dry_run",
  "schemaVersion": 1,
  "sourceArtifact": {
    "kind": "phase_issue_publish_approval",
    "candidateSlug": "church-care-follow-up",
    "candidateType": "workflow_process_candidate",
    "finalPacketType": "non_app_solution_plan",
    "approvalStatus": "approved_for_issue_publish"
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
  "issuePayloadPreviews": [
    {
      "title": "[church-care-follow-up] Discovery",
      "body": "Issue-ready body...",
      "labels": ["ai:plan"],
      "metadata": {
        "phase": "discovery",
        "phaseOrder": 1,
        "candidateSlug": "church-care-follow-up",
        "sourceFinalPacketType": "non_app_solution_plan"
      }
    }
  ],
  "phaseOrder": ["discovery", "solution_design"],
  "labelsToApply": ["ai:plan"],
  "sourcePacketTraceability": [
    {
      "phase": "discovery",
      "sourceFinalPacketType": "non_app_solution_plan",
      "sourceApproval": "phase_issue_publish_approval"
    }
  ],
  "decision": {
    "dryRunStatus": "payloads_ready_for_owner_review",
    "nextSafeAction": "review_phase_issue_payloads",
    "githubIssuesCreated": false,
    "codexBuildTriggered": false,
    "ownerApprovalRequired": true
  },
  "ownerReadableReport": "Phase Issue Publisher Dry Run...",
  "guardrails": {
    "dryRunOnly": true,
    "noUi": true,
    "noGithubIssuesCreated": true,
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

## Failure Rules

The dry-run publisher must fail honestly when:

- input artifact is not `phase_issue_publish_approval`
- approval status is not `approved_for_issue_publish`
- approval decision is not approved
- approval checks are missing or not all `pass`
- source phase issue drafts are missing
- any issue payload would be missing title, body, labels, phase metadata, source packet metadata, guardrails, or required source files
- payload body contains secrets, env var values, protected preview bypass links, paid resource instructions, migration instructions, production deploy instructions, or automatic Codex build instructions

## Guardrails

Phase issue publisher dry run must not:

- create GitHub issues
- trigger Codex build work
- build UI
- deploy production
- create paid resources
- apply migrations
- add secrets or env vars
- change repository visibility
- auto-merge generated app code
- treat dry-run payload generation as owner approval for real issue creation

## Success Criteria

The dry-run publisher is working when:

1. Approved publish approvals produce exact GitHub issue payload previews.
2. Owner-readable output lists titles, labels, phase order, source packet traceability, guardrails, and next safe action.
3. Non-approved statuses fail honestly.
4. Missing approval fields fail honestly.
5. Missing source drafts fail honestly.
6. No GitHub issues, build work, deployments, migrations, paid resources, secrets, env changes, repository visibility changes, or auto-merges occur.
