# Spark Safe Public Trial Readiness

## Goal

Prepare Spark of Hope Intake Lite for safe limited public trial review without launching production, exposing private data, sending notifications, creating paid resources, or applying migrations.

## Scope

- Spark route, Spark local/mock library, Spark styling, and Spark smoke coverage only.
- No Owner Control Center changes.
- No orchestrator changes.
- No production deployment.
- No paid resources.
- No migrations.
- No secrets or environment changes.
- No automatic Codex execution, GitHub issue creation, or label changes.

## Required Safety Language

The Spark route must visibly state:

- Preview only. Spark of Hope Intake Lite is being tested with limited review, not publicly launched.
- This form is not emergency support, crisis counseling, or a replacement for local professional help.
- Crisis-support resources will be added after owner review.
- Do not add hotline numbers until the crisis-support copy is approved.

## Public Trial Readiness Checklist

The readiness gate should check:

1. Preview and emergency-support safety language is visible.
2. Crisis-support placeholder is present without hotline numbers.
3. Public preview list is approved-only.
4. Non-approved items stay private.
5. Local/mock storage remains the default.

## Review Gate

The `spark_public_trial_readiness` artifact has:

- `ready_for_limited_public_testing` when every checklist item passes.
- `not_ready` when the public preview list has no approved item or safety language is missing.

This gate is owner-readable only. It does not approve production launch.

## Guardrails

- No public launch from this checklist.
- No emergency-support claim.
- No crisis hotline numbers until owner-approved crisis-support copy exists.
- No private story body, email, or contact details in public preview areas.
- No public sharing unless an item is explicitly approved for preview.
- No mentor matching.
- No outbound reminders.
- No paid resources.
- No migrations.
- No production deploy.
- No secrets/env changes.
- No automatic Codex triggers.
