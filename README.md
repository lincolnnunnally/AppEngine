# App Engine Production Scaffold

This folder is the backend-ready target for the current static cockpit.

It is designed for:

- Next.js App Router
- Neon Postgres
- Auth.js sign-in
- customer and admin protected areas
- page and API-level authorization guards
- generated-app Identity/Auth standard
- generated-app Super Admin registry standard
- generated-app Operations/Cost/Provider Strategy standard
- generated-app Deployment Environment standard
- generated-app Design Quality Gate standard
- generated-app UX Review standard
- generated-app Cross-Browser/Mobile Compatibility standard
- generated-app Release Gate standard
- existing-app vNext improvement packet standard
- ChatGPT Handoff / Issue Creation Packet standard
- natural-language Intake Command and App Selection standard
- end-to-end command pilot for the first bounded app build
- reusable app templates
- shared product, business, architecture, database, auth, design, frontend, backend, QA, fixer, and deployment agent roles
- typed agent artifacts for routes, APIs, roles, tables, workflows, QA checks, and deployment gates
- project planning API routes
- local, OpenAI, and Anthropic worker adapters
- persisted agent runs, QA reports, and artifacts
- future GitHub, Playwright, and Vercel workers

## Setup

```bash
cd /Users/lincolnnunnally/Documents/Project_Code/app-engine/production-app
cp .env.example .env.local
npm install
npm run dev
```

Use `.env.local` only for local development. For Vercel Production and Preview variables, use `.env.vercel.example` as the allow-list. Do not upload `.env.local` wholesale because it can contain localhost URLs, local bypass flags, or provider snippets this app does not use.

When `DATABASE_URL` or a supported Vercel/Neon Postgres URL points to a real Neon database, apply migrations and seeds with:

```bash
npm run db:setup
```

## Current State

This is now a working local engine cockpit with production-shaped persistence.

Current working flow:

- Analyze an app idea
- Save the project
- Inspect the automatic agent bench and run the generated agent task graph
- Persist agent output as a run report
- Run QA checks
- Prepare deployment and record Vercel command gates/blockers
- Track readiness, findings, and setup gaps

Production completion still requires OAuth sign-in credentials, deployment verification, and a full real-project autopilot pass from idea to generated app preview.

## Local Mode

`APP_ENGINE_LOCAL_MODE=true` lets the builder save generated projects to:

```text
.app-engine/dev-projects.json
```

This keeps the production cockpit usable before real Neon credentials are connected. Once a Postgres URL points to a real Neon database, set `APP_ENGINE_LOCAL_MODE=false` and apply the migrations/seeds.

On Vercel, `APP_ENGINE_LOCAL_MODE` must be `false`. Vercel cannot persist `.app-engine/dev-projects.json`, so project save requires Neon persistence. The deployed app will still use Neon when Vercel has a valid Postgres URL, even if an old local-mode value is present.

## Vercel Environment

Use `.env.vercel.example` as the Vercel allow-list. The important production values are:

```text
DATABASE_URL or POSTGRES_URL
APP_ENGINE_LOCAL_MODE="false"
APP_ENGINE_DEV_ADMIN_BYPASS="false"
APP_ENGINE_SETUP_ADMIN_BYPASS="false"
AUTH_SECRET
AUTH_URL="https://your-vercel-app-url"
APP_ENGINE_OWNER_EMAIL
AUTH_GITHUB_ID
AUTH_GITHUB_SECRET
NEON_API_KEY
NEON_PROJECT_ID
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

`DATABASE_URL` is preferred, but Neon/Vercel Marketplace integrations may provide `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, or `NEON_DATABASE_URL`. App Engine accepts those aliases for core persistence and database setup.

Remove these from Vercel if they were copied from a Neon snippet because App Engine does not read them:

```text
NEON_CONNECTION_STRING
NEON_AUTH_URL
NEON_JWKS_URL
unknown_neon_DATABASE_URL
```

After changing Vercel variables, redeploy the affected environment. Check that the variable is scoped to the deployment you are testing, usually Production for the live URL and Preview for branch deployments. Then verify:

```text
/api/engine/health
/api/engine/setup-profile
```

Health should report `storage: "neon"`, `databaseConfigured: true`, and `schemaReady: true`.

## Auth Access

During local development, admin routes can be opened without OAuth so you can keep building:

```text
APP_ENGINE_DEV_ADMIN_BYPASS="true"
```

