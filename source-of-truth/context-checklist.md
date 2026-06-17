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
- Handoff Relay Reducer when owner-facing relay, pasted Codex handoffs, next prompt drafting, or middleman-work reduction is involved
- Project Memory Engine when project history, decisions, lessons, blockers, current state, or owner memory feedback is involved
- Real Project Trial Runner when a real project/app candidate is selected to prove the usable pipeline without automatic execution
- Trial Result Review Loop when Lincoln reviews a real project trial result or turns trial feedback into improvement candidates
- Manual Orchestrator Run Button when AppEngine selects the next safe action from owner-visible state
- Pending Check Resolution Policy when a pull request has stale/pending external status checks after required verification passes
- ChatGPT Handoff and Issue Creation Packet Standard for conversation-to-GitHub handoffs
- Opportunity Intake Foundation when customer-facing problem/opportunity intake, public front-door routing, or ecosystem-destination framing is involved
- Opportunity Clarification Engine when an `opportunity_intake` needs to become a clarified owner-reviewable opportunity profile before problem-to-solution routing
- Problem-To-Solution Intake Standard for problem-first, vision-first, and hybrid starts
- Problem Intake To Portfolio Routing Standard for accepted problem/vision candidates before packets or implementation
- Solution Candidate Review Gate before candidate packet or plan requests
- Candidate To Packet Bridge before final packet creation or phase expansion
- Packet Draft Approval Gate before draft packets become final packets or plans
- Final Packet Materialization before phase creation or implementation
- Phase Creation Approval Gate before phase issue generation or executable phase work
- Phase Issue Generation before GitHub phase issue creation or executable phase work
- Phase Issue Publish Approval Gate before real GitHub phase issue publication
- Phase Issue Publisher Dry Run before real GitHub issue creation
- Phase Issue Publisher Manual Mode before any owner-approved real GitHub issue creation
- Published Phase Issue Registry after manually published phase issues are created
- Phase Start Approval Gate before any published phase issue receives an execution label
- Execution Label Dry Run before any real label mutation
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
- Design Intent Engine before generated-app UI design, UI build, UI review, or visual polish
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
- If this came from a pasted Codex handoff, does a `handoff_relay_summary` exist with PR/branch/status, verification, completed work, guardrails, risks, blockers, dependencies, current project state, and a draft next prompt for owner review only?
- If this updates project memory, does a `project_memory` artifact record decisions, progress, blockers, open questions, lessons, summaries, and next safe action without triggering Codex, GitHub issues, labels, deploys, migrations, paid resources, secrets/env changes, or auto-merge?
- If this is a real project trial, does a `real_project_trial` artifact identify project, problem, audience, transformation, design intent, current stage, next safe action, risks/blockers, recommended packet type, source artifact inputs, and a copyable next prompt without triggering Codex, GitHub issues, labels, deploys, migrations, paid resources, secrets/env changes, or auto-merge?
- If this reviews a trial result, does a `trial_result_review` artifact record review status, owner note, useful signals, concerns, improvement candidate, Project Memory update, and a copyable next prompt without triggering Codex, GitHub issues, labels, deploys, migrations, paid resources, secrets/env changes, or auto-merge?
- If this runs the manual orchestrator, does an `orchestrator_run` artifact read project memory, handoffs, real project trials, design intent, and portfolio context; record a decision trace; queue the recommended next safe action locally/mock; explain why; update Project Memory; and generate a copyable prompt without triggering Codex, GitHub issues, labels, deploys, migrations, paid resources, secrets/env changes, repository visibility changes, or auto-merge?
- If this runs the orchestrator batch dry run, does an `orchestrator_batch_dry_run` artifact select no more than three queued actions, prepare handoff drafts only, mark `dryRunOnly: true`, explain skipped actions, and preserve false execution values for Codex, GitHub issues, labels, production deploys, paid resources, migrations, secrets/env changes, repo visibility changes, and auto-merge?
- If this prepares batch dry-run handoffs, does an `orchestrator_batch_handoff_prepare` artifact convert at most three still-queued actions into Handoff Inbox entries, update action statuses to `prepared_handoff`, update Project Memory, skip unsafe/stale actions honestly, and preserve false execution values for Codex, GitHub issues, labels, production deploys, paid resources, migrations, secrets/env changes, repo visibility changes, and auto-merge?
- If this exports a prepared handoff, does an `orchestrator_approved_handoff_export` artifact record owner approval, exact Codex-ready prompt, required verification, expected result, Project Memory update, and explicit false execution values for Codex, GitHub issues, labels, production deploys, paid resources, migrations, secrets/env changes, repo visibility changes, and auto-merge?
- If this prepares an orchestrator result for relay, does the Orchestrator to Handoff Bridge save a `handoff_relay_summary` with source `orchestrator_prepared_handoff`, include current project state, reason, exact prompt, guardrails, required verification, expected result, dependencies, and evidence, and update Project Memory without sending prompts or triggering Codex/GitHub/deploy actions?
- If this addresses stale/pending PR checks, does a `pending_check_resolution` artifact classify required, advisory, blocking, failed, missing, and pending checks; confirm required checks passed; enforce the timeout; and preserve no-auto-merge/no-bypass-failing-checks guardrails?
- If this assesses production readiness, does a `production_readiness_snapshot` artifact cover auth/admin protection, persistence, privacy/security, deployment readiness, monitoring/logging, cost/resource risk, user-facing UX, remaining blockers, owner-readable summary, and next safe action without changing production, resources, migrations, secrets/env, labels, issues, repository visibility, or merge state?
12. If this starts from the public Opportunity front door, does an `opportunity_intake` artifact capture problem/pain, affected people, better outcome, current barriers, existing idea/vision if any, desired impact, possible solution type, routing outcome, source-of-truth files, copyable next prompt, and guardrails?
13. Does Opportunity Intake preserve the boundary that Opportunity is a front door, AppEngine is the production factory, ecosystem apps/services are possible destinations or components, and no destination is assumed to be built?
- If an `opportunity_intake` is being processed, does an `opportunity_clarification` artifact clarify core problem, affected people, root barriers, desired better future, opportunity statement, first useful step, likely solution type, missing information, status, route, source files, and copyable next prompt?
- Does Opportunity Clarification preserve the boundary that ecosystem apps/services are not assumed built and owner review is required before problem_solution_intake, portfolio routing, packet creation, issue creation, Codex handoff, or implementation?
14. If this starts from a problem, vision, or hybrid of both, does a `problem_solution_intake` artifact classify the mode, questions, solution shape, missing context, routing, and next safe action before build work?
15. If the problem/vision is accepted as a candidate, does `problem_portfolio_routing` map it into `app_portfolio_registry` before any App Build Packet or vNext Packet is created?
16. Does the selected candidate type avoid forcing every problem into an app when a website, workflow/process, automation, content/resource, community/ministry model, or multi-part ecosystem solution is more fitting?
17. Are required review gates listed and blocking packet creation until owner/source-of-truth/problem clarity/security/cost/boundary checks pass?
18. If a portfolio candidate may proceed, does `solution_candidate_review` record readiness status, blockers, missing context, next safe action, and owner-readable review output?
19. Does solution candidate review cover problem clarity, intended transformation, audience/user, solution shape, data/security/privacy, cost/provider impact, build complexity, app/ecosystem fit, and owner approval requirements?
20. Does solution candidate review prevent packet creation when readiness is `needs_clarification`, `blocked_by_security`, `blocked_by_cost`, or `blocked_by_scope`?
21. If solution candidate review is approved, does `candidate_packet_bridge` select the correct draft type: `app_build_packet_draft`, `vnext_packet_draft`, or `non_app_solution_plan_draft`?
22. Does candidate packet bridge explain why that draft type was selected and preserve no-phase-issues, no-build, no-deploy guardrails?
23. If a packet draft exists, does `packet_draft_approval` approve, revise, reject, or block it before any final packet or plan is created?
24. Does packet draft approval cover problem and transformation clarity, correct packet type, solution shape fit, audience/user clarity, data/security/privacy readiness, provider/cost readiness, scope realism, reviewability, and owner approval notes?
25. Does packet draft approval prevent final packet creation when approval status is `needs_revision`, `rejected`, `blocked_by_security`, `blocked_by_cost`, or `blocked_by_scope`?
26. If packet draft approval passes, does `final_packet_materialization` create exactly one final planning packet: `app_build_packet`, `vnext_packet`, or `non_app_solution_plan`?
27. Does final packet materialization preserve no-phase-issues, no-build, no-deploy guardrails and set next safe action to phase creation approval?
28. If final packet materialization passes, does `phase_creation_approval` approve, revise, reject, or block phase creation before phase issues are generated?
29. Does phase creation approval cover final packet completeness, source-of-truth alignment, correct solution type, phase sequence readiness, cost/provider safety, security/privacy safety, and owner approval notes?
30. Does phase creation approval preserve no-phase-issues, no-build, no-deploy guardrails?
31. If phase creation approval passes, does `phase_issue_generation` create bounded phase issue drafts with source final packet, phase order, labels, per-phase guardrails, required source files, and next safe action?
32. Does phase issue generation preserve `githubIssuesCreated: false` and `codexBuildTriggered: false` until a later explicit issue-creation step?
33. Does the phase issue list match the solution type: app/vNext phases for software work and non-code phases for non-app solution plans?
34. If phase issue generation passes, does `phase_issue_publish_approval` approve, revise, reject, or block publication before real GitHub issues are created?
35. Does phase issue publish approval check title, body, source packet, phase order, labels, guardrails, acceptance criteria, boundedness, safe labels, secrets/env safety, protected URL safety, paid resource safety, migration safety, and production deploy safety?
36. Does phase issue publish approval preserve `githubIssuesPublished: false`, `codexBuildTriggered: false`, and `codexTriggerLabelsApproved: false` until a later explicit publish/activation step?
37. If phase issue publish approval passes, does `phase_issue_publisher_dry_run` preview exact GitHub issue payloads with titles, bodies, labels, phase order, source packet traceability, guardrails, and next safe action?
38. Does phase issue publisher dry run preserve `githubIssuesCreated: false` and `codexBuildTriggered: false` until a later explicit owner-approved publisher?
39. If real issue creation is desired, does `phase_issue_publisher_manual` require explicit manual mode and owner approval before publishing?
40. Does phase issue publisher manual mode default to no-op, sanitize labels, block `ai:build`/`ai:fix`, preserve source packet traceability, and keep `codexBuildTriggered: false`?
41. If real phase issues were manually published, does `published_phase_issue_registry` record issue numbers, URLs, source packet traceability, phase order, labels, guardrails, current status, and next safe action?
42. Does published phase issue registry preserve registry-only behavior: no labels added, no new GitHub issues, and `codexBuildTriggered: false`?
43. Before any published issue receives an execution label, does `phase_start_approval` check registry membership, phase order, previous required phases, guardrails, acceptance criteria, risk safety, and owner approval notes?
44. Does phase start approval preserve approval-gate-only behavior: no labels added, no execution labels approved, and `codexBuildTriggered: false`?
45. Before any real label mutation, does `execution_label_dry_run` show target issue, current labels, proposed labels, blocked labels, safety reason, and next safe action?
46. Does execution label dry run preserve dry-run-only behavior: no labels applied and `codexBuildTriggered: false`?
47. If this came from a natural language request, does an `intake_packet` exist with raw request, inferred app, request type, confidence, missing context, selected workflow, and next labels?
48. Has app selection identified exactly one outcome: new app, existing app, ambiguous request, or multi-app request?
49. If this is a command-path proof or pilot, does a `pilot_app_build` artifact record issue, handoff, intake, packet, dry-run follow-ups, PRs, release status, blockers, and next action?
50. If this is a live GitHub pilot, are pilot JSON artifacts and structured follow-up task JSON persisted under `agent-run` instead of runner-local `/tmp` paths?
51. Does the pilot block production deployment, paid provider creation, and generated app code merge without review?
52. Is this a new app or complex build that needs an App Build Packet before implementation?
53. If an App Build Packet exists, does the active task stay inside its current phase?
54. Does the app have an Identity/Auth plan with provider, roles, memberships, permissions, protected routes, and production auth gates?
55. Does the app have a Super Admin registry entry or planned entry with status, health, logs, admin, users, billing/status if needed, and allowed admin actions?
56. Does the portfolio registry know this app's name, slug, review URL, production URL, current version, deployment state, build state, next safe action, source files, linked issues, and linked PRs?
57. Does the app have provider/cost review with reuse strategy, preview/production cost posture, cost ceiling, upgrade trigger, and owner approval before new paid resources?
58. Does the active agent run have cost governance with monthly/project/app/issue spend, remaining budget, task class, thresholds, and budget-aware next action when model/API credits may be consumed?
59. Does cost governance say to continue, continue with a cheaper model, pause, or request owner approval?
60. Does the app have a Deployment Environment plan with frontend, backend if needed, database, env var inventory, preview/production URLs, custom domain, logs, health, and rollback notes?
61. Does the app have a `design_intent_profile` with target audience, user sophistication, desired emotional experience, brand personality, trust needs, accessibility needs, visual style preference, examples/references if provided, things to avoid, and output guidance before UI generation or review?
62. Does the design intent fit the app charter and prevent generic UI or purpose bleed from another app?
63. Does the app have a Design Quality Gate covering navigation, primary action, mobile, copy, spacing, contrast, trust, emotional fit, empty states, error states, onboarding, and admin screens?
64. Does the app have Designer and Customer Perspective review before Release Gate approval?
65. Does the app have a Compatibility Test Plan covering iPhone/iPad Safari, desktop Safari, Chrome mobile/desktop, common desktop browsers, viewports, touch targets, forms, auth flows, uploads/payments if used, and admin screens?
66. Does the app have a Release Gate with v1/vNext rules, preview deploy contract, production approval, post-launch monitoring, and Super Admin status update?
67. If this is an existing app improvement, is there a vNext packet that loaded charter, current version, registry, monitoring data, known issues, and release history?
68. Are any core files, docs, prompts, context, or issue links missing?
69. Should the agent proceed, pause, ask for clarification, or create a follow-up issue?

## Output

The Context Gate must produce:

- Go / No-Go decision
- Missing context
- Boundary warnings
- Required source files read
- Recommended next step
