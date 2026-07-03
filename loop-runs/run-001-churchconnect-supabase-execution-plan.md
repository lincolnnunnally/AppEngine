# RUN-001 ChurchConnect Supabase Execution Plan

**Date:** 2026-06-25  
**Source run:** `run-001-2026-06-21-churchconnect-visitor-capture-cycle-1`  
**AppEngine step:** Step 5 — first real product problem through AppEngine  
**Status:** Ready for ChurchConnect-repo execution through production under the AppEngine gate.

## Decision

ChurchConnect recovery is the real AppEngine proof. The work must not proceed as an independent ChurchConnect side project.

AppEngine owns:
- acceptance criteria
- prior-work/vNext routing
- run record
- review gate
- verify-after-publish evidence
- production completion standard

Codex/Claude Code own:
- code execution inside `github.com/lincolnnunnally/ChurchConnect`
- Supabase migration execution inside the existing consolidated data path
- tests/smokes
- PR evidence
- deployment/health evidence when the release gate allows it
- live workflow walkthrough evidence

## Target Architecture

ChurchConnect should move away from Mongo/Emergent and become operational on the consolidated Life Produces Life / ChurchConnect Supabase care/connect spine.

Use Mongo/Emergent code only as source material. Do not merge the Mongo launch path as the destination.

## First Proof

Visitor follow-up should land in one operational Supabase workflow:

1. Public visitor intake captures the person.
2. The person is represented in `people` when enough identity/contact data exists.
3. The visit is represented in `guests`.
4. Requested follow-up creates an actionable `guest_followup_tasks` record, or routes to `care_requests` / `care_follow_ups` if that is the chosen canonical care path.
5. Staff can see and update the follow-up status from the existing ChurchConnect staff surface.
6. The status persists in Supabase.
7. A live verify-after-publish walkthrough proves the visitor-to-staff workflow works.

## Acceptance Criteria

- ChurchConnect no longer depends on Mongo/Emergent as the target production data path for visitor follow-up.
- Visitor intake writes to the consolidated Supabase path.
- Staff follow-up reads from the same Supabase path.
- Follow-up status persists and can be updated.
- The ChurchConnect app is deployed/published within configured provider and spend limits.
- The live URL passes a health check after publish.
- Existing visitor/admin surfaces are extended; no parallel visitor form or admin dashboard is created.
- No `visitor_submissions` table is added.
- No new paid resource is created outside configured limits.
- Production is not marked complete until health and visitor-follow-up walkthrough evidence are recorded.

## Verification Required

- Supabase schema check for the target tables and RLS policies.
- ChurchConnect repo smoke/build checks.
- Visitor follow-up route proof.
- Staff follow-up status update proof.
- Live health check after deploy.
- AppEngine run record updated with PR, deploy, and walkthrough evidence.

## Open Safety Item

Supabase surfaced an RLS advisory for unrelated tables with RLS disabled. Do not fix those inside the visitor-follow-up PR unless the AppEngine gate explicitly scopes a security-hardening task. Do record the advisory as a launch risk before public use.
