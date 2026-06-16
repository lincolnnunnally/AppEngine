# Controlled Production Release Gate

## Purpose

The Controlled Production Release Gate decides whether AppEngine has enough evidence for first controlled production use.

This is not a deployment workflow. It is the owner approval gate before any separate production deployment action can be considered.

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

Even when the gate is approved, production deployment is not automatic. A separate owner-approved production deployment workflow is still required.

## Guardrails

The gate must not:

- deploy production
- create paid resources
- apply live migrations
- write to production databases
- add or change secrets/env vars
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
- why production deployment still requires a separate explicit approval
