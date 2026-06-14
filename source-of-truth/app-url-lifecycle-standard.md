# App URL Lifecycle Standard

AppEngine must make app URLs understandable and reviewable by the owner.

If AppEngine says a preview is verified, it must also know where Lincoln goes to review it, what version it is, whether production is blocked or live, and what the next safe action is.

## URL States

Every generated app must distinguish these URL roles.

### Build Preview

Internal build, testing, and route-verification URL.

Examples:

- Vercel branch preview URL
- temporary deployment URL

Agents may use this for automated checks, but the owner should rarely need to hunt for it.

### Owner Review URL

The current review version awaiting owner judgment.

Examples:

- `review.spark-of-hope.com`
- `review.spark-of-hope.unitedundergod.org`
- `review.childfirstsolutions.com`
- `review.app-name.unitedundergod.org`

This URL should always point to the latest reviewable build for the app.

### Production URL

The current approved public version.

Examples:

- `spark-of-hope.com`
- `childfirstsolutions.com`
- `churchconnect.cloud`

Production only changes after owner approval and release-gate evidence.

## deployment_lifecycle Artifact

Agents should produce or update a `deployment_lifecycle` artifact whenever work touches preview, review, production, release, monitoring, or vNext state.

Required fields:

```json
{
  "kind": "deployment_lifecycle",
  "schemaVersion": 1,
  "app": {
    "name": "Spark of Hope Intake Lite",
    "slug": "spark-of-hope-intake-lite"
  },
  "reviewUrl": "https://review.spark-of-hope.unitedundergod.org",
  "productionUrl": "https://spark-of-hope.com",
  "deploymentUrl": "https://app-engine-preview.vercel.app",
  "deploymentState": "review_ready",
  "currentVersion": "v1",
  "reviewVersion": "v1",
  "productionVersion": "not_released",
  "approvalRequired": true,
  "lastDeploymentTimestamp": "2026-06-14T00:00:00.000Z"
}
```

## Deployment States

Use these lifecycle states:

- `build_preview`: internal preview exists, but owner review is not complete.
- `review_ready`: owner review URL exists and points to the current reviewable build.
- `review_blocked`: owner review URL is missing, unknown, inaccessible, or points to the wrong app/version.
- `approved_for_release`: owner approval has been recorded and release-gate preparation may continue.
- `production_live`: production URL is the approved live version.
- `production_blocked`: production exists only as an approval-gated target or must not change yet.
- `failed_needs_fix`: preview, review URL, deployment evidence, or lifecycle state failed and needs a focused fix.

## Build Completion Contract

`build_completion_plan` must use `deployment_lifecycle` as the URL and lifecycle authority.

The plan must expose:

- `reviewUrl`
- `productionUrl`
- `deploymentState`
- `currentVersion`
- `nextSafeAction`

When the deployment state is `review_ready`, the next safe action should move toward review gates or owner review.

When the deployment state is `review_blocked` or `failed_needs_fix`, the next safe action should create a focused fix issue.

When production is requested without approval, the next safe action must be `stop_for_owner_approval`.

## Preview Verification Contract

Preview verification must fail when:

- no owner review URL exists
- the owner review URL is unknown
- the owner review URL is inaccessible
- the expected route returns 404
- the expected route is only the wrong root page
- marker text or test id is missing
- Vercel deployment state is not `READY`
- commit SHA is missing
- the check relies on a protected Vercel bypass/share link

Preview verification is not complete until AppEngine can tell Lincoln exactly where to review the build.

## Safety Boundaries

This standard does not authorize production deployment.

These remain blocked without explicit owner approval:

- production deployment
- paid resource creation
- provider provisioning
- real database migrations
- secrets or environment variable changes
- custom domain activation
- generated app code auto-merge
- public launch status

## Success Criteria

AppEngine must always be able to answer:

- Where is the current review build?
- Where is production?
- What version is being reviewed?
- What version is live?
- Is this build for internal preview, owner review, or production?
- What happens if the owner approves it?

The owner should never need to search GitHub, Vercel, workflow logs, PR comments, or deployment IDs to find an app.
