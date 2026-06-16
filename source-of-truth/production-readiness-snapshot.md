# Production Readiness Snapshot

## Purpose

AppEngine needs a blunt, owner-readable snapshot of how close the factory is to production use. The snapshot is an assessment artifact only. It does not deploy, provision, migrate, change settings, create issues, apply labels, run Codex, or merge code.

## Artifact

Create a `production_readiness_snapshot` artifact when evaluating whether AppEngine is ready for broader production use.

Statuses:

- `not_ready`
- `partially_ready`
- `ready_for_limited_owner_review`
- `blocked`

## Required Assessment Areas

Every snapshot must assess:

- auth/admin protection
- persistence
- privacy/security
- deployment readiness
- monitoring/logging
- cost/resource risk
- user-facing UX
- remaining blockers

## Owner-Readable Output

The owner-readable summary should answer:

- what is safe now
- what is not ready
- what is blocking production readiness
- what the highest-leverage next improvement is
- what the next safe action should be

## Machine-Readable Contract

The artifact should include:

- app or system name
- status
- confidence
- category assessments
- remaining blockers
- highest-leverage improvements
- next safe action
- evidence links or source files
- owner-readable summary
- guardrails

## Guardrails

The snapshot must keep these actions blocked unless separately approved:

- production deployment
- paid resource creation
- database migrations
- secrets or environment changes
- repository visibility changes
- GitHub issue creation
- label changes
- automatic Codex execution
- generated app auto-merge

## Success

The snapshot is useful when Lincoln can read one assessment and understand whether AppEngine is ready for production, what still blocks it, and which next improvement matters most.
