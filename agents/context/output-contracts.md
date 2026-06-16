# Output Contracts

Every agent should produce a human-readable summary and a machine-usable output shape.

Required structure:

```json
{
  "agent": "agent-id",
  "status": "completed | blocked | needs_follow_up",
  "summary": "Short result summary.",
  "artifacts": [
    {
      "kind": "artifact_kind",
      "title": "Artifact title",
      "content": {}
    }
  ],
  "findings": [
    {
      "severity": "low | medium | high",
      "title": "Finding title",
      "details": "Finding details.",
      "recommendedLabel": "ai:fix"
    }
  ],
  "followUpTasks": [
    {
      "title": "Follow-up title",
      "body": "Issue-ready task body.",
      "recommendedLabel": "ai:plan"
    }
  ],
  "handoffTo": ["next-agent-id"]
}
```

Agents should keep prose concise and make follow-up work issue-ready when possible.

Every phase handoff and `followUpTasks[].body` must include a `## Required Source Of Truth To Load` section. That section must explicitly list `source-of-truth/00-why-we-build.md`, `source-of-truth/01-ecosystem-philosophy.md`, `source-of-truth/02-global-principles.md`, `source-of-truth/03-life-produces-life.md`, `source-of-truth/04-app-purpose-rules.md`, `source-of-truth/05-ecosystem-design-gates.md`, the relevant app charter, the current phase artifact when one exists, and any phase-specific standards needed for the task. Do not rely on the prompt factory's shared context list as an invisible substitute for issue-visible source-of-truth files.

Every app charter, App Build Packet, vNext Packet, architecture plan, design brief, release gate, and implementation handoff should preserve these philosophy fields when the task affects app scope:

- purpose
- audience
- barrier removed
- need addressed
- movement toward life
- app boundaries
- transformation outcome
- tool classification: Direct Transformation Tool, Support Tool, or mixed

## Known Artifact Kinds

Agents may return these artifact kinds when relevant:

