# Handoff Relay Reducer

AppEngine should reduce Lincoln's copy/paste relay work between Codex, ChatGPT, GitHub, and the app-building process.

This is a practical owner-control feature. It captures a pasted Codex handoff, summarizes what changed, identifies current project state, and drafts the next recommended Codex prompt for owner review.

It must not act automatically.

## Purpose

The Handoff Relay Reducer answers:

- What did Codex just say?
- Which PR, branch, or milestone does the handoff refer to?
- What changed?
- What was verified?
- Which guardrails were preserved?
- What remains blocked or risky?
- What human approval is still needed?
- What should Lincoln send next, if anything?

## Machine-Readable Artifact Contract

Agents and tools may produce a `handoff_relay_summary` artifact:

```json
{
  "kind": "handoff_relay_summary",
  "schemaVersion": 1,
  "source": "codex_handoff_paste",
  "extracted": {
    "prNumber": 93,
    "prTitle": "Add Design Intent Engine foundation",
    "branch": "codex/design-intent-engine",
    "mergeStatus": "merged",
    "verificationResults": ["source:check passed", "typecheck passed", "build passed"],
    "completedWork": ["Added Design Intent Engine"],
    "guardrailsPreserved": ["No production deploy", "No paid resources"],
    "risks": [],
    "blockers": [],
    "dependencies": []
  },
  "projectState": {
    "currentStatus": "Latest handoff appears merged",
    "latestCompletedMilestone": "PR #93 merged",
    "openPrs": [],
    "recommendedNextAction": "Proceed to the next approved feature from updated main",
    "remainingMajorMilestones": []
  },
  "nextPrompt": {
    "prompt": "Review before sending.",
    "reason": "Keeps Lincoln in approval control.",
    "dependencies": ["Owner reviews and manually sends this prompt."],
    "expectedOutcome": "A clear next Codex action with guardrails preserved."
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

## UI Requirements

Owner Control Center should include:

- Handoff Inbox for pasted Codex handoffs.
- Handoff Analysis with PR number, title, branch, merge status, verification, completed work, guardrails, risks, blockers, and dependencies.
- Project State Summary with current status, latest milestone, open PRs, recommended next action, and remaining major milestones.
- Next Prompt Generator with a copyable review box.
- Feedback Loop for good direction, wrong direction, incomplete, needs redesign, duplicate work, and unnecessary complexity.

Feedback becomes a draft improvement candidate only.

## Design Intent

Use the AppEngine default `design_intent_profile`:

- warm
- approachable
- clean
- hopeful
- practical
- trustworthy
- not cold
- not generic
- not over-complicated

The interface should feel like a mission control center for owner review, not a generic admin form.

## Guardrails

The Handoff Relay Reducer must not:

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

The feature is working when Lincoln can paste a handoff, see a useful project-state summary, review a drafted next prompt, and save feedback without AppEngine taking any external action automatically.
