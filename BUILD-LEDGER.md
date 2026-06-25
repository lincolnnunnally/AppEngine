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

### STEP 5 — first real problem THROUGH AppEngine  🟡 AppEngine proof done (#191); ChurchConnect execution = Codex's track (parked from this board per Lincoln, 2026-06-25)
- 🟡 **5 · ChurchConnect visitor bug as `extend_existing` → vNext → Codex in the ChurchConnect repo** (gated AppEngine proof only). The verify-after-publish walkthrough is built and proven here, on the existing Reviewer/Tester pieces — never recreated.
  done so far: ✅ AppEngine side (**#191**, merged) — RUN-001 carried through the existing pipeline; prior-work verdict `extend_existing` → materialized the vNext packet + follow-ups (8 phases). This proves the pipeline runs a real problem to a handoff. Fail-closed, nothing deployed.
  ⚠️ **data-layer caveat:** the #191 packet was built on the older **Supabase** model (`connection_inbox`/`connection_cards`). The LIVE ChurchConnect app is now FastAPI/**MongoDB** (off-Emergent migration in its own repo — open PRs #5 Mongo import / #7 fan-out). So #191 is a pipeline PROOF, **not a directly-executable spec** — reconcile to Mongo before any execution.
  remaining for ✅: the real off-Emergent migration + visitor-follow-up fix runs in the **ChurchConnect repo** (`github.com/lincolnnunnally/ChurchConnect` — Codex + a Claude Code session already active there). Lincoln chose to keep AppEngine on its finish line, so this is **NOT an active AppEngine-board item** — it's Codex's track. Steps 6–7 wait on that proof + Lincoln's launch decision.
  owner: Codex (ChurchConnect repo) · Lincoln (launch/data decisions)

### STEP 6 — open the doors  ⛔ BLOCKED until Step 5 is ✅ (it's a launch decision + a real code change, not a config flip)
- ⛔ **6 · Owner-only → controlled real users → public login,** once spend/safety limits hold. **Step stays BLOCKED — the *code half* is now built & merged default-off (#200); flipping it live is still Lincoln's launch decision + spend cap.**

  **Go-public checklist (grounded in the access model, `src/lib/auth/roles.ts` / `access.ts`):**
  1. ✅ **Open the consumer surface to role `customer` — BUILT, default OFF (#200).** Shipped staged behind `APP_ENGINE_PUBLIC_ACCESS` (`owner` default → `allowlist` → `public`; unknown fails closed) via new `canAccessEngineConsumerSurface` gate. The two-door entry + `/problem-intake-lite` + `/opportunity-intake` + their **POST** APIs now open to a permitted `customer` when flipped; GET list-all + operator screens (owner-control, builder, admin, canonical-status, orchestrator, module-catalog, life-core) stay owner/admin-only (builder + life-core re-gated for defense-in-depth). Role-aware rail hides operator jargon from customers. `smoke:consumer-access` covers the decision table. **Default `owner` mode = identical to pre-#200 behavior, so the merge changed nothing live.**
  2. ✅ **Stage it — BUILT (#200).** `allowlist` rung reads `APP_ENGINE_CUSTOMER_ALLOWLIST` (approved emails) as the controlled middle rung before fully `public`. Env vars documented in `.env.example` / `.env.vercel.example`.
  3. ✅ **Soft-launch copy flip — BUILT, default OFF (#201).** `/soft-launch` reads the same `APP_ENGINE_PUBLIC_ACCESS` mode: `owner` keeps the current "Owner-only soft launch" copy (no live change), `allowlist` shows an invited-access welcome, `public` shows the open "We Succeed" welcome. So the whole go-public bundle is now code-complete and dormant — flipping the env is the only "going live" action left.
  4. ✅ **Spend/safety holds by construction** — free-tier default + the release gate (#186/#187), and **Vercel is on Hobby/free (confirmed 2026-06-25), so there is no spend to cap** — you can't overspend; Hobby just rate-limits deploys (~24h), never charges. The only paid resource stays Lincoln's Supabase Pro identity (per CURRENT_SCOPE). Caveat for *fully* public: Hobby ToS restricts commercial use.
  5. **Verify-after-publish** — walk the live app (every door/intake) once it's open, on the existing Reviewer/Tester pieces.
  - Pre-public hardening already shipped (**#192**): public title → "We Succeed" (no "App Engine"/"Neon" jargon), security headers (X-Frame-Options/X-Content-Type-Options/Referrer-Policy/Permissions-Policy) live on we-succeed.org. (Strict CSP still open — needs nonces.)
  - **To go live when ready (now a pure env flip — entry, intakes, rail, AND soft-launch copy all track the mode):** `APP_ENGINE_PUBLIC_ACCESS=allowlist` + `APP_ENGINE_CUSTOMER_ALLOWLIST=<emails>` (controlled) → later `=public` → verify-after-publish (#5). No spend cap needed: Vercel is on Hobby/free (cost is moot; deploys just rate-limit, never charge). Step still waits on Lincoln's launch decision + the board's Step-5 ordering.

### STEP 7 — confirm it holds  ⛔ BLOCKED until Step 6 is ✅
- ⛔ **7 · Confirm spend limits hold under real use.** **Done = beautiful, public, usable app at we-succeed.org.**

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
