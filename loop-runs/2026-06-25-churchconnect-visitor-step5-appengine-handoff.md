# Step 5 — First real problem THROUGH AppEngine (AppEngine side)

**Run:** ChurchConnect Visitor Capture (RUN-001) carried through the AppEngine pipeline.
**Date:** 2026-06-25. **Classification:** `extend_existing`. **Status:** AppEngine handoff materialized; ChurchConnect-repo execution + live verify remain (cross-boundary).

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

## Safety
Nothing was deployed, migrated, provisioned, or spent. This run produced planning/handoff artifacts only (the pipeline is fail-closed). The actual ChurchConnect change is owner-gated and happens in its own repo.
