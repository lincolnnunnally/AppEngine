# Orchestrator to Handoff Bridge

The Orchestrator to Handoff Bridge turns a Manual Orchestrator result into a prepared Handoff Inbox entry.

It reduces Lincoln's relay work without removing owner approval.

## Purpose

When AppEngine runs the Manual Orchestrator, it already knows:

- current project state
- why a next safe action was selected
- the exact suggested Codex prompt
- dependencies
- expected result
- guardrails
- evidence

Lincoln should not have to manually translate that result into a handoff.

The bridge lets Lincoln save the selected `orchestrator_run` as a prepared `handoff_relay_summary` for owner review and copying.

## Owner Workflow

1. Lincoln presses `Run next safe step`.
2. AppEngine creates an `orchestrator_run`.
3. Lincoln reviews the decision.
4. Lincoln presses `Prepare Codex Handoff`.
5. AppEngine saves a prepared handoff into the Handoff Inbox.
6. Lincoln copies the prepared Codex prompt from the Handoff Inbox if it is right.

The bridge must not send the prompt automatically.

## Prepared Handoff Requirements

A prepared handoff must include:

- current project state
- reason for the next action
- exact suggested Codex prompt
- guardrails
- required verification
- expected result
- source `orchestrator_run` id
- dependencies
- evidence

The prepared handoff should be stored as a `handoff_relay_summary` with source `orchestrator_prepared_handoff`.

## Project Memory Update

When a prepared handoff is created, Project Memory should record:

- the source orchestrator run
- that a prepared handoff is waiting for owner review
- the next safe action
- that the Handoff Inbox is now the relay surface

Project Memory must not treat the prepared handoff as completed work by Codex. It is a reviewable prompt, not execution.

## Guardrails

The bridge must not:

- trigger Codex automatically
- create GitHub issues
- apply labels
- deploy production
- create paid resources
- apply migrations
- add secrets or env vars
- change repository visibility
- auto-merge generated app code

## Success Criteria

The feature works when Lincoln can run the Manual Orchestrator, press `Prepare Codex Handoff`, see the prepared handoff in the Handoff Inbox, copy the exact Codex prompt, and see Project Memory update without AppEngine taking any external action automatically.
