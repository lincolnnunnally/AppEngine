# BUILD-LEDGER — the check-out board (what's DONE, what's LEFT, who's on what)

> **What this is:** the running record of AppEngine work AND the live claim board that keeps
> multiple agents (Claude Code, Codex, ChatGPT) from colliding or rebuilding the same thing.
> Its two jobs: (1) stop rebuilding — if it's DONE, build forward from it, never recreate it;
> (2) stop collisions — before working an item, you CLAIM it so no one else picks it up.
>
> **Companion to CURRENT_SCOPE.md, not a replacement.** Scope = where we're going + locked
> decisions. Ledger = what's finished, what's claimable, who holds what. Read both; obey the scope.

---

## THE CHECK-OUT PROTOCOL (read before touching any item)
The repo copy of this file is the ONLY real board. Instruction-box copies are snapshots and do
not refresh — never claim against them. Every agent follows these steps, every time:

1. **Pull first.** Get the latest repo copy of this file before doing anything. The repo wins; if
   your snapshot disagrees, the repo is right.
2. **Pick the first 🟢 AVAILABLE item with no unmet dependency.** Do not skip ahead to a ⛔ BLOCKED
   item — its prerequisite isn't DONE yet. One item at a time.
3. **Claim it — commit the claim BEFORE you start work.** Change its status to 🟡 CLAIMED and fill
   the claim line: your name, date/time, and the branch you'll work on. Commit/push this file change
   on its own, first. The claim is only real once it's pushed — that's what other agents see.
4. **If your push hits a conflict on this file, someone claimed it a beat before you.** Yield, pull
   again, pick the next 🟢 item. Never work an item already 🟡 or 🔵.
5. **When done, move it forward** — 🔵 IN REVIEW (PR open) or ✅ DONE (merged) — with the PR number.
   Commit that change too.
6. **Stale claims free up.** A 🟡 claim older than ~24h with no branch/PR goes back to 🟢 — an agent
   that crashed mid-task must not lock an item forever.

This is a discipline enforced by git, not a hard lock. It works only if EVERY agent obeys it.

