# App Improvement and vNext Packet Standard

Existing apps must be improved with a vNext Packet instead of restarting the app as a new build.

Use this standard for requests such as:

- Improve this app
- Add this feature
- Fix this problem
- Make version 2
- Respond to user feedback
- Make the app easier for a specific audience to use

## Required Context

Before planning an improvement, agents must load:

- Existing app charter
- Current version
- Super Admin registry entry
- Current deployment environment
- Provider/cost review
- Monitoring data
- Known issues
- User feedback or request
- Release history
- Current source-of-truth docs and active task

If this context is missing, the agent should create a context-gathering follow-up instead of inventing the current app state.

## Improvement Path

Use this path for existing apps:

```text
existing app
-> vNext packet
-> impact and boundary review
-> provider/cost delta
-> design/review/build/test
-> release gate
-> updated monitored version
```

## Versioning Rules

- Small safe improvements may release as `v1.1`, `v1.2`, or another patch/minor version.
- Major changes may release as `v2`.
- Improvements must state whether they are bug fixes, feature additions, UX improvements, operations fixes, growth changes, or monitoring responses.
- Improvements must not restart the whole app unless the vNext packet explicitly calls for a rebuild and explains why.
- Improvements must not pull in another app's goals, audience, data, or workflows without a documented integration reason.

## Guardrails

Agents must stop or create follow-up work when:

- The existing app charter is missing.
- The current version or release history is unknown.
- The Super Admin registry entry is missing.
- Monitoring data or known issues were not checked.
- The improvement would change app identity, audience, or boundaries without approval.
- The improvement needs new paid providers but no provider/cost delta exists.
- The improvement skips design, compatibility, workflow testing, or release gates.
- The improvement is broad enough to need a new App Build Packet or explicit v2 packet.

## Machine Shape

Agents should produce vNext packet artifacts with this shape:

```json
{
  "kind": "vnext_packet",
  "schemaVersion": 1,
  "app": {
    "name": "App name",
    "slug": "app-slug",
    "currentVersion": "v1",
    "targetVersion": "v1.1"
  },
  "context": {
    "charterLoaded": true,
    "registryLoaded": true,
    "monitoringLoaded": true,
    "knownIssuesLoaded": true,
    "releaseHistoryLoaded": true
  },
  "change": {
    "requestType": "feature | fix | ux | operations | growth | monitoring | v2",
    "summary": "What should improve",
    "nonGoals": ["What this improvement must not become"]
  },
  "providerCostDelta": {
    "newPaidResourcesExpected": false,
    "costReviewRequired": true
  },
  "phases": [],
  "guardrails": {
    "doNotRestartWholeApp": true,
    "preventGoalBleed": true,
    "releaseGateRequired": true
  }
}
```
