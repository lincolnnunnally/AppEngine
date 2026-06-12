# Release Gate Standard

Every generated app must have a route from idea to preview to production to monitoring. The Release Gate prevents endless build mode by making launch readiness a required artifact, not an afterthought.

## Release Path

Use this path for generated apps:

```text
idea
-> App Build Packet
-> Identity/Auth plan
-> Super Admin registry entry
-> Provider/cost review
-> Deployment environment plan
-> Design Quality Gate
-> UX review
-> Compatibility Test Plan
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
- Provider/cost review exists
- New paid provider resources are blocked until owner approval
- Deployment environment plan exists
- Design Quality Gate exists
- Designer review is complete or explicitly blocked
- Customer Perspective review is complete or explicitly blocked
- UX review covers mobile, empty states, error states, onboarding, and admin screens
- Compatibility Test Plan exists
- iPhone/iPad Safari and desktop Safari have no unresolved release blockers
- Chrome mobile/desktop and common desktop browser issues are recorded or resolved
- Touch targets, forms, auth flows, uploads/payments if used, and admin screens are checked
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
- Provider/cost review: confirm provider reuse, cost posture, paid-resource approval, and upgrade triggers before provisioning or production release.
- Design review: require Designer and Customer Perspective review before release approval.
- Compatibility testing: require mobile-first, Safari, Chrome, Edge, Firefox, viewport, touch-target, form, auth, upload/payment if used, and admin checks before release approval.
- Production approval: require owner approval before production deploy, custom domain activation, and production status.
- Post-launch monitoring: schedule or trigger monitor checks for health, logs, incidents, and user/admin workflows.
- Super Admin status update: update registry status as `planned`, `building`, `preview`, `production`, `paused`, or `retired`.

No automation contract should deploy directly to production without explicit approval.

## Guardrails

Agents must stop or create follow-up work when:

- A generated app has no release gate.
- A generated app keeps receiving build tasks but has no preview path.
- Provider/cost review is missing before provider provisioning or release approval.
- New paid provider resources are being created without owner approval.
- Designer review or Customer Perspective review is missing before release approval.
- Mobile, empty states, error states, onboarding, or admin screens have not been reviewed.
- The app is technically working but ugly, confusing, unreadable, inaccessible, or emotionally mismatched to the audience.
- Safari, mobile, touch-target, form, auth, upload, payment, admin, or common browser issues remain unresolved.
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
      "id": "provider_cost_review",
      "status": "required",
      "evidence": "provider_cost_review"
    },
    {
      "id": "deployment_environment",
      "status": "required",
      "evidence": "deployment_environment_plan"
    },
    {
      "id": "design_quality",
      "status": "required",
      "evidence": "design_review"
    },
    {
      "id": "customer_perspective_review",
      "status": "required",
      "evidence": "design_review"
    },
    {
      "id": "compatibility",
      "status": "required",
      "evidence": "compatibility_test_plan"
    },
    {
      "id": "safari_mobile",
      "status": "required",
      "evidence": "iPhone Safari, iPad Safari, desktop Safari"
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
    "providerCostReview": {
      "recommendedLabel": "ai:plan",
      "blocksProvisioning": true,
      "noPaidResourcesWithoutApproval": true
    },
    "designReview": {
      "recommendedLabel": "ai:review",
      "requiresDesignerReview": true,
      "requiresCustomerPerspectiveReview": true,
      "blocksReleaseApproval": true
    },
    "compatibilityTesting": {
      "recommendedLabel": "ai:review",
      "requiresSafariMobile": true,
      "requiresCommonBrowsers": true,
      "blocksReleaseApproval": true
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
    "costReviewBeforeProvisioning": true,
    "designReviewBeforeRelease": true,
    "compatibilityBeforeRelease": true,
    "postLaunchMonitoringRequired": true,
    "vNextAfterV1": true,
    "noSecretsInOutput": true
  }
}
```