**Status legend:** 🟢 AVAILABLE · 🟡 CLAIMED (someone's on it) · 🔵 IN REVIEW (PR open) · ✅ DONE (merged) · ⛔ BLOCKED (waiting on a prerequisite)

---

## ✅ DONE (verified against actually-merged PRs on `main` — never rebuild these)
- ✅ Canonical pipeline on main — intake gate, prior-work check, routing, candidate→packet bridge, handoff, review gates, 100+ smoke tests. (Merged across the #160s; **#165** added the Step-1 cockpit shell + two front doors.)
- ✅ Ecosystem registry seed corrected + truth-protection smoke tests (**#175**); Opportunity/AppEngine scope-fence reset (**#178**).
- ✅ Deploy/cost gate proven to halt before provisioning (**#176**) — the cost-stop works.
- ✅ Dark two-door entry (**#177**) — base `#0e1512`, gold/teal doors (scope step 2).
- ✅ Entry gated owner-only; GitHub OAuth login working at we-succeed.org (**#179**).
- ✅ CURRENT_SCOPE.md synced to the we-succeed pathway — **v5 on `main`** (**#180**). NOTE: the earlier "matured to v8" line was memory-seeded and **wrong** — `main` is v5; the v8→v9 text is NOT on main yet, it lands via **#184** (below).
- ✅ Step-3 dark theme across the whole app shell (**#181**).
- ✅ Step-3 problem-intake door keeps the rail + two-door / one-name opportunity intake (**#182**).
- ✅ Step-3 consumer-friendly problem door — dev label + redundant sub-choices dropped (**#183**).
- ✅ Step-3 finished app shell — one AppShell header per cockpit screen (redundant topnav removed), `.entry`/`.soft-launch` inherit the locked `:root` palette, build-door default→"vision", doors set positive expectations; CURRENT_SCOPE v9 + this ledger landed (**#184**).
- ✅ Step-4 "loop to live" — release gate + deploy readiness (**#186**/**#187**/**#189**, fail-closed, existing-provider-only, within limits), production deploy `READY` at we-succeed.org, live `/api/health` ok, owner-gate enforced, both doors verified end-to-end via Lincoln's owner walkthrough on production (a submission saved); build-door redundant selector removed (**#190**). Free-tier only.
- ✅ **Public launch (Step 6)** — we-succeed.org is live & PUBLIC since 2026-06-27 (staged access #200/#201 + `APP_ENGINE_PUBLIC_ACCESS=public` on Vercel prod). See Step 6 below.
- ✅ **Conversational intake (post-launch, #205)** — the two-door **form wall** is replaced by **one conversational discovery**: asks one question at a time, reflects back, then maps the answers onto the **existing** intake APIs (no backend change); a "use the form" fallback keeps the original forms. The two intents (problem/build) are now the opening turn. **The "two doors" locked decision is superseded by CURRENT_SCOPE v10 — do not rebuild the two-door entry.** Deterministic + free; built so a Claude clarification worker can drive it later (worker-adapters).
- ✅ **Shared environment source + composer (post-launch, #244)** — one private env file outside git feeds every app's `.env` via `npm run env:compose` (shared source + per-app profile → generated local artifact); standard in `source-of-truth/shared-environment-source-standard.md`; `smoke:env-compose` green. Ends retyping the same provider keys per app. Never rebuild per-app env plumbing — add an `env/app-profiles/<slug>.env.example` instead.

---

## THE BOARD — claimable work

### STEP 3 — make the whole app look finished  ✅ **COMPLETE** (merged via #181/#182/#183/#184)
Acceptance: no route renders bare; no screen ships a competing theme; every door/intake keeps the rail.

- ✅ **3a · Every route inside the shared AppShell** — redundant page-level `topnav` removed; one AppShell header per cockpit screen (**#184**). Open caveat for Lincoln: `/account` (customer placeholder, not in the owner rail) and `/soft-launch` (public pre-login) render outside the owner shell by design — wrap `/account` only if you want it in the owner surface.
- ✅ **3b · Problem-intake door keeps the rail** — moved into the `(cockpit)` AppShell (**#182**).
- ✅ **3c · Exactly two doors, one consistent name** — rail/header/body all "Build something" / "Solve a problem"; build door trimmed 4→2 (**#182** + **#183**).
- ✅ **3d · Palette pass** — dark theme (**#181**); `.entry`/`.soft-launch` inherit the locked `:root` tokens (**#184**).

### STEP 4 — guardrail, then first real deploy  ✅ **COMPLETE** ("loop to live" crossed)
- ✅ **4 · Spend/provider guardrail + first real deploy: we-succeed.org with BOTH doors working end to end + health check, within limits.** ("loop to live")
  Release gate + deploy readiness (**#186**/**#187**/**#189**) — fail-closed, existing-provider-only, within configured limits. Production deploy `READY` at we-succeed.org; live `/api/health` ok; owner-gate enforced (unauthenticated → `/soft-launch`); GitHub owner sign-in wired. Owner-authenticated walkthrough confirmed by Lincoln on production: both doors reach their intake with the rail, a submission saved. Build-door redundant selector removed (**#190**). Free-tier only; no new paid resources.

### STEP 5 — first real problem THROUGH AppEngine  🟡 AppEngine proof done (#191); ChurchConnect execution partially live (Codex track)
- 🟡 **5 · ChurchConnect visitor bug as `extend_existing` → vNext → Codex in the ChurchConnect repo** (gated AppEngine proof only). The verify-after-publish walkthrough is built and proven here, on the existing Reviewer/Tester pieces — never recreated.
  done so far: ✅ AppEngine side (**#191**, merged) — RUN-001 carried through the existing pipeline; prior-work verdict `extend_existing` → materialized the vNext packet + follow-ups (8 phases). This proves the pipeline runs a real problem to a handoff. Fail-closed, nothing deployed from AppEngine.
  done so far in ChurchConnect: ✅ shared-Supabase backend path is live on Render. `GET /api/churchconnect/supabase-readiness` reports `ready=true`, `keyMode=supabase_secret`, `targetShape=life_produces_life`, and reachable canonical `organization`, `person`, and `ecosystem_event` tables. Public visitor registration writes to `person` + `ecosystem_event`; latest proof wrote `person_id=28608b9e-9cda-44fb-8d1e-cfe65b5230b7`, `guest_id=518f5c61-2101-4b25-8c85-fce19a5200b1`, `followup_task_id=16d9dbe6-2f48-4e7e-8224-5441b52f461a`.
  done so far in ChurchConnect: ✅ protected staff follow-up backend + inbox wiring pushed in `lincolnnunnally/ChurchConnect@e0d685d`. `GET /api/churchconnect/church/{slug}/visitor-followups` and `PATCH /api/churchconnect/visitor-followups/{id}` are live and fail closed without staff auth (`401 Not authenticated`). Existing `ConnectionInbox` now reads/updates through those backend endpoints instead of stale direct `connection_inbox`/`connection_followup_log` tables.
  remaining for ✅: authenticated staff walkthrough must prove the production Connection Inbox can see, update, and persist the follow-up; `milstead-church` still resolves through configured fallback because the shared `organization` table has no sampled row; frontend production freshness still needs verification after Vercel limits/deploy pickup. Evidence lives in [`loop-runs/2026-06-25-churchconnect-visitor-step5-appengine-handoff.md`](loop-runs/2026-06-25-churchconnect-visitor-step5-appengine-handoff.md).
  owner: Codex (ChurchConnect repo) · Lincoln (launch/data decisions)

### STEP 6 — open the doors  ✅ **COMPLETE — we-succeed.org is PUBLIC** (Lincoln's launch call, 2026-06-27)
- ✅ **6 · Public login is LIVE.** Lincoln made the launch decision and chose **straight to fully public** (superseding the Step-5 ordering — he's treating the AppEngine-side proof #191 + the parked ChurchConnect track as sufficient). Executed 2026-06-27: set `APP_ENGINE_PUBLIC_ACCESS=public` on the Vercel **production** env via API token + triggered a fresh prod deploy (`dpl_9Mr6exeJPfCPXF2GJ33tSnHRXZum`, READY). **Verified live on `www.we-succeed.org`:** `/api/health` ok; anonymous `/` → `/soft-launch` showing the public "We Succeed" welcome; signed-in customers now reach the two-door entry + both intakes; **operator surfaces still protected** (anon `/orchestrator` `/admin` `/builder` `/life-core` `/owner-control-center` `/module-catalog` `/canonical-status` all → `/soft-launch`); intake **list-all GET + anon POST → 401**; security headers (#192) intact. Reversible anytime: set `APP_ENGINE_PUBLIC_ACCESS=owner` (or `allowlist`) on Vercel prod + redeploy.
  - **One open human check (verify-after-publish #5):** a real **signed-in non-owner** GitHub account walking both doors → submit. Can't be done from here (needs a real OAuth session); it's Lincoln's to confirm on production. Everything anonymous/automatable is verified.

  **Go-public checklist (grounded in the access model, `src/lib/auth/roles.ts` / `access.ts`):**
  1. ✅ **Open the consumer surface to role `customer` — BUILT, default OFF (#200).** Shipped staged behind `APP_ENGINE_PUBLIC_ACCESS` (`owner` default → `allowlist` → `public`; unknown fails closed) via new `canAccessEngineConsumerSurface` gate. The two-door entry + `/problem-intake-lite` + `/opportunity-intake` + their **POST** APIs now open to a permitted `customer` when flipped; GET list-all + operator screens (owner-control, builder, admin, canonical-status, orchestrator, module-catalog, life-core) stay owner/admin-only (builder + life-core re-gated for defense-in-depth). Role-aware rail hides operator jargon from customers. `smoke:consumer-access` covers the decision table. **Default `owner` mode = identical to pre-#200 behavior, so the merge changed nothing live.**
  2. ✅ **Stage it — BUILT (#200).** `allowlist` rung reads `APP_ENGINE_CUSTOMER_ALLOWLIST` (approved emails) as the controlled middle rung before fully `public`. Env vars documented in `.env.example` / `.env.vercel.example`.
  3. ✅ **Soft-launch copy flip — BUILT, default OFF (#201).** `/soft-launch` reads the same `APP_ENGINE_PUBLIC_ACCESS` mode: `owner` keeps the current "Owner-only soft launch" copy (no live change), `allowlist` shows an invited-access welcome, `public` shows the open "We Succeed" welcome. So the whole go-public bundle is now code-complete and dormant — flipping the env is the only "going live" action left.
  4. ✅ **Spend/safety holds by construction** — free-tier default + the release gate (#186/#187), and **Vercel is on Hobby/free (confirmed 2026-06-25), so there is no spend to cap** — you can't overspend; Hobby just rate-limits deploys (~24h), never charges. The only paid resource stays Lincoln's Supabase Pro identity (per CURRENT_SCOPE). Caveat for *fully* public: Hobby ToS restricts commercial use.
  5. **Verify-after-publish** — walk the live app (every door/intake) once it's open, on the existing Reviewer/Tester pieces.
  - Pre-public hardening already shipped (**#192**): public title → "We Succeed" (no "App Engine"/"Neon" jargon), security headers (X-Frame-Options/X-Content-Type-Options/Referrer-Policy/Permissions-Policy) live on we-succeed.org. (Strict CSP still open — needs nonces.)
  - **To go live when ready (now a pure env flip — entry, intakes, rail, AND soft-launch copy all track the mode):** `APP_ENGINE_PUBLIC_ACCESS=allowlist` + `APP_ENGINE_CUSTOMER_ALLOWLIST=<emails>` (controlled) → later `=public` → verify-after-publish (#5). No spend cap needed: Vercel is on Hobby/free (cost is moot; deploys just rate-limit, never charge). Step still waits on Lincoln's launch decision + the board's Step-5 ordering.

### STEP 7 — confirm it holds  🟢 substantially met — finish line reached; ongoing watch
- 🟢 **7 · Spend holds by construction; app is public & usable at we-succeed.org.** Spend can't run away: Vercel is Hobby/**free** (no spend to cap), generated-app resources stay free-tier, and the release gate (#186/#187) is fail-closed so a public user's submission can't provision paid resources. **`Done =` condition met: a public, usable app is live at www.we-succeed.org.** Remaining is *operational watch*, not build: (a) Lincoln's signed-in customer walkthrough (#5); (b) keep an eye on the release gate / free-tier limits as real traffic arrives; (c) optional hardening — strict CSP (nonces), rate-limiting/abuse protection on public sign-in, and the Hobby ToS commercial-use consideration if monetizing.

### TRANSFER — all ecosystem builds move to Claude Code (Lincoln's directive, 2026-07-03)
Lincoln directed that every ecosystem build transfers to Claude Code and the full ecosystem gets set up. Full-estate audit ran 2026-07-03 (GitHub + Vercel + Supabase + DNS + local repos + registry, cross-checked); plan delivered as ECOSYSTEM_TRANSFER_PLAN (session doc). Lincoln approved: CURRENT_SCOPE v12, ChurchConnect first, protective backup pushes. Protective work already DONE (no rebuild): TonerTrackerPro history pushed to its empty origin; 4 new private backup repos (dads-recovery, toner-platform, emergent-integrations-archive, appengine-workspace) — secrets excluded. Corrected for the record: the Kids Need Dads domain is kidsneeddad.com (singular, eNom/DreamHost, exp 2027-03-01, healthy); the plural kidsneeddads.com is a third party's — never ours.

- ✅ **T1 · CURRENT_SCOPE v12 — ecosystem-transfer scope (Lincoln-approved)** — merged (**#246**, verify ✅).
- ✅ **T2 · App Transfer Ledger Standard landed on main** — clean cherry-pick of the two stranded commits, merged (**#247**, verify ✅); PR #206 closed as superseded.
- ✅ **T3 · Regenerate ecosystem-portfolio-registry.json** — done (**#257**). 15→23 entries (new: kindred-dating, united-under-god, community-connections, honestly, milstead, million-mistakes, printer-protector-monitoring, churchconnect-bridge), laser-engrave-market refreshed post-pivot, linkedIssues/linkedPRs filled for every active entry (34 PRs / 21 issues across 7 repos), summary counts computed. The 14 queued follow-ups published as issues **#259–#272** — deliberately WITHOUT the recommended `ai:plan` label (labeling would auto-dispatch the Codex prompt factory per issue, against the TRANSFER directive; add the label to an individual issue to opt it in). Flagged for Lincoln: Printer-Protector's only real source is a local non-git folder (code-loss risk — protective push needed).
- ✅ **T4 · life-produces-life CODE monorepo cloned** → `Project_Code/life-produces-life-monorepo` (apps + packages confirmed). Reminder: the local `life-produces-life` folder is the source-of-truth repo, a DIFFERENT repo. Stranded ChurchConnect DB drafts preserved on its `churchconnect-slice-event-fanout` branch (272b289).
- ⛔ **T5 · ChurchConnect finish (first app through the transfer)** — prep COMPLETE 2026-07-03 (readiness package delivered; see `loop-runs/2026-07-03-churchconnect-readiness.md`): gate (c) PR cleanup DONE under Lincoln's "move forward" (ChurchConnect #11 transfer-ledger + #7 fan-out tests MERGED, #5 closed reopenably, #12 left to the active branding session). Still waiting on Lincoln: (a) walkthrough — the seeded test-staff account `Lincoln@milstead.church` exists in `render.yaml` but needs `CC_TEST_PASSWORD` set on Render (then Claude Code can drive the proof itself, one test-record PATCH approval), and (b) the word "apply" for the 3-migration schema packet (slice v1.0 + fanout v1.0 + recommended publish_event REVOKE hardening; verified conflict-free against live, clean drop-schema rollback). New finding: **live-on-mission.org is UNREGISTERED** — paid decision.
- ✅ **T6 · spark-of-hope Vercel project disconnected from the AppEngine repo** (2026-07-03). The `spark-of-hope` Vercel project (root `apps/spark-of-hope`, a path that doesn't exist in this repo) was git-linked to `lincolnnunnally/AppEngine`, so EVERY merge to main spawned a doomed production deploy (~9 failed on 2026-07-03 alone, burning Hobby deploy quota) and put the always-red "spark-of-hope" check on every PR. Fixed via Vercel API: git integration removed (project kept — NOT deleted; it has no domain and never had a READY deploy). AppEngine merges now build only the AppEngine project, and the phantom PR check is gone — a red spark-of-hope check should no longer appear (and no longer needs the standing "ignore it" caveat). This is waste-stopping only; real Spark canonicalization remains board decision D6.

### POST-LAUNCH — run the business of the apps (Lincoln-directed, 2026-07-03)
Lincoln's full vision (2026-07-03): the ops dashboard must tell him everything he needs to know — a sorted "needs my attention" queue with directed actions (missing env vars, needed domains, health), clickable cards with revenue/activity depth, and a "send to Claude Code" button on findings. Ops lives in AppEngine (back office of the United Under God family); the UUG website later reads the SAME collector for a public family-of-apps view — never build a second dashboard.

- ✅ **Ops layer: per-app users / open tickets / recent orders on the owner dashboard** — DONE (**#245**, merged 2026-07-03). Generated apps ship a token-gated `GET /api/admin/stats` (foundation module); deploys inject a per-app `APP_ENGINE_STATS_TOKEN` and keep it on the build job; an ops collector polls reporting apps and caches readings (self-creating `app_ops_stats_cache`, re-poll on read after 10 min — no cron); every portfolio card carries an Ops strip with real counts or an honest "Not reporting yet". AppEngine itself exposes the same endpoint; `APP_ENGINE_OPS_TARGETS` (env JSON) lets any app that adopts the endpoint report with no code change. Standard: `source-of-truth/app-ops-reporting-standard.md`. Free tier only; counts only, no PII; tokens never in git.
- ✅ **Ops attention queue: "needs my attention" panel with directed actions** — DONE (**#251**, merged 2026-07-03). Per app: live-URL reachability, missing required env-var NAMES (Vercel API lists names only — never values; core missing = act, money/mail keys = watch), still-on-`*.vercel.app` = needs a domain, stats-endpoint adoption. One sorted panel on owner-control (act-first, every item a concrete action sentence + Open link), needs-attention flag on cards, Needs list in card detail. Hardened by an 18-agent adversarial review (9 confirmed findings fixed: outage-masking last-good cache, false "All clear" on failed loads, isLocalMode route bypass, stale-as-fresh timestamps, pre-migration NULL needs, mid-deploy false alarms, env-audit dropouts, token-less env targets, duplicate queue entries). Outage sequence live-verified.
- ✅ **Ops attention queue: account-wide Vercel deploy sweep** — DONE (**#278**, merged 2026-07-03; Lincoln-directed after the spark-of-hope waste). The queue now checks EVERY Vercel project's latest production deploy, not just registered apps: a failing latest deploy is an act-now item with the directed fix — fix + redeploy / roll back when a good deploy exists; fix the root directory in Settings → Git or disconnect the git integration when nothing has ever gone live (the exact T6 failure mode). Honest by construction (per #251's rules): a failed sweep is its own watch item (never a silent all-clear), BUILDING is not attention, failures age out after 7 days so dormant projects don't nag, no VERCEL_TOKEN = off. Verified: 9-scenario mock-API behavior test + live account run + `smoke:ops-stats` step.
- 🟢 **Ops deep-dive: clickable card detail — users, revenue (sum of payments), activity trend** (extend the stats contract additively; imported apps report as they adopt it).
- 🟢 **"Send to Claude Code" from a card/finding** — one click packages app+repo+finding into a task packet filed as a GitHub issue labeled for Claude Code (fits the TRANSFER directive; auto-dispatch to a session is a follow-on).
- ✅ **URL status board: every app's domain situation, at a glance** — DONE (**#275**, merged 2026-07-03; Lincoln-directed). Every app in `source-of-truth/ecosystem-portfolio-registry.json` (now 24 entries) shows one of LIVE at its domain · DEPLOYED awaiting domain (`*.vercel.app`-style host only) · DOMAIN OWNED but nothing serving · AWAITING URL — each with the concrete owner next step — in a board panel under the attention queue on owner-control. Owner-provided domain facts (2026-07-03) stored per app as a registry `domain` block (standard amended in `source-of-truth/app-portfolio-registry.md`); milstead.us (community app) vs milstead.church (Milstead Baptist Church, ChurchConnect tenant) recorded as DIFFERENT apps (new `milstead-church` entry); stale best-life.us "WordPress site" blocker superseded (owned, DreamHost-parked). Guarded by `smoke:portfolio-url-status` (valid status + concrete step per app; all 13 owner-confirmed domains exactly once; milstead split enforced; `byUrlStatus` rollup honest). Display + registry data only — no DNS changes, no paid actions; live health stays with the attention queue (#251).

---

## ACTIVATION — without this, the board is just a doc nobody honors
For the check-out protocol to actually prevent collisions, each agent's project instructions must say:
> *"Before any build task: pull BUILD-LEDGER.md from the repo, claim the first 🟢 item per its
> check-out protocol, and never work an item already 🟡 or 🔵. The repo copy is the only real board."*
Add that line to the Claude, ChatGPT, and Codex/Claude Code instruction boxes. A board no one is
pointed at is the same drift problem in a new place.

## The drift rule (why this file exists)
The failure we are ending: an agent that can't see prior work invents new work to look productive,
and the system gets rebuilt instead of finished. This ledger + the scope's ONE RULE + the
Architect/Source-of-Truth gate (Agent #4, to be built into the engine) keep effort on the finish
line. Check the ledger. Claim your item. Build forward. Never recreate what's listed DONE.