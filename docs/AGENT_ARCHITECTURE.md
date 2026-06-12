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
source-of-truth/app-build-packet.md
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

## App Build Packets

New apps, generated-app foundations, major rebuilds, and complex app workflows must start with an App Build Packet before implementation. The packet keeps the work from becoming one giant Codex task.

The packet defines:

- app charter, purpose, audience, and boundaries
- success definition and MVP stages
- deployment target
- Super Admin integration requirements
- phased work plan
- app-goal bleed guardrails
- issue-ready follow-up tasks

Required packet phases:

```text
discovery
charter
architecture
data_model
ui_design
mvp_build
testing
review
deployment
monitoring
super_admin_registration
```

Generated apps must register or plan registration with the central AppEngine Super Admin dashboard for management, monitoring, health, logs, users, billing/status if needed, and admin actions.

Local packet verification:

```bash
npm run smoke:app-build-packet
```

## GitHub Trigger Path

The prompt factory workflow listens for `labeled`, `edited`, and `reopened` issue events. This matters because ChatGPT may create a GitHub issue with labels already attached, and the label event is the immediate trigger. Avoiding the separate `opened` trigger prevents duplicate runs for the same newly labeled issue.

The workflow sequence is:

1. Verify source of truth.
2. Select the primary agent from the manifest label workflow.
3. Write an `agent-run` artifact containing `orchestration-plan.json`.
4. Generate a manifest-backed Codex prompt.
5. Run Codex.
6. Store prompt, output, plan, and patch in the `agent-run` artifact, even if Codex fails before publishing.
7. Open a pull request if Codex changed files.
8. Comment the result on the source issue.
9. Comment the failure run link on the source issue if Codex exits nonzero.
10. Create follow-up GitHub issues when Codex returns structured `followUpTasks`.

## Orchestration Monitor

`.github/workflows/orchestration-monitor.yml` runs on a schedule and by manual dispatch. It checks open issues with `ai:*` labels and writes an orchestration monitor report artifact.

When comment mode is enabled, it adds a one-time marker comment to each open AI-labeled issue. This gives GitHub, ChatGPT, Codex, and future agents visible proof that AppEngine saw the issue without relying on Lincoln to relay status.

The monitor is configured by:

```text
monitor.config.yaml
```

The first version uses a scheduled GitHub Actions watchdog because it is simpler than webhooks and keeps the loop inside GitHub. It can later be expanded to a webhook or GitHub App model when AppEngine needs real-time behavior.

The monitor reports:

- open AI-labeled issues
- stale issues
- open pull requests
- stale pull requests
- recent failed workflow runs
- recently merged pull requests
- source-of-truth files changed in the latest commit

Guardrails:

- dry-run mode is available
- marker comments prevent duplicate monitor comments
- comment volume is capped per run
- no production deployment actions are taken
- issue creation remains explicit through structured follow-up tasks

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

`scripts/make-orchestration-plan.js` writes a machine-readable plan for the current run.

`scripts/create-follow-up-issues.js` turns structured agent `followUpTasks` into GitHub issues.

`scripts/create-app-build-packet.js` creates an App Build Packet and phase-ready follow-up tasks for new or complex app work.

`scripts/monitor-ai-issues.js` scans open AI-labeled issues and records a monitor report.

## GitHub Issues

ChatGPT can clarify an idea with Lincoln, then create or update a GitHub issue using one of the issue templates. The label on the issue is the trigger. This avoids relying on long chat memory and keeps the handoff visible to every assistant.
