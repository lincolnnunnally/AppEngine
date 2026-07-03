# Loop run — Ecosystem transfer to Claude Code: Wave 0 (protect & govern)

- **Date:** 2026-07-03
- **Agent:** Claude Code
- **Trigger:** Lincoln's directive: "all the builds for my ecosystem is being moved over to you… please help me complete the transfer and set up of my complete ecosystem." Approvals captured in-session: CURRENT_SCOPE v12; ChurchConnect first; secrets-scrub + backup pushes.
- **Board items:** TRANSFER T1–T4 (BUILD-LEDGER.md)

## What ran

1. **Full-estate audit (read-only, 7 agents, cross-checked):** GitHub (29 repos), Vercel (13 projects, 1 team), Supabase (1 project, 57 migrations, table census), live DNS/HTTP for ~19 domains, every local repo under Project_Code (branch/dirty/ahead-behind/iCloud artifacts), AppEngine registry + transfer machinery. Deliverable: ECOSYSTEM_TRANSFER_PLAN (session doc, delivered to Lincoln).
2. **Protective pushes (T-prep, approved):**
   - `TonerTrackerPro` local history (branches `main`, `replit-agent`) → previously EMPTY origin `lincolnnunnally/TonerTracker` (verified 0 refs before push; verified refs after).
   - New private backup repos: `dads-recovery` (from `dads-reveory-project`; `.env` excluded, embedded JWTs verified anon-tier), `toner-platform` (workspace root; nested TM-Admin-portal/TM-UserDash repos excluded — already on GitHub), `emergent-integrations-archive` (from `_UPLOAD_TO_GITHUB`), `appengine-workspace` (app-engine parent docs; `production-app/` excluded).
3. **T1 · CURRENT_SCOPE v12** — merged via **#246** (verify ✅). Ecosystem transfer is the path; we-succeed.org stays live; waves 0–4 defined.
4. **T2 · App Transfer Ledger Standard landed** — merged via **#247** (verify ✅ after rebase onto post-#246 main). Clean cherry-pick of 62738d0 + 6b99ec2 from `codex/app-transfer-ledger-system` (was 54 behind). PR #206 closed as superseded.
5. **T4 · Code monorepo cloned** — `lincolnnunnally/life-produces-life` → `Project_Code/life-produces-life-monorepo` (distinct name; the existing `life-produces-life` folder is the source-of-truth repo clone). apps/{best-life, churchconnect-bridge, live-on-mission, spark-of-hope, united-under-god} + packages/{ai-guide, auth, database, matching-engine, opportunity-engine, ui} confirmed present.
6. **Stranded ChurchConnect DB drafts preserved** — committed + pushed to their existing branch `churchconnect-slice-event-fanout` on `life-produces-life-source-of-truth` (272b289): DB_REALITY_RECONCILIATION.md, db/0003_churchconnect_fanout__DRAFT.sql, db/MIGRATION_RECONCILIATION.md + in-flight TASK-draft edits. Still DRAFT status; preservation only.
7. **PR #244** — found already merged by a concurrent session; ledger's DONE record now accurate. No action.

## Corrections recorded

- **Kids Need Dads domain:** the ecosystem's domain is **kidsneeddad.com** (singular; eNom via DreamHost, expires 2027-03-01, DreamHost NS, live on Netlify). The plural kidsneeddads.com is a **third party's** GoDaddy domain (since 2009) — an audit sweep wrongly flagged its expiry as urgent; withdrawn per Lincoln's correction. Lesson applied to scope v12 agent rules: check what has been established before flagging new work.
- The audit critic's "we-succeed.org still gated" contradiction was a false positive: anonymous `/` → `/soft-launch` showing the public welcome IS the designed public mode (BUILD-LEDGER Step 6).

## ChurchConnect-first prep (T5 — gates surfaced, not crossed)

Open PRs reviewed (read-only): **#5** launch sweep — CONFLICTING, +275k/−17k across 100 files, stale since 6-08, likely superseded → recommend close-or-rework, do not merge; **#7** event fan-out tests — MERGEABLE, 1 test file; **#11** transfer ledger docs — MERGEABLE; **#12** AIPOS launch pack — MERGEABLE (note: local checkout has 11 uncommitted files on this branch — possible in-flight Codex work; do not disturb).

Waiting on Lincoln (per the v12 gates):
1. **Staff walkthrough:** a real staff login on churchconnect.cloud production to prove the Connection Inbox reads/updates follow-ups end-to-end (or provide a staff test credential and Claude Code drives it in-browser).
2. **`churchconnect` schema apply** to the shared Supabase — gated DB change; spec in TASK-CHURCHCONNECT_CLEAN_SCHEMA__DRAFT.md v1.0 + the preserved db/0003 fanout draft; reconcile against DB_REALITY_RECONCILIATION.md first.
3. **Merge approval for ChurchConnect PRs** (#7/#11/#12; #5 recommend close) — merges to that repo auto-deploy churchconnect.cloud production.

## Still open on the TRANSFER board

- **T3** registry regeneration + publishing the 14 queued follow-up issues (🟢 available).
- **T5** ChurchConnect finish (⛔ waiting on the three gates above).
- Wave 2 discovery needs Lincoln's logins: Cloudflare (easypeazy.site, snip.show origins), Netlify (kidsneeddad.com), milstead.us shared-host, DreamHost DNS (spark-of-hope.com attach).

## Evidence

- Merged: AppEngine #246 (9852fde), #247 (4209283). Closed: #206 (superseded).
- Pushed: TonerTracker (2 branches), dads-recovery, toner-platform, emergent-integrations-archive, appengine-workspace (all private), life-produces-life-source-of-truth@272b289.
- Cloned: life-produces-life-monorepo.
- Audit run: 7 subagents, 80 tool calls, all read-only; raw results in session transcript.
