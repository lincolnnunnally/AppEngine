# CURRENT_SCOPE.md — one narrow line from here to a finished, usable app

> **Version: 2026-06-27 (v10). Supersedes all earlier versions.**
> The repo copy is the single source of truth; Claude-project and ChatGPT-project copies must match it verbatim. Newest-dated repo copy wins. Copy exactly; do not re-author.
>
> **v10 change (from v9):** the intake is now **one conversational discovery**, not two separate form doors. Live feedback showed the forms felt like homework, and the two doors asked the same question set in a different order. So the entry asks one question at a time and reflects back; the two intents (problem / build) are the opening turn, and a form fallback remains. Updated the "Two doors" and "Door routing" locked decisions below. No change to the finish line. (App went **public** 2026-06-27 — see BUILD-LEDGER Step 6.)
>
> **v9 change (from v8):** folded the BUILD-LEDGER check-out rule into Agent rules, so the one instruction-box doc carries it — agents pull the live ledger and claim their item before building, so multiple agents don't collide or rebuild. The detailed protocol stays in BUILD-LEDGER.md (referenced, not duplicated). No change to scope or finish line.

## THE ONE RULE
**Build from what already exists.** First find what's already built and move forward from it. Improve what's there; never recreate it. Build new only when nothing covers the need. This binds planning (Claude, ChatGPT) as much as building (Claude Code, Codex): no one proposes a fresh path before checking the existing one.

## How we work
Agents run this — they build, merge, and deploy on their own to reach the finish line, within the spending/provider limits Lincoln sets. Lincoln sets vision and limits; the system enforces cost by configuration, not per-action approval. Only irreversible/destructive actions (e.g., permanently deleting data) need explicit confirmation.

## What we're building
**Opportunity** is the front door: a person brings a problem; it finds the opportunity inside, connects people around shared problems, and routes solutions to **AppEngine** — the factory that builds apps from a reusable **Lego system of modules**. When finished, AppEngine autonomously builds out the ecosystem. Goal: a real, beautiful, simple app at **we-succeed.org** that people log into and use.

## Done =
A polished, simple, user-friendly app live at we-succeed.org that real people log into and use, with the two-door entry and the AppEngine gate/registry/loop behind it, inside Lincoln's spend/provider limits.

## Locked decisions — DO NOT RE-OPEN
- **One conversational discovery, two intents:** the entry is a guided conversation that asks one question at a time and reflects back — not a wall of form fields. The two intents — "a problem I'm facing" / "something I want to build" — are the **opening turn**, then the questions converge (they're the same set in a different order). A **form fallback** ("prefer to fill out a form?") keeps the original forms for anyone who wants them. No third/fourth intent. No operator jargon ("Vision intake," "Opportunity Intake," "mode") shown to users. (Deterministic + free today; built so a Claude clarification worker can drive it later.)
- **AppEngine builds AND deploys — that's the product.** The user describes the problem and the result they want; AppEngine does everything between and ships a real, deployed, loggable-into app at a live URL (the Vercel hosting URL by default, or one the user provides). Auto-build and auto-deploy are the value, never a disclaimer. **Lifecycle: tell the problem → clarify → build → deploy → verify → audit/improve.** After publish, AI walks the live app itself — every workflow, every button, every function — and confirms each works before handing it back. Starter apps are expected imperfect at launch — the user logs in, tests, improves. No screen may say "no automatic build," "no production deploy," or "no assumed destination."
- **Set expectations up front.** The biggest source of user frustration is expecting one thing and getting another. So the process tells the user plainly: the first version is a real, live, working starter — not the final polished product — and after publish it is verified, then tested and improved with their input. Naming the arc up front is part of the product, not a disclaimer.
- **Prompt for solutions, not single tasks.** Intake asks for the outcome the user wants. Agents run longer loops completing a whole solution per turn — fewer handoffs, less redone work.
- **Free tier by default; one paid exception.** All engine/generated-app resources stay free-tier / pre-approved, so a deploy can't surprise-cost. The only paid resource is Lincoln's own ecosystem identity/data on Pro Supabase. Spending stays inside configured limits.
- **No infrastructure jargon to users.** Customers never see provider/database names ("Neon," "Supabase," "Vercel," "provider," "paid resources"). Placement (shared ecosystem identity → Supabase; standalone customer app → isolated Neon) is internal only.
- **Look:** dark, polished, welcoming. Base `#0e1512`, gold `#e6a93a` (problem), teal `#34c0ad` (build), text `#eef2ee`.
- **Intent routing:** the conversation maps the problem intent → consumer problem intake (`/api/problem-intake-lite`) and the build intent → opportunity-intake (`/api/opportunity-intake`); the form fallback hits the same endpoints. Both flow through `problem_intake_gate` behind the scenes.
- **Entry URL = we-succeed.org. Public login is the goal.**
- **Identity table:** `person` canonical; `lpl_people` parked.
- **Reuse/Lego:** reuse capability + styling, never personal data; customer data lives in its own isolated DB. Modules cataloged, reused, improved — not rebuilt.
- **AppEngine is the factory;** ecosystem apps are its FUTURE OUTPUT, each in its own repo, connected via the registry — not absorbed, not current work.
- Build work enters through AppEngine/Opportunity. Broad chat prepares inputs; it never originates build work.

## Pathway to done (in order)
1. Gate entry so login works (owner-only first). **[done]**
2. Dark two-door entry (PR #177). **[done]**
3. Whole app looks finished — every screen renders inside the shared AppShell (persistent rail + header) so no screen strands the user; every screen inherits the locked palette. **Acceptance: no route renders bare; no screen ships a competing theme; every door/intake screen keeps the rail.** (Ecosystem screens like `spark-of-hope-intake-lite` are out of scope, excluded.)
4. Spend/provider guardrail in place, then first real deploy: we-succeed.org with **BOTH doors working end to end** (each reaches its intake, rail intact) + health check, within limits. Crosses "loop to live."
5. First real product problem THROUGH AppEngine: ChurchConnect visitor bug as `extend_existing` → vNext → Codex executes in the ChurchConnect repo. Allowed only as a gated AppEngine proof, not direct side work. The verify-after-publish walkthrough is built and proven here as part of the loop — on the existing Reviewer/Tester pieces, never recreated.
6. Owner-only → controlled real-user access → public login, once spend/safety limits hold.
7. Confirm spend limits hold under real use. **Done = beautiful, public, usable app at we-succeed.org.**

## Not on the path now — surface and stop
Building Milstead.us, ChurchConnect, Kids Need Dads, United Under God, Best Life, or any ecosystem app; Spark domain cutover; any new app/feature/classification. These get built BY AppEngine, after it's finished. (ChurchConnect appears in step 5 ONLY as a gated AppEngine proof.)

## Agent rules
1. First action: read this file + the repo master source of truth + BUILD-LEDGER.md.
2. Build from what exists. Improve, never recreate. Never invent a classification.
3. Stay on the pathway. If a decision is re-asked, point here and move on. Surface out-of-scope requests and stop.
4. Run autonomously — build, merge, deploy — within Lincoln's spending/provider limits. Only irreversible/destructive actions need confirmation.
5. **Check out your work first.** Before any build task, pull the latest BUILD-LEDGER.md from the repo (the repo copy is the only live board; this box is a stale snapshot) and claim your item per its check-out protocol — claim first, commit the claim, then build. Never work an item already claimed or in review; never start a blocked item. Build agents claim and execute (Claude Code, Codex, ChatGPT); broad Claude chat prepares inputs and reviews — it doesn't claim.
