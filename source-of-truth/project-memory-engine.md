# Project Memory Engine

AppEngine should remember project history, decisions, progress, blockers, lessons learned, design preferences, architecture choices, and current state so Lincoln does not have to carry memory between ChatGPT, Codex, GitHub, and AppEngine.

This is owner-facing memory, not autonomous execution.

This first slice may use local/mock persistence to avoid migrations, paid resources, or secrets. Future durable GitHub/database-backed memory requires a separate approved change.

## Purpose

The Project Memory Engine answers:

- Where is the project right now?
- What changed recently?
- Which decisions have already been made?
- Which approaches should be preserved?
- Which approaches were rejected?
- What is blocked?
- What questions remain open?
- What should happen next?

## Machine-Readable Artifact Contract

Agents and tools may produce a `project_memory` artifact:

```json
{
  "kind": "project_memory",
  "schemaVersion": 1,
  "projectName": "AppEngine",
  "latestProjectState": {
    "currentState": "Ready for owner review",
    "latestProgress": "PR #94 merged: Handoff Relay Reducer",
    "recommendedNextAction": "Create Project Memory Engine PR",
    "lastHandoffId": "handoff_..."
  },
  "majorDecisions": [],
  "acceptedApproaches": [],
  "rejectedApproaches": [],
  "completedMilestones": [],
  "currentBlockers": [],
  "openQuestions": [],
  "architectureDecisions": [],
  "designPreferences": [],
  "lessonsLearned": [],
  "futureImprovements": [],
  "progressHistory": [],
  "ownerFeedback": [],
  "summaries": {
    "executive": "Owner-readable current state and next action.",
    "technical": "Architecture and implementation memory.",
    "projectStatus": "Progress, blockers, and open questions."
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

## Memory Inputs

Project memory may be updated from:

- pasted Codex handoffs
- `handoff_relay_summary`
- owner feedback
- future durable GitHub artifacts

When a handoff is added, AppEngine should update:

- latest project state
- recent progress
- completed milestones
- blockers
- open questions
- recommendations
- architecture and design memory when visible in the handoff

## Owner Control Center

Owner Control Center should show:

- Current State
- Recent Progress
- Current Blockers
- Open Questions
- Recommended Next Action
- executive summary
- technical summary
- project status summary

Owner feedback should support:

- important decision
- lesson learned
- bad direction
- keep doing this
- future improvement

Feedback becomes memory only. It must not trigger Codex or GitHub work.

## Guardrails

The Project Memory Engine must not:

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

The feature is working when AppEngine can explain current state, progress, blockers, open questions, decisions, lessons, and next safe action from one owner-readable memory report without Lincoln reading workflow logs, GitHub threads, or previous chats.
