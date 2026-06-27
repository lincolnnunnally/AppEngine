# Step 5 — First real problem THROUGH AppEngine (AppEngine side)

**Run:** ChurchConnect Visitor Capture (RUN-001) carried through the AppEngine pipeline.
**Date:** 2026-06-25. **Classification:** `extend_existing`. **Status:** AppEngine handoff materialized; ChurchConnect-repo backend execution is partially proven live; protected staff follow-up API is live; authenticated staff walkthrough remains open.

## What this proves
The first real product problem went **through the existing AppEngine pipeline** to an actionable, grounded handoff — not a fresh build, not chat memory. No new pipeline was created; this used the pieces already on `main`.

## The loop (existing pipeline, in order)
1. **Prior-Work Check** — already on `main`: [`loop-runs/run-001-prior-work-check.json`](run-001-prior-work-check.json) / [`.md`](run-001-prior-work-check.md). Verdict **`extend_existing`** → authorizes `vnext_packet`. Target repo: `ChurchConnect -> ../../ChurchConnect/ChurchConnect`.
2. **vNext Packet** — materialized here via the existing `vnext:packet` script (gated on the `extend_existing` verdict):
   - [`run-001-churchconnect-visitor-vnext-packet.json`](run-001-churchconnect-visitor-vnext-packet.json)
   - [`run-001-churchconnect-visitor-vnext-follow-ups.json`](run-001-churchconnect-visitor-vnext-follow-ups.json)
   - 8 phases: current_state → change_scope → provider_cost_delta → design_update → build_update → regression_testing → release_gate → monitoring_update (one follow-up task each).

## The fix the packet hands off (extend, do not rebuild)
- **Bug:** `table_split` — admin/data surfaces read different tables (`connection_inbox` vs `connection_cards`), so visitor follow-up state is unreliable. Reconcile to one canonical table.
- **Extend these existing surfaces:** `src/components/VisitorRegistration.tsx`, `src/components/ConnectionInbox.tsx`, `src/components/ConnectionCards.tsx`, `supabase/migrations` (connection_cards).
- **Blocked side-doors (do NOT build):** `NewVisitorCaptureForm` (dup of VisitorRegistration), `VisitorAdminDashboard` (dup of ConnectionInbox), `visitor_submissions` table (dup of existing migrations).
- **Guardrails (from the packet):** doNotRestartWholeApp, preventGoalBleed, costReviewRequired; non-goals lock the extend-not-rebuild boundary.

## Cross-boundary — what AppEngine cannot do from here
- The ChurchConnect repo lives **outside this workspace's writable root** (`../../ChurchConnect/ChurchConnect`). Per the scope, **Codex executes the fix in the ChurchConnect repo** — this packet is the bridge object meant to cross that boundary.
- The **verify-after-publish walkthrough** runs against ChurchConnect's own production after the fix deploys, on the existing Reviewer/Tester pieces — never recreated.
- ChurchConnect appears here **only** as the gated AppEngine proof (scope step 5), not as direct side work.

## ChurchConnect execution evidence — 2026-06-26

Codex executed the backend recovery in `github.com/lincolnnunnally/ChurchConnect` against the existing `main` deploy path.

- Render blueprint no longer defaults `SUPABASE_URL` to the old ChurchConnect Supabase project; it requires the host env and labels the target as `life_produces_life`.
- Backend route now supports `sb_secret_...` Supabase secret keys without treating them as legacy JWT service-role tokens.
- Backend route now exposes `GET /api/churchconnect/supabase-readiness` for AppEngine/live proof.
- Live readiness result: `ready=true`, `targetShape=life_produces_life`, canonical tables available: `organization`, `person`, `ecosystem_event`; legacy ChurchConnect tables not exposed.
- Live public profile result: `GET /api/churchconnect/church/milstead-church/public-profile` returned `200` with `id=churchconnect:milstead-church`.
- Live visitor proof result: `POST /api/churchconnect/church/milstead-church/visitor-registration` returned `200` with:
  - `person_id=a3a872e8-f205-4f43-b58d-f4be03bf13a8`
  - `guest_id=4e1f13ab-e869-4c2b-a592-12d424e731c2`
  - `followup_task_id=e5a3c2bd-2833-469f-904e-18c881a810d3`

## ChurchConnect execution evidence — 2026-06-27

Codex continued the ChurchConnect transfer from the AppEngine handoff and pushed `lincolnnunnally/ChurchConnect@e0d685d` (`Continue ChurchConnect Supabase follow-up transfer`) to `main`.

- Backend added protected staff endpoints backed by the shared Life Produces Life `ecosystem_event` records:
  - `GET /api/churchconnect/church/{church_slug}/visitor-followups`
  - `PATCH /api/churchconnect/visitor-followups/{followup_id}`
- Existing `src/components/ConnectionInbox.tsx` now reads and updates through those backend endpoints instead of the stale direct `connection_inbox` / `connection_followup_log` path.
- Verification before push:
  - `python3 -m py_compile backend/routes/supabase_visitor_followup.py` passed.
  - `npm run build` passed in a clean ChurchConnect checkout after installing existing dependencies.
- Live deployment proof after Render picked up `e0d685d`:
  - `GET /api/churchconnect/church/milstead-church/visitor-followups` without staff auth returned `401 Not authenticated`, proving the follow-up list fails closed instead of exposing visitor data.
  - `PATCH /api/churchconnect/visitor-followups/16d9dbe6-2f48-4e7e-8224-5441b52f461a` without staff auth returned `401 Not authenticated`, proving follow-up updates fail closed.
  - `GET /api/churchconnect/supabase-readiness` returned `ready=true`, `keyMode=supabase_secret`, `targetShape=life_produces_life`; canonical `organization`, `person`, and `ecosystem_event` remain reachable.
  - `POST /api/churchconnect/church/milstead-church/visitor-registration` returned `200` with:
    - `person_id=28608b9e-9cda-44fb-8d1e-cfe65b5230b7`
    - `guest_id=518f5c61-2101-4b25-8c85-fce19a5200b1`
    - `followup_task_id=16d9dbe6-2f48-4e7e-8224-5441b52f461a`

## Remaining before Step 5 can be called complete

- The `organization` table is reachable but currently has no sampled row; `milstead-church` is resolving through a configured fallback. Seed or connect the real Life Produces Life organization row before broader use.
- Staff follow-up read/update is now implemented in code and the protected backend is live, but an authenticated staff walkthrough still needs to prove that the Connection Inbox can see, update, and persist a follow-up from the production UI.
- Frontend production freshness still needs verification after Vercel deployment limits clear.
- Do not mark Step 5 complete until the staff follow-up status can be seen, updated, persisted, and walked live.

## Transfer coverage ledger — 2026-06-27

- ChurchConnect now has a draft app-specific transfer ledger in `lincolnnunnally/ChurchConnect#11`: <https://github.com/lincolnnunnally/ChurchConnect/pull/11>.
- The ledger records the visible `/church/welcome` feature cards, additional existing ChurchConnect modules not shown in the screenshots, current code surfaces, legacy/runtime status, shared Supabase proof status, and next transfer slices.
- Future ChurchConnect transfer work should name the ledger row or slice it advances before changing code. This keeps the transfer focused on carrying forward the existing app instead of recreating a smaller replacement.

## Safety
The AppEngine pipeline stayed in its lane: it produced the gated handoff, then the actual code executed in the ChurchConnect repo. No new paid resource was created. The backend proof wrote clearly marked AppEngine test visitors into the shared Supabase path; Step 5 remains open until staff follow-up is verified end to end.
