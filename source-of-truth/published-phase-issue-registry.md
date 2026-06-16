# Published Phase Issue Registry

AppEngine must track manually published phase issues after they are created, without triggering Codex build work.

This step produces a `published_phase_issue_registry` artifact. It is registry and tracking only. It does not create GitHub issues, add labels, trigger Codex build work, build UI, deploy production, create paid resources, apply migrations, add secrets, change env vars, change repository visibility, or auto-merge generated app code.

## Purpose

Published Phase Issue Registry answers:

- Which manual publish artifact created the issues?
- Which source packet and dry-run payload chain produced each issue?
- Which issue numbers and URLs were published?
- What phase order should AppEngine follow?
- Which safe labels were applied?
- What guardrails still apply?
- What is the current status of the phase issue chain?
- What is the next safe action?

This is the tracking layer after manual issue publication and before any execution automation is added.

## Input Artifact

The input artifact is `phase_issue_publisher_manual`.

Required input fields:

- `kind: "phase_issue_publisher_manual"`
- `schemaVersion`
- `sourceArtifact.kind: "phase_issue_publisher_dry_run"`
- `sourceArtifact.candidateSlug`
- `sourceArtifact.candidateType`
- `sourceArtifact.finalPacketType`
- `candidate.name`
- `candidate.slug`
- `candidate.type`
- `candidate.summary`
- `candidate.needAddressed`
- `candidate.desiredTransformation`
- `sourceFinalPacket.kind`
- `sourceFinalPacket.status`
- `publishResults`
- `phaseOrder`
- `labelsToApply`
- `decision.publishStatus`
- `decision.githubIssuesCreated`
- `decision.codexBuildTriggered`
- `ownerReadableReport`
- `guardrails.manualPublishingOnly`

The registry must fail honestly when required manual publish fields are missing.

## Proceed Rule

The registry may proceed only when:

- `decision.publishStatus: "manual_publish_completed"`
- `decision.githubIssuesCreated: true`
- `decision.codexBuildTriggered: false`
- every `publishResults[]` entry has `created: true`
- every `publishResults[]` entry has a real `issueNumber`
- every `publishResults[]` entry has a real `url`
- every `publishResults[]` entry has `phase`
- every `publishResults[]` entry has `phaseOrder`
- labels contain no build-triggering labels

It must fail honestly for no-op manual publish output, mock publish output, missing issue numbers, missing URLs, missing source traceability, missing phase order, unsafe labels, or any indication Codex build work was triggered.

## Safe Labels

Published issue labels must remain safe for tracking/planning.

Blocked labels include:

- `ai:build`
- `ai:fix`

This registry does not add labels. It only records labels that were already applied by the manual publisher.

## Owner-Readable Output

The owner-readable output should be concrete:

```text
Published Phase Issue Registry

Candidate: Church Care Follow-Up
Issues tracked: 3
Current status: published_tracking_only
Next safe action: review_published_phase_issues
Codex build triggered: no

Published issues:
1. Discovery
   Issue: #101
   URL: https://github.com/lincolnnunnally/AppEngine/issues/101
   Labels: ai:plan
```

## Machine-Readable Output Contract

Agents should produce a `published_phase_issue_registry` artifact:

```json
{
  "kind": "published_phase_issue_registry",
  "schemaVersion": 1,
  "sourceArtifact": {
    "kind": "phase_issue_publisher_manual",
    "candidateSlug": "church-care-follow-up",
    "candidateType": "workflow_process_candidate",
    "finalPacketType": "non_app_solution_plan"
  },
  "sourcePacket": {
    "kind": "non_app_solution_plan",
    "status": "final_review_ready"
  },
  "candidate": {
    "name": "Church Care Follow-Up",
    "slug": "church-care-follow-up",
    "type": "workflow_process_candidate"
  },
  "publishedIssues": [
    {
      "issueNumber": 101,
      "url": "https://github.com/lincolnnunnally/AppEngine/issues/101",
      "title": "[church-care-follow-up] Discovery",
      "phase": "discovery",
      "phaseOrder": 1,
      "labels": ["ai:plan"],
      "sourceDryRunPayload": {
        "sourceArtifact": "phase_issue_publisher_dry_run",
        "requestedLabels": ["ai:plan"],
        "blockedLabels": []
      },
      "currentStatus": "published_tracking_only",
      "nextSafeAction": "review_published_phase_issue"
    }
  ],
  "phaseOrder": ["discovery"],
  "issueLabels": ["ai:plan"],
  "currentStatus": "published_tracking_only",
  "nextSafeAction": "review_published_phase_issues",
  "ownerReadableReport": "Published Phase Issue Registry...",
  "guardrails": {
    "registryOnly": true,
    "noUi": true,
    "noGithubIssuesCreated": true,
    "noLabelsAdded": true,
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

The registry must fail honestly when:

- input artifact is not `phase_issue_publisher_manual`
- manual publish output was not completed
- manual publish output was mocked
- manual publish output did not create GitHub issues
- any published issue is missing an issue number
- any published issue is missing a URL
- any published issue is missing phase order
- source artifact, source packet, candidate, or traceability fields are missing
- labels include `ai:build`, `ai:fix`, or other build-triggering labels
- `decision.codexBuildTriggered` is not false

## Guardrails

Published Phase Issue Registry must not:

- create GitHub issues
- add labels
- trigger Codex build work
- build UI
- deploy production
- create paid resources
- apply migrations
- add secrets or env vars
- change repository visibility
- auto-merge generated app code

## Success Criteria

The registry is working when:

1. Completed manual publish artifacts create a `published_phase_issue_registry`.
2. Registry output records issue numbers, URLs, phase order, labels, guardrails, status, and next safe action.
3. Mock/no-op manual publish output fails honestly.
4. Missing issue numbers, URLs, source traceability, or phase order fail honestly.
5. Build-triggering labels fail honestly.
6. `codexBuildTriggered` remains false.
7. No Codex build work, production deploy, paid resources, migrations, secrets/env changes, repository visibility changes, or generated app auto-merge happen.
