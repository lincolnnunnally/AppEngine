# Spark Public Preview Safety Slice

## Goal

Move Spark of Hope Intake Lite closer to a useful public preview while keeping private stories, contact details, and unreviewed submissions out of the public-facing view.

## Approved-Only Rule

Only items with status `approved_for_preview` may appear in the approved public preview list.

These statuses must not appear in the public preview list:

- `new`
- `needs_review`
- `needs_followup`
- `hidden`

## Storage

This slice uses local/mock queue persistence only. It does not create database tables, migrations, provider resources, GitHub issues, labels, or Codex triggers.

## Public Preview Safety

- No public publishing beyond the approved preview list.
- No private story body exposure.
- No email/contact exposure.
- No auto-sharing.
- No mentor matching.
- No production deploy.
- No paid resources.
- No migrations.
- No secrets or environment changes.

## Owner Notes

The approved preview list is a visible safety boundary. It lets the owner see what could be shown publicly later while proving hidden or unreviewed items stay out of the public preview surface.
