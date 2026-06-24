# CURRENT_SCOPE.md — the plan: one narrow line from here to a finished, usable app

> Read this first, every time. It keeps work focused, remembers what's already decided,
> and lays out the full pathway to the finish so we stop taking different routes to the same place.
> If a decision below is being re-asked, point here and move on. If a request isn't on the path, surface it and stop.

## What we are building (the whole point, in one breath)
**Opportunity** is the front door: a person brings a problem, and it helps them find the
opportunity inside it, orchestrates people working on similar problems, and routes real
solutions to **AppEngine** — the underlying factory that builds apps from a reusable, improvable
**Lego system of modules** so nothing is rebuilt from scratch.

When Opportunity + AppEngine are finished, **AppEngine autonomously builds out the ecosystem**
(Milstead.us as the community-connection prototype, ChurchConnect, Kids Need Dads, and a dozen
more). That is the goal: a real, beautiful, simple app at we-succeed.org that people — including
Lincoln — log into and use.

## The end state (what "done" actually looks like)
A polished, attractive, simple, user-friendly app live at **we-succeed.org**, that **real people
can log into and use**, with the two-door Opportunity entry, the AppEngine gate/registry/loop
working behind it, and the safety rule that **nothing spends or provisions without Lincoln**.
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
- **Only Lincoln merges, deploys, or approves any spend/resource.**
- **Build work enters through AppEngine / Opportunity.** Broad chat prepares inputs; it never originates build work.

## The pathway to done (narrow but long — one route, in order)
1. Gate the entry page so login works (owner-only first, as the safe test rung). **[done decision: yes]**
2. Merge PR #177 (dark two-door entry). **[Lincoln]**
3. Make the WHOLE app look finished — polished dark theme across the shell/rail, not just the entry panel. Simple, attractive, user-friendly.
4. First real deploy: bring up we-succeed.org (entry + health check), owner-approved. Crosses "loop to live."
5. Prove one real problem end-to-end through the gate (ChurchConnect visitor bug: `extend_existing` -> handoff -> Codex executes).
6. Open login to real users (the deliberate move from owner-only to public).
7. Confirm the spend/approval lock holds with real users. **Done = a beautiful, public, usable app at we-succeed.org.**

## Not on the path right now — surface and stop (these are AppEngine's future OUTPUT, not today's work)
Building/working on Milstead.us, ChurchConnect, Kids Need Dads, United Under God, Best Life, or any
ecosystem app · Spark domain cutover · any new app, feature, or classification.
These get built BY AppEngine, autonomously, AFTER it's finished. Until then they wait.

## Agent rules
1. First action on any task: read this file + the master source of truth from the repo.
2. Build from what exists. Never originate build work in chat. Never invent a classification.
3. If a decision above is being re-asked, point here and move on.
4. No agent merges or deploys. Lincoln does.
