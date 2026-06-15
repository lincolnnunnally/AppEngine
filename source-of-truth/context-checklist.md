# Context Checklist

All agent workflows must load and answer this checklist before taking action.

## Required Inputs

- Global Principles
- Why We Build
- Ecosystem Philosophy
- Life Produces Life product doctrine
- App Purpose Rules
- Ecosystem Design Gates
- App Charter
- ChatGPT Handoff and Issue Creation Packet Standard for conversation-to-GitHub handoffs
- Problem-To-Solution Intake Standard for problem-first, vision-first, and hybrid starts
- Problem Intake To Portfolio Routing Standard for accepted problem/vision candidates before packets or implementation
- Solution Candidate Review Gate before candidate packet or plan requests
- Intake Command Standard for natural language requests, GitHub issue creation, and agent workflow routing
- App Selection Standard for new-app vs existing-app disambiguation
- End-to-End AppEngine Command Test Standard for command-path proof and pilot dry runs
- First Real App Pilot Template when the task touches the bounded pilot build
- App Build Packet for new apps, major rebuilds, or complex multi-phase work
- Identity/Auth Standard for generated apps, major rebuilds, and launch work
- Super Admin Registry Standard for generated apps, major rebuilds, and launch work
- App Portfolio Registry Standard for portfolio-wide app state, URLs, versions, issues, pull requests, and next safe actions
- Operations, Cost, and Provider Strategy Standard for generated apps, provider provisioning, cost review, deployment environments, and launch work
- Cost Governance and Model Routing Standard for model/API credit spend, task classification, thresholds, and owner approval
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
6. What barrier does this remove?
7. What need does this address?
8. How does this help someone move toward life?
9. How does this help someone become a source of life for others?
10. If this came from ChatGPT, does a `chatgpt_handoff_packet` exist with raw conversation summary, raw request, selected app or new app slug, request type, intake confidence, missing context, recommended label, and source-of-truth files to load?
11. Does the ChatGPT handoff issue avoid secrets, API keys, tokens, passwords, private credentials, and unnecessary private user data?
12. If this starts from a problem, vision, or hybrid of both, does a `problem_solution_intake` artifact classify the mode, questions, solution shape, missing context, routing, and next safe action before build work?
13. If the problem/vision is accepted as a candidate, does `problem_portfolio_routing` map it into `app_portfolio_registry` before any App Build Packet or vNext Packet is created?
14. Does the selected candidate type avoid forcing every problem into an app when a website, workflow/process, automation, content/resource, community/ministry model, or multi-part ecosystem solution is more fitting?
15. Are required review gates listed and blocking packet creation until owner/source-of-truth/problem clarity/security/cost/boundary checks pass?
16. If a portfolio candidate may proceed, does `solution_candidate_review` record readiness status, blockers, missing context, next safe action, and owner-readable review output?
17. Does solution candidate review cover problem clarity, intended transformation, audience/user, solution shape, data/security/privacy, cost/provider impact, build complexity, app/ecosystem fit, and owner approval requirements?
18. Does solution candidate review prevent packet creation when readiness is `needs_clarification`, `blocked_by_security`, `blocked_by_cost`, or `blocked_by_scope`?
19. If this came from a natural language request, does an `intake_packet` exist with raw request, inferred app, request type, confidence, missing context, selected workflow, and next labels?
20. Has app selection identified exactly one outcome: new app, existing app, ambiguous request, or multi-app request?
21. If this is a command-path proof or pilot, does a `pilot_app_build` artifact record issue, handoff, intake, packet, dry-run follow-ups, PRs, release status, blockers, and next action?
22. If this is a live GitHub pilot, are pilot JSON artifacts and structured follow-up task JSON persisted under `agent-run` instead of runner-local `/tmp` paths?
23. Does the pilot block production deployment, paid provider creation, and generated app code merge without review?
24. Is this a new app or complex build that needs an App Build Packet before implementation?
25. If an App Build Packet exists, does the active task stay inside its current phase?
26. Does the app have an Identity/Auth plan with provider, roles, memberships, permissions, protected routes, and production auth gates?
27. Does the app have a Super Admin registry entry or planned entry with status, health, logs, admin, users, billing/status if needed, and allowed admin actions?
28. Does the portfolio registry know this app's name, slug, review URL, production URL, current version, deployment state, build state, next safe action, source files, linked issues, and linked PRs?
29. Does the app have provider/cost review with reuse strategy, preview/production cost posture, cost ceiling, upgrade trigger, and owner approval before new paid resources?
30. Does the active agent run have cost governance with monthly/project/app/issue spend, remaining budget, task class, thresholds, and budget-aware next action when model/API credits may be consumed?
31. Does cost governance say to continue, continue with a cheaper model, pause, or request owner approval?
32. Does the app have a Deployment Environment plan with frontend, backend if needed, database, env var inventory, preview/production URLs, custom domain, logs, health, and rollback notes?
33. Does the app have a Design Quality Gate covering navigation, primary action, mobile, copy, spacing, contrast, trust, emotional fit, empty states, error states, onboarding, and admin screens?
34. Does the app have Designer and Customer Perspective review before Release Gate approval?
35. Does the app have a Compatibility Test Plan covering iPhone/iPad Safari, desktop Safari, Chrome mobile/desktop, common desktop browsers, viewports, touch targets, forms, auth flows, uploads/payments if used, and admin screens?
36. Does the app have a Release Gate with v1/vNext rules, preview deploy contract, production approval, post-launch monitoring, and Super Admin status update?
37. If this is an existing app improvement, is there a vNext packet that loaded charter, current version, registry, monitoring data, known issues, and release history?
38. Are any core files, docs, prompts, context, or issue links missing?
39. Should the agent proceed, pause, ask for clarification, or create a follow-up issue?

## Output

The Context Gate must produce:

- Go / No-Go decision
- Missing context
- Boundary warnings
- Required source files read
- Recommended next step
