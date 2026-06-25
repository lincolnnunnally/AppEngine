# Step 5 — First real problem THROUGH AppEngine (AppEngine side)

**Run:** ChurchConnect Visitor Capture (RUN-001) carried through the AppEngine pipeline.
**Date:** 2026-06-25. **Classification:** `extend_existing`. **Status:** AppEngine handoff materialized; ChurchConnect-repo execution + live verify remain under Step 5.

## Direction correction — 2026-06-25

Lincoln clarified that ChurchConnect recovery is the proof that AppEngine can work on a real ecosystem app. It is not a parked side project and not an independent Codex track.

Target direction:
- AppEngine remains the conductor: intake, prior-work check, vNext packet, acceptance criteria, review gate, live verify, and run record.
- Codex/Claude Code execute in the ChurchConnect repo as workers inside this Step 5 loop.
- ChurchConnect must be pulled away from Mongo/Emergent and made operational on the consolidated Life Produces Life / ChurchConnect Supabase care/connect spine.
- Mongo/Emergent branches are source material only, not the destination architecture.
- The first implementation proof should map visitor follow-up onto existing Supabase tables such as `people`, `guests`, `guest_followup_tasks`, `care_requests`, and `care_follow_ups`, adding a new inbox table only if the gate proves the existing tables are insufficient.

## What this proves
The first real product problem went **through the existing AppEngine pipeline** to an actionable, grounded handoff — not a fresh build, not chat memory. No new pipeline was created; this used the pieces already on `main`.

## The loop (existing pipeline, in order)
1. **Prior-Work Check** — already on `main`: [`loop-runs/run-001-prior-work-check.json`](run-001-prior-work-check.json) / [`.md`](run-001-prior-work-check.md). Verdict **`extend_existing`** → authorizes `vnext_packet`. Target repo: `ChurchConnect -> ../../ChurchConnect/ChurchConnect`.
2. **vNext Packet** — materialized here via the existing `vnext:packet` script (gated on the `extend_existing` verdict):
   - [`run-001-churchconnect-visitor-vnext-packet.json`](run-001-churchconnect-visitor-vnext-packet.json)
   - [`run-001-churchconnect-visitor-vnext-follow-ups.json`](run-001-churchconnect-visitor-vnext-follow-ups.json)
   - 8 phases: current_state → change_scope → provider_cost_delta → design_update → build_update → regression_testing → release_gate → monitoring_update (one follow-up task each).

## The fix the packet hands off (extend, do not rebuild)
- **Bug:** visitor follow-up is unreliable because visitor capture and staff follow-up do not land on one operational care/connect path.
- **Corrected data target:** Supabase consolidation. Use the existing consolidated Supabase care/connect tables first (`people`, `guests`, `guest_followup_tasks`, `care_requests`, `care_follow_ups`, plus staff/church membership tables as needed). Do not reconcile toward Mongo.
- **Extend these existing surfaces:** `src/components/VisitorRegistration.tsx`, existing staff follow-up/admin surfaces in ChurchConnect, and the Supabase migration/schema layer. Prefer adapting the existing components to the Supabase client/path rather than building parallel visitor or admin screens.
- **Blocked side-doors (do NOT build):** `NewVisitorCaptureForm` (dup of VisitorRegistration), `VisitorAdminDashboard` (parallel admin dashboard), `visitor_submissions` table (third capture table), Mongo/Emergent launch merge as the target path.
- **Guardrails (from the packet):** doNotRestartWholeApp, preventGoalBleed, costReviewRequired; non-goals lock the extend-not-rebuild boundary.

## Cross-boundary execution
- The ChurchConnect repo lives **outside this workspace's writable root** (`../../ChurchConnect/ChurchConnect`). Per the scope, **Codex/Claude Code execute the fix in the ChurchConnect repo** as workers inside this AppEngine Step 5 loop.
- The **verify-after-publish walkthrough** runs against ChurchConnect's own production after the fix deploys, on the existing Reviewer/Tester pieces — never recreated.
- ChurchConnect appears here **only** as the gated AppEngine proof (scope step 5), not as independent side work.

## Safety
Nothing was deployed, migrated, provisioned, or spent in the #191 AppEngine-side run. The next execution must preserve that discipline until the Step 5 gate has a Supabase-targeted plan, configured spend/provider limits, and verification evidence.
