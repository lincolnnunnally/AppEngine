# Opportunity Action Plan Draft

Opportunity Action Plan Draft turns a routed `opportunity_solution_path` into a practical first plan the owner can review.

It exists between route decision and packet creation. It helps Lincoln see the next human-useful step without starting implementation.

## Purpose

An `opportunity_action_plan` should answer:

- What opportunity are we responding to?
- Which solution path was recommended?
- What are the first 3 practical steps?
- What can AppEngine build or help with later?
- What must the person, community leader, or owner clarify?
- What resources are needed?
- What risks or blockers remain?
- What timeline makes sense?
- What should the next review prompt say?

## Input Artifact

The required input is:

- `opportunity_solution_path`

The action plan must preserve source traceability to:

- source intake
- source clarification
- source solution path
- recommended path
- confidence and blockers

## Artifact

The machine-readable artifact is:

- `opportunity_action_plan`

Required fields:

- opportunity summary
- recommended solution path
- first 3 practical steps
- what AppEngine can build/help with
- what the person or community leader must clarify
- needed resources
- risks/blockers
- suggested timeline
- next review prompt
- source-of-truth files
- guardrails

## Plan Types

Supported plan types:

- `app_tool_workflow_plan`
- `content_resource_plan`
- `community_ministry_model_plan`
- `ecosystem_service_later_plan`
- `needs_more_info_plan`

## Boundaries

This step must not:

- create build packets
- create vNext packets
- create GitHub issues
- add labels
- trigger Codex
- deploy production
- create paid resources
- run migrations
- add secrets or env vars
- change repository visibility
- assume Spark, Live On Mission, Best Life, or any ecosystem app is fully built

## Owner Review

The owner-readable output should be plain and practical.

It should help Lincoln decide whether to:

- approve the first practical step
- ask for more clarification
- pause the opportunity
- later create a packet or non-app plan through an explicit approval path

## Success Criteria

The action plan is successful when it gives the owner a useful next step while keeping AppEngine out of premature build mode.
