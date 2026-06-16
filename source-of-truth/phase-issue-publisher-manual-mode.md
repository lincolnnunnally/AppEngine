# Phase Issue Publisher Manual Mode

AppEngine may publish real GitHub phase issues from an approved `phase_issue_publisher_dry_run`, but only in explicit manual mode with owner approval.

This step produces a `phase_issue_publisher_manual` artifact. It is manual publishing only. The default behavior is dry-run/no-op. It does not trigger Codex build work, build UI, deploy production, create paid resources, apply migrations, add secrets, change env vars, change repository visibility, or auto-merge generated app code.

## Purpose

Phase Issue Publisher Manual Mode answers:

- Was manual publishing explicitly enabled?
- Was owner approval explicitly recorded?
- Which GitHub issue payloads were validated?
- Which safe labels were applied?
- Which labels were blocked because they could trigger build work?
- Were real GitHub issues created, mocked, or skipped?
- What is the next safe action?

This is the first controlled path from approved phase issue previews to real GitHub issues.

## Default Behavior

Manual publishing is disabled by default.

Without explicit enablement, the publisher must:

- validate the dry-run payloads
- produce a `phase_issue_publisher_manual` artifact
- report `publishStatus: "manual_publish_not_enabled"`
- report `githubIssuesCreated: false`
- create no GitHub issues
- trigger no Codex build work

## Required Manual Enablement

Real GitHub issue creation requires both:

- `APPENGINE_PHASE_ISSUE_PUBLISH_MODE=manual`
- `APPENGINE_PHASE_ISSUE_PUBLISH_OWNER_APPROVED=true`

Smoke tests may use:

- `APPENGINE_PHASE_ISSUE_PUBLISH_MOCK=true`

Mock mode validates the manual path without calling GitHub or claiming real issue creation.

## Input Artifact

The input artifact is `phase_issue_publisher_dry_run`.

Required input fields:

- `kind: "phase_issue_publisher_dry_run"`
- `schemaVersion`
- `sourceArtifact.kind: "phase_issue_publish_approval"`
- `sourceArtifact.candidateSlug`
- `sourceArtifact.candidateType`
- `sourceArtifact.finalPacketType`
- `sourceArtifact.approvalStatus`
- `candidate.name`
- `candidate.slug`
- `candidate.type`
- `candidate.summary`
- `candidate.needAddressed`
- `candidate.desiredTransformation`
- `sourceFinalPacket.kind`
- `sourceFinalPacket.status`
- `issuePayloadPreviews`
- `phaseOrder`
- `labelsToApply`
- `sourcePacketTraceability`
- `decision.dryRunStatus`
- `decision.githubIssuesCreated`
- `decision.codexBuildTriggered`
- `decision.ownerApprovalRequired`
- `guardrails.dryRunOnly`

The manual publisher must fail honestly when required dry-run fields are missing.

## Manual Publish Rules

The publisher may create real GitHub issues only when:

- dry-run artifact is valid
- manual mode is explicitly enabled
- owner approval flag is explicitly true
- GitHub repository is known
- GitHub token is available
- payloads pass safety validation
- labels are sanitized to safe labels

It must never apply build-triggering labels in this PR.

Blocked labels include:

- `ai:build`
- `ai:fix`

Default safe label:

- `ai:plan`

If a payload contains only blocked labels, the manual publisher should replace them with the safe default label and record the blocked original labels.

## Owner-Readable Output

The owner-readable output should be concrete:

```text
Phase Issue Publisher Manual Mode

Candidate: Church Care Follow-Up
Mode: noop
Owner approved: no
Issues requested: 6
Issues created: 0
Next safe action: request_owner_manual_publish_approval
GitHub issues created: no
Codex build triggered: no
```

When mock mode is used, output must clearly say the result was mocked.

## Machine-Readable Output Contract

Agents should produce a `phase_issue_publisher_manual` artifact:

```json
{
  "kind": "phase_issue_publisher_manual",
  "schemaVersion": 1,
  "sourceArtifact": {
    "kind": "phase_issue_publisher_dry_run",
    "candidateSlug": "church-care-follow-up",
    "candidateType": "workflow_process_candidate",
    "finalPacketType": "non_app_solution_plan"
  },
  "candidate": {
    "name": "Church Care Follow-Up",
    "slug": "church-care-follow-up",
    "type": "workflow_process_candidate",
    "summary": "Clarify and track a care follow-up solution candidate.",
    "needAddressed": "timely care coordination",
    "desiredTransformation": "people receive timely care and stay connected"
  },
  "publishMode": {
    "requestedMode": "manual",
    "manualModeEnabled": true,
    "ownerApproved": true,
    "mockMode": true
  },
  "publishResults": [
    {
      "title": "[church-care-follow-up] Discovery",
      "phase": "discovery",
      "requestedLabels": ["ai:build"],
      "appliedLabels": ["ai:plan"],
      "blockedLabels": ["ai:build"],
      "mocked": true,
      "created": false,
      "url": "mock://issues/1"
    }
  ],
  "decision": {
    "publishStatus": "mock_publish_validated",
    "nextSafeAction": "review_mock_publish_results",
    "githubIssuesCreated": false,
    "mockIssuesCreated": true,
    "codexBuildTriggered": false,
    "ownerApprovalRequired": true
  },
  "ownerReadableReport": "Phase Issue Publisher Manual Mode...",
  "guardrails": {
    "manualPublishingOnly": true,
    "defaultDryRunNoop": true,
    "noUi": true,
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

## Required Issue Body Content

Every issue body created by manual mode must include:

- source packet traceability
- phase
- phase order
- guardrails
- acceptance criteria
- required source-of-truth files
- manual publisher traceability

## Next Tracking Step

After real GitHub issues are created, use `source-of-truth/published-phase-issue-registry.md` to record issue numbers, URLs, source packet traceability, phase order, labels, guardrails, current status, and next safe action. The registry step must not create additional issues, add labels, or trigger Codex build work.

## Failure Rules

The manual publisher must fail honestly when:

- input artifact is not `phase_issue_publisher_dry_run`
- dry-run payloads are invalid
- manual mode is enabled without owner approval
- manual mode is enabled without GitHub repository information
- real publish mode is enabled without a GitHub token
- payloads contain secrets, env var values, protected preview bypass links, paid resource instructions, migration instructions, production deploy instructions, or automatic Codex build instructions

## Guardrails

Phase Issue Publisher Manual Mode must not:

- run automatically
- publish issues unless manual mode and owner approval are explicit
- apply `ai:build` or other build-triggering labels
- trigger Codex build work
- build UI
- deploy production
- create paid resources
- apply migrations
- add secrets or env vars
- change repository visibility
- auto-merge generated app code

## Success Criteria

The manual publisher is working when:

1. Default mode validates payloads but creates no GitHub issues.
2. Manual mock mode validates publish payloads without calling live GitHub.
3. Manual real mode is possible only with explicit owner approval and GitHub credentials.
4. Build-triggering labels are stripped or replaced with safe labels.
5. Published or mocked issue bodies include traceability, guardrails, acceptance criteria, and required source files.
6. No Codex build work, deployments, migrations, paid resources, secrets, env changes, repository visibility changes, or auto-merges occur.
