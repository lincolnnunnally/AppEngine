# Agent Enforcement Rules

These rules apply to ChatGPT, Codex, GitHub Actions, future agents, and monitoring services.

## Before Acting

- Check GitHub source of truth.
- Load the manifest.
- Load shared context files from the manifest.
- Load Why We Build.
- Load Ecosystem Philosophy.
- Load App Purpose Rules.
- Load Ecosystem Design Gates.
- Load the app charter.
- Load the ChatGPT Handoff and Issue Creation Packet Standard when the task came from ChatGPT, a conversational summary, or a GitHub issue created from a chat handoff.
- Load the Intake Command Standard when the task begins as a natural language request, GitHub issue, ChatGPT handoff, or app command.
- Load the App Selection Standard before deciding whether work is a new app, existing app improvement, ambiguous request, or multi-app request.
- Load the End-to-End AppEngine Command Test Standard and First Real App Pilot Template when proving or running the handoff-to-packet pilot path.
- Load the App Build Packet when the task is a new app, major rebuild, generated-app foundation, or complex multi-phase feature.
- Load the Identity/Auth Standard when the task touches generated apps, app users, permissions, admin access, launch readiness, or deployment.
- Load the Super Admin Registry Standard when the task touches generated apps, app operations, launch readiness, monitoring, or deployment.
- Load the Operations, Cost, and Provider Strategy Standard when the task touches generated apps, provider choices, new resources, cost, storage, email, payments, AI/model usage, monitoring services, deployment, or launch readiness.
- Load the Deployment Environment Standard when the task touches generated apps, environment variables, preview URLs, production URLs, domains, logs, health checks, rollback, or deployment.
- Load the Design Intent Engine when the task touches generated app UI, visual direction, layout, forms, dashboards, navigation, mobile layout, design review, or visual polish.
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
- The task cannot answer what barrier it removes, what need it addresses, how it moves someone toward life, and how it helps someone become a source of life for others.
- A ChatGPT-created issue has no `chatgpt_handoff_packet` when it is supposed to represent a conversation handoff.
- A ChatGPT handoff packet or issue body includes secrets, private API keys, tokens, passwords, private credentials, or unnecessary private user data.
- A ChatGPT handoff recommends bypassing intake or using direct build, fix, review, release, provider provisioning, or production deployment before app selection.
- A natural language request has no `intake_packet` before planning, building, fixing, or improving an app.
- The app selection outcome is ambiguous, references "this app" without a durable source, or matches multiple apps without a documented integration reason.
- A pilot command path has no `pilot_app_build` artifact recording issue, handoff, intake, packet, follow-ups, PRs, release status, blockers, and next action.
- A pilot tries to deploy production, create paid resources, or merge generated app code without review.
- A new app request is being implemented before an App Build Packet exists.
- An existing app request is being implemented before a vNext packet exists.
- A new app or complex build is being treated as one giant Codex task instead of an App Build Packet with phased follow-up issues.
- A generated app has no Identity/Auth plan with provider, roles, memberships, permissions, protected routes, and production auth gates.
- A generated app has no Super Admin registry entry or planned entry with status, health, logs, admin, users, billing/status if needed, and admin actions.
- A generated app has no provider/cost review before provider provisioning, deployment environment approval, or release approval.
- Autonomous model/API work has no `cost_governance` artifact when it could consume meaningful credits.
- Cost governance says `pause` or `request_approval`, but the agent continues model-heavy work anyway.
- A task would create new paid Vercel, Render, database, storage, email, payment, AI, analytics, or monitoring resources without owner approval.
- A generated app has no Deployment Environment plan with frontend, backend if needed, database, env var inventory, preview/production URLs, custom domain/subdomain, logs, health checks, and rollback notes.
- A generated app UI task has no `design_intent_profile` capturing audience, user sophistication, desired emotional experience, brand personality, trust needs, accessibility needs, visual style preference, things to avoid, and output guidance.
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

Follow-up creation is dry-run by default. Real GitHub follow-up issue creation requires the explicit workflow mode `create` or the repository variable `APPENGINE_FOLLOW_UP_MODE=create`.

Every generated phase handoff must make its source-of-truth load list visible in the issue body. Include `source-of-truth/00-why-we-build.md`, `source-of-truth/01-ecosystem-philosophy.md`, `source-of-truth/02-global-principles.md`, `source-of-truth/03-life-produces-life.md`, `source-of-truth/04-app-purpose-rules.md`, `source-of-truth/05-ecosystem-design-gates.md`, the app charter, the current phase artifact when one exists, and phase-specific standards. This prevents later agents from depending on hidden prompt context or drifting away from the Life Produces Life doctrine.

## App Build Packets

Use an App Build Packet before building any generated app or complex app workflow. The packet must define the app charter, purpose, audience, barrier removed, need addressed, movement toward life, transformation outcome, boundaries, success definition, MVP stages, deployment target, Identity/Auth plan, Super Admin integration, Super Admin registry entry, provider/cost review, Cost Governance and Model Routing requirements, Deployment Environment plan, Design Intent profile, Design Quality Gate, UX Review, Compatibility Test Plan, Release Gate, and phase follow-up tasks. Do not collapse discovery, architecture, provider/cost, data model, identity/auth, UI/design, design intent, design quality, UX review, compatibility, build, testing, review, deployment environment, deployment, release gate, monitoring, and Super Admin registration into one task.

## ChatGPT Handoffs

Use a ChatGPT Handoff Packet when a conversation becomes a GitHub issue. The packet must record the raw conversation summary, raw request, selected app or new app slug, request type, intake confidence, missing context, recommended label, source-of-truth files to load, and issue-ready title/body.

ChatGPT handoff issues default to `ai:plan` so intake and app selection happen before any build, fix, review, release, provider provisioning, or production deployment work.

Do not include secrets or private credentials in handoff packets or issue bodies. Redact secret-like values as `[REDACTED_SECRET]` and record that redaction in the packet security notes.

## Intake and App Selection

Use an Intake Packet before converting plain-language requests into AppEngine workflow tasks. The packet must record the raw request, inferred app, request type, confidence, missing context, selected workflow, next issue labels, and guardrails.

Use the App Selection Standard before app work starts:

- New app requests route to an App Build Packet.
- Existing app requests route to a vNext Packet only after loading charter, Super Admin registry, current version, release history, monitoring state, known issues, and open issues.
- Ambiguous requests route to clarification.
- Multi-app requests are split into one scoped issue per app unless the task is explicitly a cross-app integration.

Do not let a natural request become implementation work until intake and app selection have selected the correct packet path.

## E2E Command Pilot

Use a `pilot_app_build` artifact to prove the first bounded AppEngine command flow. The artifact must record the source issue, ChatGPT handoff packet, intake packet, App Build Packet or vNext Packet, dry-run follow-up issues, PRs, release status, blockers, and next action.

The pilot is dry-run by default. It must not deploy production, create paid provider resources, or merge generated app code without review.

Live GitHub-triggered pilots must persist pilot JSON files under the durable `agent-run` artifact. Do not point issue comments at runner-local `/tmp` paths. Emit `follow-up-tasks.json` when the workflow should preview or create phase follow-up issues.

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
