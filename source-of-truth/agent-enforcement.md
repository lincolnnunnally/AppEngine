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
- Load the Operations, Cost, and Provider Strategy Standard when the task touches generated apps, provider choices, new resources, cost, storage, email, payments, AI/model usage, monitoring services, deployment, or launch readiness.
- Load the Deployment Environment Standard when the task touches generated apps, environment variables, preview URLs, production URLs, domains, logs, health checks, rollback, or deployment.
- Load the Design Quality Gate when the task touches generated apps, UX, UI, copy, mobile, accessibility, trust, admin screens, or release readiness.
- Load the UX Review Standard when the task touches generated apps, workflow testing, mobile testing, empty states, error states, onboarding, admin screens, or release readiness.
- Load the Compatibility Standard when the task touches generated apps, mobile readiness, Safari, Chrome, Edge, Firefox, viewports, touch targets, forms, auth flows, uploads, payments, admin screens, or release readiness.
- Load the Release Gate Standard when the task touches generated apps, preview, production approval, launch readiness, monitoring, v1, v2, or vNext work.
- Load the App Improvement and vNext Packet Standard when the task touches an existing app improvement, feature addition, bug fix, user feedback, monitoring response, or v2/vNext request.
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
- A generated app has no provider/cost review before provider provisioning, deployment environment approval, or release approval.
- A task would create new paid Vercel, Render, database, storage, email, payment, AI, analytics, or monitoring resources without owner approval.
- A generated app has no Deployment Environment plan with frontend, backend if needed, database, env var inventory, preview/production URLs, custom domain/subdomain, logs, health checks, and rollback notes.
- A generated app has no Design Quality Gate with Designer and Customer Perspective review before Release Gate approval.
- A generated app is technically working but ugly, confusing, unreadable, inaccessible, emotionally mismatched, or missing mobile, empty, error, onboarding, or admin states.
- A generated app has no Compatibility Test Plan covering Safari, mobile, common browsers, viewports, touch targets, forms, auth flows, uploads/payments if used, and admin screens.
- A generated app has unresolved Safari, mobile, touch-target, form, auth, upload, payment, admin, or common browser issues before release approval.
- A generated app has no Release Gate with preview deploy, production approval, post-launch monitoring, Super Admin status update, and v1/vNext rules.
- An existing app improvement is being planned as a brand-new app instead of a vNext packet.
- A vNext improvement does not load the existing app charter, current version, Super Admin registry, monitoring data, known issues, and release history.
- The task skips required Super Admin management, monitoring, health, logs, users, billing/status if needed, or admin-action planning for a generated app.
- The task imports goals from another app without a documented connection.
- The task depends only on chat memory and has no GitHub issue, doc, or repo file.

## Follow-Up Tasks

Agents should create or recommend GitHub issues when they find missing context, cross-app opportunities, recurring failures, growth opportunities, or app charter conflicts.

When structured `followUpTasks` are present in agent output, AppEngine may create GitHub issues automatically with one of the supported `ai:*` labels.

## App Build Packets

Use an App Build Packet before building any generated app or complex app workflow. The packet must define the app charter, audience, boundaries, success definition, MVP stages, deployment target, Identity/Auth plan, Super Admin integration, Super Admin registry entry, provider/cost review, Deployment Environment plan, Design Quality Gate, UX Review, Compatibility Test Plan, Release Gate, and phase follow-up tasks. Do not collapse discovery, architecture, provider/cost, data model, identity/auth, UI/design, design quality, UX review, compatibility, build, testing, review, deployment environment, deployment, release gate, monitoring, and Super Admin registration into one task.

## App Improvements

Use a vNext packet before improving an existing app. The packet must load the existing app charter, current version, Super Admin registry entry, monitoring data, known issues, release history, active request, provider/cost delta, design/review/build/test path, release gate, and monitoring update. Do not restart the whole app or import another app's goals unless the vNext packet explicitly approves that boundary change.

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
