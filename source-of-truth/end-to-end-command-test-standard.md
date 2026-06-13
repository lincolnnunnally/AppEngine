# End-to-End AppEngine Command Test Standard

The command test proves AppEngine can move from a ChatGPT conversation to structured GitHub work without manual copy and paste.

## Required Path

```text
ChatGPT conversation
-> ChatGPT handoff issue
-> intake packet
-> selected workflow
-> App Build Packet or vNext Packet
-> dry-run follow-up issues
-> agent loop evidence
```

This test should use the real AppEngine scripts and artifact shapes wherever possible. It should not create production deployments, paid provider resources, or merge generated app code.

## Required Command Flow

Use this local dry-run flow:

```bash
npm run pilot:e2e
```

The command must:

1. Create a `chatgpt_handoff_packet`.
2. Produce an issue-ready GitHub issue title and body.
3. Feed the issue body into intake.
4. Create an `intake_packet`.
5. Route the selected workflow.
6. Create an App Build Packet for a new app or a vNext Packet for an existing app.
7. Produce dry-run follow-up issues through the follow-up parser.
8. Produce a `pilot_app_build` artifact recording the run.
9. Persist pilot JSON artifacts into the durable `agent-run` artifact when running in GitHub Actions.
10. Emit structured `followUpTasks` JSON so the workflow can preview or create follow-up issues without relying on prose.

## Required Pilot Artifact

The command must produce a `pilot_app_build` artifact with:

- Pilot app name and slug
- Source issue title/body or issue number when available
- ChatGPT handoff packet path or summary
- Intake packet path or summary
- App Build Packet or vNext Packet path
- Follow-up issues created or dry-run planned
- Structured follow-up task JSON path
- PRs created or linked
- Release status
- Blockers
- Next action
- Guardrails

## Guardrails

The command test must enforce:

- Dry-run by default.
- No production deploy.
- No paid provider resource creation.
- No generated app code merge without review.
- No secret values in artifacts, issue bodies, or logs.
- No direct build from raw conversation text.
- No bypass around Context Gate, intake, app selection, packet creation, or release gate.

## Durable Artifact Rules

Live GitHub-triggered pilots must not point issue comments at runner-local `/tmp` paths. When running in GitHub Actions, the pilot command must write durable files under:

```text
agent-run/pilot/
```

The workflow must upload the `agent-run` artifact and comment with a durable artifact summary. Issue comments should tell agents to download the GitHub Actions artifact named `agent-run`, not inspect temporary runner paths.

The workflow follow-up mode is safe by default:

- `dry-run`: prepare follow-up issue previews only.
- `create`: create real GitHub follow-up issues and dispatch bounded next workflows.

Real follow-up issue creation requires the explicit repository variable:

```text
APPENGINE_FOLLOW_UP_MODE=create
```

Controlled create-mode tests should also set:

```text
APPENGINE_MAX_FOLLOW_UP_ISSUES=1 or 2
APPENGINE_MAX_FOLLOW_UP_WORKFLOW_DISPATCHES=0 or 1
```

## First Pilot Criteria

The first real app pilot should be:

- Small enough to build in phases.
- Mission-aligned.
- Useful as a real AppEngine proof.
- Easy to verify without production deployment.
- Safe to keep on preview and dry-run follow-up issues.

## Machine Shape

```json
{
  "kind": "pilot_app_build",
  "schemaVersion": 1,
  "pilot": {
    "name": "Spark of Hope Intake Lite",
    "slug": "spark-of-hope-intake-lite",
    "mode": "dry_run",
    "scope": "Small bounded first app build pilot"
  },
  "issue": {
    "title": "[AppEngine Intake] New app: Spark of Hope Intake Lite",
    "number": "",
    "url": "",
    "bodyPath": "agent-run/pilot/issue.md",
    "label": "ai:plan"
  },
  "artifacts": {
    "chatgptHandoffPacket": "agent-run/pilot/chatgpt-handoff-packet.json",
    "intakePacket": "agent-run/pilot/intake-packet.json",
    "buildPacket": "agent-run/pilot/app-build-packet.json",
    "followUpDryRun": "agent-run/pilot/follow-up-issues.json",
    "structuredFollowUpTasks": "agent-run/pilot/follow-up-tasks.json"
  },
  "workflow": {
    "selectedPacket": "app_build_packet",
    "selectedAgent": "planner",
    "followUpIssues": []
  },
  "prs": [],
  "release": {
    "status": "not_deployed",
    "productionDeployAllowed": false,
    "previewDeployPlanned": true
  },
  "blockers": [],
  "nextAction": "Review dry-run follow-up issues, then create the real GitHub issue.",
  "guardrails": {
    "dryRunOnly": true,
    "noProductionDeploy": true,
    "noPaidResources": true,
    "noGeneratedCodeMergeWithoutReview": true,
    "noSecrets": true
  }
}
```