Public deployments must use Auth.js with a configured OAuth provider. Add either GitHub or Google OAuth credentials before exposing the app:

```text
AUTH_SECRET
APP_ENGINE_OWNER_EMAIL
AUTH_GITHUB_ID
AUTH_GITHUB_SECRET
```

or:

```text
AUTH_SECRET
APP_ENGINE_OWNER_EMAIL
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
```

Generated apps must define an Identity/Auth plan before build or launch work begins. The standard lives in:

```text
source-of-truth/identity-auth-standard.md
```

Each generated app also needs a Super Admin registry entry or planned entry so AppEngine can track status, ownership, deployment, health, logs, users/admin, billing/status if needed, and support actions:

```text
source-of-truth/super-admin-registry.md
```

Verify the local generator and follow-up issue handoff with:

```bash
npm run smoke:identity-registry
```

Generated apps must also define Operations/Cost/Provider Strategy, Deployment Environment, Design Quality, Compatibility, and Release Gate plans before moving from build mode to launch mode:

```text
source-of-truth/operations-cost-provider-strategy.md
source-of-truth/cost-governance-model-routing.md
source-of-truth/deployment-environment-standard.md
source-of-truth/design-quality-gate.md
source-of-truth/ux-review-standard.md
source-of-truth/compatibility-standard.md
source-of-truth/release-gate-standard.md
```

The release path is:

```text
Lincoln conversation -> ChatGPT handoff packet -> GitHub issue -> intake packet -> app selection -> packet -> identity/auth -> registry -> provider/cost -> cost governance -> environment -> design quality -> compatibility -> release gate -> monitored launch
```

The first useful public launch is `v1`. Later improvements become `vNext`, `v2`, or focused follow-up issues instead of endlessly expanding the MVP.

Preview deployments are public by default for fast review and route-specific verification. Production stays approval-gated. Public previews must not expose secrets, real private user data, production writes, paid provider actions, admin-only data, or real migrations.

Before provisioning provider resources or approving release, agents must produce or approve a `provider_cost_review` artifact. That review checks provider reuse, preview cost posture, production approval, monthly ceiling or owner-defined cap, upgrade trigger, and whether new paid Vercel, Render, database, storage, email, payment, AI, analytics, or monitoring resources are allowed.

Before autonomous model-heavy work continues, agents must produce or inherit a `cost_governance` artifact. That artifact tracks monthly, project, app, and issue AI/API spend, classifies the task as cheap, medium, or expensive, applies warning/pause/owner-approval thresholds, and can make Build Completion choose `pause_for_budget` or `request_budget_approval`.

Before release approval, the Designer and Customer Perspective agents must produce or approve a `design_review` artifact. That review checks simple navigation, one clear primary action, mobile-first layout, readable copy, accessible spacing and contrast, trust-building elements, audience-specific emotional fit, empty states, error states, onboarding, and admin screens. Technically working but ugly or confusing apps do not pass the release gate.

Before release approval, Workflow Tester and Code Reviewer must also produce or approve a `compatibility_test_plan` artifact. That plan checks iPhone/iPad Safari, desktop Safari, Chrome mobile/desktop, common desktop browsers, responsive viewports, touch targets, forms, auth flows, file uploads if used, payments if used, admin screens, and Super Admin status. Unresolved Safari/mobile/common browser issues block release.

Verify the release generator and no-production-deploy follow-up handoff with:

```bash
npm run smoke:provider-cost
npm run smoke:cost-governance
npm run smoke:design-quality
npm run smoke:compatibility
npm run smoke:release-gate
npm run smoke:vnext-packet
```

Existing app improvements use a vNext packet instead of restarting the whole app:

```text
natural request -> intake packet -> existing app -> vNext packet -> design/review/build/test -> release gate -> updated monitored version
```

The vNext packet standard lives in:

```text
source-of-truth/app-improvement-vnext-packet.md
```

Natural language requests must become intake packets before app work starts. This is how requests like `build this app`, `start AppEngine build`, `improve Spark of Hope`, or `add this feature to Toner Management` become the right GitHub issue path:

```text
source-of-truth/chatgpt-handoff-issue-standard.md
source-of-truth/intake-command-standard.md
source-of-truth/app-selection-standard.md
```

Verify the ChatGPT handoff and intake routers locally with:

```bash
npm run pilot:e2e
npm run smoke:e2e-pilot
npm run smoke:chatgpt-handoff
npm run smoke:intake
```