- `chatgpt_handoff_packet`: required when ChatGPT turns Lincoln's conversation into a GitHub issue; defines raw conversation summary, raw request, selected app or new app slug, request type, intake confidence, missing context, recommended label, source-of-truth files to load, issue title/body, and secret-safety guardrails.
- `problem_solution_intake`: required when Lincoln starts from a noticed problem, an existing solution vision, or a hybrid of both; classifies intake as `problem_first`, `vision_first`, or `hybrid`, clarifies affected people, barriers, root causes, desired transformation, solution shape, missing context, routing, next safe action, and planning-only guardrails.
- `problem_portfolio_routing`: required when a `problem_solution_intake` is accepted as a portfolio-tracked solution candidate; maps the intake to a new app candidate, existing app improvement, website candidate, workflow/process candidate, automation candidate, content/resource candidate, ministry/community model candidate, or multi-part ecosystem solution; records `app_portfolio_registry` as the destination/tracking artifact and required review gates before packet creation.
- `solution_candidate_review`: required before a portfolio-tracked solution candidate becomes an App Build Packet request, vNext Packet request, or non-app solution plan request; reviews problem clarity, transformation, audience/user, solution shape, data/security/privacy, cost/provider impact, build complexity, app/ecosystem fit, and owner approval requirements.
- `candidate_packet_bridge`: required after approved `solution_candidate_review` and before final packet creation; converts ready candidates into review-ready `app_build_packet_draft`, `vnext_packet_draft`, or `non_app_solution_plan_draft` without creating phase issues or triggering build work.
- `packet_draft_approval`: required after `candidate_packet_bridge` and before final packet creation; approves, revises, rejects, or blocks review-ready packet drafts without creating final packets, phase issues, or build work.
- `final_packet_materialization`: required after approved `packet_draft_approval` and before any phase issue creation; turns approved packet drafts into final `app_build_packet`, `vnext_packet`, or `non_app_solution_plan` planning packets without triggering build work.
- `phase_creation_approval`: required after `final_packet_materialization` and before phase issue generation; approves, revises, rejects, or blocks whether final packets may generate phase issues without creating the issues or triggering build work.
- `phase_issue_generation`: required after approved `phase_creation_approval` and before any GitHub phase issue creation; turns approved final packets into bounded, reviewable phase issue drafts without creating GitHub issues, triggering Codex build work, deploying, provisioning, migrating, changing secrets/env, or auto-merging generated app code.
- `phase_issue_publish_approval`: required after `phase_issue_generation` and before any real GitHub issue publication; approves, revises, rejects, or blocks whether drafted phase issues may be published without publishing them or triggering Codex build work.
- `phase_issue_publisher_dry_run`: required after approved `phase_issue_publish_approval` and before any real GitHub issue creation; converts approved drafts into exact publish-ready GitHub issue payload previews without creating issues or triggering Codex build work.
- `phase_issue_publisher_manual`: required before any real GitHub phase issue creation; publishes approved dry-run payloads only when manual mode and owner approval are explicit, defaults to dry-run/no-op, strips build-triggering labels, and does not trigger Codex build work.
- `published_phase_issue_registry`: required after completed `phase_issue_publisher_manual` output; records manually published phase issue numbers, URLs, source packet traceability, phase order, labels, guardrails, current status, and next safe action without creating issues, adding labels, or triggering Codex build work.
- `phase_start_approval`: required before any published phase issue may receive a later execution label; approves, revises, rejects, or blocks whether a registered issue is safe to start while adding no labels and triggering no Codex build work.
- `intake_packet`: required before routing natural language requests like "build this app," "start AppEngine build," "improve Spark of Hope," or "add this feature to Toner Management"; defines raw request, inferred app, request type, confidence, missing context, selected workflow, next labels, and guardrails.
- `pilot_app_build`: required for the first bounded AppEngine command pilot; records issue, handoff packet, intake packet, App Build Packet or vNext Packet, dry-run follow-up issues, PRs, release status, blockers, next action, and guardrails.
- `build_completion_plan`: required before generated-app work moves from planning into implementation, preview, review, release, or vNext work; records app, source issue, current phase, current state, next safe action, blocked reason, owner approval requirement, related PR, preview URL, required/passed/failed gates, follow-up tasks, evidence links, and safety guardrails.
- `cost_governance`: required before autonomous agent work consumes meaningful model/API credits; records monthly budget, monthly spend, project spend, app spend, issue spend, remaining budget, estimated next spend, model routing class, thresholds, budget-aware action, owner approval requirement, and guardrails.
- `deployment_lifecycle`: required before claiming a generated app is reviewable or live; records app name, app slug, owner review URL, production URL, current deployment URL, deployment state, current version, review version, production version, approval requirement, last deployment timestamp, URL discovery evidence, and production/resource/migration guardrails.
- `preview_verification`: required before claiming any preview deployment works; records Vercel deployment state, preview root URL, expected route, checked URL, HTTP status, marker/test-id evidence, optional mock/API JSON result, commit SHA, timestamp, pass/fail checks, and focused fix follow-up tasks when verification fails.
- `owner_status_report`: required when AppEngine reports app/build progress to the owner; generated from `build_completion_plan`, `deployment_lifecycle`, `preview_verification`, and `cost_governance`; tells Lincoln where the app is, what state/version it is in, what is blocking progress, and the next safe action.
- `app_build_packet`: required before a new generated app, major rebuild, or complex app workflow is implemented.
- `identity_auth_plan`: required for generated apps and launch work; defines provider, sessions, identity objects, memberships, roles, permissions, protected routes, local setup behavior, and production auth gates.
- `super_admin_registry_entry`: required for generated apps and launch work; defines lifecycle status, owner, repo, deployment, health, logs, admin, users, billing/status if needed, and allowed admin actions.
- `app_portfolio_registry`: required when AppEngine reports portfolio-wide app state; indexes every managed app by name, slug, review URL, production URL, current version, deployment state, build state, next safe action, source-of-truth files, linked issues, and linked PRs.
- `provider_cost_review`: required before generated apps provision provider resources or pass release; defines provider strategy, reuse options, preview/production cost posture, cost ceiling, upgrade trigger, and paid-resource approval gates.
- `deployment_environment_plan`: required for generated apps and launch work; defines frontend provider, API/backend provider if needed, database provider, env var inventory, preview URL, production URL, custom domain/subdomain, logs, health checks, and rollback notes.
- `design_review`: required for generated apps and release work; defines Designer review, Customer Perspective review, design quality checks, UX state checks, mobile checks, onboarding, admin screens, and release-blocking issues.
- `compatibility_test_plan`: required for generated apps and release work; defines browser support, iPhone/iPad Safari, desktop Safari, Chrome mobile/desktop, common browser checks, viewports, touch targets, forms, auth flows, uploads/payments if used, admin screens, and release-blocking issues.
- `release_gate_plan`: required for generated apps and launch work; defines v1 launch rules, vNext follow-up rules, preview deploy contract, production approval, post-launch monitoring, and Super Admin status update contract.
- `vnext_packet`: required for existing app improvements; defines current version, target version, loaded context, improvement request, non-goals, provider/cost delta, phases, release gate, monitoring update, and app-boundary guardrails.
- `build_spec`: build-ready scope, acceptance criteria, and non-goals.
- `design_brief`: user flow, screen, copy, and visual direction.
- `workflow_test_plan`: end-to-end journey checks.
- `review_report`: code, security, quality, and deployment-risk review.

