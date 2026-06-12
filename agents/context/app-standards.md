# App Standards

Use these standards for AppEngine and generated apps.

- Prefer the existing stack and repo patterns before adding new dependencies.
- Keep AppEngine as the orchestration and handoff layer for Codex-built work.
- Use GitHub issues, labels, branches, pull requests, and comments as durable collaboration records.
- Convert natural language requests into intake packets before planning so "build this," "start AppEngine build," "improve this app," and feature requests route to the correct app workflow.
- Use app selection/disambiguation before implementation; new apps require App Build Packets, existing apps require vNext packets, and ambiguous or multi-app requests require clarification.
- Keep customer/admin auth, Identity/Auth plans, Super Admin registry entries, provider/cost reviews, Deployment Environment plans, Design Quality Gates, UX Reviews, Compatibility Test Plans, Release Gates, Neon persistence, generated app export, QA, and deployment gates aligned.
- Launch the first useful MVP as `v1`; route later improvements to `vNext`, `v2`, or follow-up issues instead of expanding the MVP forever.
- Use vNext packets for existing app improvements so “improve this app,” feature additions, fixes, feedback, and v2 work do not restart the whole app.
- Do not create new paid provider resources without provider/cost review and owner approval.
- Do not ship technically working but ugly, confusing, or emotionally mismatched generated apps; require Designer and Customer Perspective review before Release Gate approval.
- Do not ship generated apps with unresolved Safari, mobile, common browser, touch-target, form, auth, upload, payment, or admin compatibility issues.
- Keep generated apps buildable even when no generated-app database is configured.
- Add the API route, cockpit state, readiness/autopilot behavior, docs, and verification path together when adding a new engine action.
- Keep agent definitions in one source of truth and derive task graphs or prompts from it.
- Run `npm run typecheck` and `npm run build` before finishing code changes unless the change is docs-only.
