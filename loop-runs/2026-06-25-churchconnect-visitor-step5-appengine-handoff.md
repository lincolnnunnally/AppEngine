# Step 5 — First real problem THROUGH AppEngine (AppEngine side)

**Run:** ChurchConnect Visitor Capture (RUN-001) carried through the AppEngine pipeline.
**Date:** 2026-06-25. **Classification:** `extend_existing`. **Status:** AppEngine handoff materialized; ChurchConnect-repo backend execution is partially proven live; staff follow-up UI verify remains open.

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

## Remaining before Step 5 can be called complete

- The `organization` table is reachable but currently has no sampled row; `milstead-church` is resolving through a configured fallback. Seed or connect the real Life Produces Life organization row before broader use.
- Staff follow-up read/update UI has not yet been proven against the new `ecosystem_event` follow-up record.
- Frontend production freshness still needs verification after Vercel deployment limits clear.
- Do not mark Step 5 complete until the staff follow-up status can be seen, updated, persisted, and walked live.

## Safety
The AppEngine pipeline stayed in its lane: it produced the gated handoff, then the actual code executed in the ChurchConnect repo. No new paid resource was created. The backend proof wrote a clearly marked AppEngine test visitor into the shared Supabase path; Step 5 remains open until staff follow-up is verified.
