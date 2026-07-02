# Autonomous Build Activation

Spec for autonomous phase-to-phase execution of the factory's internal build pipeline
while preserving all existing safety gates. Origin: owner-approved improvement plan
(Lincoln, 2026-07-02). Implemented the same day; "As implemented" notes record where
reality required adapting the original spec.

App Engine previously required manual triggers between build phases. Three changes
enable autonomous execution while preserving every quality, cost, and release gate.

Implementation rule (per global principles): review existing code first. All three
changes extend existing workflows, config files, and API routes — nothing replaced.

## Current -> Target

| Step | Before | After |
| --- | --- | --- |
| Phase completion | dry-run preview of follow-up issues | auto-creates the next `ai:*` issue (caps enforced) |
| Stalled/failed builds | monitor reports only | monitor re-triggers per `monitor.config.yaml` dispatch rules |
| Deployment gate cleared | commands recorded for manual run | preview deploy executes automatically behind a flag |

Safety boundaries: cost governance can pause, release gate blocks, production always
requires owner approval.

## Change 1: Follow-Up Issue Automation

When a build phase completes, the workflow automatically creates the next GitHub issue
with the appropriate `ai:*` label, which triggers the next agent phase via the existing
`opened` event handling in `.github/workflows/ai-prompt-factory.yml`.

Config: repository variable `APPENGINE_FOLLOW_UP_MODE="create"` (the workflow already
reads it; dry-run remains the fallback for any other value).

Constraints preserved (verify, do not remove):

- `APPENGINE_MAX_FOLLOW_UP_ISSUES` — cap per run (set to 10)
- `APPENGINE_MAX_FOLLOW_UP_WORKFLOW_DISPATCHES` — prevents dispatch loops (set to 1)
- Cost governance `pause_for_budget` can halt the chain
- Release gate blocks production deployment without explicit approval
- The duplicate-echo skip (opened vs. labeled) must keep runs from doubling
- Dry-run artifacts still produced under the `agent-run` artifact for auditability

**As implemented:** no code change needed — `ai-prompt-factory.yml` already supported
this mode; the repository variables were set per the activation checklist.

## Change 2: Orchestration Monitor Dispatch

Extends the scheduled Orchestration Monitor (`scripts/monitor-ai-issues.js`, cron every
6 hours) from report-only to report-and-dispatch. Config lives in `monitor.config.yaml`
under `dispatch:`.

Rules:

