# Spark Follow-Up Review Slice

## Goal

Spark of Hope Intake Lite review items may record owner follow-up notes and a recommended next step before any public preview or persistence work continues.

## Scope

- This is a local/mock review enhancement only.
- Review items can track `followUpNotes` and `recommendedNextStep`.
- Review statuses may include `follow_up_needed`, `encouragement_sent`, and `ready_for_public_preview`.
- `ready_for_public_preview` is not public publishing approval.
- Public preview remains limited to `approved_for_preview` items only.

## Guardrails

- No production deployment.
- No paid resources.
- No migrations.
- No secrets or environment changes.
- No GitHub issue creation, labels, Codex execution, or auto-merge.
- No public sharing unless an item is explicitly `approved_for_preview`.
- No private story body, email, contact details, or mentor matching is exposed from this queue.

## Acceptance Criteria

- Spark review queue items include owner-editable follow-up notes.
- Spark review queue items include an owner-editable recommended next step.
- Follow-up statuses are available in the local/mock review queue.
- Approved preview filtering excludes all statuses except `approved_for_preview`.
- A copyable next prompt summarizes follow-up and ready-for-preview counts without triggering automation.
