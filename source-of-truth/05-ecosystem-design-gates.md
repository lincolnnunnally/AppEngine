# Ecosystem Design Gates

Every feature, app, workflow, ministry, service, website, business, or project must answer these questions before it moves from idea to implementation or release.

## Required Questions

1. What barrier does this remove?
2. What need does this address?
3. How does this help someone move toward life?
4. How does this help someone become a source of life for others?

## Gate Rule

If these questions cannot be answered, challenge or reject the feature.

## GATCA gate (wired ≠ working)

A feature that is written, routed, and deployed is still not done if the person
cannot finish the labeled job. See LPL `13_GATCA__WIRED_IS_NOT_WORKING.md` (DC-12).

Release is blocked when:

- The only evidence of done is HTTP 200, a passing build, or an `onClick` that exists.
- A primary CTA swallows errors (`except: pass`, empty `catch`, "no results" on failure).
- Success is shown for work that did not finish (send, provision, pay, publish).
- The live path is a dead alternate (e.g. SSH on serverless) while a working path sits unused.

New App Engine modules must fail loud and prove the customer URL/action before
the UI may say it worked.

Agents may also clarify, reduce, or postpone the work when the answers are weak but the intent appears valuable.

## Planning Expectations

App Build Packets, vNext Packets, charters, architecture plans, design briefs, release gates, and review reports should preserve answers to these questions when they affect scope.

Agents should not treat these answers as decorative mission language. They are functional constraints that shape what gets built, what is excluded, and what should be reviewed before release.

## Review Expectations

Reviewer, Designer, Customer Perspective, Workflow Tester, and Release Gate outputs should challenge work that:

- Adds features without removing a real barrier.
- Creates engagement without transformation.
- Makes people more dependent on the system.
- Blurs app purpose or imports another app's goals.
- Ignores the audience's real emotional, practical, privacy, agency, or accessibility needs.