An `app_build_packet` artifact must include app charter path, purpose, audience, barrier removed, need addressed, movement toward life, transformation outcome, tool classification, boundaries, success definition, MVP stages, deployment target, Identity/Auth plan, Super Admin integration requirements, Super Admin registry entry, Provider/Cost review, Deployment Environment plan, Design Quality Gate, UX Review, Compatibility Test Plan, Release Gate plan, guardrails, phases, and phase-ready `followUpTasks`.

An `identity_auth_plan` artifact must not contain secrets, OAuth credentials, API keys, session secrets, provider tokens, private user data, or production bypass values.

A `super_admin_registry_entry` artifact must not contain secrets. It may contain planned URLs, status values, provider names, route paths, and environment names.

An `app_portfolio_registry` artifact must not contain secrets, private user data, private billing data, protected Vercel bypass/share links, or hidden deployment credentials. It must include every managed app's name, slug, review URL, production URL, current version, deployment state, build state, next safe action, source-of-truth files, linked issues, and linked PRs. It must flag missing review URLs, missing source files, missing linked work, contradictory states, or production-live claims without approval evidence as blockers or focused follow-up tasks.

A `provider_cost_review` artifact must not contain secrets, provider tokens, private billing data, or payment credentials. It blocks new paid provider resource creation and release approval until cost posture, reuse strategy, and owner approval needs are clear.

A `deployment_environment_plan` artifact must list variable names only, never secret values. Preview deployments are public by default for review and route-specific verification; production remains approval-gated.

A `design_review` artifact must include Designer and Customer Perspective review status. It blocks Release Gate approval when mobile, empty states, error states, onboarding, admin screens, accessibility, trust, or emotional fit are missing.

A `compatibility_test_plan` artifact must include Safari/mobile and common browser targets. It blocks Release Gate approval when iPhone/iPad Safari, desktop Safari, Chrome mobile/desktop, Edge, Firefox, common viewports, touch targets, forms, auth flows, uploads/payments if used, or admin screens have unresolved issues.

A `release_gate_plan` artifact must not claim production is approved unless owner approval is recorded in GitHub or another durable source.

A `chatgpt_handoff_packet` artifact must not contain secrets, private API keys, tokens, passwords, private credentials, or unnecessary private user data. It should default to `ai:plan` so intake and app selection happen before build, fix, review, or release work.

A `problem_solution_intake` artifact must classify the starting point as `problem_first`, `vision_first`, or `hybrid`. It must recommend one or more solution shapes from `app`, `website`, `workflow_process`, `automation`, `content_resource`, `community_ministry_model`, or `multi_part_ecosystem_solution`. It must include problem summary, affected people, barriers, need addressed, desired transformation, movement toward life, missing questions, routing, next safe action, owner-readable summary, and planning-only guardrails. It must not route directly to implementation, production, paid resources, migrations, env changes, public intake UI, or generated app auto-merge.

A `problem_portfolio_routing` artifact must use `problem_solution_intake` as its source artifact and `app_portfolio_registry` as its destination/tracking artifact. It must produce exactly one candidate type from `new_app_candidate`, `existing_app_improvement`, `website_candidate`, `workflow_process_candidate`, `automation_candidate`, `content_resource_candidate`, `ministry_community_model_candidate`, or `multi_part_ecosystem_solution`. It must include an owner-readable routing report, required review gates, next safe action, portfolio action, and guardrails. It must not create a build packet or vNext packet until review gates pass.

