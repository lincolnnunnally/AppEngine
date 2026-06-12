# Release Gate Standard

Every generated app must have a route from idea to preview to production to monitoring. The Release Gate prevents endless build mode by making launch readiness a required artifact, not an afterthought.

## Release Path

Use this path for generated apps:

```text
idea
-> App Build Packet
-> Identity/Auth plan
-> Super Admin registry entry
-> Deployment environment plan
-> preview deploy
-> production approval
-> v1 launch
-> post-launch monitoring
-> vNext follow-up issues
```

Agents may pause or block at any step, but they must name the blocker and create issue-ready follow-up work.

## Versioning Rules

- The first useful public launch is `v1`.
- MVP means `v1`, not "forever unfinished."
- Improvements after `v1` become `v2`, `vNext`, or scoped follow-up issues.
- A release cannot expand into unrelated features just because the model can keep building.
- If an app needs a major rethink after launch, create a new App Build Packet or vNext packet.

## Required Gates

Each generated app must pass or explicitly block these gates:

- App Build Packet exists
- Identity/Auth plan exists
- Super Admin registry entry exists
- Deployment environment plan exists
- Preview deploy contract exists
- Preview health check is defined
- Preview logs are defined
- User/admin paths are testable
- Production approval is required
- Production URL or domain plan exists
- Rollback notes exist
- Post-launch monitoring task exists
- Super Admin status update contract exists

## Automation Contracts

Release gates should create issue-ready tasks for:

- Preview deploy: create or update preview deployment, run smoke checks, and update Super Admin status to `preview`.
- Production approval: require owner approval before production deploy, custom domain activation, and production status.
- Post-launch monitoring: schedule or trigger monitor checks for health, logs, incidents, and user/admin workflows.
- Super Admin status update: update registry status as `planned`, `building`, `preview`, `production`, `paused`, or `retired`.

No automation contract should deploy directly to production without explicit approval.

## Guardrails

Agents must stop or create follow-up work when:

- A generated app has no release gate.
- A generated app keeps receiving build tasks but has no preview path.
- Preview is marked ready without health checks and logs.
- Production is marked ready without owner approval, rollback notes, and Super Admin status update.
- Versioning is missing or post-v1 improvements are being folded into the MVP.
- Monitoring is missing after launch.
- Any release artifact contains secrets.

## Machine Shape

Agents should produce release gate artifacts with this shape:

```json
{
  "kind": "release_gate_plan",
  "schemaVersion": 1,
  "app": {
    "name": "App name",
    "slug": "app-slug",
    "version": "v1",
    "targetStatus": "preview"
  },
  "versioning": {
    "launchVersion": "v1",
    "futureWork": "vNext packets or follow-up issues after v1 launch"
  },
  "gates": [
    {
      "id": "deployment_environment",
      "status": "required",
      "evidence": "deployment_environment_plan"
    },
    {
      "id": "production_approval",
      "status": "blocked_until_owner_approval",
      "evidence": "owner approval comment or release issue"
    }
  ],
  "automationContracts": {
    "previewDeploy": {
      "recommendedLabel": "ai:review",
      "deploysProduction": false,
      "updatesSuperAdminStatus": "preview"
    },
    "productionApproval": {
      "recommendedLabel": "ai:review",
      "requiresHumanApproval": true,
      "deploysProduction": false
    },
    "postLaunchMonitoring": {
      "recommendedLabel": "ai:monitor",
      "checks": ["health", "logs", "user workflow", "admin workflow"]
    },
    "superAdminStatusUpdate": {
      "statuses": ["planned", "building", "preview", "production", "paused", "retired"]
    }
  },
  "guardrails": {
    "previewBeforeProduction": true,
    "ownerApprovalBeforeProduction": true,
    "postLaunchMonitoringRequired": true,
    "vNextAfterV1": true,
    "noSecretsInOutput": true
  }
}
```
