# Spark Review Queue Lite

## Goal

Add a small owner-review slice for Spark of Hope Intake Lite so private preview submissions can be triaged without turning the app into a public publishing workflow.

## Scope

- Stay inside the Spark of Hope Intake Lite route, library, and source-of-truth lane.
- Use local/mock queue persistence only.
- Show safe metadata for submitted items: safe identifier, title/name, category/struggle, hope outcome, status, submitted date, safety/moderation note, and owner review notes.
- Add a copyable next prompt for the next Spark improvement.

## Review Statuses

- `new`
- `needs_review`
- `approved_for_preview`
- `needs_followup`
- `hidden`

## Guardrails

- No public publishing by default.
- No private story body, email, or contact details appear in the review queue.
- No automatic sharing.
- No mentor matching.
- No Codex trigger.
- No GitHub issue creation.
- No label changes.
- No production deploy.
- No paid resources.
- No migrations.
- No secrets or environment changes.

## Owner Notes

The queue is a private, local preview aid. It helps the owner see how submitted Spark stories could be reviewed before AppEngine introduces durable admin storage, moderation workflows, or mentor/community routing.

## Next Safe Action

Review the local queue behavior and decide whether the next Spark improvement should be controlled review persistence, admin authentication, or moderation workflow design.
