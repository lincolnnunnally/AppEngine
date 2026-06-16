# Persistence Inventory And Migration Plan

## Purpose

AppEngine cannot become production-ready while important owner state lives only in local/mock files or browser storage. This inventory identifies what must become durable, how sensitive it is, and the safe order for moving it without applying migrations yet.

This document is planning-only. It does not create database tables, migrations, provider resources, secrets, deployments, GitHub issues, labels, or Codex execution.

## Inventory

| State area | Current store | Primary files | Sensitivity | Durable priority | Notes |
| --- | --- | --- | --- | --- | --- |
| Handoff Relay | `.app-engine/handoff-relay.json` with Vercel memory fallback | `src/lib/engine/handoff-relay.ts` | Private | High | Stores pasted handoffs and prepared Codex prompts that may include project context. |
| Project Memory | `.app-engine/project-memory.json` with Vercel memory fallback | `src/lib/engine/project-memory.ts` | Private | Critical | Stores decisions, blockers, progress history, and next safe actions. |
| Orchestrator Runs | local/mock run outputs plus in-memory preview behavior | `src/lib/engine/orchestrator-run.ts`, `scripts/create-orchestrator-run.js` | Internal | High | Stores decision traces and next safe action context. |
| Orchestrator Action Queue | local/mock queue nested with orchestrator run state | `src/lib/engine/orchestrator-run.ts`, `src/app/api/engine/orchestrator-run/actions/[actionId]/route.ts` | Internal | High | Stores queued, prepared, blocked, and completed actions. |
| Real Project Trial | `.app-engine/real-project-trials.json` with Vercel memory fallback | `src/lib/engine/real-project-trial.ts` | Private | High | Stores real project trial summaries, app ideas, risks, and recommendations. |
| Trial Result Review | `.app-engine/real-project-trials.json` reviews section | `src/lib/engine/real-project-trial.ts` | Private | Medium | Stores owner review notes and improvement candidates. |
| Problem Intake Lite | `.app-engine/problem-intake-lite.json` | `src/lib/engine/problem-intake-lite.ts` | Sensitive | Critical | May store people, barriers, personal problems, and solution ideas. |
| Problem Intake Feedback | `.app-engine/problem-intake-lite.json` feedback section | `src/lib/engine/problem-intake-lite.ts` | Private | Medium | Stores owner feedback and improvement candidates. |
| Spark Story Submissions | local/mock controlled preview paths and API behavior | `src/lib/spark-of-hope-intake-lite/intake.ts`, `src/app/api/spark-of-hope-intake-lite/stories/route.ts` | Sensitive | Critical | May contain hope stories, struggles, contact preferences, or consent context. |
| Spark Review Queue | browser `localStorage` | `src/app/spark-of-hope-intake-lite/page.tsx`, `src/lib/spark-of-hope-intake-lite/review-queue.ts` | Sensitive | High | Stores review status, moderation notes, and follow-up guidance. |
| Spark Reminder Queue | browser `localStorage` | `src/app/spark-of-hope-intake-lite/page.tsx`, `src/lib/spark-of-hope-intake-lite/reminder-queue.ts` | Sensitive | High | Stores reminder preferences and manual follow-up review state. |
| Development Projects | `.app-engine/dev-projects.json` | `src/lib/engine/development-store.ts` | Internal | Medium | Legacy local engine project data and generated app readiness state. |

## Privacy And Sensitivity Classes

- `internal`: operational state that should not be public but normally contains no personal story content.
- `private`: owner/project context, strategy, prompts, project history, or review notes.
- `sensitive`: user-submitted problems, stories, contact preferences, consent context, or pastoral/support-adjacent material.

Sensitive data must move last and only after schema, retention, access control, and deletion behavior are reviewed.

## Migration Order

1. Add durable state adapter boundary while keeping local/mock as default.
2. Add append-only audit trail for important state transitions.
3. Move internal orchestrator state behind the adapter in local/mock mode.
4. Move Project Memory and Handoff Relay behind the adapter in local/mock mode.
5. Design database schema and retention rules for private and sensitive state.
6. Add migration scripts in dry-run mode only.
7. Add reviewed database adapter behind explicit owner approval and feature flag.
8. Migrate internal state first.
9. Migrate private owner state second.
10. Migrate sensitive intake/story/review state last.

## Rollback And Safety Plan

Before any real migration:

- export current local/mock JSON stores
- verify checksums or counts before and after import
- keep local/mock read fallback during the first cutover
- keep writes dual-recorded only after explicit owner approval
- keep production blocked until release gate approval
- keep migrations blocked until schema review passes
- never write secrets or env values into migration artifacts
- provide a one-step rollback to read from the exported local/mock snapshot

## First Durable Targets

The first production-gap closure should focus on:

1. Project Memory
2. Handoff Relay
3. Orchestrator Action Queue

These carry the most autonomy value with lower user-data risk than Spark stories or problem intake submissions.

## Guardrails

This plan must not:

- deploy production
- create paid resources
- apply migrations
- add secrets or environment variables
- change repository visibility
- trigger Codex automatically
- create GitHub issues
- apply labels
- auto-merge generated app code
