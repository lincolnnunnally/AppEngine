# Orchestrator Decision Trace + Action Queue

## Goal

The Manual Orchestrator must not merely choose a next safe action. It must show why that action was selected and queue the recommendation for owner review without triggering work automatically.

## Decision Trace

Every `orchestrator_run` should include a decision trace with:

- inputs considered
- current project state
- blockers found
- selected next safe action
- why the action was selected
- confidence level: `low`, `medium`, or `high`
- evidence used
- guardrails considered

The trace should be honest when context is missing. Missing context should reduce confidence or route to a safer clarification/review action.

## Action Queue

Every `orchestrator_run` should create a local/mock `orchestrator_action_queue` entry for the recommended next safe action.

Supported action statuses:

- `queued`
- `prepared_handoff`
- `owner_approved`
- `blocked`
- `completed`

## Storage

The queue is local/mock only.

It may be stored beside local orchestrator run history or in Vercel mock memory, but it must not create GitHub issues, apply labels, trigger Codex, deploy, migrate, create paid resources, change secrets/env, change repository visibility, or auto-merge.

## Project Memory Updates

Project Memory should record:

- when an action is queued
- when an action is prepared as a handoff
- when an action is blocked
- when an action is completed

This makes AppEngine remember what it recommended without making Lincoln manually reconstruct state from workflow logs, PR comments, or chat history.

## Owner-Readable Output

The owner-readable output should explain:

- what AppEngine considered
- what it found
- what action it queued
- why it queued that action
- confidence level
- whether owner approval is required
- what remains blocked

## Guardrails

- No Codex auto-execution.
- No GitHub issue creation.
- No label changes.
- No production deploy.
- No paid resources.
- No migrations.
- No secrets or environment changes.
- No repository visibility changes.
- No generated app auto-merge.

## Success Criteria

The feature works when a Manual Orchestrator run produces a durable `decisionTrace`, creates a local/mock queued action, updates Project Memory with the queued action, and preserves all owner-approval guardrails.
