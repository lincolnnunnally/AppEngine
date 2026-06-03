# App Engine Production Scaffold

This folder is the backend-ready target for the current static cockpit.

It is designed for:

- Next.js App Router
- Neon Postgres
- Auth.js sign-in
- customer and admin protected areas
- page and API-level authorization guards
- reusable app templates
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
- Run the generated agent task graph
- Persist agent output as a run report
- Run QA checks
- Prepare deployment and record Vercel command gates/blockers
- Track readiness, findings, and setup gaps

Production completion still requires real service credentials, Neon migrations, worker-provider API keys, deployment automation, and generated-app filesystem/worktree output.

## Local Mode

`APP_ENGINE_LOCAL_MODE=true` lets the builder save generated projects to:

```text
.app-engine/dev-projects.json
```

This keeps the production cockpit usable before real Neon credentials are connected. Once `DATABASE_URL` points to a real Neon database, set `APP_ENGINE_LOCAL_MODE=false` and apply the migrations/seeds.

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

2. Manual fallback:

```text
GENERATED_APP_DATABASE_URL
```

Use this only when you want all generated app setup to target a specific database or branch.

## Worker Providers

The engine chooses workers automatically:

- `OPENAI_API_KEY` -> OpenAI Responses API worker
- `ANTHROPIC_API_KEY` -> Anthropic Messages API worker
- neither key -> deterministic local worker

Optional model overrides:

```text
OPENAI_MODEL="gpt-5.1"
ANTHROPIC_MODEL="claude-sonnet-4-5"
```

The local worker is intentionally kept available so the engine can be verified without external credentials.

## Deployment Workflow

The cockpit records deployment attempts through:

```text
POST /api/engine/projects/:projectId/deployments
GET /api/engine/projects/:projectId/deployments
```

The deployment gate checks:

```text
DATABASE_URL
NEON_API_KEY and NEON_PROJECT_ID, or GENERATED_APP_DATABASE_URL
AUTH_SECRET
APP_ENGINE_OWNER_EMAIL
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
