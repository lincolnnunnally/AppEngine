# App Standards

Use these standards for AppEngine and generated apps.

- Prefer the existing stack and repo patterns before adding new dependencies.
- Keep AppEngine as the orchestration and handoff layer for Codex-built work.
- Use GitHub issues, labels, branches, pull requests, and comments as durable collaboration records.
- Keep customer/admin auth, Identity/Auth plans, Super Admin registry entries, Neon persistence, generated app export, QA, and deployment gates aligned.
- Keep generated apps buildable even when no generated-app database is configured.
- Add the API route, cockpit state, readiness/autopilot behavior, docs, and verification path together when adding a new engine action.
- Keep agent definitions in one source of truth and derive task graphs or prompts from it.
- Run `npm run typecheck` and `npm run build` before finishing code changes unless the change is docs-only.
