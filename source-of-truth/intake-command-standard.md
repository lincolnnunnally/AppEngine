# Intake Command Standard

Natural language requests must become structured intake packets before AppEngine plans, builds, fixes, or improves an app.

Use this standard for requests such as:

- Build this app
- Start AppEngine build
- Create a new app for this idea
- Improve Spark of Hope
- Add this feature to Toner Management
- Fix this problem
- Make version 2
- Respond to user feedback

## Purpose

The intake layer decides what the request is, which app it belongs to, and which workflow should run next. It prevents raw chat text from becoming a giant Codex task.

## Required Intake Path

Use this path for every natural language request:

```text
ChatGPT handoff issue or natural request
-> problem_solution_intake when the request starts from a problem, solution vision, or hybrid
-> problem_portfolio_routing when the clarified problem or vision becomes a portfolio candidate
-> solution_candidate_review before App Build Packet, vNext Packet, or non-app solution plan requests
-> intake packet
-> app selection
-> correct workflow
-> App Build Packet or vNext Packet
-> agent loop
```

Use `source-of-truth/problem-to-solution-intake-standard.md` before normal app selection when Lincoln has noticed a problem but has not chosen a solution, when the request has a solution vision that still needs shape/scope validation, or when the right answer might be a website, workflow/process, automation, content/resource, community/ministry model, or multi-part ecosystem solution instead of only an app.

Use `source-of-truth/problem-portfolio-routing-standard.md` after `problem_solution_intake` and before App Build Packet or vNext Packet creation when the clarified problem or vision should become a tracked solution candidate in the app portfolio.

Use `source-of-truth/solution-candidate-review-gate.md` after `problem_portfolio_routing` to decide whether the tracked candidate needs clarification, is blocked, or is ready for an App Build Packet request, vNext Packet request, or non-app solution plan request.

## Request Types

The intake packet must classify the request as one of:

- `new_app`: create a new app or app idea.
- `improvement`: improve an existing app without restarting it.
- `feature`: add a feature to an existing app.
- `fix`: repair an existing app problem.
- `v2`: plan a major existing-app version.
- `feedback`: respond to user feedback for an existing app.
- `ambiguous`: pause because the app, intent, or scope is unclear.
- `multi_app`: pause or split because more than one app is in scope.

## Routing Rules

- All requests must load Ecosystem Philosophy, Global Principles, Life Produces Life, App Purpose Rules, and Ecosystem Design Gates before routing to build or improvement work.
- New-app and existing-app requests must preserve the difference between shared philosophy and app-specific purpose.
- Intake should challenge requests that cannot name the barrier removed, need addressed, movement toward life, and transformation outcome.
- New app requests must route to an `app_build_packet` before implementation.
- Existing app requests must route to a `vnext_packet` only after loading existing app context.
- Ambiguous app names must route to clarification.
- Multi-app requests must be split into one issue per app unless a documented integration reason exists.
- Requests that violate an app charter or boundaries must stop before planning.
- Raw intake must never trigger direct production deployment.

## Required Existing-App Context

Before creating a vNext packet, intake must load:

- Existing app charter
- Super Admin registry entry
- Current version
- Release history
- Monitoring state
- Known issues
- Open issues
- Active request source

If this context is missing, create a context-gathering or clarification follow-up instead of creating the vNext packet.

## Structured Issue Requirements

When intake creates or recommends a GitHub issue, the issue must include:

- Raw request
- Inferred app
- Request type
- Confidence
- Missing context
- Selected workflow
- Next labels
- ChatGPT handoff packet when the issue was created from a conversation
- Guardrails
- Source issue or source URL when available

## Guardrails

Agents must stop or create follow-up work when:

- The request says "this app" but no app can be identified.
- The request names multiple apps without an explicit integration task.
- The request could be either a new app or an existing-app improvement.
- The request would restart an existing app instead of using vNext.
- The request would build a new app without an App Build Packet.
- The request crosses another app's audience, data, workflows, or charter.
- The request asks for production deployment without release gate approval.
- The request depends only on chat memory and has no GitHub issue, repo file, or durable source.

## Machine Shape

Agents should produce intake packet artifacts with this shape:

```json
{
  "kind": "intake_packet",
  "schemaVersion": 1,
  "rawRequest": "Build this app",
  "inferredApp": {
    "name": "App name",
    "slug": "app-slug",
    "status": "new | existing | ambiguous | multi_app",
    "candidates": []
  },
  "requestType": "new_app | improvement | feature | fix | v2 | feedback | ambiguous | multi_app",
  "confidence": 0.85,
  "missingContext": [],
  "selectedWorkflow": {
    "packetKind": "app_build_packet | vnext_packet | intake_clarification",
    "nextGenerator": "scripts/create-app-build-packet.js",
    "recommendedLabels": ["ai:plan"],
    "reason": "Why this route was selected"
  },
  "nextIssueLabels": ["ai:plan"],
  "requiredExistingAppContext": [
    "app charter",
    "Super Admin registry entry",
    "current version",
    "release history",
    "monitoring state",
    "open issues"
  ],
  "guardrails": {
    "newAppsRequireAppBuildPacket": true,
    "existingAppsRequireVNextPacket": true,
    "requiresDisambiguationWhenAmbiguous": true,
    "blocksMultiAppRequests": true,
    "preventsBoundaryBleed": true
  }
}
```
