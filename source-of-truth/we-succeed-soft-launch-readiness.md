# We Succeed Soft-Launch Readiness

## Purpose

The We Succeed Soft-Launch Readiness artifact is the Step 4 proof checklist for AppEngine itself.

It answers whether the current AppEngine/Opportunity app is ready for the first controlled deploy path at:

```text
https://we-succeed.org
```

Use artifact kind:

```text
we_succeed_soft_launch_readiness
```

## Scope

This is only for the current AppEngine soft-launch lane:

- we-succeed.org as the target URL
- `/api/health` as the public read-only health check
- the problem door at `/problem-intake-lite`
- the build door at `/opportunity-intake`
- owner login before intake access
- provider/spend controls staying inside configured limits
- no new ecosystem app work

## Required Evidence

The readiness artifact must require:

- target URL is locked to `https://we-succeed.org`
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

The artifact must fail honestly until live target evidence and provider/spend guardrail evidence exist.

## Guardrails

The artifact must not:

- create new paid resources
- work on ChurchConnect
- work on ecosystem apps
- run database migrations
- expose secrets
- change provider settings silently
- use a different target URL
- treat a working root page as proof that both doors work

## Success

The artifact succeeds when Lincoln and the agents can see one owner-readable Step 4 record showing:

- what target is being launched
- which live checks passed
- which checks still block deploy/readiness
- whether provider/spend controls are proven
- what the next safe action is
