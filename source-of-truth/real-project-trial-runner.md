# Real Project Trial Runner

AppEngine needs a first useful way to prove the pipeline on real project work without turning every test into automatic Codex execution.

The Real Project Trial Runner lets the owner select an existing portfolio candidate or enter a manual trial project, then produces an owner-readable and machine-readable trial summary. It is a usability feature and a safety boundary, not an execution trigger.

## Purpose

The runner answers:

- Which real project should AppEngine try next?
- What problem is being solved?
- Who is affected?
- What transformation is desired?
- What design intent should guide the work?
- What stage is the project currently in?
- What is the next safe action?
- Which packet type is recommended?

Spark of Hope Intake Lite is the default first real project trial unless the current source of truth identifies a safer candidate.

## Machine-Readable Artifact Contract

Agents and tools may produce a `real_project_trial` artifact:

```json
{
  "kind": "real_project_trial",
  "schemaVersion": 1,
  "project": {
    "name": "Spark of Hope Intake Lite",
    "slug": "spark-of-hope-intake-lite",
    "source": "portfolio"
  },
  "problemBeingSolved": "People need a simple, safe way to share a story and receive encouragement.",
  "targetAudience": "People looking for hope and encouragement plus ministry reviewers.",
  "desiredTransformation": "Move from isolation or uncertainty toward hope, support, and a clear next step.",
  "designIntent": "ministry_community, warm_approachable, hopeful, calm, trustworthy, mobile-first.",
  "currentStage": "Verified preview MVP slice with controlled preview persistence planning available.",
  "nextSafeAction": "Create a vNext packet for the next owner-reviewed Spark of Hope slice.",
  "risksBlockers": [],
  "recommendedPacketType": "vnext_packet",
  "artifactInputs": {
    "problemSolutionIntake": {
      "kind": "problem_solution_intake",
      "status": "derived"
    },
    "problemPortfolioRouting": {
      "kind": "problem_portfolio_routing",
      "status": "available"
    },
    "solutionCandidateReview": {
      "kind": "solution_candidate_review",
      "status": "derived"
    },
    "designIntentProfile": {
      "kind": "design_intent_profile",
      "status": "derived"
    },
    "projectMemory": {
      "kind": "project_memory",
      "status": "available"
    }
  },
  "nextPrompt": {
    "prompt": "Copyable owner-reviewed Codex prompt.",
    "reason": "Why this trial is the next useful step.",
    "expectedOutcome": "A reviewable packet path with no automatic execution.",
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

## Inputs

Use existing artifacts where possible:

- `problem_solution_intake`
- `problem_portfolio_routing`
- `solution_candidate_review`
- `design_intent_profile`
- `project_memory`
- `app_portfolio_registry`

If an existing app is selected, load its charter, registry state, design intent, project memory, current version, and latest known build state before recommending the next packet type.

If a manual trial project is entered, the runner must capture:

- project name
- problem being solved
- target audience
- desired transformation
- design intent

Manual trial projects should route back through problem-to-solution intake and portfolio routing before any packet or phase work.

## Owner Control Center

Owner Control Center should include a Real Project Trial section that:

- allows selecting an existing project/app candidate
- allows entering a manual trial project
- shows problem, audience, transformation, design intent, current stage, next safe action, risks/blockers, and recommended packet type
- displays a copyable next prompt for owner review
- stores trial summaries with local/mock persistence for the first slice

## Guardrails

The Real Project Trial Runner must not:

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

The feature is working when Lincoln can select Spark of Hope or enter a manual project, generate a useful trial summary, see the next safe action, copy a reviewed next prompt, and confirm that AppEngine took no external action automatically.
