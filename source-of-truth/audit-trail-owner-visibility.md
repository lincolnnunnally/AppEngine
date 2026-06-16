# Audit Trail Owner Visibility

## Goal

AppEngine must let the owner see recent audit activity without opening workflow logs, raw JSONL files, or private local state.

This layer reads Audit Trail Lite events and produces an owner-safe report. It is visibility only.

## Artifact

`audit_trail_owner_visibility`

Required fields:

- `kind`
- `schemaVersion`
- `generatedAt`
- `storage`
- `ownerReadableSummary`
- `events`
- `guardrails`

Each owner-visible event must include:

- event time
- event type
- source
- summary
- safe status
- subject id when safe
- filtered metadata preview

## Privacy Rules

Owner-facing audit views must not expose private/raw fields by default.

Filtered metadata includes keys or values that look like:

- secrets
- tokens
- passwords
- credentials
- API keys
- auth fields
- email
- phone
- contact information
- private notes
- raw story/body text

The owner view may show that private fields were filtered, but should not show their values.

## Storage

Current storage is `local_mock_jsonl`.

Future durable storage may reuse the same report contract, but this PR does not enable a database adapter, create migrations, or send events to an external logging service.

## Owner View

The Owner Control Center should show:

- recent audit events
- event time
- event type
- source
- summary
- safe status
- whether private fields were filtered

## Guardrails

This standard does not:

- deploy production
- create paid resources
- apply migrations
- change secrets or env vars
- change repository visibility
- trigger Codex automatically
- create GitHub issues
- apply labels
- auto-merge generated code

## Success Criteria

1. Audit events are visible to the owner from one place.
2. Sensitive/private fields are filtered before display.
3. The report stays local/mock only.
4. The owner can understand recent AppEngine activity without reading workflow logs or raw files.
