# App Engine Agent Guide

## Project

This repository contains a Next.js app-building engine. It plans app ideas, runs automated agent workflows, generates app bundles, applies generated Neon schemas, runs QA, and prepares Vercel deployments.

## Commands

- Install dependencies: `npm ci`
- Start local dev server: `npm run dev`
- Typecheck: `npm run typecheck`
- Production build: `npm run build`
- Apply engine database schema/seed data: `npm run db:setup`

Run `npm run typecheck` and `npm run build` before finishing code changes unless the task is docs-only.

## Environment

Use `.env.example` as the source of truth for required environment variables.

Important runtime values:

- `DATABASE_URL`: Neon database for the app engine itself.
- `NEON_API_KEY` and `NEON_PROJECT_ID`: preferred generated-app database strategy. The engine creates/reuses Neon branches and applies generated schemas there.
- `NEON_PARENT_BRANCH_ID`: optional parent branch for generated-app database branches.
- `NEON_DATABASE_NAME` and `NEON_ROLE_NAME`: generated app branch connection defaults, usually `neondb` and `neondb_owner`.
- `GENERATED_APP_DATABASE_URL`: optional manual fallback for generated app schema and seed setup.
- `APP_ENGINE_LOCAL_MODE`: keep `true` for local JSON fallback, set `false` when `DATABASE_URL` is ready.
- `AUTH_SECRET`: Auth.js secret.
- `AUTH_URL`: local or deployed app URL.
- `APP_ENGINE_OWNER_EMAIL`: bootstrap owner/admin email.
- `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`: optional GitHub OAuth.
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`: optional Google OAuth.
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`: enables real model workers.
- `APP_ENGINE_WORKER_PROVIDER`: optional `local`, `openai`, or `anthropic` override. Local mode defaults to deterministic local workers.
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`: enables deployment preparation.

Do not commit `.env.local`, generated `.app-engine` output, `.next`, `node_modules`, or `*.tsbuildinfo`.

## Working Style

- Treat GitHub `main` plus repo-owned files as the central source of truth before building. Before agent or prompt-factory work, run `npm run source:check` or otherwise verify live GitHub `main`, local `origin/main`, `agents/manifest.yaml`, and the manifest's shared context files are aligned.
- If ChatGPT, Codex, local files, and GitHub disagree, stop and reconcile the source of truth before editing. Do not build parallel prompt folders, agent manifests, or product directions from chat memory alone.
- Prefer small, production-shaped changes over prototypes.
- Keep customer/admin auth, Neon persistence, QA checks, generated app export, and deployment gates working together.
- When adding a new engine action, add the API route, cockpit UI state, readiness/autopilot behavior, and verification path together.
- Keep generated apps buildable with no database configured by using static fallback data where appropriate.
- Keep agent behavior centralized in `src/lib/engine/agent-roles.ts`; task graph and worker prompts should derive from the shared role registry.
- Keep machine-usable agent outputs centralized in `src/lib/engine/agent-artifacts.ts`; generated app exports should consume these artifacts instead of relying only on prose summaries.
- Keep artifact-to-file compilation in `src/lib/engine/app-generator.ts` aligned with new artifact kinds so generated apps receive importable code, not just reports.
