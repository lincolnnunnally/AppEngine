# Opportunity Solution Path Router

## Purpose

Opportunity Solution Path Router turns a clarified opportunity into the right next solution path without starting implementation.

It uses `opportunity_clarification` as input and produces an owner-reviewable `opportunity_solution_path` artifact.

## Input

Required input artifact:

- `opportunity_clarification`

## Artifact

Use artifact kind:

- `opportunity_solution_path`

## Routing Outcomes

Supported routes:

- `appengine_build_candidate`
- `app_tool_workflow`
- `content_resource`
- `community_ministry_model`
- `existing_ecosystem_service_later`
- `needs_more_info`
- `not_safe_or_not_ready`

## Required Output Fields

Every solution path should include:

- recommended path
- reason for routing
- first practical step
- needed resources
- blockers
- confidence level
- next AppEngine action prompt

## Boundary

The router must not assume Spark, Live On Mission, Best Life, or other ecosystem apps are fully built.

Existing ecosystem services are possible future destinations only after AppEngine verifies the destination exists, fits the opportunity, and passes the appropriate review gates.

## Owner Review

Owner review is required before an `opportunity_solution_path` becomes:

- `problem_solution_intake`
- portfolio routing
- packet draft
- App Build Packet
- vNext Packet
- Non-App Solution Plan
- GitHub issue
- Codex handoff
- implementation work

## Guardrails

- No build packets are created automatically.
- No Codex execution is triggered.
- No GitHub issues are created.
- No labels are applied.
- Production deploys remain blocked.
- Paid resources remain blocked.
- Live migrations remain blocked.
- Secrets and env changes remain blocked.
- Repository visibility changes remain blocked.
- Adapter-backed local/mock persistence is allowed.