A `solution_candidate_review` artifact must use `problem_portfolio_routing` as its source artifact. Its `readinessStatus` must be one of `needs_clarification`, `ready_for_app_build_packet`, `ready_for_vnext_packet`, `ready_for_non_app_solution_plan`, `blocked_by_security`, `blocked_by_cost`, or `blocked_by_scope`. It must review problem clarity, intended transformation, audience/user, solution shape, data/security/privacy needs, cost/provider impact, build complexity, app/ecosystem fit, and owner approval requirements. It must include an owner-readable review report, next safe action, blockers, missing context, follow-up tasks, and guardrails. It must not create App Build Packets, vNext Packets, implementation work, production deploys, paid resources, migrations, secrets/env changes, repository visibility changes, or generated app auto-merge.

A `candidate_packet_bridge` artifact must use `solution_candidate_review` as its source artifact and may only proceed when readiness is `ready_for_app_build_packet`, `ready_for_vnext_packet`, or `ready_for_non_app_solution_plan`. It must select exactly one draft kind: `app_build_packet_draft`, `vnext_packet_draft`, or `non_app_solution_plan_draft`. It must include an owner-readable bridge report explaining why the packet type was selected, the review-ready packet draft, next safe action, owner approval requirement, and guardrails. It must fail honestly for `needs_clarification`, `blocked_by_security`, `blocked_by_cost`, `blocked_by_scope`, or missing required review fields. It must not create final packets, phase issues, implementation work, production deploys, paid resources, migrations, secrets/env changes, repository visibility changes, or generated app auto-merge.

A `packet_draft_approval` artifact must use `candidate_packet_bridge` as its source artifact. Its `approvalStatus` must be one of `approved_for_final_packet`, `needs_revision`, `rejected`, `blocked_by_security`, `blocked_by_cost`, or `blocked_by_scope`. It must review problem and transformation clarity, correct packet type, solution shape fit, audience/user clarity, data/security/privacy readiness, provider/cost readiness, scope realism, reviewability, and owner approval notes. It must include an owner-readable approval report, next safe action, follow-up tasks, and guardrails. It must fail honestly for missing bridge or approval fields. It must not create final packets, phase issues, implementation work, production deploys, paid resources, migrations, secrets/env changes, repository visibility changes, or generated app auto-merge.

A `final_packet_materialization` artifact must use `packet_draft_approval` as its source artifact and may only proceed when `approvalStatus` is `approved_for_final_packet`, `decision.readyForFinalPacket` is true, and all approval checks are `pass`. It must create exactly one final planning packet: `app_build_packet`, `vnext_packet`, or `non_app_solution_plan`. It must include an owner-readable materialization report, next safe action, follow-up tasks, and guardrails. It must fail honestly for `needs_revision`, `rejected`, `blocked_by_security`, `blocked_by_cost`, `blocked_by_scope`, or missing approval fields. It must not create phase issues, implementation work, production deploys, paid resources, migrations, secrets/env changes, repository visibility changes, or generated app auto-merge.

A `phase_creation_approval` artifact must use `final_packet_materialization` as its source artifact. Its `approvalStatus` must be one of `approved_for_phase_creation`, `needs_revision`, `rejected`, `blocked_by_security`, `blocked_by_cost`, or `blocked_by_scope`. It must review final packet completeness, source-of-truth alignment, correct solution type, phase sequence readiness, cost/provider safety, security/privacy safety, and owner approval notes. It must include an owner-readable approval report, next safe action, follow-up tasks, and guardrails. It must fail honestly for missing materialization or approval fields. It must not create phase issues, implementation work, production deploys, paid resources, migrations, secrets/env changes, repository visibility changes, or generated app auto-merge.

A `phase_issue_generation` artifact must use `phase_creation_approval` as its source artifact and may only proceed when `approvalStatus` is `approved_for_phase_creation`, `decision.approvedForPhaseCreation` is true, and all approval checks are `pass`. It must include source final packet, generated phase issue list, phase order, labels to apply later, guardrails for each phase, owner-readable report, and next safe action. It must fail honestly for `needs_revision`, `rejected`, `blocked_by_security`, `blocked_by_cost`, `blocked_by_scope`, or missing approval fields. It must set `githubIssuesCreated: false` and `codexBuildTriggered: false`, and must not create GitHub issues, trigger Codex build work, deploy production, create paid resources, apply migrations, change secrets/env, change repository visibility, or auto-merge generated app code.

