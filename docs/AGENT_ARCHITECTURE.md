# AppEngine Agent Architecture

AppEngine uses GitHub as the durable handoff layer between ChatGPT, Codex, GitHub Actions, and future agents.

## Source Of Truth

The source of truth is `agents/manifest.yaml`.

Before agents build, review, fix, monitor, or generate prompts, they must verify:

- GitHub `main` is known.
- Local `origin/main` is current.
- `agents/manifest.yaml` is present.
- Every manifest `shared_context_files` entry exists.
- Every manifest agent prompt exists.

Use:

```bash
npm run source:check
```

GitHub Actions runs this in strict mode before Codex receives a generated prompt.

## Agent Files

Shared context:

```text
source-of-truth/global-principles.md
source-of-truth/life-produces-life.md
source-of-truth/context-checklist.md
source-of-truth/agent-enforcement.md
source-of-truth/charters/appengine.md
agents/context/mission.md
agents/context/source-of-truth.md
agents/context/app-standards.md
agents/context/security-rules.md
agents/context/output-contracts.md
```

Agent prompts:

```text
agents/prompts/*.md
```

Do not create a second prompt source without updating the manifest.

## Workflow Sequence

Labels map to manifest `label_workflows`:

```text
ai:plan    -> context_gate, mission, visionary, customer_perspective, discovery, connection, systems, planner
ai:build   -> context_gate, designer, builder
ai:review  -> context_gate, customer_perspective, workflow_tester, code_reviewer
ai:fix     -> context_gate, fixer
ai:growth  -> context_gate, discovery, connection, growth
ai:monitor -> context_gate, monitor
```

The orchestrator can reroute follow-up work by returning issue-ready tasks with one of those labels.

## Context Gate

The `context_gate` agent runs before label workflows. Its job is to prevent:

- stale context
- repository drift
- app goal bleeding
- forgotten principles
- agents operating from incomplete information

Every agent workflow must load:

- Global Principles
- Life Produces Life product doctrine
- App Charter
- Current Context
- Active Task

The Context Gate can return a go/no-go decision, missing context, boundary warnings, and a recommended next step.

## Adding A New Agent

1. Add the agent to `agents/manifest.yaml`.
2. Add its prompt under `agents/prompts/`.
3. Add or update shared context only if all agents should inherit it.
4. Add the agent to `label_workflows` or `recommended_flow` when it should run automatically.
5. Run `npm run source:check`.
6. Update docs when the workflow changes.

## Prompt Generation

`scripts/make-codex-prompt.js` reads:

- `agents/manifest.yaml`
- the selected agent prompt
- all manifest shared context files
- GitHub issue metadata
- repository context

It writes a Codex-ready prompt package without exposing secrets.

## GitHub Issues

ChatGPT can clarify an idea with Lincoln, then create or update a GitHub issue using one of the issue templates. The label on the issue is the trigger. This avoids relying on long chat memory and keeps the handoff visible to every assistant.
