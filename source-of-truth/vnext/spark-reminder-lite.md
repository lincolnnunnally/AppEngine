# Spark Contributor Reminder Lite

## Goal

Spark of Hope Intake Lite may capture a contributor's preference to be reminded later about follow-up testimony, while keeping all reminder behavior local/mock and owner-reviewed.

## Scope

- Add reminder preference fields to the Spark submission form.
- Add a local/mock reminder queue for owner review.
- Show reminder items with safe metadata only.
- No emails, texts, push notifications, calendar events, or external reminders are sent.
- Reminder status does not publish stories and does not approve public preview.

## Reminder Preferences

- `none`
- `one_week`
- `one_month`
- `after_encouragement`

## Reminder Statuses

- `pending_review`
- `ready_to_remind`
- `reminder_noted`
- `closed`

## Guardrails

- No production deployment.
- No paid resources.
- No migrations.
- No secrets or environment changes.
- No GitHub issue creation, labels, Codex execution, or auto-merge.
- No private story body, email, or contact details appear in reminder items.
- No public sharing unless a review item is separately `approved_for_preview`.

## Acceptance Criteria

- Spark submissions include reminder preference fields.
- Reminder requests create local/mock queue items only.
- The owner can review reminder items in the Spark page.
- The reminder queue clearly states that no notifications are sent.
- Smoke coverage proves reminder queue creation, status updates, and no-notification guardrails.
