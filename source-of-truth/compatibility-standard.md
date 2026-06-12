# Cross-Browser, Mobile, and Platform Compatibility Standard

Every generated app must include a compatibility plan before Release Gate approval.

The standard prevents apps from launching when they only work in the builder's default browser or desktop viewport.

## Required Platforms

Test these platforms whenever practical:

- iPhone Safari
- iPad Safari
- Desktop Safari
- Chrome mobile
- Chrome desktop
- Edge desktop
- Firefox desktop

If a platform cannot be tested directly, the agent must record the gap and create follow-up work instead of silently approving release.

## Required Viewports

Compatibility checks should cover common small, tablet, and desktop sizes:

- 360 x 640
- 390 x 844
- 430 x 932
- 768 x 1024
- 1024 x 768
- 1280 x 720
- 1440 x 900

Agents may add more viewports for app-specific audiences.

## Required Checks

Every compatibility test plan must cover:

- Mobile-first responsive layout
- Navigation and primary action visibility
- Touch targets
- Forms and validation
- Auth flows and redirects
- File uploads if used
- Payments if used
- Admin screens
- Super Admin status surfaces
- Loading, empty, and error states
- Browser-specific API usage and fallbacks

## Guardrails

Agents must stop or create follow-up work when:

- iPhone/iPad Safari has unresolved layout, auth, form, upload, or payment issues.
- A common browser breaks the primary workflow.
- Touch targets are too small or clustered on mobile.
- Forms cannot be completed on mobile.
- Auth redirects fail in Safari or mobile browsers.
- File uploads or payments are used but not tested on mobile and Safari.
- Admin or Super Admin screens are unusable on tablet or desktop.
- Compatibility testing is missing before Release Gate approval.

## Machine Shape

Agents should produce compatibility artifacts with this shape:

```json
{
  "kind": "compatibility_test_plan",
  "schemaVersion": 1,
  "app": {
    "name": "App name",
    "slug": "app-slug"
  },
  "browserSupport": [
    {
      "id": "iphone_safari",
      "browser": "Safari",
      "platform": "iPhone",
      "required": true,
      "status": "required"
    }
  ],
  "viewports": ["390x844", "768x1024", "1440x900"],
  "checks": [
    {
      "id": "touch_targets",
      "status": "required",
      "question": "Can the primary workflow be completed comfortably with touch?"
    }
  ],
  "conditionalChecks": {
    "fileUploadsIfUsed": true,
    "paymentsIfUsed": true
  },
  "guardrails": {
    "blocksReleaseGateApproval": true,
    "safariMobileRequired": true,
    "commonBrowsersRequired": true,
    "unresolvedCompatibilityIssuesBlockRelease": true
  }
}
```
