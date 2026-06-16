# Phase Issue Publish Approval Gate

AppEngine must review `phase_issue_generation` before phase issue drafts may be published as real GitHub issues.

This gate produces a `phase_issue_publish_approval` artifact. It is approval-gate only. It does not create GitHub issues, trigger Codex build work, build UI, deploy production, create paid resources, apply migrations, add secrets, change env vars, change repository visibility, or auto-merge generated app code.

## Purpose

Phase Issue Publish Approval answers:

- Are the generated phase issue drafts complete enough to publish?
- Does each draft have a clear title, body, source packet, phase order, labels, guardrails, and acceptance criteria?
- Is the phase list bounded and reviewable?
- Are labels safe for publication?
- Do any drafts include secrets, env vars, protected URLs, paid-resource instructions, migrations, or production deploy instructions?
- Is Codex build execution still blocked unless explicitly approved later?

This is the last review checkpoint before AppEngine may preview publish-ready GitHub issue payloads. After approval, use `source-of-truth/phase-issue-publisher-dry-run.md` before any real GitHub issue creation.

## Input Artifact

The input artifact is `phase_issue_generation`.

Required input fields:

- `kind: "phase_issue_generation"`
- `schemaVersion`
- `sourceArtifact.kind: "phase_creation_approval"`
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
- `phaseOrder`
- `labelsToApply`
- `phaseIssueDrafts`
- `decision.phaseIssueDraftsGenerated`
- `decision.githubIssuesCreated`
- `decision.codexBuildTriggered`
- `decision.ownerApprovalRequired`
- `guardrails.phaseIssueDraftGenerationOnly`

The gate must fail honestly when required generation fields are missing.

## Approval Statuses

Every `phase_issue_publish_approval` must use one of these statuses:

- `approved_for_issue_publish`
- `needs_revision`
- `rejected`
- `blocked_by_security`
- `blocked_by_cost`
- `blocked_by_scope`

Only `approved_for_issue_publish` may recommend later issue publication. Even then, this gate does not publish GitHub issues.

After this gate approves issue publication, use `source-of-truth/phase-issue-publisher-dry-run.md` to preview the exact GitHub issue payloads for owner review before any live issue is created.

## Required Approval Checks

Every approval must check:

- `phaseIssueCompleteness`
- `sourcePacketTraceability`
- `phaseOrderClarity`
- `labelSafety`
- `guardrailCompleteness`
- `acceptanceCriteriaCompleteness`
- `automaticCodexBuildSafety`
- `secretAndEnvSafety`
- `resourceAndReleaseSafety`
- `boundedReviewability`

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

## Label Safety

Phase issue drafts may record recommended labels, including labels that a later workflow could apply.

This approval gate must not treat recommended labels as permission to activate workflow-triggering labels automatically.

In particular:

- `ai:build` must not be applied to a real GitHub issue unless a later owner-approved publish step explicitly allows build execution.
- `ai:fix` must not be applied unless a later owner-approved fix step explicitly allows it.
- `ai:plan` can be recommended for planning issues, but publication still requires this gate to pass.

The publish approval artifact should keep `codexTriggerLabelsApproved: false` by default.

## Owner-Readable Approval Output

The owner-readable output should be concise:

```text
Phase Issue Publish Approval

Candidate: Church Care Follow-Up
Source final packet: non_app_solution_plan
Status: approved_for_issue_publish
Phase drafts reviewed: discovery, solution_design, workflow_process_design
Next safe action: prepare_phase_issue_publish
Owner approval required: yes
Guardrails: approval gate only, no GitHub issues created, no Codex build, no deploy
```

When the gate does not approve publication, the output must clearly say why and what the next safe action is.

## Machine-Readable Output Contract

Agents should produce a `phase_issue_publish_approval` artifact:

```json
{
  "kind": "phase_issue_publish_approval",
  "schemaVersion": 1,
  "sourceArtifact": {
    "kind": "phase_issue_generation",
    "candidateSlug": "church-care-follow-up",
    "candidateType": "workflow_process_candidate",
    "finalPacketType": "non_app_solution_plan",
    "generationStatus": "phase_issue_drafts_ready"
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
  "approvalStatus": "approved_for_issue_publish",
  "approvalChecks": {
    "phaseIssueCompleteness": {
      "status": "pass",
      "notes": "Every phase issue draft has title, body, source packet, order, labels, guardrails, and acceptance criteria."
    }
  },
  "phaseIssueSummary": {
    "phaseCount": 6,
    "phaseOrder": ["discovery", "solution_design"],
    "labelsToApply": ["ai:plan"],
    "draftTitles": ["[church-care-follow-up] Discovery"]
  },
  "decision": {
    "approvedForIssuePublish": true,
    "nextSafeAction": "prepare_phase_issue_publish",
    "githubIssuesPublished": false,
    "codexBuildTriggered": false,
    "codexTriggerLabelsApproved": false,
    "ownerApprovalRequired": true
  },
  "ownerReadableReport": "Phase Issue Publish Approval...",
  "followUpTasks": [],
  "guardrails": {
    "approvalGateOnly": true,
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

## Draft Completeness Rules

Every phase issue draft must include:

- clear `title`
- issue-ready `body`
- source final packet reference
- phase id
- phase order
- recommended label
- recommended labels
- guardrails
- acceptance criteria
- required source-of-truth files

Every draft body must include:

- `## Goal`
- `## Acceptance Criteria`
- `## Labels To Apply`
- `## Required Source Of Truth To Load`
- `## Guardrails`
- `## Non-Goals`

## Failure Rules

The gate must fail honestly when:

- input artifact is not `phase_issue_generation`
- phase issue drafts are missing
- any draft is missing title, body, source packet, phase order, labels, guardrails, or acceptance criteria
- phase order and draft order disagree
- labels are missing, unsupported, or unsafe for the next step
- draft body includes secrets, env var values, protected preview bypass links, paid resource instructions, migration instructions, or production deploy instructions
- draft body implies Codex build work should start automatically
- source-of-truth files are not visible in the draft body

## Next Safe Actions

| Approval status | Next safe action |
| --- | --- |
| `approved_for_issue_publish` | `prepare_phase_issue_publish` |
| `needs_revision` | `revise_phase_issue_drafts` |
| `rejected` | `record_phase_issue_publish_rejection` |
| `blocked_by_security` | `create_security_review_issue` |
| `blocked_by_cost` | `create_cost_review_issue` |
| `blocked_by_scope` | `create_scope_review_issue` |

## Guardrails

Phase issue publish approval must not:

- create GitHub issues
- trigger Codex build work
- build UI
- deploy production
- create paid resources
- apply migrations
- add secrets or env vars
- change repository visibility
- auto-merge generated app code
- treat issue publication approval as implementation approval

## Success Criteria

The gate is working when:

1. Approved phase issue generations can be approved for later issue publication without creating GitHub issues.
2. Missing draft fields fail honestly.
3. Unsafe labels or unsafe instructions fail honestly.
4. `needs_revision`, `rejected`, `blocked_by_security`, `blocked_by_cost`, and `blocked_by_scope` are represented honestly.
5. Owner-readable output shows source final packet, phase list, labels, blockers, guardrails, and next safe action.
6. No GitHub issues, build work, deployments, migrations, paid resources, secrets, env changes, repository visibility changes, or auto-merges occur.
