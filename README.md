# App Engine Production Scaffold

This folder is the backend-ready target for the current static cockpit.

It is designed for:

- Next.js App Router
- Neon Postgres
- Auth.js sign-in
- customer and admin protected areas
- page and API-level authorization guards
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

When `DATABASE_URL` points to a real Neon database, apply migrations and seeds with:

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

This keeps the production cockpit usable before real Neon credentials are connected. Once `DATABASE_URL` points to a real Neon database, set `APP_ENGINE_LOCAL_MODE=false` and apply the migrations/seeds.

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
