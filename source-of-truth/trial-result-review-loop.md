# Trial Result Review Loop

The Real Project Trial Runner proves AppEngine can prepare a real project trial. The Trial Result Review Loop lets Lincoln review that result, mark what was useful or wrong, and convert feedback into AppEngine improvement candidates without automatic execution.

This is an owner-control feature, not a build trigger.

## Purpose

The review loop answers:

- Did the trial result help?
- What was useful?
- What was wrong, unclear, missing, or mismatched?
- Is the trial ready for the next packet?
- What should AppEngine remember?
- What is the next owner-reviewed prompt?

## Review Statuses

Every trial review must use one of these statuses:

- `useful`
- `needs_clarification`
- `wrong_direction`
- `missing_requirement`
- `design_mismatch`
- `ready_for_next_packet`

## Machine-Readable Artifact Contract

Agents and tools may produce a `trial_result_review` artifact:

```json
{
  "kind": "trial_result_review",
  "schemaVersion": 1,
  "trialId": "trial_spark-of-hope-intake-lite_...",
  "project": {
    "name": "Spark of Hope Intake Lite",
    "slug": "spark-of-hope-intake-lite",
    "source": "portfolio"
  },
  "reviewStatus": "ready_for_next_packet",
  "ownerNote": "The direction is useful. Include pastoral review boundaries next.",
  "usefulSignals": [],
  "concerns": [],
  "improvementCandidate": {
    "title": "Spark of Hope Intake Lite: proceed to next packet",
    "summary": "Owner marked the trial ready for vNext packet progression.",
    "candidateType": "packet_progression"
  },
  "nextPrompt": {
    "prompt": "Copyable owner-reviewed Codex prompt.",
    "reason": "Why this prompt is recommended.",
    "expectedOutcome": "What should happen next.",
    "dependencies": []
  },
  "guardrails": {
    "ownerApprovalOnly": true,
    "noAutomaticCodexExecution": true,
    "noGitHubIssueCreation": true,
    "noLabelChanges": true,
    "noProductionDeploy": true,
    "noPaidResources": true,
    "noMigrations": true,
    "noSecretsOrEnvChanges": true,
    "repositoryVisibilityUnchanged": true,
    "noGeneratedAppAutoMerge": true
  }
}
```

## Project Memory

When a trial review is saved, AppEngine should update `project_memory` with:

- latest project state
- latest progress
- recommended next action
- accepted direction when useful
- blockers when clarification, wrong direction, missing requirement, or design mismatch is selected
- lessons learned
- future improvement candidate
- owner feedback

## Owner Control Center

Owner Control Center should include a Trial Result Review section that:

- shows the latest real project trial output
- lets Lincoln select a review status
- captures an owner note
- stores the review as `trial_result_review`
- updates Project Memory from the review
- displays a copyable next prompt
- shows review history newest first

## Guardrails

The Trial Result Review Loop must not:

- trigger Codex automatically
- create GitHub issues
- apply labels
- deploy production
- create paid resources
- apply migrations
- add secrets or env vars
- change repository visibility
- auto-merge generated app code

## Success Criteria

The feature is working when Lincoln can generate or select a trial, review it, save the result, see Project Memory update, and copy a next prompt without AppEngine taking any external action automatically.
