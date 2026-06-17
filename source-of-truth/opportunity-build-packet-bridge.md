# Opportunity Candidate to Build Packet Bridge

The Opportunity Candidate to Build Packet Bridge connects the Opportunity engine to the existing AppEngine factory pipeline.

It uses `opportunity_appengine_candidate` as input and produces an owner-reviewable `opportunity_build_packet_bridge` artifact.

This bridge must reuse the existing AppEngine packet standards and approval path. It must not create a parallel planning system.

## Purpose

The bridge answers:

- Which Opportunity candidate is being considered?
- What source opportunity intake, clarification, solution path, action plan, and candidate produced it?
- Which solution type was selected?
- Which review-ready packet draft is recommended?
- What information is still missing?
- What is the owner approval status?
- What is the next safe AppEngine step?

## Input Artifact

Required input:

- `opportunity_appengine_candidate`

The bridge must preserve source references to:

- opportunity intake
- opportunity clarification
- opportunity solution path
- opportunity action plan
- Opportunity AppEngine candidate

## Artifact

Machine-readable artifact:

- `opportunity_build_packet_bridge`

## Draft Outputs

The bridge may produce one review-ready draft recommendation:

- `app_build_packet_draft`
- `workflow_solution_plan_draft`
- `content_resource_plan_draft`
- `community_model_plan_draft`

These are draft recommendations only.

They are not final packets.

They do not authorize implementation.

## Existing Pipeline Reuse

The bridge should connect to the existing packet path:

1. Packet draft review
2. Packet draft approval
3. Final packet materialization
4. Phase creation approval
5. Phase issue generation
6. Manual publishing or later approved automation

The bridge must not skip those steps.

## Required Fields

The artifact must include:

- source opportunity references
- candidate summary
- selected solution type
- recommended packet draft
- missing information
- owner approval status
- next AppEngine step
- owner-readable report
- copyable next AppEngine prompt
- source-of-truth files
- guardrails

## Boundaries

This bridge must not:

- create final App Build Packets
- create final workflow solution plans
- create final content/resource plans
- create final community model plans
- create phase issues
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

The owner-readable output should clearly state:

- candidate
- selected draft
- why the draft was selected
- owner approval status
- missing information
- next safe action
- guardrails

## Success Criteria

The bridge succeeds when an Opportunity candidate can enter the existing AppEngine packet approval path as a review-ready draft without creating final packets, issues, labels, Codex runs, deployments, or parallel packet standards.
