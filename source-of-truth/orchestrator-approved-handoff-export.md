# Orchestrator Approved Handoff Export

## Purpose

AppEngine may prepare a Codex handoff, but Lincoln remains the approval point before that handoff becomes a prompt he copies and sends. This standard defines the safe export step between a prepared handoff and a manual Codex prompt.

## Input

Use a `handoff_relay_summary` whose source is `orchestrator_prepared_handoff` and whose merge status is `prepared`.

The prepared handoff must include:

- current project state
- reason for the next action
- exact suggested Codex prompt
- guardrails
- required verification
- expected result
- dependencies
- evidence when available

## Artifact

Create an `orchestrator_approved_handoff_export` artifact only after owner approval.

Required fields:

- source handoff id
- approval status
- exact exported Codex-ready prompt
- guardrails
- required verification
- expected result
- owner-readable summary
- Project Memory update intent
- execution flags proving nothing was sent or triggered

## Owner-Readable Output

The output should tell Lincoln:

- which prepared handoff was approved
- what prompt is ready to copy
- what checks should be run after Codex acts
- what result is expected
- what guardrails remain active

## Guardrails

This step must not:

- trigger Codex automatically
- create GitHub issues
- apply labels
- deploy production
- create paid resources
- apply migrations
- change secrets or environment variables
- change repository visibility
- auto-merge generated app code

## Success

The handoff is useful when Lincoln can copy one clear prompt from the Handoff Inbox, Project Memory records the export, and AppEngine still performs no external action automatically.
