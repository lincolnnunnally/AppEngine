# Loop run — ChurchConnect readiness (T5 prep) + roster corrections

- **Date:** 2026-07-03 (evening)
- **Agent:** Claude Code
- **Trigger:** Lincoln: "move forward with your priorities and let's get this ready" (following the 20-app roster roll-call and his corrections).
- **Board item:** TRANSFER T5 (prep lane — gates themselves stay Lincoln's)

## Owner corrections recorded (authoritative)

- **Milstead.us ≠ Milstead.Church:** milstead.us = the Milstead COMMUNITY app (Community Connections prototype); milstead.church = **Milstead Baptist Church's** site (ChurchConnect tenant `milstead-church`). Different apps. Earlier docs conflated them.
- **Million Mistakes is a standalone app** (roster #20), not just content.
- kidsneeddad.com (correct domain, healthy) currently serves **"RebuildingDad"** branding — rebrand happens with the KND canonical merge.
- Owner-supplied domains verified: **laser.engrave.market** + **best-life.us** + **milstead.church** resolve to Lincoln's DreamHost (owned, idle). **live-on-mission.org: whois "Domain not found" — UNREGISTERED** (paid decision to register).
- we-succeed.org "may change" (Lincoln note).

## What ran

1. **ChurchConnect PR cleanup (gate c, executed under Lincoln's go):** #11 transfer-ledger docs (was draft → ready → **MERGED**), #7 fan-out tests (**MERGED**), #5 stale June-8 launch sweep (**CLOSED** as superseded, reopenable, branch kept), #12 untouched — its branch carries the active "registration + AI branding" session's uncommitted work.
2. **Schema-apply packet prepared (gate b):** 3-migration plan (churchconnect_slice_v1_0 = preserved 0002 draft verbatim; churchconnect_fanout_v1_0 = preserved 0003 draft verbatim; churchconnect_harden_publish_event_v1_0 = recommended one-line REVOKE closing the SECURITY DEFINER EXECUTE-to-PUBLIC hole). Verified against live DB same-day: reused public tables/columns match exactly, private.* helpers present, zero collisions, laser_* migrations orthogonal, readiness probe untouched → live visitor path cannot break. Rollback = drop schema cascade (clean boundary). 7-step post-apply verification defined. **Apply remains gated on Lincoln's word.**
3. **Staff-walkthrough runbook (gate a):** discovered the seeded test-staff path — `backend/seed_admin.py` creates `Lincoln@milstead.church` (church-staff, Milstead Baptist Church, pre-verified) on every backend boot from `CC_TEST_EMAIL`/`CC_TEST_PASSWORD` in `render.yaml`; **CC_TEST_PASSWORD is sync:false and must be set in the Render dashboard**. With that one secret (+ approval for one test-record PATCH), Claude Code can drive the whole production proof in-browser. Runbook delivered to Lincoln.
4. **SoT PR #18 review brief:** V2 = markdown conversion of Lincoln's own unsaved .docx; conflicts if merged as "canonical" (second apex vs LOCKED master v1.1; "Hub as management center for the entire ecosystem" vs no-app-is-the-hub; 6-layer stack vs locked 4-group catalog; faith-neutral mission line vs the locked apex). Recommendation: **approve-with-edits** (keep as preserved source, subordinate header). 4 rulings enumerated for Lincoln.

## Evidence

- ChurchConnect: #7 MERGED, #11 MERGED, #5 CLOSED (gh-verified states).
- Deliverables to Lincoln: CHURCHCONNECT_READINESS_PACKAGE.md + ECOSYSTEM_APP_ROSTER.md v2 (session docs).
- Preparation ran as a 3-agent read-only workflow (~234k tokens); raw outputs in session transcript.
- whois live-on-mission.org → "Domain not found".

## Next (all Lincoln)

"apply" (+ yes/no on the REVOKE) → schema lands with verification · CC_TEST_PASSWORD on Render → Claude drives the walkthrough · PR #18: 4 rulings or "approve-with-edits as recommended" · live-on-mission.org registration (paid).
