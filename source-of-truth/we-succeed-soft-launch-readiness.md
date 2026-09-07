# App Engine Soft-Launch Readiness

**Lock 2026-09-07:** App Engine is **not** we-succeed.org. This document is App
Engine Step 4 soft-launch readiness. It is **not** a We Succeed product, brand,
or host lock. `we-succeed.org` / `www.we-succeed.org` is reserved for a different
future use — do not invent that product and do not put an App Engine brand on
we-succeed.

Canonical App Engine soft-launch host (factory):

```text
https://appengine.unitedundergod.org
```

Owner desk (not the Step 4 factory target):

```text
https://dashboard.unitedundergod.org
```

## Historical identifier

Use artifact kind:

```text
we_succeed_soft_launch_readiness
```

That kind name is a **historical Continuity identifier** for App Engine Step 4
soft-launch readiness, now targeting `https://appengine.unitedundergod.org`.
It does **not** mean We Succeed is App Engine, and it does not authorize any
we-succeed.org work.

File names (`we-succeed-soft-launch-readiness.ts` / this markdown) stay for
Continuity. The owner-readable title is **App Engine Soft-Launch Readiness**.

## Purpose

The App Engine Soft-Launch Readiness artifact is the Step 4 proof checklist for
App Engine itself.

It answers whether the current App Engine / Opportunity app is ready for the
first controlled deploy path at:

```text
https://appengine.unitedundergod.org
```

## Scope

This is only for the current App Engine soft-launch lane:

- `appengine.unitedundergod.org` as the locked target URL
- `/api/health` as the public read-only health check
- the problem door at `/problem-intake-lite`
- the build door at `/opportunity-intake`
- owner control at `/owner-control-center`
- owner login before intake access
- provider/spend controls staying inside configured limits
- no new ecosystem app work
- no We Succeed product invention

Existing App Engine routes (verified in this repo):

- `src/app/api/health/route.ts` → `/api/health`
- `src/app/(cockpit)/problem-intake-lite/page.tsx` → `/problem-intake-lite`
- `src/app/(cockpit)/opportunity-intake/page.tsx` → `/opportunity-intake`
- `src/app/(cockpit)/owner-control-center/page.tsx` → `/owner-control-center`

Do not invent Stripe or password doors.

## Required Evidence

The readiness artifact must require:

- target URL is locked to `https://appengine.unitedundergod.org`
- public health check path is `/api/health`
- both door routes are source-wired
- production auth source readiness is not blocked
- owner login is verified on the target
- live `/api/health` returns ok
- problem door reaches its intake end to end with the rail intact
- build door reaches its intake end to end with the rail intact
- provider/spend guardrail is verified on the real deploy path
- controlled production release gate evidence is clear
- rollback notes are reviewed
- owner approval notes are present when needed

## Blocking Behavior

Status values:

- `blocked_pending_evidence`
- `ready_for_controlled_deploy`

The artifact must fail honestly until live target evidence and provider/spend
guardrail evidence exist.

## Guardrails

The artifact must not:

- create new paid resources
- work on ChurchConnect (PRs 221 / 222 / 287 / 293 are out of scope)
- work on ecosystem apps
- run database migrations
- expose secrets
- change provider settings silently
- invent Stripe or password auth
- use a different target URL (including we-succeed.org)
- treat a working root page as proof that both doors work
- put an App Engine brand on we-succeed.org

## Leftover-preview notes

Leftover-preview of this App Engine branch is `app-engine-*.vercel.app`. Use it
to prove the **readiness lock**, not to invent a we-succeed host.

- Readiness target in source must be `https://appengine.unitedundergod.org`.
  we-succeed.org must not appear as `productionOrigin` / locked Step 4 target.
- Leftover-preview still exposes the existing App Engine doors:
  `/api/health`, `/problem-intake-lite`, `/opportunity-intake`,
  `/owner-control-center`. Unsigned visitors may land on `/soft-launch` (App
  Engine face). That is existing gate behavior, not a new product.
- Owner desk remains `https://dashboard.unitedundergod.org`. Desk leftover-preview
  walks are unchanged by this retarget.
- ChurchConnect leftover-preview walks (PRs 221 / 222 / 287 / 293) are out of
  scope. Do not retarget those branches from this lock.
- Do not treat leftover-preview or www.we-succeed.org as a We Succeed App Engine
  brand launch.

**HOLD MERGE until CoS leftover-preview PASS.**

## CoS leftover-preview walk

PASS only when all of the following are true:

1. Artifact / source lock: `target.productionOrigin` is
   `https://appengine.unitedundergod.org` (not we-succeed.org).
2. Leftover-preview `GET /api/health` returns ok.
3. Leftover-preview still has `/problem-intake-lite` and `/opportunity-intake`
   (existing App Engine doors; unsigned may redirect to `/soft-launch`).
4. Leftover-preview `/soft-launch` is App Engine copy — not a We Succeed brand
   on we-succeed.org.
5. Do not walk ChurchConnect 221 / 222 / 287 / 293 as proof of this leftover.
6. Do not invent Stripe or password on the walk.

## Success

The artifact succeeds when Lincoln and the agents can see one owner-readable
Step 4 record showing:

- what target is being launched (`appengine.unitedundergod.org`)
- which live checks passed
- which checks still block deploy/readiness
- whether provider/spend controls are proven
- what the next safe action is
