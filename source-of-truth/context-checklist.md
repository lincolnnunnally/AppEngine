# Context Checklist

All agent workflows must load and answer this checklist before taking action.

## Required Inputs

- Global Principles
- Life Produces Life product doctrine
- App Charter
- ChatGPT Handoff and Issue Creation Packet Standard for conversation-to-GitHub handoffs
- Intake Command Standard for natural language requests, GitHub issue creation, and agent workflow routing
- App Selection Standard for new-app vs existing-app disambiguation
- End-to-End AppEngine Command Test Standard for command-path proof and pilot dry runs
- First Real App Pilot Template when the task touches the bounded pilot build
- App Build Packet for new apps, major rebuilds, or complex multi-phase work
- Identity/Auth Standard for generated apps, major rebuilds, and launch work
- Super Admin Registry Standard for generated apps, major rebuilds, and launch work
- Operations, Cost, and Provider Strategy Standard for generated apps, provider provisioning, cost review, deployment environments, and launch work
- Deployment Environment Standard for generated apps, major rebuilds, preview deploys, and launch work
- Design Quality Gate for generated apps, major rebuilds, and launch work
- UX Review Standard for generated apps, user workflow testing, mobile testing, and launch work
- Compatibility Standard for generated apps, Safari/mobile readiness, common browser testing, and launch work
- Release Gate Standard for generated apps, preview deploys, production approval, monitoring, and vNext work
- App Improvement and vNext Packet Standard for existing app improvements, feature additions, fixes, user feedback, and v2 work
- Current Context from GitHub issue, pull request, docs, or committed source
- Active Task and triggering label
- Relevant manifest agent prompt
- Current GitHub source-of-truth state

## Required Checks

1. Is the local workspace aligned with live GitHub source?
2. Does the task belong to this app or should it be routed elsewhere?
3. Does the task preserve the app's charter, audience, boundaries, and success definition?
4. Does the task preserve the Life Produces Life doctrine?
5. Does the task risk app-goal bleeding between unrelated apps?
6. If this came from ChatGPT, does a `chatgpt_handoff_packet` exist with raw conversation summary, raw request, selected app or new app slug, request type, intake confidence, missing context, recommended label, and source-of-truth files to load?
7. Does the ChatGPT handoff issue avoid secrets, API keys, tokens, passwords, private credentials, and unnecessary private user data?
8. If this came from a natural language request, does an `intake_packet` exist with raw request, inferred app, request type, confidence, missing context, selected workflow, and next labels?
9. Has app selection identified exactly one outcome: new app, existing app, ambiguous request, or multi-app request?
10. If this is a command-path proof or pilot, does a `pilot_app_build` artifact record issue, handoff, intake, packet, dry-run follow-ups, PRs, release status, blockers, and next action?
11. If this is a live GitHub pilot, are pilot JSON artifacts and structured follow-up task JSON persisted under `agent-run` instead of runner-local `/tmp` paths?
12. Does the pilot block production deployment, paid provider creation, and generated app code merge without review?
13. Is this a new app or complex build that needs an App Build Packet before implementation?
14. If an App Build Packet exists, does the active task stay inside its current phase?
15. Does the app have an Identity/Auth plan with provider, roles, memberships, permissions, protected routes, and production auth gates?
16. Does the app have a Super Admin registry entry or planned entry with status, health, logs, admin, users, billing/status if needed, and allowed admin actions?
17. Does the app have provider/cost review with reuse strategy, preview/production cost posture, cost ceiling, upgrade trigger, and owner approval before new paid resources?
18. Does the app have a Deployment Environment plan with frontend, backend if needed, database, env var inventory, preview/production URLs, custom domain, logs, health, and rollback notes?
19. Does the app have a Design Quality Gate covering navigation, primary action, mobile, copy, spacing, contrast, trust, emotional fit, empty states, error states, onboarding, and admin screens?
20. Does the app have Designer and Customer Perspective review before Release Gate approval?
21. Does the app have a Compatibility Test Plan covering iPhone/iPad Safari, desktop Safari, Chrome mobile/desktop, common desktop browsers, viewports, touch targets, forms, auth flows, uploads/payments if used, and admin screens?
22. Does the app have a Release Gate with v1/vNext rules, preview deploy contract, production approval, post-launch monitoring, and Super Admin status update?
23. If this is an existing app improvement, is there a vNext packet that loaded charter, current version, registry, monitoring data, known issues, and release history?
24. Are any core files, docs, prompts, context, or issue links missing?
25. Should the agent proceed, pause, ask for clarification, or create a follow-up issue?

## Output

The Context Gate must produce:

- Go / No-Go decision
- Missing context
- Boundary warnings
- Required source files read
- Recommended next step
