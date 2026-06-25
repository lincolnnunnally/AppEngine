# Execution Dispatcher (dry run)

The Execution Dispatcher is roadmap step #2 from the Orchestrator Autonomous Execution Plan — the highest-leverage handoff-burden reducer. It replaces Lincoln copying a prepared builder prompt into Codex with a controlled, owner-approved **GitHub workflow-dispatch draft**.

Artifact kind:

```text
execution_dispatcher_dry_run
```

## It is a DRY RUN

It **never dispatches**. `dispatched` is always `false` and `executionEnabled` is always `false`. It produces the *draft* dispatch (target workflow, ref, inputs) and reports what must be true before an owner could approve it. The actual `gh workflow run` is a separate, explicit, manual owner action — never automatic.

## Prerequisites (fails closed)

It composes the existing pieces, not a parallel system. Status is `ready_for_owner_approved_dispatch` only when **all** are true, else `blocked_pending_prerequisites`:

1. **Durable persistence is active** — composes `persistence_activation_readiness` (the roadmap's #1 prerequisite). Today this is blocked (Neon disabled), so the dispatcher honestly reports blocked.
2. **A prepared builder prompt is present** — from a `build_execution_builder_handoff_export`.
3. **The owner has explicitly approved this dispatch** — per-dispatch, not a standing setting.

## Target

The draft targets the real `.github/workflows/ai-prompt-factory.yml` (`workflow_dispatch`) on `main`, passing the prepared builder prompt as the task input.

## Guardrails

planning-only · the dry run never dispatches · no automatic Codex execution · owner approval required to dispatch · no production deploy · no new paid resources · no label changes · no GitHub issue creation.

## Owner view

Visible at `/orchestrator` alongside the autonomy roadmap: where the loop is, what's blocking the dispatcher, and the next safe action.
