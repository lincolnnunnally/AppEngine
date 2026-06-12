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

## Drift Prevention

- Do not build from chat memory alone.
- Do not create a second prompt folder when the manifest already defines one.
- Do not invent a new agent shape without updating `agents/manifest.yaml`.
- Do not proceed when ChatGPT, Codex, local files, and GitHub disagree.
- Turn disagreements into a source-of-truth check before building.

## Durable Memory

Core principles, product direction, and completed decisions should be stored in repo files, issues, pull requests, or agent outputs. Chat can clarify, but repo state decides what future agents inherit.