A `phase_issue_publish_approval` artifact must use `phase_issue_generation` as its source artifact. Its `approvalStatus` must be one of `approved_for_issue_publish`, `needs_revision`, `rejected`, `blocked_by_security`, `blocked_by_cost`, or `blocked_by_scope`. It must review phase issue completeness, source packet traceability, phase order clarity, label safety, guardrail completeness, acceptance criteria completeness, automatic Codex build safety, secret/env safety, resource/release safety, and bounded reviewability. It must include an owner-readable approval report, next safe action, follow-up tasks, and guardrails. It must fail honestly for missing generation fields, missing draft fields, unsafe labels, secrets/env values, protected bypass URLs, paid resource instructions, migration instructions, production deploy instructions, or automatic Codex build instructions. It must set `githubIssuesPublished: false`, `codexBuildTriggered: false`, and `codexTriggerLabelsApproved: false`, and must not create GitHub issues, trigger Codex build work, deploy production, create paid resources, apply migrations, change secrets/env, change repository visibility, or auto-merge generated app code.

A `phase_issue_publisher_dry_run` artifact must use `phase_issue_publish_approval` as its source artifact and may only proceed when `approvalStatus` is `approved_for_issue_publish`, `decision.approvedForIssuePublish` is true, and all approval checks are `pass`. It must include exact GitHub issue payload previews with title, body, labels, phase metadata, source packet traceability, guardrails, owner-readable output, and next safe action. It must fail honestly for `needs_revision`, `rejected`, `blocked_by_security`, `blocked_by_cost`, `blocked_by_scope`, missing approval fields, missing source drafts, unsafe payload content, protected bypass URLs, secrets/env values, paid resource instructions, migration instructions, production deploy instructions, or automatic Codex build instructions. It must set `githubIssuesCreated: false`, `codexBuildTriggered: false`, and `ownerApprovalRequired: true`, and must not call the GitHub API, create GitHub issues, trigger Codex build work, deploy production, create paid resources, apply migrations, change secrets/env, change repository visibility, or auto-merge generated app code.

A `phase_issue_publisher_manual` artifact must use `phase_issue_publisher_dry_run` as its source artifact. It must default to `publishStatus: manual_publish_not_enabled`, `githubIssuesCreated: false`, and `codexBuildTriggered: false` unless `APPENGINE_PHASE_ISSUE_PUBLISH_MODE=manual` and `APPENGINE_PHASE_ISSUE_PUBLISH_OWNER_APPROVED=true` are explicitly present. It may use mock mode only when `APPENGINE_PHASE_ISSUE_PUBLISH_MOCK=true`; mock mode must not claim real GitHub issue creation. Real manual mode must require a GitHub repository and token. It must sanitize labels, block `ai:build` and `ai:fix`, include source packet traceability, guardrails, acceptance criteria, and required source files in every issue body, and must not trigger Codex build work, deploy production, create paid resources, apply migrations, change secrets/env, change repository visibility, or auto-merge generated app code.

A `published_phase_issue_registry` artifact must use `phase_issue_publisher_manual` as its source artifact and may proceed only when `decision.publishStatus` is `manual_publish_completed`, `decision.githubIssuesCreated` is true, `decision.codexBuildTriggered` is false, and every publish result has `created: true`, a real issue number, a real GitHub issue URL, phase, phase order, and safe labels. It must record source packet, source dry-run payload traceability, published issue numbers/URLs, phase order, issue labels, guardrails, current status, and next safe action. It must fail honestly for no-op or mock manual publish output, missing issue numbers, missing URLs, missing phase order, missing source traceability, build-triggering labels, or any indication Codex build work was triggered. It must not create GitHub issues, add labels, trigger Codex build work, deploy production, create paid resources, apply migrations, change secrets/env, change repository visibility, or auto-merge generated app code.

