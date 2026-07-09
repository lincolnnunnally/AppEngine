# CURRENT_SCOPE.md — one narrow line from here to a finished, usable app

> **Version: 2026-07-03 (v12). Supersedes all earlier versions.**
> The repo copy is the single source of truth; Claude-project and ChatGPT-project copies must match it verbatim. Newest-dated repo copy wins. Copy exactly; do not re-author.
>
> **v12 change (from v11) — approved by Lincoln 2026-07-03:** the ecosystem transfer is now the path. Lincoln directed that **all ecosystem builds move to Claude Code** and the complete ecosystem gets transferred to Lincoln-owned infrastructure and set up. v11's fence ("ecosystem apps are future output, not current work — surface and stop") is **lifted and replaced** by the ordered transfer waves below. The We Succeed product at we-succeed.org stays live and maintained; it is no longer the *only* work. No change to the ONE RULE, the look, the identity decisions, or the free-tier discipline.
>
> **v11 change (from v10):** removed the opening intent choice — one single entrance; the conversation starts directly at the first question; positioned unmistakably as an **app builder**. **v10 change (from v9):** intake became one conversational discovery, not two form doors.
>
> **2026-07-09 amendment to v12 — owner directive (authority model):** Lincoln directed that **all technical work is automated: an idea flows to production with zero technical involvement from him.** Claude Code has FULL technical autonomy — coding, testing, git branches/commits/**merges to main on every ecosystem repo**, deploys to Vercel/Render/any connected host (including production), database schema and data changes, env vars, and DNS/infra management where API access exists. Do NOT ask Lincoln for technical approval. Because no human gate exists, engineering replaces approval: back up before destructive database operations, keep deploys reversible, verify end-to-end after every change, take protective snapshots — then report what was done. Surface to Lincoln ONLY three things: (1) **money** — new paid services, plan upgrades, purchases; (2) **credentials only he can create** — account API keys (e.g. Render), OAuth apps, registrar/DNS logins, Stripe/email accounts (once provided, their use is autonomous); (3) **mission, philosophy, doctrine, and product direction** (what an app IS). Consume the philosophy; never invent or change it. This amendment supersedes every owner-approval gate on **technical** actions (merge/deploy/DB/env/DNS) in this file and in older workflow/gate docs; paid-resource and doctrine/direction gates remain in force. "How we work" and Agent rule 4 below are amended accordingly; everything else in v12 stands.

## THE ONE RULE
**Build from what already exists.** First find what's already built and move forward from it. Improve what's there; never recreate it. Build new only when nothing covers the need. This binds planning (Claude, ChatGPT) as much as building (Claude Code, Codex): no one proposes a fresh path before checking the existing one.

## How we work
Agents run this — they build, merge, and deploy on their own to reach the finish line, within the spending/provider limits Lincoln sets. Lincoln sets vision and limits; the system enforces cost by configuration, not per-action approval. *(Amended 2026-07-09 — see the authority-model amendment above.)* Technical actions — merges to main, deploys (including production and live sites), database schema/data changes, env vars, DNS/infra — are fully autonomous; engineering replaces approval (back up before destructive DB operations, keep deploys reversible, verify end-to-end, snapshot, then report). Only **money (new paid services/upgrades/purchases), credentials only Lincoln can create, and mission/doctrine/product direction** go to Lincoln. **Every app creation and transfer follows our docs: the AIPOS/Launch Pack standards, the App Transfer Ledger Standard, the portfolio registry, the deployment queue's safe path, and the build logs (BUILD-LEDGER + loop-runs). No app work outside those rails.**

## What we're building
Two things, in one system:
1. **The factory stays live.** We Succeed (we-succeed.org) remains the public front door: a person brings a problem or an idea; one conversational discovery; AppEngine builds and ships a real app.
2. **The ecosystem transfer (the active pathway).** Every ecosystem expression — ChurchConnect, EasyPeazy, Snip.Show, Spark of Hope, Live On Mission, Kindred, Milstead/Community Connections, Kids Need Dads, ChildFirst, Best Life, the commercial apps — is transferred onto Lincoln-owned infrastructure, registered in the portfolio, connected to the shared identity (`person`, one Supabase), and brought live. Claude Code is the executing builder; Codex/ChatGPT tracks hand off through the board and their open PRs.

## Done =
Every ecosystem app in the portfolio registry is on Lincoln-owned infra with a live, verified URL, its transfer ledger closed out (every feature `transferred_proven`, intentionally deferred, or owner-removed), its docs (AIPOS/Launch Pack/env profile) in place — and we-succeed.org stays live and usable throughout, all inside Lincoln's spend/provider limits.

## Locked decisions — DO NOT RE-OPEN
- **One conversational discovery, one single entrance** at we-succeed.org (v11) — never rebuild the two-door entry or form wall.
- **Positioned as an app builder, not self-help.**
- **AppEngine builds AND deploys — that's the product.** Lifecycle: tell the problem → clarify → build → deploy → verify → audit/improve.
- **Set expectations up front.** The first version is a real, live, working starter — named plainly.
- **Prompt for solutions, not single tasks.**
- **Free tier by default; one paid exception** (Lincoln's ecosystem identity/data on Pro Supabase). Any new paid resource needs Lincoln's explicit approval first.
- **No infrastructure jargon to users.**
- **Look:** dark, polished, welcoming. Base `#0e1512`, gold `#e6a93a`, teal `#34c0ad`, text `#eef2ee`.
- **Identity table:** `person` canonical; `lpl_*` family parked (selective harvest only).
- **Reuse/Lego:** reuse capability + styling, never personal data; customer data lives in its own isolated DB. Modules cataloged, reused, improved — not rebuilt.
- **Transfers preserve, never recreate** (App Transfer Ledger Standard): live sites stay up during their transfer; feature parity is proven, not assumed; a live surface is never cut over without its origin located and its data path verified.
- **Ecosystem apps connect, not silo:** every transferred app lands on the shared identity architecture; ChurchConnect integrates services, owns none.
- **Domains stay put until cutover is proven.** (For the record: the Kids Need Dads domain is kidsneeddad.com — singular; the plural is a third party's.)

## Pathway to done (the transfer waves, in order)
0. **Protect & govern:** at-risk code backed up (done 2026-07-03: TonerTrackerPro + 4 backup repos); App Transfer Ledger Standard landed on main; portfolio registry regenerated with live issue/PR links; the life-produces-life CODE monorepo cloned locally; this scope v12 landed.
1. **Finish what's closest:** **ChurchConnect first** (Lincoln's call): staff-authenticated Connection Inbox proof → gated `churchconnect` schema apply → PR cleanup (#5/#7/#11/#12) → salvage-only data import per the locked clean-rebuild direction. Then ChildFirst launch pack + Laser Engrave registry sync.
2. **Recover the live-but-unmapped:** find the true origins of easypeazy.site and snip.show (Cloudflare), milstead.us (shared host), kidsneeddad.com (Netlify); bring each onto Lincoln's infra without downtime; canonical-source merges (Snip.Show←emergent; Kids Need Dads←RebuildingDads+KND-google-ai).
3. **Launch the missing transformation apps:** Spark of Hope (canonicalize its five copies → live at spark-of-hope.com), Live On Mission, Kindred, Best Life — on the shared `person` identity, shared modules first (Connection engine from Kindred).
4. **Configs & commercial completion:** JeepFix/RacketPro/Association as engine configs; Toner consolidation; Iconium; Million-Mistakes as content.

## Not on the path now — surface and stop
Inventing new apps, philosophy, or classifications; skipping the transfer-ledger/Launch-Pack rails for "quick" app work; migrating any production data without its gate; new paid resources without approval; cutting over a live domain before the destination is verified.

## Agent rules
1. First action: read this file + the repo master source of truth + BUILD-LEDGER.md (and for app transfers, the app's transfer ledger).
2. Build from what exists. Improve, never recreate. Never invent a classification.
3. Stay on the pathway. If a decision is re-asked, point here and move on. Surface out-of-scope requests and stop.
4. Run autonomously — build, merge, deploy (including production), change databases/env/DNS — within Lincoln's spending/provider limits *(amended 2026-07-09 per the authority-model amendment)*. Engineering replaces approval: back up before destructive DB operations, keep deploys reversible, verify end-to-end, snapshot, then report. Only money, owner-only credentials, and mission/doctrine/product direction go to Lincoln.
5. **Check out your work first.** Before any build task, pull the latest BUILD-LEDGER.md from the repo (the repo copy is the only live board) and claim your item per its check-out protocol — claim first, commit the claim, then build. Never work an item already claimed or in review; never start a blocked item.
6. **Follow the docs in all app creation** — AIPOS/Launch Pack, App Transfer Ledger Standard, portfolio registry, deployment queue safe path, build logs. Verify before you act; reconcile, never clobber; check what has been established before flagging new work.
