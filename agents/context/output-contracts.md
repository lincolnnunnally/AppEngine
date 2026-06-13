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

Every phase handoff and `followUpTasks[].body` must include a `## Required Source Of Truth To Load` section. That section must explicitly list `source-of-truth/global-principles.md`, `source-of-truth/life-produces-life.md`, the relevant app charter, the current phase artifact when one exists, and any phase-specific standards needed for the task. Do not rely on the prompt factory's shared context list as an invisible substitute for issue-visible source-of-truth files.

## Known Artifact Kinds

Agents may return these artifact kinds when relevant:

- `chatgpt_handoff_packet`: required when ChatGPT turns Lincoln's conversation into a GitHub issue; defines raw conversation summary, raw request, selected app or new app slug, request type, intake confidence, missing context, recommended label, source-of-truth files to load, issue title/body, and secret-safety guardrails.
- `intake_packet`: required before routing natural language requests like "build this app," "start AppEngine build," "improve Spark of Hope," or "add this feature to Toner Management"; defines raw request, inferred app, request type, confidence, missing context, selected workflow, next labels, and guardrails.
- `pilot_app_build`: required for the first bounded AppEngine command pilot; records issue, handoff packet, intake packet, App Build Packet or vNext Packet, dry-run follow-up issues, PRs, release status, blockers, next action, and guardrails.
- `app_build_packet`: required before a new generated app, major rebuild, or complex app workflow is implemented.
- `identity_auth_plan`: required for generated apps and launch work; defines provider, sessions, identity objects, memberships, roles, permissions, protected routes, local setup behavior, and production auth gates.
- `super_admin_registry_entry`: required for generated apps and launch work; defines lifecycle status, owner, repo, deployment, health, logs, admin, users, billing/status if needed, and allowed admin actions.
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

An `app_build_packet` artifact must include app charter path, boundaries, audience, success definition, MVP stages, deployment target, Identity/Auth plan, Super Admin integration requirements, Super Admin registry entry, Provider/Cost review, Deployment Environment plan, Design Quality Gate, UX Review, Compatibility Test Plan, Release Gate plan, guardrails, phases, and phase-ready `followUpTasks`.

An `identity_auth_plan` artifact must not contain secrets, OAuth credentials, API keys, session secrets, provider tokens, private user data, or production bypass values.

A `super_admin_registry_entry` artifact must not contain secrets. It may contain planned URLs, status values, provider names, route paths, and environment names.

A `provider_cost_review` artifact must not contain secrets, provider tokens, private billing data, or payment credentials. It blocks new paid provider resource creation and release approval until cost posture, reuse strategy, and owner approval needs are clear.

A `deployment_environment_plan` artifact must list variable names only, never secret values.

A `design_review` artifact must include Designer and Customer Perspective review status. It blocks Release Gate approval when mobile, empty states, error states, onboarding, admin screens, accessibility, trust, or emotional fit are missing.

A `compatibility_test_plan` artifact must include Safari/mobile and common browser targets. It blocks Release Gate approval when iPhone/iPad Safari, desktop Safari, Chrome mobile/desktop, Edge, Firefox, common viewports, touch targets, forms, auth flows, uploads/payments if used, or admin screens have unresolved issues.

A `release_gate_plan` artifact must not claim production is approved unless owner approval is recorded in GitHub or another durable source.

A `chatgpt_handoff_packet` artifact must not contain secrets, private API keys, tokens, passwords, private credentials, or unnecessary private user data. It should default to `ai:plan` so intake and app selection happen before build, fix, review, or release work.

An `intake_packet` artifact must route new apps to an App Build Packet, existing apps to a vNext Packet after required context is loaded, and ambiguous or multi-app requests to clarification. It must not trigger implementation, provider provisioning, or production deployment directly.

A `pilot_app_build` artifact must be dry-run by default. It must not deploy production, create paid provider resources, or merge generated app code without review. It should record the first real bounded pilot from handoff issue to dry-run follow-up issues. In GitHub Actions, pilot JSON files and structured `followUpTasks` must be persisted under the durable `agent-run` artifact, not runner-local `/tmp` paths.

A `vnext_packet` artifact must load existing app context before planning changes. It must not restart the whole app, erase release history, or import unrelated app goals.