A `phase_start_approval` artifact must use `published_phase_issue_registry` as its source artifact. It must decide whether one target published phase issue is safe to receive a manual execution label later. It must support `approved_for_manual_phase_start`, `needs_revision`, `rejected`, `blocked_by_security`, `blocked_by_cost`, and `blocked_by_scope`. It must check issue existence in the registry, phase order, previous required phase completion or non-requirement, guardrails, acceptance criteria, secrets/env/migration/production/paid-resource risk, and owner approval notes. It must set `labelsAdded: false`, `executionLabelsApproved: false`, and `codexBuildTriggered: false`, and must not add `ai:build`, `ai:fix`, or any execution label, trigger Codex build work, deploy production, create paid resources, apply migrations, change secrets/env, change repository visibility, or auto-merge generated app code.

An `intake_packet` artifact must route new apps to an App Build Packet, existing apps to a vNext Packet after required context is loaded, and ambiguous or multi-app requests to clarification. It must not trigger implementation, provider provisioning, or production deployment directly.

A `pilot_app_build` artifact must be dry-run by default. It must not deploy production, create paid provider resources, or merge generated app code without review. It should record the first real bounded pilot from handoff issue to dry-run follow-up issues. In GitHub Actions, pilot JSON files and structured `followUpTasks` must be persisted under the durable `agent-run` artifact, not runner-local `/tmp` paths.

A `build_completion_plan` artifact must use the state values `planned`, `ready_for_build`, `draft_pr_open`, `preview_pending`, `preview_verified`, `build_preview`, `review_ready`, `review_blocked`, `approved_for_release`, `production_live`, `production_blocked`, `release_blocked`, `owner_approval_required`, `ready_for_vnext`, or `failed_needs_fix`. Its `nextSafeAction` must be one of `create_planning_issue`, `create_implementation_issue`, `create_draft_pr`, `wait_for_preview`, `verify_preview`, `verify_review_url`, `run_review_gates`, `create_fix_issue`, `await_owner_review`, `stop_for_owner_approval`, `pause_for_budget`, `request_budget_approval`, `prepare_release_gate`, or `create_vnext_packet`. It must embed `costGovernance`, expose `budgetAwareNextSafeAction`, include a `deploymentLifecycle` object, expose `reviewUrl`, `productionUrl`, `deploymentState`, and `currentVersion`, and block production deploys, paid resources, migrations, auto-merge, public protected-preview bypass links, and AI/API credit consumption beyond configured cost governance thresholds unless owner approval is recorded.

A `deployment_lifecycle` artifact must use deployment state values `build_preview`, `review_ready`, `review_blocked`, `approved_for_release`, `production_live`, `production_blocked`, or `failed_needs_fix`. It must distinguish build preview URLs from owner review URLs and production URLs. Owner review URLs must be normal public review URLs, not protected bypass/share links. Production URLs must not be updated unless owner approval and release-gate evidence are recorded.

A `cost_governance` artifact must classify the current model task as `cheap`, `medium`, or `expensive`. Cheap tasks include issue routing, label selection, formatting, and artifact cleanup. Medium tasks include review, summarization, and validation. Expensive tasks include architecture, implementation, debugging, and design generation. Its `nextBudgetAction` must be `continue`, `continue_with_cheaper_model`, `pause`, or `request_approval`. It must not contain API keys, model tokens, account billing secrets, private invoices, payment credentials, or private billing data.

A `preview_verification` artifact must fail when the owner review URL is missing, unknown, inaccessible, or protected by a bypass/share link; when the expected route returns 404; when only the root URL works; when the expected route returns the wrong page; when the marker text or test id is missing; when the Vercel deployment state is not `READY`; when the commit SHA is missing; or when the check depends on a protected Vercel bypass/share link instead of a normal public preview URL. A failed preview verification must create a focused `ai:fix` follow-up task.

An `owner_status_report` artifact must not contain secrets, private user data, private billing details, or protected deployment bypass/share links. It must include an owner-readable summary with review URL or blocked/unknown status, production status, current state, deployment state, current version, blockers, next safe action, evidence links, and guardrails. It should be persisted under the durable `agent-run` artifact and reflected in issue comments so Lincoln can understand state without reading workflow logs.

A `vnext_packet` artifact must load existing app context before planning changes. It must not restart the whole app, erase release history, or import unrelated app goals.