- `stalled_build` — an open `ai:*` issue that is stale and never started a workflow is
  re-triggered by re-applying its `ai:*` label (fires the factory's `labeled` event).
  `max_retries: 3`.
- `failed_workflow` — a failed pipeline workflow run is re-run once (`gh run rerun`),
  only on its first attempt, ONLY for workflows on the rerun allowlist
  (`rerun_workflow_name_patterns`, default: AI Prompt Factory — a failed PR
  verification is a code failure, not a stall), and never for workflows matching the
  safety name patterns (release/production/deploy). `max_retries: 1`.
- `incomplete_phase` — a stale issue that started a workflow but produced no follow-up
  gets ONE recovery issue (labeled `ai:fix`). `max_retries: 1`.

Safety (all enforced in the script):

- `dispatch.enabled` in config AND `MONITOR_DISPATCH=true` env both required
- Dry-run mode logs would-be actions without executing
- Retry counters persist as dispatch marker comments on the issue
  (`<!-- appengine-monitor-dispatch rule:<rule> retry:<n> -->`), so `max_retries` holds
  across monitor runs
- `skip_workflow_name_patterns` blocks re-running release-gate/production workflows
- Every dispatch action is logged in the monitor report artifact (`actions[]`) with
  rule, target, reason, and retry count — the owner-visible audit trail

**As implemented:** re-trigger uses label re-application (the factory's
`workflow_dispatch` only accepts a `mode` input, so dispatching it directly cannot
target an issue). Failed-run rerun checks the run's `attempt` via `gh run view` so the
once-only rule is enforced by GitHub's own attempt counter.

Two hardenings from the pre-merge adversarial review:

- **Recovery chains capped at one generation** — a recovery issue is never itself
  given a recovery (title match), so a stalled recovery cannot spawn an unbounded
  chain. Dispatch also only acts on FRESH stalls (stale >= `stale_hours` but updated
  within 7 days); ancient backlog stays report-only.
- **Cost-governance kill switch is real, not decorative** — `respect_cost_governance`
  is parsed and enforced: when the repository variable
  `APPENGINE_COST_GOVERNANCE_PAUSED` is `true`, ALL dispatch actions are suppressed
  (recorded in the report as suppressed) until the owner clears it. Set it with
  `gh variable set APPENGINE_COST_GOVERNANCE_PAUSED --body true` to pause the
  autonomous chain instantly.

## Change 3: Deployment Gate Execution (Preview Only)

When `POST /api/engine/projects/:projectId/deployments` prepares a deployment and the
result is `deployment_ready`, the route now ALSO executes the preview deployment —
behind `APP_ENGINE_AUTO_DEPLOY_PREVIEW=true`.

Blocking conditions that still prevent auto-deploy (all preserved, computed by
`buildDeploymentPayload`): missing core env (`DATABASE_URL`/`AUTH_SECRET`/owner email),
missing deployment env (`VERCEL_TOKEN`/org/project), generated app database not ready,
QA readiness < 90%. Plus new: the generated bundle must be present in this runtime.

Config:

```
APP_ENGINE_AUTO_DEPLOY_PREVIEW="true"    # off unless set
APP_ENGINE_AUTO_DEPLOY_PRODUCTION="false" # not honored by code; production is never auto
APP_ENGINE_DEPLOYMENT_TIMEOUT_SECONDS=3600
```

**As implemented:** the original spec listed the Vercel CLI command sequence
(`vercel pull/build/deploy`). A serverless API route cannot run the CLI, so auto-deploy
reuses the PROVEN API-based deploy module (`src/lib/engine/vercel-deploy.ts`,
`deployToVercel`) — the same path that already deploys customer apps live. The executor
lives in `src/lib/engine/preview-auto-deploy.ts`; `prepareProjectDeployment` stays
prepare-only and the customer-build spine is untouched (its prepare-only smoke still
holds). Each run is recorded through the existing deployments persistence with per-step
results; failures persist blockers for the next monitor cycle.

Preview auto-deploy is acceptable because previews are public-by-default, time-boxed,
and must not expose secrets, real private user data, production writes, or paid
provider actions (existing preview policy). Production deployments remain manual:
owner review, design review, compatibility sign-off, and release gate clearance first.

## Safety Boundaries (Preserved — Do Not Modify)

- Cost Governance: `pause_for_budget` blocks new phases until owner approval
- Release Gate: no production deployment without identity/auth, design quality,
  compatibility, and owner sign-off
- Quality Threshold: QA readiness >= 90% before any deployment proceeds
- Production Approval: production stays owner-approved; only previews auto-deploy
- Follow-Up Caps: `APPENGINE_MAX_FOLLOW_UP_ISSUES` and
  `APPENGINE_MAX_FOLLOW_UP_WORKFLOW_DISPATCHES` prevent runaway loops
- Owner Status Report: every workflow run produces a report with state, blockers,
  retries, and the next safe action

## Activation Checklist

- [x] Repository variable `APPENGINE_FOLLOW_UP_MODE` set to `create`
- [x] `APPENGINE_MAX_FOLLOW_UP_ISSUES=10`, `APPENGINE_MAX_FOLLOW_UP_WORKFLOW_DISPATCHES=1`
- [x] `monitor.config.yaml` dispatch rules + safety checks added
- [x] Monitor script acts on dispatch rules with persistent retry counters
- [x] Preview auto-deploy behind `APP_ENGINE_AUTO_DEPLOY_PREVIEW` (via API deploy module)
- [x] Env examples updated; flag not set in production until owner adds it
- [x] Smoke coverage: `scripts/smoke-autonomous-loop.js`
- [ ] End-to-end test: `ai:plan` issue -> follow-up auto-creation -> monitor retry on a
      simulated stall -> preview auto-deploy (owner-observed first run)
- [ ] Review the first fully autonomous run via the owner status report before
      considering any production automation
- [x] Documented in `README.md` under "Autonomous Build Pipeline"
