# Design Quality Gate

Every generated app must pass a Design Quality Gate before release-gate approval.

The gate prevents technically working apps from shipping with confusing navigation, unclear actions, cramped mobile layouts, unreadable copy, weak trust signals, or a visual tone that does not fit the audience.

## Required Standards

Each generated app must define and review:

- Simple navigation
- Clear primary action on every main workflow screen
- Mobile-first layout
- Readable copy
- Accessible spacing
- Accessible contrast
- Trust-building elements
- Audience-specific emotional fit
- Empty states
- Error states
- Loading states when relevant
- Onboarding path when the workflow needs first-time setup
- Admin screens when the app has owner, admin, support, billing, monitoring, or Super Admin surfaces

## Required Design Reviewers

Release Gate approval requires:

- Designer review
- Customer Perspective review

The Designer review checks structure, layout, hierarchy, action clarity, responsiveness, accessibility, states, and visual fit.

The Customer Perspective review checks trust, comprehension, emotional tone, friction, confidence, and whether the app feels useful to the intended audience.

## Guardrails

Agents must stop or create follow-up work when:

- The app is technically working but visually confusing.
- The primary action is missing, hidden, or competing with too many other actions.
- Mobile layout is cramped, overflowing, or lower quality than desktop.
- Copy is vague, cold, too technical, or mismatched to the audience.
- Empty states or error states leave the user stuck.
- Admin screens exist but are harder to understand than user screens.
- Trust-building elements are missing for sensitive workflows, payments, family, faith, health, service, or support contexts.
- Designer review or Customer Perspective review is missing before Release Gate approval.

## Machine Shape

Agents should produce design review artifacts with this shape:

```json
{
  "kind": "design_review",
  "schemaVersion": 1,
  "app": {
    "name": "App name",
    "slug": "app-slug",
    "audience": ["Primary user group"]
  },
  "reviewers": {
    "designerRequired": true,
    "customerPerspectiveRequired": true,
    "designerStatus": "required",
    "customerPerspectiveStatus": "required"
  },
  "qualityChecks": [
    {
      "id": "simple_navigation",
      "status": "required",
      "question": "Can the user understand where they are and where to go next?"
    },
    {
      "id": "clear_primary_action",
      "status": "required",
      "question": "Is the next best action obvious on the main workflow screens?"
    },
    {
      "id": "mobile_first_layout",
      "status": "required",
      "question": "Does the workflow feel complete and comfortable on mobile?"
    }
  ],
  "stateChecks": ["empty states", "error states", "loading states", "onboarding", "admin screens"],
  "guardrails": {
    "blocksReleaseGateApproval": true,
    "requiresDesignerReview": true,
    "requiresCustomerPerspectiveReview": true,
    "blocksUglyOrConfusingApps": true
  }
}
```
