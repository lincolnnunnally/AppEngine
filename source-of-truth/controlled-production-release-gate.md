# Controlled Production Release Gate

## Purpose

The Controlled Production Release Gate decides whether AppEngine has enough evidence for first controlled production use.

This is the evidence gate for the Step 4 controlled deploy path. When the gate passes, AppEngine may use the existing provider project within configured limits, then verify the live target.

Use artifact kind:

```text
controlled_production_release_gate
```

## Required Evidence

The gate must require:

- durable state readiness
- durable schema migration dry-run evidence
- production auth owner confirmation
- runtime monitoring review
- audit trail review
- rollback notes
- launch blocker status
- owner approval notes

## Blocking Behavior

The gate must fail honestly when required evidence is missing.

Status values:

- `blocked_pending_evidence`
- `approved_for_first_controlled_use`

When the gate is approved, deployment is still controlled: it must use the existing provider project, stay within configured spend limits, and be followed by live verification.

## Guardrails

The gate must not:

- run an unreviewed production deploy
- create new paid resources
- apply live migrations
- write to production databases
- add or change secrets/env vars
- create a new provider project
- exceed configured provider/spend limits
- change repository visibility
- trigger Codex automatically
- create GitHub issues
- apply labels
- auto-merge generated app code

## Success

The gate succeeds when Lincoln can see one owner-readable artifact showing:

- what evidence is present
- what evidence is missing
- whether controlled production use is blocked
- what the next safe action is
- whether the existing controlled deploy path is ready
