# Agent Enforcement Rules

These rules apply to ChatGPT, Codex, GitHub Actions, future agents, and monitoring services.

## Before Acting

- Check GitHub source of truth.
- Load the manifest.
- Load shared context files from the manifest.
- Load the app charter.
- Load the App Build Packet when the task is a new app, major rebuild, generated-app foundation, or complex multi-phase feature.
- Load the Identity/Auth Standard when the task touches generated apps, app users, permissions, admin access, launch readiness, or deployment.
- Load the Super Admin Registry Standard when the task touches generated apps, app operations, launch readiness, monitoring, or deployment.
- Load the issue, pull request, or active task.
- Run the Context Gate.

## Stop Conditions

Stop and reconcile before editing when:

- ChatGPT, Codex, local files, and GitHub disagree.
- The local branch is stale.
- The agent cannot find the referenced source-of-truth files.
- The task contradicts the app charter.
- A new app or complex build is being treated as one giant Codex task instead of an App Build Packet with phased follow-up issues.
- A generated app has no Identity/Auth plan with provider, roles, memberships, permissions, protected routes, and production auth gates.
- A generated app has no Super Admin registry entry or planned entry with status, health, logs, admin, users, billing/status if needed, and admin actions.
- The task skips required Super Admin management, monitoring, health, logs, users, billing/status if needed, or admin-action planning for a generated app.
- The task imports goals from another app without a documented connection.
- The task depends only on chat memory and has no GitHub issue, doc, or repo file.

## Follow-Up Tasks

Agents should create or recommend GitHub issues when they find missing context, cross-app opportunities, recurring failures, growth opportunities, or app charter conflicts.

When structured `followUpTasks` are present in agent output, AppEngine may create GitHub issues automatically with one of the supported `ai:*` labels.

## App Build Packets

Use an App Build Packet before building any generated app or complex app workflow. The packet must define the app charter, audience, boundaries, success definition, MVP stages, deployment target, Identity/Auth plan, Super Admin integration, Super Admin registry entry, and phase follow-up tasks. Do not collapse discovery, architecture, data model, identity/auth, UI/design, build, testing, review, deployment, monitoring, and Super Admin registration into one task.

## Monitoring

The orchestration monitor checks open AI-labeled GitHub issues on a schedule. Its job is to make sure GitHub remains the handoff hub and Lincoln does not have to manually ask whether ChatGPT, Codex, or future agents noticed the work.

The first monitor implementation is a GitHub Actions watchdog. It should stay narrow:

- detect open AI issues
- detect stale issues and PRs
- detect failed workflow runs
- detect recently merged PRs
- detect source-of-truth changes
- write reports and one-time marker comments

Do not add production-impacting monitor actions without a new chartered design and approval step.