The first bounded pilot uses:

```text
source-of-truth/end-to-end-command-test-standard.md
source-of-truth/pilot-app-build-template.md
```

The pilot is dry-run only. It proves the path from ChatGPT handoff issue to intake, App Build Packet, dry-run follow-up issues, and `pilot_app_build` artifact without production deployment, paid provider resources, or unreviewed generated app code.

In GitHub Actions, pilot artifacts are persisted under the uploaded `agent-run` artifact instead of runner-local `/tmp` paths. The workflow defaults to dry-run follow-up previews. To allow real GitHub follow-up issues, set repository variable `APPENGINE_FOLLOW_UP_MODE` to `create`. Keep controlled tests bounded with `APPENGINE_MAX_FOLLOW_UP_ISSUES` and `APPENGINE_MAX_FOLLOW_UP_WORKFLOW_DISPATCHES`.

## Generated App Databases

The engine can prepare databases for generated apps in two ways:

1. Automatic Neon branch provisioning, preferred:

```text
NEON_API_KEY
NEON_PROJECT_ID
NEON_DATABASE_NAME="neondb"
NEON_ROLE_NAME="neondb_owner"
```

When these are configured, `Setup DB` creates or reuses a Neon branch for the generated app, retrieves a connection URI, and applies the generated app schema and seed data.

2. Manual per-app fallback:

```text
GENERATED_APP_DATABASE_URL_<PROJECT_ID>
GENERATED_APP_DATABASE_URL_<PROJECT_SLUG>
```

Use this when you manually create a Neon database/branch for a generated app. Select the project in the builder and the Generated Database panel will show the exact `.env.local` keys to use. This keeps Church Connect, Toner Management, Kindred Soul, and future apps on separate database targets while still letting the factory apply each generated schema.

Global manual fallback is available only when explicitly enabled:

```text
APP_ENGINE_ALLOW_GLOBAL_GENERATED_DATABASE_URL="true"
GENERATED_APP_DATABASE_URL
```

Use the global fallback only for temporary testing because every generated app setup will target the same database/branch.

## Setup Profile

The cockpit reads:

```text
GET /api/engine/setup-profile
```

This route reports setup phases, missing variable names, and the next setup action without exposing secret values. Use it in local or Codex web runs to understand what is actually configured.

## Worker Providers

The engine chooses workers automatically:

- `APP_ENGINE_LOCAL_MODE=true` -> deterministic local worker
- `OPENAI_API_KEY` -> OpenAI Responses API worker
- `ANTHROPIC_API_KEY` -> Anthropic Messages API worker
- neither key -> deterministic local worker

Optional provider override:

```text
APP_ENGINE_WORKER_PROVIDER="local" | "openai" | "anthropic"
```

Optional model overrides:

```text
OPENAI_MODEL="gpt-5.1"
ANTHROPIC_MODEL="claude-sonnet-4-5"
```

The local worker is intentionally kept available so the engine can be verified without external credentials.

## Agent Bench

Agent roles live in:

```text
src/lib/engine/agent-roles.ts
```

The task graph is generated from those roles, so each specialist owns its phase, mission, deliverables, handoffs, and quality bar. In local mode these roles produce deterministic structured output. When model keys are connected, the same role definitions become the worker instructions.

Inspect the current bench with:

```text
GET /api/engine/agent-roles
```

Agent runs now produce machine-usable artifacts in addition to human summaries. Generated app exports consume the latest agent run and write:

```text
app-engine-blueprint.json
src/lib/generated-blueprint.ts
src/lib/auth/permissions.ts
src/lib/generated-api-contract.ts
src/lib/db/generated-model.ts
src/lib/qa/acceptance-checks.ts
src/lib/deployment/deployment-plan.ts
```

Those files contain the agent-produced routes, API routes, role matrix, protected route gates, database model, workflows, QA checks, deployment gates, and raw agent blueprint artifacts.

## Prompt Factory

The repo includes a prompt factory for turning rough issues, app ideas, and error reports into Codex-ready automation prompts.

The source of truth is:

```text
agents/manifest.yaml
```

The manifest lists shared context files, agent prompt files, recommended flows, and label workflows. Before building or generating prompts, run:

```bash
npm run source:check
```

That checks live GitHub `main`, local `origin/main`, and every manifest-referenced context/prompt file. In GitHub Actions this runs in strict mode before Codex receives a prompt.

