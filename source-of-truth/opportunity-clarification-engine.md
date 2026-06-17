# Opportunity Clarification Engine

## Purpose

Opportunity Clarification turns a submitted `opportunity_intake` into a clearer opportunity profile before AppEngine routes work toward a solution path.

The goal is not to build immediately. The goal is to understand the problem well enough to choose the right next safe action.

## Input

The required input artifact is:

- `opportunity_intake`

The clarification step must preserve the original intake as source evidence.

## Artifact

Use artifact kind:

- `opportunity_clarification`

## Required Clarification Fields

Every opportunity clarification should include:

- core problem
- affected people
- root barriers
- desired better future
- opportunity statement
- possible first useful step
- likely solution type
- missing information

## Statuses

Supported statuses:

- `clarified`
- `needs_more_info`
- `not_actionable_yet`
- `safety_sensitive`

## Routing Outcomes

Opportunity Clarification may route toward:

- `app_tool_workflow`
- `content_resource`
- `community_ministry_model`
- `existing_ecosystem_service_later`
- `appengine_build_candidate`

## Boundary

Opportunity Clarification must not assume Spark, Live On Mission, Best Life, or other ecosystem apps are fully built.

Ecosystem apps and services are possible destinations or solution components only after AppEngine verifies that the destination exists, fits the need, and passes the proper review gates.

## Owner Review

Owner review is required before an `opportunity_clarification` becomes:

- `problem_solution_intake`
- portfolio candidate
- packet draft
- GitHub issue
- Codex handoff
- implementation work

## Guardrails

- Production deploys remain blocked.
- Paid resources remain blocked.
- Live migrations remain blocked.
- Secrets and env changes remain blocked.
- Repository visibility changes remain blocked.
- Codex auto-execution remains blocked.
- GitHub issue creation remains blocked.
- Label changes remain blocked.
- Adapter-backed local/mock persistence is allowed.
