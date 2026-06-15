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
source-of-truth/00-why-we-build.md
source-of-truth/01-ecosystem-philosophy.md
source-of-truth/02-global-principles.md
source-of-truth/03-life-produces-life.md
source-of-truth/04-app-purpose-rules.md
source-of-truth/05-ecosystem-design-gates.md
source-of-truth/context-checklist.md
source-of-truth/agent-enforcement.md
source-of-truth/chatgpt-handoff-issue-standard.md
source-of-truth/intake-command-standard.md
source-of-truth/app-selection-standard.md
source-of-truth/end-to-end-command-test-standard.md
source-of-truth/pilot-app-build-template.md
source-of-truth/app-build-packet.md
source-of-truth/identity-auth-standard.md
source-of-truth/super-admin-registry.md
source-of-truth/operations-cost-provider-strategy.md
source-of-truth/cost-governance-model-routing.md
source-of-truth/deployment-environment-standard.md
source-of-truth/design-quality-gate.md
source-of-truth/ux-review-standard.md
source-of-truth/compatibility-standard.md
source-of-truth/release-gate-standard.md
source-of-truth/app-improvement-vnext-packet.md
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

## ChatGPT Handoff

ChatGPT should create a structured GitHub issue when Lincoln says "start AppEngine build," "build this," or "improve this app." The issue contains a `chatgpt_handoff_packet` artifact and a machine-readable JSON block that intake can route without guessing from prose.

The handoff path is:

```text
Lincoln conversation
-> ChatGPT handoff packet
-> GitHub issue
-> intake packet
-> selected workflow
-> agent loop
```

The packet records raw conversation summary, raw request, selected app or new app slug, request type, intake confidence, missing context, recommended label, and source-of-truth files to load. Handoff issues default to `ai:plan`, even for fixes and releases, so Context Gate and intake run before any build or release work.

Local handoff verification:

```bash
npm run smoke:chatgpt-handoff
```

## Intake and App Selection

Natural language requests enter AppEngine through an intake packet before planning or building. This lets Lincoln, ChatGPT, GitHub issues, and future agents say things like:

```text
build this app
start AppEngine build
improve Spark of Hope
add this feature to Toner Management
```

The intake path is:

```text
ChatGPT handoff issue or natural request
-> intake_packet
-> app selection
-> App Build Packet or vNext Packet
-> agent loop
```

The `intake_packet` artifact records raw request, inferred app, request type, confidence, missing context, selected workflow, next labels, and guardrails.

Routing rules:

- New app requests create an App Build Packet before implementation.
- Existing app requests create a vNext Packet only after loading charter, Super Admin registry, current version, release history, monitoring state, known issues, and open issues.
- Ambiguous app names pause for clarification.
- Multi-app requests split into one scoped issue per app unless the task is explicitly cross-app integration work.

Local intake verification:

```bash
npm run smoke:intake
```

## E2E Command Pilot

The first true "use the machine" step is a dry-run command that proves the AppEngine path from conversation to follow-up issues:

```text
ChatGPT conversation
-> ChatGPT handoff issue
-> intake packet
-> selected workflow
-> App Build Packet
-> dry-run follow-up issues
-> pilot_app_build artifact
```

Run it locally with:

```bash
npm run pilot:e2e
npm run smoke:e2e-pilot
```

The first pilot template is `Spark of Hope Intake Lite`, a small bounded app build packet. It is not a production deployment and does not merge generated app code. The pilot records issue body, handoff packet, intake packet, App Build Packet, dry-run follow-up issues, PRs, release status, blockers, next action, and guardrails in a `pilot_app_build` artifact.

In GitHub Actions, pilot evidence must be durable. The pilot command writes JSON files under `agent-run/pilot/`, `scripts/persist-agent-run-artifacts.js` writes `agent-run/artifact-summary.md` and `agent-run/follow-up-tasks.json`, and the workflow uploads the `agent-run` artifact. Issue comments should point to that GitHub Actions artifact rather than runner-local `/tmp` paths.

Follow-up issue creation is safe by default:

- `dry-run`: write follow-up previews and comment with the output.
- `create`: create real GitHub follow-up issues and dispatch bounded next workflows when `APPENGINE_FOLLOW_UP_MODE=create`.

Pilot guardrails:

- dry-run only by default
- no production deploy
- no paid provider resources
- no generated app code merge without review
- no secrets in artifacts or issues

## App Build Packets

New apps, generated-app foundations, major rebuilds, and complex app workflows must start with an App Build Packet before implementation. The packet keeps the work from becoming one giant Codex task.

The packet defines:

- app charter, purpose, audience, and boundaries
- success definition and MVP stages
- deployment target
- Identity/Auth plan
- Super Admin integration requirements
- Super Admin registry entry
- Provider/Cost review
- Deployment Environment plan
- Design Quality Gate plan
- UX Review plan
- Compatibility Test Plan
- Release Gate plan
- phased work plan
- app-goal bleed guardrails
- issue-ready follow-up tasks

Required packet phases:

```text
discovery
charter
architecture
provider_cost
data_model
identity_auth
ui_design
design_quality
ux_review
compatibility
mvp_build
testing
review
deployment_environment
deployment
release_gate
monitoring
super_admin_registration
```

Generated apps must register or plan registration with the central AppEngine Super Admin dashboard for management, monitoring, health, logs, users, billing/status if needed, and admin actions.

Generated apps must also define an Identity/Auth plan before build work begins. The required plan covers provider, sessions, identity objects, memberships, roles, permissions, protected routes, local setup behavior, and production auth gates.

