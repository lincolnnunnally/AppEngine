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
ai:plan    -> mission, visionary, customer_perspective, discovery, connection, systems, planner
ai:build   -> designer, builder
ai:review  -> customer_perspective, workflow_tester, code_reviewer
ai:fix     -> fixer
ai:growth  -> discovery, connection, growth
ai:monitor -> monitor
```

The orchestrator can reroute follow-up work by returning issue-ready tasks with one of those labels.

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
