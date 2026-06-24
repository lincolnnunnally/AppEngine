# CURRENT_SCOPE.md — the plan: one narrow line from here to a finished, usable app

> **Version: 2026-06-24 (v5). Supersedes ALL earlier versions.**
> The copy committed in the repo is the single source of truth. The Claude-project and
> ChatGPT-project copies must match it verbatim. If any copy differs, the newest-dated repo copy
> wins. Do not re-author this document — copy it exactly.

## THE ONE RULE (read this before anything else)
**Build from what already exists.** When Lincoln makes a request, FIRST find what has already been
built for it and move forward from that foundation. Improve or tweak what's there when needed —
never recreate it. Create something new only when nothing already covers the need.
This binds advice and planning (Claude, ChatGPT) exactly as much as building (Claude Code, Codex):
**no one proposes a fresh path before checking the existing one.** Reinvention is the failure we are
ending; reference-and-build-forward is the rule.

## How we work now
The agents run this. Advice agents build on the platform; builder agents build on the foundation;
they **merge and deploy on their own** to move toward the finish line. This document's job is to keep
them aimed in the right direction — not to insert Lincoln as a manual approval gate. Lincoln sets the
vision and the spending limits; the agents do the rest and complete the app.

---

## What we are building (the whole point, in one breath)
**Opportunity** is the front door: a person brings a problem, and it helps them find the
opportunity inside it, orchestrates people working on similar problems, and routes real
solutions to **AppEngine** — the underlying factory that builds apps from a reusable, improvable
**Lego system of modules** so nothing is rebuilt from scratch.

When Opportunity + AppEngine are finished, **AppEngine autonomously builds out the ecosystem**
(Milstead.us as the community-connection prototype, ChurchConnect, Kids Need Dads, and a dozen
more). The goal: a real, beautiful, simple app at we-succeed.org that people — including Lincoln —
log into and use.

## The end state (what "done" actually looks like)
A polished, attractive, simple, user-friendly app live at **we-succeed.org**, that **real people
can log into and use**, with the two-door Opportunity entry and the AppEngine gate/registry/loop
working behind it — operating within the **spending and provider limits Lincoln has set**.
"Beautiful and public and usable" is the target — not a deferral.

## Decisions already made — DO NOT RE-OPEN
- **Entry = TWO doors:** "I have a problem to solve" / "I have something I want to build." No third door. No operator jargon shown to users.
- **Look = dark, polished, simple, welcoming.** Base `#0e1512`, gold `#e6a93a` (problem door), teal `#34c0ad` (build door), text `#eef2ee`. Built in PR #177; polish (including the full app shell) is IN scope.
- **Door routing:** problem -> consumer problem intake; build -> opportunity-intake. Both flow through `problem_intake_gate` behind the scenes.
- **Entry URL = we-succeed.org. Public login is the goal.**
- **Identity table:** `person` canonical; `lpl_people` parked.
- **Reuse / Lego model:** reuse capability + styling, never personal data; customer data lives in its own isolated database. Modules are cataloged, reused, and improved — not rebuilt.
- **Classifications grow only deliberately:** prefer an existing true type; never invent one ad hoc in an unrelated PR.
- **"Loop" is the discipline/wrapper** over the existing pipeline; the portfolio registry IS the catalog — no separate catalog.
- **AppEngine is the factory;** ecosystem apps are its FUTURE OUTPUT, each in its own repo, connected via the registry — not absorbed, and not current work.
- **Agents merge and deploy autonomously.** The one hard limit: spending and provisioning stay within the budget and approved-provider limits Lincoln sets — the system enforces those limits, so cost is controlled by configuration, not by per-action approval. Irreversible/destructive operations (e.g., permanently deleting data) require an explicit confirmation step.
- **Build work enters through AppEngine / Opportunity.** Broad chat prepares inputs; it never originates build work.

## The pathway to done (narrow but long — one route, in order)
1. Gate the entry page so login works (owner-only first, as the safe test rung). **[done decision: yes]**
2. Merge PR #177 (dark two-door entry).
3. Make the WHOLE app look finished — polished dark theme across the shell/rail, not just the entry panel. Simple, attractive, user-friendly.
4. Put the spend/provider limit-guardrail in place, then first real deploy: bring up we-succeed.org (entry + health check) within that limit. Crosses "loop to live."
5. After the live deploy proof, run the first real product problem THROUGH AppEngine: ChurchConnect visitor bug as `extend_existing` -> vNext handoff -> Codex executes in the ChurchConnect repo. Allowed only because it is a gated proof of AppEngine, not direct ChurchConnect side work.
6. Move from owner-only to controlled real-user access, then public login once the spend/safety limits are confirmed holding.
7. Confirm the spend limits hold under real use. **Done = a beautiful, public, usable app at we-succeed.org.**

## Not on the path right now — surface and stop (these are AppEngine's future OUTPUT, not today's work)
Building/working on Milstead.us, ChurchConnect, Kids Need Dads, United Under God, Best Life, or any
ecosystem app · Spark domain cutover · any new app, feature, or classification.
These get built BY AppEngine, autonomously, AFTER it's finished. Until then they wait.
(ChurchConnect appears in step 5 ONLY as a gated proof of AppEngine — never as direct side work.)

## Agent rules
1. First action on any task: read this file + the master source of truth from the repo.
2. Build from what exists (THE ONE RULE). Improve what's there; never recreate it. Never invent a classification.
3. Stay on the pathway above. If a decision is being re-asked, point here and move on. Surface out-of-scope requests and stop.
4. Run autonomously — merge, build, deploy — within Lincoln's spending/provider limits. Only irreversible/destructive actions need an explicit confirmation.
