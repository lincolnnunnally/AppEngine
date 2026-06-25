# RUN-001 ChurchConnect Supabase Execution Plan

**Date:** 2026-06-25  
**Source run:** `run-001-2026-06-21-churchconnect-visitor-capture-cycle-1`  
**AppEngine step:** Step 5 — first real product problem through AppEngine  
**Status:** ChurchConnect repo code path merged; not complete until deploy/publish, health check, and live walkthrough evidence are recorded.

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

## Current Execution Evidence

- ChurchConnect execution PR: https://github.com/lincolnnunnally/ChurchConnect/pull/9
- Merge commit: `f2354ccba6b61dac16d27c143c236d1eefff4927`
- Scope: new FastAPI `/api/churchconnect` Supabase visitor-follow-up route, server registration, existing visitor form routed through the backend, and `SUPABASE_URL` documented for deployment.
- Live Supabase read-only check on project `dzxipsskcrvbtvzekbgz` confirmed existing target tables and clean proof counts: `church_organizations` 7, `church_subdomains` 0, `people` 3, `guests` 0, `guest_followup_tasks` 0.
- Local verification in prepared ChurchConnect work copy: Python compile passed for the new backend route/server wiring; frontend production build passed.

## Deployment Verification Gap

- Frontend deploy gap: Vercel project `church-connect` still showed the latest production deployment on the older `main` commit `a3e9b476325edccd140a911e3c01b02536a43b2a`. The #9 PR-branch deployment was canceled after merge, and no production deployment for `f2354ccba6b61dac16d27c143c236d1eefff4927` was visible yet.
- Frontend live fetch gap: `www.churchconnect.cloud/church/milstead-church/visitor-registration` returned an older cached Vercel build (`last-modified` June 19, 2026), so the merged visitor form is not proven live.
- Backend deploy gap: `render.yaml` declares `churchconnect-backend`, free plan, branch `main`, `autoDeploy: true`, and `/api/health`; however this environment does not have Render CLI/MCP access to confirm deployment or set env.
- Backend env required before live proof: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be present on the existing backend service.
- Health proof gap: local DNS resolution failed for `api.churchconnect.cloud`, so backend health and visitor route checks could not be trusted from this sandbox.

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
