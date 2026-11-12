# App Engine Agent Guide

<!-- LPL-SHARED-AGENT-RULES:START -->
## Shared rules for every agent — read before anything else

Claude Code, Codex, Cursor, Copilot, Grok, Gemini and any other agent working in this repo.
These load automatically at the start of every session, so they apply before any other doc is read.

1. **THE ONE RULE: build from what already exists.** First find what's already built and move forward
   from it. Improve what's there; never recreate it. Build new only when nothing covers the need. This
   binds planning as much as building: no one proposes a fresh path before checking the existing one.
2. **Read before you change or claim.** Open and read every file you are about to edit, in this session.
   Never describe a file, repo, setting or doc you have not opened; say "not checked" instead. A guess
   with a disclaimer is still a guess.
3. **Check the Module Catalog before building any capability.** `lincolnnunnally/AppEngine` →
   `source-of-truth/module-catalog.md`. If a block covers it, reuse that block.
4. **Fit the task into the whole; never reshape the whole around the task.** Change only what the task
   needs. Do not rename, restructure, restyle or rewrite working code, copy or design outside it. If the
   task seems to need that, stop and say why in the PR instead of doing it.
5. **Say how it fits.** Every PR description names what existing code or module it builds on and what it
   deliberately left unchanged.
6. **Mission, doctrine and product direction are Lincoln's.** Take them from
   `lincolnnunnally/life-produces-life-source-of-truth`; never invent or change them.

This block is synced from `lincolnnunnally/AppEngine` `source-of-truth/shared-agent-rules.md`.
Edit it there, then run `npm run agent-rules:sync -- <repo dir>`; edits made here are overwritten.
<!-- LPL-SHARED-AGENT-RULES:END -->

## Project

This repository contains a Next.js app-building engine. It plans app ideas, runs automated agent workflows, generates app bundles, applies generated Neon schemas, runs QA, and prepares Vercel deployments.

**Before building an app, read `source-of-truth/QUICK_APP_BUILD_PLAYBOOK.md`** — the proven fast-build manual: the 48-module shelf, DB-adapter and auth patterns, the standard ship pipeline, and the gotcha list. Build the fast way by default; register reusable work as modules (owner directive 2026-07-09).

## Authority model (owner directive, 2026-07-09)

Claude Code has FULL technical autonomy — coding, testing, git branches/commits/**merges to main on every ecosystem repo**, deploys to Vercel/Render/any connected host (including production), database schema and data changes, env vars, and DNS/infra management where API access exists. Do NOT ask Lincoln for technical approval. Because no human gate exists, engineering replaces approval: back up before destructive database operations, keep deploys reversible, verify end-to-end after every change, take protective snapshots — then report what was done.

Surface to Lincoln ONLY three things: (1) **money** — new paid services, plan upgrades, purchases; (2) **credentials only he can create** — account API keys (e.g. Render), OAuth apps, registrar/DNS logins, Stripe/email accounts (once provided, their use is autonomous); (3) **mission, philosophy, doctrine, and product direction** (what an app IS). Consume the philosophy; never invent or change it.

## Asking Lincoln for something (owner request, 2026-11-01)

When you need Lincoln to do one of the three things above, **put it on his to-do list**,
not only in your chat reply. Chat asks get buried. Add it to `source-of-truth/owner-tasks.json`
(`npm run tasks:add -- --app <slug> --title "..." --why "..." --step "..." --kind credential --priority blocker --link <url> --by "<you>"`,
then `npm run tasks:check`), or POST it with `APP_ENGINE_TASKS_TOKEN`. It shows at the top of
`dashboard.unitedundergod.org` and on `/tasks` until he clears it. In chat, mention it in one line
with its id. Close tasks you verified are done. Full rules: `source-of-truth/owner-task-queue.md`.

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
- `AUTH_URL`: local only. Production/leftover-preview must not pin it — Auth.js is host-aware across `dashboard.unitedundergod.org` and `appengine.unitedundergod.org`. GitHub OWNER STEP callbacks are those two hosts only (`source-of-truth/github-oauth-soft-launch-callbacks.md`). `we-succeed.org` is not App Engine soft-launch — do not register it.
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
