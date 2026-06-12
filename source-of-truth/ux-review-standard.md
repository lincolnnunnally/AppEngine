# UX Review Standard

Every generated app must receive a UX review before release-gate approval.

The UX review checks whether the app can be used by the intended audience without Lincoln, ChatGPT, Codex, or an admin explaining what to do.

## Required UX Checks

Review these surfaces whenever they exist:

- First screen
- Main user workflow
- Mobile workflow
- Empty states
- Error states
- Loading or pending states
- Onboarding
- Account/profile area
- Admin screens
- Super Admin status surface
- Billing/status screens when billing exists
- Monitoring or incident screens when operations are visible

## Review Questions

The review must answer:

- Who is this screen for?
- What is the primary action?
- What happens if there is no data yet?
- What happens when something fails?
- Does mobile feel first-class?
- Does the language feel clear and human?
- Does the experience build trust?
- Does the tone fit the audience and problem?
- Can an admin understand what needs attention?
- Is anything technically present but emotionally or practically confusing?

## Workflow Test Checks

Workflow Tester should include UX checks for:

- User path
- Mobile path
- Empty state path
- Error state path
- Onboarding path
- Admin path
- Super Admin status path when relevant

## Guardrails

Agents must not approve release when:

- UX review is missing.
- The app has no clear first action.
- Mobile layout is untested.
- Empty or error states are missing for the primary workflow.
- Admin surfaces are placeholder-only but required for launch.
- The app feels cold, generic, or mismatched to a sensitive audience.

## Machine Shape

Agents may attach UX findings to a `design_review` artifact:

```json
{
  "kind": "design_review",
  "schemaVersion": 1,
  "uxReview": {
    "required": true,
    "status": "required",
    "surfaces": ["first screen", "main workflow", "mobile", "empty states", "error states", "onboarding", "admin screens"],
    "releaseBlockingIssues": []
  },
  "workflowTestChecks": ["mobile", "empty states", "error states", "onboarding", "admin screens"],
  "followUpTasks": []
}
```