Super Admin registry entries must declare the app lifecycle status, owner, repo, deployment, health, logs, admin path, user-management status, billing/status if needed, and allowed admin actions.

Provider/Cost reviews must declare provider reuse, preview cost posture, production cost posture, cost ceiling or owner-defined cap, upgrade trigger, and whether new paid resources are approved. They block provider provisioning and release approval when cost ownership is unclear.

Cost Governance reviews model/API credit usage separately from provider costs. The `cost_governance` artifact tracks monthly, project, app, and issue spend, classifies tasks as cheap, medium, or expensive, applies warning/pause/owner-approval thresholds, and lets Build Completion pause or request approval before consuming more credits.

Deployment Environment plans must declare Vercel frontend settings, Render/API backend settings when needed, database provider, environment variable names without values, preview URL, production URL or approval gate, custom domain/subdomain, logs, health checks, and rollback notes.

Design Quality Gates require Designer and Customer Perspective review before Release Gate approval. The `design_review` artifact checks simple navigation, one clear primary action, mobile-first layout, readable copy, accessible spacing and contrast, trust-building elements, audience-specific emotional fit, empty states, error states, onboarding, and admin screens.

Compatibility Test Plans require mobile-first responsive checks and common platform coverage before Release Gate approval. The `compatibility_test_plan` artifact checks iPhone/iPad Safari, desktop Safari, Chrome mobile/desktop, Edge, Firefox where practical, common viewports, touch targets, forms, auth flows, file uploads if used, payments if used, admin screens, and Super Admin status.

Release Gates move apps out of endless build mode. The first public MVP launch is `v1`; later improvements become `vNext`, `v2`, or focused follow-up issues. Production requires preview evidence, owner approval, rollback notes, post-launch monitoring, and Super Admin status update.

Existing apps use vNext packets for improvements. A vNext packet loads the existing charter, current version, Super Admin registry entry, monitoring data, known issues, release history, and active request before planning changes. It prevents improvements from restarting the whole app or bleeding goals from other apps.

Local packet verification:

```bash
npm run smoke:app-build-packet
```

Local identity/registry verification:

```bash
npm run smoke:identity-registry
```

Local provider/cost and improvement verification:

```bash
npm run smoke:provider-cost
npm run smoke:cost-governance
npm run smoke:vnext-packet
```

Local deployment/release verification:

```bash
npm run smoke:design-quality
npm run smoke:compatibility
npm run smoke:release-gate
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
- App Build Packet when the work is a generated app, major rebuild, or complex multi-phase workflow
- Identity/Auth, Super Admin Registry, Provider/Cost, Deployment Environment, Design Quality Gate, UX Review, Compatibility, and Release Gate standards when the work moves toward launch
- App Improvement and vNext Packet standard when the work improves an existing app
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

`scripts/create-chatgpt-handoff-packet.js` creates a `chatgpt_handoff_packet`, issue-ready title/body, and machine-readable handoff JSON for ChatGPT-to-GitHub triggers.

`source-of-truth/problem-to-solution-intake-standard.md` defines the planning-only intake layer for problem-first, vision-first, and hybrid starts before AppEngine assumes the answer is an app or implementation task.

`scripts/create-problem-portfolio-routing.js` turns a `problem_solution_intake` artifact into a portfolio-tracked solution candidate, using `app_portfolio_registry` as the destination/tracking artifact and recording required review gates before any packet or build work.

`scripts/create-intake-packet.js` creates an intake packet and routes natural language requests to App Build Packet, vNext Packet, or clarification follow-ups.

`scripts/run-e2e-command-pilot.js` runs the dry-run command pilot from ChatGPT handoff to intake, App Build Packet, follow-up issue dry run, and `pilot_app_build` artifact.

`scripts/persist-agent-run-artifacts.js` turns pilot output into durable `agent-run` summaries and structured `follow-up-tasks.json` for preview or optional GitHub issue creation.

`scripts/create-app-build-packet.js` creates an App Build Packet and phase-ready follow-up tasks for new or complex app work.

`scripts/create-identity-registry-standard.js` creates an Identity/Auth plan, Super Admin registry entry, and focused follow-up tasks.

`scripts/create-app-portfolio-registry-standard.js` creates an App Portfolio Registry artifact, owner-readable portfolio markdown, and focused follow-up tasks for missing app state, URLs, source files, issues, or pull requests.

`scripts/create-provider-cost-standard.js` creates a provider/cost review and focused provider approval follow-up tasks.

`scripts/create-cost-governance-standard.js` creates a model/API cost governance artifact, budget threshold decision, model routing recommendation, and budget follow-up tasks.

`scripts/create-release-gate-standard.js` creates a Deployment Environment plan, Release Gate, and focused preview/release/monitor follow-up tasks.

`scripts/create-design-quality-standard.js` creates a Design Quality Gate, UX Review, `design_review` artifact, and focused design follow-up tasks.

`scripts/create-compatibility-standard.js` creates a Compatibility Test Plan, `compatibility_test_plan` artifact, and focused browser/mobile follow-up tasks.

`scripts/create-vnext-packet.js` creates a vNext packet and phased follow-up tasks for improving existing apps.

`scripts/monitor-ai-issues.js` scans open AI-labeled issues and records a monitor report.

## GitHub Issues

ChatGPT can clarify an idea with Lincoln, then create or update a GitHub issue using one of the issue templates. The label on the issue is the trigger. This avoids relying on long chat memory and keeps the handoff visible to every assistant.
