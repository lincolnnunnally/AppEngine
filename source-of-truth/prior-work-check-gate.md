# Prior-Work Check Gate

AppEngine must check for existing work in the target repo before any run becomes a
build packet. This gate is the standing answer to the recurring problem of
rebuilding something that already exists.

This gate runs after clarification/routing and **before** any App Build Packet,
vNext Packet, or non-app solution plan. It is blocking: a run may not become a
packet until the gate returns `extend_existing` (with targets) or a verified
`build_new`.

## Why This Exists

Runs like RUN-001 (ChurchConnect Visitor Capture) repeatedly proposed new
surfaces for capabilities that already existed in the target repo. The fix is not
agreement in chat; it is a gate that catches the duplication on its own, every
time, with evidence.

## Properties

The gate is:

- **Blocking.** It gates packet creation. A block is a hard stop, not a warning.
- **Evidence-validated.** Every "this already exists" claim must carry a concrete
  pointer: a file path, a route, or a table/column in schema evidence. No
  evidence, no claim.
- **Cross-repo.** It inspects the *target* repo (for example ChurchConnect), not
  AppEngine's own files.
- **Read-only.** It never writes to the target repo, runs migrations, deploys, or
  creates paid resources.

## The Two Rules

1. **Can't-see-the-repo = block.** If the gate cannot read the target repo, it
   returns `blocked_cannot_verify`. It must never assume "nothing exists, safe to
   build" from inability to look. Read access is separate from write access: a
   repo can be visible for the prior-work check even when the build handoff must
   happen elsewhere.
2. **Side-door rule.** If prior work exists for a capability, creating a new
   parallel surface (a "side door" around the existing one) is forbidden. The
   gate forces `extend_existing` and lists every proposed surface that collides
   with existing work as a side-door violation.

## Input

The gate takes a `prior_work_check` request:

- `request`: `runId`, `title`, `goal`.
- `targetRepo`: `name`, `candidatePaths` (ordered checkout locations to try),
  `backupSchemaPaths` (schema evidence such as a database backup).
- `capabilities[]`: each with `id`, `description`, and search hints
  (`componentHints`, `routeHints`, `tableHints`, `columnHints`).
- `proposedNewSurfaces[]`: the new components/routes/tables the run proposes to
  create, each tagged with the `capabilityId` it serves. These are what the
  side-door rule checks against existing work.
- `forbiddenSideDoors[]` (optional): named scope-creep patterns to forbid.

## Verdicts

- `extend_existing`: prior work found. The gate returns `extensionTargets`
  (existing surfaces to extend) and `sideDoorViolations` (proposed parallels to
  drop). Proceed by extending.
- `build_new`: target repo was readable and no prior work was found. Proceed to a
  fresh build packet.
- `blocked_cannot_verify`: target repo could not be read. Hard stop.

`passed` is true only for `extend_existing` and `build_new`. The runner exits
non-zero on a non-passing verdict when `PRIOR_WORK_CHECK_STRICT=true`.

## Where It Sits In The Pipeline

```text
opportunity/problem intake
  -> clarification
  -> solution routing
  -> Prior-Work Check (this gate, blocking)
       blocked_cannot_verify -> stop, make the repo visible, rerun
       extend_existing       -> vNext packet that extends the named surfaces
       build_new             -> App Build Packet for a verified-new app
  -> packet -> review gates -> handoff
```

The Prior-Work Check is a required review gate in
`source-of-truth/problem-portfolio-routing-standard.md` and must pass before the
build-packet steps in `source-of-truth/app-build-packet.md`.

## Run And Verify

```bash
# Run a real request:
PRIOR_WORK_CHECK_INPUT=path/to/request.json npm run prior-work:check

# Built-in examples:
PRIOR_WORK_CHECK_EXAMPLE=run-001 npm run prior-work:check      # extend_existing
PRIOR_WORK_CHECK_EXAMPLE=unreachable npm run prior-work:check  # blocked_cannot_verify
PRIOR_WORK_CHECK_EXAMPLE=build-new npm run prior-work:check    # build_new

npm run smoke:prior-work-check
```

## RUN-001 Reference Result

Run against the real ChurchConnect repo, RUN-001 returns `extend_existing`,
pointing at:

- `src/components/VisitorRegistration.tsx` (visitor capture form) — extend.
- `src/components/ConnectionInbox.tsx` (admin inbox, reads `connection_inbox`) — extend.
- `src/components/ConnectionCards.tsx` (admin cards, reads the live `connection_cards`) — extend.
- `supabase/migrations` against `connection_cards` (`follow_up_status`) — add a
  follow-up migration; do not create a new table.

The gate also reports a `table_split` finding: `ConnectionInbox.tsx` reads
`connection_inbox` while `ConnectionCards.tsx` reads `connection_cards`. That
split is the real ChurchConnect bug RUN-001 should fix by reconciling to one
canonical table in the follow-up migration — not by building a third surface.

Blocked side doors: a new visitor form component, a new admin dashboard
component, and a new `visitor_submissions` table.

## Guardrails

- Read-only; no target-repo writes, no migrations executed, no deploy, no paid
  resources, no secrets/env changes.
- Evidence required for every existence claim.
- Can't-see-the-repo blocks; never assume absence from inability to look.
- Side doors are forbidden when prior work exists.

## Success Criteria

The gate is working when:

1. A request against a readable repo with prior work returns `extend_existing`
   with evidence-backed extension targets.
2. Proposed parallel surfaces are flagged as side-door violations.
3. An unreadable target repo returns `blocked_cannot_verify`, not `build_new`.
4. A readable repo with no prior work returns `build_new`.
5. RUN-001 returns the reference result above on its own.
