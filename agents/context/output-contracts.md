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

## Known Artifact Kinds

Agents may return these artifact kinds when relevant:

- `app_build_packet`: required before a new generated app, major rebuild, or complex app workflow is implemented.
- `identity_auth_plan`: required for generated apps and launch work; defines provider, sessions, identity objects, memberships, roles, permissions, protected routes, local setup behavior, and production auth gates.
- `super_admin_registry_entry`: required for generated apps and launch work; defines lifecycle status, owner, repo, deployment, health, logs, admin, users, billing/status if needed, and allowed admin actions.
- `build_spec`: build-ready scope, acceptance criteria, and non-goals.
- `design_brief`: user flow, screen, copy, and visual direction.
- `workflow_test_plan`: end-to-end journey checks.
- `review_report`: code, security, quality, and deployment-risk review.

An `app_build_packet` artifact must include app charter path, boundaries, audience, success definition, MVP stages, deployment target, Identity/Auth plan, Super Admin integration requirements, Super Admin registry entry, guardrails, phases, and phase-ready `followUpTasks`.

An `identity_auth_plan` artifact must not contain secrets, OAuth credentials, API keys, session secrets, provider tokens, private user data, or production bypass values.

A `super_admin_registry_entry` artifact must not contain secrets. It may contain planned URLs, status values, provider names, route paths, and environment names.
