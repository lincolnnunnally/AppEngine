# App Selection Standard

AppEngine must identify whether a request belongs to a new app or an existing app before any agent plans work.

## Selection Sources

Use durable repo and GitHub sources before chat memory:

- App charter files
- Super Admin registry entries
- Current version records
- Release history
- Monitoring reports
- Known issues
- Open GitHub issues
- App aliases documented in source-of-truth files

## Matching Rules

App selection should consider:

- Exact app name match
- Stable slug match
- Documented alias match
- GitHub issue labels or app tags
- Super Admin registry app id
- Charter path
- Request wording and action verbs

Confidence should increase when multiple durable sources agree. Confidence should decrease when the request depends on pronouns like "this app," when multiple apps match, or when the request mentions an app-like name that is not in the registry or charters.

Shared ecosystem philosophy is not enough to merge app purposes. Apps may all serve Life Produces Life while still having different audiences, barriers, workflows, and success definitions.

## New App vs Existing App

Treat a request as a new app when:

- It uses create/build/start language.
- No existing app or alias confidently matches.
- The request describes a new audience, purpose, or charter.

Treat a request as an existing-app request when:

- It names a known app, slug, alias, charter, registry entry, or release.
- It uses improve, add, fix, update, v2, easier, feedback, or monitoring language.
- The request should preserve current users, release history, Super Admin registry, and monitoring state.

Pause for clarification when:

- The request could be either new app creation or existing-app improvement.
- The request references "this app" without a durable source.
- Two or more existing apps match.
- The requested change would cross app boundaries without an integration reason.

## Existing-App Load Requirement

Before routing to vNext, agents must load:

- Existing app charter
- Super Admin registry entry
- Current version
- Release history
- Monitoring state
- Known issues
- Open issues
- Active request

If any required source is missing, the intake packet must record it in `missingContext` and route to clarification or context gathering instead of implementation.

## Boundary Guardrails

- Apps share philosophy but do not share purpose.
- Do not import another app's audience, data, features, or workflows unless a documented connection approves it.
- Do not let an existing-app improvement restart the whole app.
- Do not let a new-app idea attach itself to a similarly named existing app without confidence and evidence.
- Do not create one issue that tries to improve multiple apps unless the issue is explicitly about a cross-app integration.
- Do not create provider resources, deployment work, or production changes during app selection.

## Selection Outcomes

The selector must choose exactly one outcome:

| Outcome | Meaning | Next packet |
| --- | --- | --- |
| `new` | A new app should be planned. | `app_build_packet` |
| `existing` | A known app should be improved. | `vnext_packet` |
| `ambiguous` | More context is needed. | `intake_clarification` |
| `multi_app` | Multiple apps matched. Split or clarify. | `intake_clarification` |

## Machine Shape

App selection data should appear inside the `intake_packet` artifact:

```json
{
  "inferredApp": {
    "name": "Spark of Hope",
    "slug": "spark-of-hope",
    "status": "existing",
    "candidates": [
      {
        "name": "Spark of Hope",
        "slug": "spark-of-hope",
        "matchedBy": ["name", "alias"],
        "currentVersion": "v1",
        "charterPath": "source-of-truth/charters/spark-of-hope.md"
      }
    ]
  },
  "appContext": {
    "charterLoaded": true,
    "registryLoaded": true,
    "currentVersionLoaded": true,
    "releaseHistoryLoaded": true,
    "monitoringLoaded": true,
    "knownIssuesLoaded": true,
    "openIssuesLoaded": true
  }
}
```
