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

## ✅ DONE (confirmed against the repo by the agents who merged it — never rebuild these)
- ✅ Canonical pipeline merged to main (PR #165) — intake gate, prior-work check, routing, candidate→packet bridge, handoff, review gates, smoke tests.
- ✅ Ecosystem registry seed corrected + truth-protection smoke tests + initial CURRENT_SCOPE.md (PR #175).
- ✅ Deploy gate proven to halt before provisioning (PR #176) — the cost-stop works.
- ✅ Dark two-door entry built (PR #177) — base `#0e1512`, gold/teal doors, per scope step 2.
- ✅ Entry gated owner-only; GitHub OAuth login working at we-succeed.org.
- ✅ CURRENT_SCOPE.md matured to v8 — locked: two doors; lifecycle build→deploy→verify→audit/improve; free-tier default + one Pro-Supabase exception; expectations up front; no infra jargon to users.

---

## THE BOARD — claimable work

### STEP 3 — make the whole app look finished  *(CURRENT STEP — these are claimable NOW)*
Acceptance for the step: no route renders bare; no screen ships a competing theme; every door/intake keeps the rail.
Items 3a–3d can run in parallel across agents; coordinate only where they touch the same file.

- 🟢 **3a · Wrap every route in the shared AppShell** — find the existing AppShell (rail + header) and ensure every screen renders inside it. No bare routes.
  claim: —
- 🟢 **3b · Fix the problem-intake door dropping the rail** — it must render inside the AppShell like everything else; user is never stranded.
  claim: —
- 🟢 **3c · Collapse the build door to exactly two doors** — it currently shows four choices under three names. Two doors, one consistent consumer name per intake across rail/header/body. No operator jargon.
  claim: —
- 🟢 **3d · Palette pass** — every screen inherits `#0e1512` / gold `#e6a93a` / teal `#34c0ad` / text `#eef2ee`. Kill competing themes.
  claim: —

### STEP 4 — guardrail, then first real deploy  ⛔ BLOCKED until Step 3 is ✅
- ⛔ **4 · Spend/provider guardrail in place, then deploy we-succeed.org with BOTH doors working end to end + health check, within limits.** ("loop to live")

### STEP 5 — first real problem THROUGH AppEngine  ⛔ BLOCKED until Step 4 is ✅
- ⛔ **5 · ChurchConnect visitor bug as `extend_existing` → vNext → Codex in the ChurchConnect repo** (gated AppEngine proof only). The verify-after-publish walkthrough is built and proven here, on the existing Reviewer/Tester pieces — never recreated.

### STEP 6 — open the doors  ⛔ BLOCKED until Step 5 is ✅
- ⛔ **6 · Owner-only → controlled real users → public login,** once spend/safety limits hold.

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
