# Source Of Truth Protocol

GitHub is the central source of truth for AppEngine and all agent handoffs.

Before an agent plans, builds, reviews, fixes, monitors, or creates follow-up work, it must verify that it is using the current repo state and the current manifest.

## Required Preflight

1. Check the live GitHub `main` revision.
2. Check the local `origin/main` revision.
3. Stop if the local remote-tracking branch is stale.
4. Stop if the local `main` branch is behind GitHub `main`.
5. Read `agents/manifest.yaml`.
6. Read all `shared_context_files` listed in the manifest.
7. Read the selected agent prompt from the manifest.
8. Treat GitHub issues, pull requests, and repo docs as durable handoff records.
9. Run the Context Gate before planning, designing, building, reviewing, fixing, monitoring, or recommending growth.

## Drift Prevention

- Do not build from chat memory alone.
- Do not create a second prompt folder when the manifest already defines one.
- Do not invent a new agent shape without updating `agents/manifest.yaml`.
- Do not proceed when ChatGPT, Codex, local files, and GitHub disagree.
- Turn disagreements into a source-of-truth check before building.

## Durable Memory

Core principles, product direction, and completed decisions should be stored in repo files, issues, pull requests, or agent outputs. Chat can clarify, but repo state decides what future agents inherit.

## Required Context Set

Every agent workflow must load:

- Global Principles
- Life Produces Life product doctrine
- App Charter
- Intake Command Standard when routing natural language requests into GitHub issues or agent workflows
- App Selection Standard when deciding whether a request is for a new app or an existing app
- App Build Packet when planning or building a new app, generated app, major rebuild, or complex multi-phase workflow
- Identity/Auth Standard when planning, building, reviewing, or launching a generated app
- Super Admin Registry Standard when planning, building, reviewing, monitoring, or launching a generated app
- Operations, Cost, and Provider Strategy Standard before provisioning provider resources, approving deployment environments, or launching generated apps
- Deployment Environment Standard when planning, building, reviewing, deploying, or launching a generated app
- Design Quality Gate when planning, designing, reviewing, testing, or releasing a generated app
- UX Review Standard when reviewing user paths, mobile paths, empty states, error states, onboarding, admin screens, or release readiness
- Compatibility Standard when reviewing mobile, Safari, Chrome, Edge, Firefox, viewport, touch, form, auth, upload, payment, admin, or release readiness
- Release Gate Standard when moving a generated app from build to preview, production, monitoring, or vNext work
- App Improvement and vNext Packet Standard when improving an existing app, adding features, fixing problems, responding to feedback, or planning v2
- Current Context
- Active Task
