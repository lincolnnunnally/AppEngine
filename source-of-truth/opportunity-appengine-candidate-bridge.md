# Opportunity to AppEngine Candidate Bridge

The Opportunity to AppEngine Candidate Bridge turns an owner-reviewable `opportunity_action_plan` into an AppEngine solution candidate.

It exists before build packets, GitHub issues, labels, or Codex handoffs.

## Purpose

An `opportunity_appengine_candidate` helps the owner decide whether a clarified opportunity is ready to become a later AppEngine planning artifact.

It should bring together:

- source opportunity intake
- clarified problem
- solution path
- action plan summary
- proposed AppEngine work type
- recommended artifact to create next
- missing owner decisions
- risks/blockers
- confidence level
- copyable next AppEngine prompt

## Input Artifact

The required input is:

- `opportunity_action_plan`

The candidate must preserve traceability to:

- source opportunity intake
- source clarification
- source solution path
- source action plan

## Artifact

The machine-readable artifact is:

- `opportunity_appengine_candidate`

## Candidate Types

Supported candidate types:

- `app_build_candidate`
- `workflow_candidate`
- `content_resource_candidate`
- `community_model_candidate`
- `ecosystem_service_later_candidate`
- `needs_more_info`

## Recommended Next Artifact

The bridge may recommend a next artifact, but it must not create it.

Examples:

- `problem_solution_intake`
- `opportunity_clarification`
- `destination_readiness_review`

## Boundaries

This bridge must not:

- create build packets
- create vNext packets
- create final packets
- create GitHub issues
- apply labels
- trigger Codex
- deploy production
- create paid resources
- run migrations
- add secrets or env vars
- change repository visibility
- assume Spark, Live On Mission, Best Life, or any ecosystem app is fully built

## Owner Review

The owner-readable output should make the candidate easy to judge:

- Is the problem clear?
- Is the solution path appropriate?
- Is AppEngine the right tool now?
- What decision is still missing?
- What risk blocks movement?
- What artifact should be created next if approved?

## Success Criteria

The bridge is successful when AppEngine can show the owner a clear candidate for later planning work while still preventing premature packet creation or automated execution.
