# AppEngine Loop System

Source of truth for how AppEngine turns ideas into working apps through manual, reviewable loops.
Read this after `agents/context/source-of-truth.md` and before starting loop-driven work. If this doc is wrong, fix the doc first, date the change, then proceed.

## Purpose

AppEngine turns ideas into working apps through repeatable loops, not one-time prompts.
A loop keeps running until the work meets a pre-agreed definition of done, then it stops.
This reduces rework, drift, and repeated conversations because the loop records the goal, acceptance criteria, current status, and work already done.

## What AppEngine Owns

AppEngine owns:

- The loop.
- The source of truth: this doc, `agents/manifest.yaml`, shared context files, and loop run records.
- The acceptance criteria.
- Decision gates.
- Handoffs between tools.
- The memory of what has already been done.

AppEngine does not replace GitHub, Codex, Claude Code, ChatGPT, Vercel, Supabase, Neon, Render, or CI/CD.
Those are workers and infrastructure the loop can call later. AppEngine is the conductor, not the orchestra.

## Roles

| Player | Job in the loop |
| --- | --- |
| Claude Code | Orchestration hub and build/debug worker during the current manual phase. |
| Codex | Coding worker inside the loop. |
| ChatGPT | Vision, requirements, and review against the goal. |
| This doc and run records | Source of truth every player reads first. |
| GitHub | Durable branch, issue, pull request, and review surface. |

## Primary Loop

```text
Idea Intake
  -> Clarify problem and who it is for
  -> Prior-Work Check against the target repo (blocking)
       blocked_cannot_verify -> stop, make the repo visible, rerun
       extend_existing       -> extend the named surfaces, do not rebuild
       build_new             -> proceed to a new build
  -> Define acceptance criteria before building
  -> Generate requirements
  -> Create task plan
  -> Build
  -> Run tests and checks
  -> Review against acceptance criteria
  -> Pass?
      yes -> Deploy or stop at owner-approved release gate
      no  -> Create fix list -> Build again, cycle_count + 1
```

## Exit Condition

1. Acceptance criteria are defined at intake, before any building. They must be specific and testable.
2. The loop exits only when those criteria pass through evidence, not vibes.
3. Circuit breaker: max 3 build -> test -> review cycles per run. If a run has not passed after 3 cycles, it stops and escalates to human review.

## Task Status Model

```text
idea -> scoped -> ready_to_build -> building -> testing -> needs_fix -> ready_to_deploy -> deployed -> improving
```

Side states:

```text
blocked
escalated
```

For intake-only records, the saved status should start as `scoped` once the problem, target user, and acceptance criteria are captured.

## Loop Run Record

Every cycle writes a record so the system remembers:

- `run_id`
- `goal`
- `acceptance_criteria`
- `agent_assigned`
- `work_completed`
- `tests_run` and results
- `issues_found`
- `cycle_count`
- `next_action`
- `decision_made`

Use `loop-runs/RUN_RECORD_TEMPLATE.md` for manual records.

## Rules

1. No agent starts work without reading the source of truth.
2. No task is complete until it passes review against its acceptance criteria.
3. No repeated discussion unless the source of truth is outdated. If it is outdated, update it, date it, and continue.
4. Max 3 build -> test -> review cycles per run, then escalate to a human.
5. The source of truth wins over chat history and over any agent memory.
6. Do not build automation until at least one manual loop has passed with a real run record.
7. Run the Prior-Work Check before defining acceptance criteria for a build. It is blocking: extend existing surfaces when prior work is found, and never assume "nothing exists" when the target repo cannot be read. See `source-of-truth/prior-work-check-gate.md`.

## App Output Conventions

When AppEngine owns or migrates an app build, the app repo should use an `appengine/<app-slug>-<purpose>` branch.

Each AppEngine-managed app should keep these app-level documents:

- `PRODUCT_SOURCE_OF_TRUTH.md`: goal, problem, target customer, philosophy, customer-facing solution, and decision boundaries.
- `LAUNCH_RUNBOOK.md`: deployment, provider setup, environment variables, DNS, migration order, and verification.
- `BUILD_LOG.md`: dated build history, changes made, tests run, and evidence.

These are not interchangeable. The source of truth says why and what. The runbook says how to operate and launch. The build log says what happened.

## Where This Lives

Now:

- `APPENGINE_LOOP_SYSTEM.md` is the loop doctrine.
- `loop-runs/` contains manual run records and templates.
- Git history is the audit trail.

Later:

- Move run records into a dedicated `appengine` database schema only after the manual version is boringly reliable.
- Add a thin router script only after manual records prove the status model, acceptance criteria, and circuit breaker.
- Add event-triggered automation only after the router script proves safe routing.

## Automation Boundary

A markdown file does not execute itself. It is the recipe card, not the cook.
Today the loop manager is Claude Code, Codex, ChatGPT, and Lincoln reading this doc and enforcing the gates manually.

Autonomy comes in stages:

1. Docs and discipline: players follow this file by hand.
2. Thin router script: reads the latest run record and routes the next action.
3. Event-triggered automation: cycles kick off on commits, tests, or review results.

Do not skip stage 1.

## Existing Repo Reconciliation

This doc does not replace the existing AppEngine source-of-truth protocol, App Build Packets, Build Completion Orchestrator, Handoff Relay, or Owner Control Center.
It wraps those pieces in a simpler operating loop with acceptance criteria and a circuit breaker.

Checked on 2026-06-21:

- Issue #139 is open and asks AppEngine builder workflows to create pull requests automatically after file changes. That belongs to a later automation phase and must be resolved before any workflow claims reliable auto-PR creation.
- PRs #155 through #160 are merged and intentionally prove owner-controlled internal use, first ecosystem request, packet draft, build execution connector, handoff export, and builder result intake without Codex auto-execution, GitHub issue creation, label changes, deploys, paid resources, migrations, secrets, or auto-merge.
- Therefore, the current loop system remains manual. It may save local run records and prepare owner-visible handoffs, but it must not create issues, labels, pull requests, deploys, migrations, paid resources, or automatic Codex runs until a later approved phase.

## First Manual Proof

The first manual proof is:

```text
Create a tiny internal AppEngine intake page.
```

Acceptance criteria:

- User can enter app idea.
- User can define problem being solved.
- User can define target user.
- User can enter acceptance criteria.
- System saves a loop run record.
- Status starts as scoped after intake.

The proof record lives in `loop-runs/2026-06-21-internal-appengine-intake-page-cycle-1.md`.

Last updated: 2026-06-30, v1.1.
