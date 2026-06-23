# CURRENT_SCOPE.md - Opportunity/AppEngine Scope Fence

> Read this first, every time. It keeps work focused, remembers settled decisions,
> and shows the remaining path to soft launch. If a request is not here, surface it
> and stop. If a settled decision is being re-asked, point here and move on.

## One Objective

Finish the single entry point: we-succeed.org, two doors, dark theme, owner-only,
backed by the working AppEngine/Opportunity gate, with one real problem proven
through it. Then soft launch. Nothing else.

Opportunity/AppEngine is the current product. The ecosystem apps are future output
of AppEngine, not the current build target.

## Finish Line

Soft launch is reached when:

- we-succeed.org serves the two-door dark entry point.
- Access is owner-only for Lincoln during soft launch.
- The underlying gate works: intake -> clarify -> prior-work check -> routing -> packet -> loop -> handoff.
- One internal loop reaches a real live URL with a health check.
- One real ChurchConnect visitor-follow-up problem runs through the gate as extend_existing.
- Nothing can deploy, spend, merge, migrate, or create resources without Lincoln.

## Decisions Already Made

- Entry has exactly two doors: "I have a problem to solve" and "I have something I want to build."
- No third door. No user-facing operator jargon such as gate, intake, packet, or loop.
- Entry theme is dark: base #0e1512, gold #e6a93a for the problem door, teal #34c0ad for the build door, text #eef2ee.
- Problem door routes to consumer problem intake.
- Build door routes to opportunity intake.
- Both doors still flow through problem_intake_gate behind the scenes.
- Entry URL is we-succeed.org.
- Soft launch is owner-only.
- Identity table is person. lpl_people is parked.
- Milstead.us is ministry_tool for community outreach and is out of active work.
- Reuse capability and styling, never personal data.
- Customer data lives in its own isolated database.
- Classifications grow only deliberately. Prefer an existing true type; never invent one ad hoc in an unrelated PR.
- Loop is the discipline over the existing pipeline, not a new system.
- The portfolio registry is the catalog. Do not build a separate catalog.
- AppEngine is the factory. Ecosystem apps live in their own repos.
- Only Lincoln merges. Only Lincoln approves deploys, spend, resources, DB changes, or public launch.
- Build work enters through AppEngine/Opportunity. Broad chat prepares inputs; it does not originate build work.

## Allowed Work Now

1. Keep main clean and protected.
2. Finish and verify this scope fence.
3. Complete the we-succeed.org two-door entry point.
4. Make the entry simple, dark, polished, and usable.
5. Keep the app owner-only for soft launch.
6. Prove one internal loop to a live URL with health check.
7. Run ChurchConnect visitor follow-up through the gate after the internal proof.

## Out Of Scope Now

- Building ecosystem apps.
- Expanding Milstead.us.
- Starting Kids Need Dads, Best Life, United Under God, Spark of Hope, or any other ecosystem app work.
- Spark domain cutover.
- ChurchConnect migration off Emergent.
- ChurchConnect repair before the internal live-loop proof.
- Creating new classifications.
- Redesigning architecture.
- Inventing workflows outside the canonical gate.
- Adding side dashboards or tools unless required for the finish line.
- Making the whole app shell dark. Polish later.
- Public access. That comes later by deliberate decision.

## Path To Done

1. Land this scope fence on main.
2. Review and merge the dark two-door entry work if it matches this scope.
3. Gate the entry owner-only for soft launch.
4. Bring up we-succeed.org with the entry point and health check, owner-approved.
5. Carry one internal AppEngine loop all the way to a real live URL.
6. Run ChurchConnect visitor follow-up through the gate as extend_existing.
7. Stop and verify soft launch readiness before public access.

## Agent Rules

1. First action on any task: read this file and the repo source-of-truth protocol.
2. Every task must answer: does this move we-succeed.org and the AppEngine/Opportunity gate closer to soft launch? If no, stop.
3. Build from what exists. Do not originate build work in chat.
4. Do not re-open settled decisions above.
5. Do not merge, deploy, spend, provision, migrate, or create resources. Lincoln does that.
6. Keep PRs small and main-rooted. Do not include unrelated WIP.
7. If agents diverge, the version matching this scope wins.