Shared context currently lives in:

```text
source-of-truth/global-principles.md
source-of-truth/life-produces-life.md
source-of-truth/context-checklist.md
source-of-truth/agent-enforcement.md
source-of-truth/app-build-packet.md
source-of-truth/identity-auth-standard.md
source-of-truth/super-admin-registry.md
source-of-truth/operations-cost-provider-strategy.md
source-of-truth/cost-governance-model-routing.md
source-of-truth/deployment-environment-standard.md
source-of-truth/design-quality-gate.md
source-of-truth/ux-review-standard.md
source-of-truth/compatibility-standard.md
source-of-truth/release-gate-standard.md
source-of-truth/app-improvement-vnext-packet.md
source-of-truth/charters/appengine.md
agents/context/mission.md
agents/context/source-of-truth.md
agents/context/app-standards.md
agents/context/security-rules.md
agents/context/output-contracts.md
```

For new generated apps or complicated app builds, create an App Build Packet before implementation. The packet defines the app charter, boundaries, audience, success definition, MVP stages, identity/auth, Super Admin registry, provider/cost review, cost governance, deployment environment, Design Quality Gate, UX Review, Compatibility Test Plan, release gate, deployment target, and phased follow-up issues.

```bash
npm run packet:create
npm run smoke:app-build-packet
npm run smoke:provider-cost
npm run smoke:cost-governance
npm run smoke:design-quality
npm run smoke:compatibility
npm run smoke:release-gate
npm run smoke:vnext-packet
```

The packet standard lives in:

```text
source-of-truth/app-build-packet.md
```

Every agent workflow starts with the Context Gate. That gate checks Global Principles, App Charter, Current Context, and Active Task before the selected agent path runs.

Generate a prompt locally with:

```bash
AGENT_MODE=builder TASK_BODY="Build the Spark of Hope story intake flow." npm run prompt:make
```

That writes `generated-prompt.md`, which is gitignored.

GitHub automation is configured in:

```text
.github/workflows/ai-prompt-factory.yml
```

Add one of these labels to an issue to run the matching mode:

```text
ai:plan
ai:build
ai:review
ai:fix
ai:growth
ai:monitor
```

The workflow generates a prompt from the issue, runs the Codex GitHub Action, captures Codex changes as a patch, opens a pull request when files changed, and comments the result back on the issue. It does not deploy. Keep `OPENAI_API_KEY` configured as a GitHub secret; do not expose it as a job-level environment variable.

The workflow listens for issues that are opened, labeled, edited, or reopened. A phone-created issue with an existing `ai:*` label can start without Lincoln relabeling or editing it later. If Codex fails, the workflow comments back on the issue with the failed run link.

Every prompt-factory run writes a phone-first preflight artifact and an `owner_status_report` under the durable `agent-run` artifact. The issue comment includes the owner status summary so Lincoln can see where the app is, what state/version it is in, what is blocked, and the next safe action without reading workflow logs.

Useful orchestration commands:

```bash
npm run orchestration:plan
npm run monitor:issues
npm run owner:status
```

GitHub also has an Orchestration Monitor workflow that checks open `ai:*` issues on a schedule and records a report artifact. When enabled, it adds a one-time marker comment so the issue itself shows that AppEngine saw it.

Monitor behavior is controlled by:

```text
monitor.config.yaml
```

The monitor starts as a scheduled GitHub Actions watchdog. It reports open AI issues, stale issues/PRs, failed workflow runs, recently merged PRs, and source-of-truth changes without deploying or touching production.

## Deployment Workflow

The cockpit records deployment attempts through:

```text
POST /api/engine/projects/:projectId/deployments
GET /api/engine/projects/:projectId/deployments
```

The deployment gate checks:

```text
DATABASE_URL
NEON_API_KEY and NEON_PROJECT_ID, or a per-app GENERATED_APP_DATABASE_URL_<PROJECT_ID>/<PROJECT_SLUG>
AUTH_SECRET
APP_ENGINE_OWNER_EMAIL
GitHub or Google OAuth credentials
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
QA readiness >= 90%
```

When blocked, the engine persists the blockers. When ready, it records the Vercel preview command sequence:

```bash
npm run typecheck
npm run build
npm run db:setup
vercel pull --yes --environment=preview --token=$VERCEL_TOKEN
vercel build --token=$VERCEL_TOKEN
vercel deploy --prebuilt --token=$VERCEL_TOKEN
```
