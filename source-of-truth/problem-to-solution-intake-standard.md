# Problem-To-Solution Intake Standard

AppEngine should help Lincoln move from a noticed problem or existing solution vision into the right kind of solution path.

This standard expands intake beyond "build an app from a clear request." Sometimes the right first output is not an app. It may be a workflow, process, ministry model, website, content/resource system, automation, or multi-part ecosystem solution.

This is a planning standard only. It does not authorize production deployment, paid resources, migrations, generated app code, public UI changes, or repository visibility changes.

## Purpose

Problem-to-solution intake answers:

- What problem is being noticed?
- Who is affected?
- What barriers keep people stuck?
- What root causes should be explored before building?
- What transformation is desired?
- Is the right solution an app, website, workflow/process, automation, content/resource, community/ministry model, or multi-part ecosystem solution?
- What questions must be answered before AppEngine creates an App Build Packet, vNext Packet, issue, PR, or review path?

## Valid Starting Points

### `problem_first`

Use `problem_first` when Lincoln notices a problem, burden, friction, opportunity, repeated pain, or stuck pattern but does not yet have a clear solution vision.

Examples:

- "Churches keep dropping follow-up after someone asks for help."
- "Parents in conflict need a better way to communicate."
- "I keep seeing people lose hope before they know what step to take."
- "Small businesses waste time on printer supplies and nobody tracks it well."

The output should clarify the problem before proposing a build.

### `vision_first`

Use `vision_first` when Lincoln already sees the problem and has a solution idea, tool, app, service, process, ministry, website, or automation in mind.

Examples:

- "Build Spark of Hope Intake Lite."
- "Create a managed website system for Easy Peazy."
- "Improve Toner Management with reorder tracking."
- "Make a church coordination dashboard."

The output should clarify scope, path, safety, cost, data, review, and phases before implementation.

### `hybrid`

Use `hybrid` when the request includes both a problem and a possible solution, but the solution path still needs validation or may be only one part of a larger ecosystem response.

Examples:

- "People need encouragement, and I think Spark of Hope could help them share stories."
- "Churches need coordination, maybe ChurchConnect can handle volunteers and follow-up."
- "I want a system that helps people discover purpose, maybe an app plus content and community."

The output should validate the problem and compare possible solution shapes before routing to build or planning packets.

## Required Questions

### Problem-First Questions

Problem-first intake must answer or mark as missing:

1. What problem, burden, opportunity, or repeated friction was noticed?
2. Who is affected?
3. What is the current workaround or alternative?
4. What barriers keep people stuck?
5. What root causes may be underneath the visible problem?
6. What need is being addressed?
7. What transformation would show that life is increasing?
8. How could this help someone become more capable of helping others?
9. What solution shapes are plausible?
10. What evidence, examples, or user stories should be gathered before choosing a solution?
11. What risks exist if AppEngine jumps straight into building?
12. What is the smallest safe next step?

### Vision-First Questions

Vision-first intake must answer or mark as missing:

1. What problem does the vision solve?
2. Who is the intended audience?
3. What is the proposed solution?
4. What should be in scope for the first useful version?
5. What should stay out of scope?
6. What success criteria prove the solution helped?
7. What app, tool, workflow, process, content, or community pieces are needed?
8. What data, privacy, identity/auth, admin, and Super Admin needs exist?
9. What provider/cost, security, deployment, review, and monitoring risks exist?
10. What build phases should happen before implementation?
11. What review gates must pass before release?
12. What is the next safe action?

### Hybrid Questions

Hybrid intake must answer or mark as missing:

1. Which parts of the request are problem observations?
2. Which parts are solution assumptions?
3. Which assumptions need validation?
4. What solution shapes should be compared?
5. What can be decided now?
6. What should wait for discovery, customer perspective, provider/cost, design, architecture, or review?
7. What is the smallest safe next step?

## Solution Shape Classification

AppEngine must decide whether the likely output should be one or more of:

- `app`: a software application with routes, data, workflows, auth, review, release, and monitoring.
- `website`: a public or private site, landing page, documentation site, marketing site, ministry site, or managed web presence.
- `workflow_process`: a repeatable human or operational process that may not need new software.
- `automation`: scripted, scheduled, AI-assisted, or integration-based work that reduces repetitive handoffs.
- `content_resource`: guides, curriculum, templates, writing, training, media, resource libraries, or knowledge systems.
- `community_ministry_model`: groups, relationships, service models, care processes, discipleship paths, outreach, or support structures.
- `multi_part_ecosystem_solution`: a combined solution with multiple app, website, workflow, automation, content, community, or ministry pieces.

The selected shape should be based on:

- the barrier being removed
- the people affected
- the desired transformation
- complexity and cost
- data/privacy/security needs
- repeatability
- whether technology is necessary or merely tempting
- whether a simpler human process would solve the problem first
- whether the solution belongs inside an existing app or should become a new app

## Routing Rules

Problem-to-solution intake should route to:

- `discovery` when the problem, audience, root causes, or alternatives are unclear.
- `customer_perspective` when trust, emotion, friction, or usefulness needs validation.
- `connection` when the solution may connect multiple apps or parts of the ecosystem.
- `systems` when the problem suggests root causes, reusable infrastructure, or a repeated operational pattern.
- `planner` when enough is known to produce an App Build Packet, vNext Packet, workflow/process plan, website plan, automation plan, content/resource plan, or community/ministry model.
- `ai:plan` follow-up when the next step should remain planning-only.
- clarification when core fields are missing or the solution shape is ambiguous.

Do not route directly to `ai:build` from problem-to-solution intake unless a later packet or phase issue explicitly approves implementation.

When the problem or vision is accepted as a candidate, use `source-of-truth/problem-portfolio-routing-standard.md` to place it into `app_portfolio_registry` as a tracked solution candidate before creating an App Build Packet, vNext Packet, or implementation issue.

## Owner-Readable Output

The owner-readable output should be concise:

```text
Problem-To-Solution Intake

Mode: problem_first
Problem: Churches lose track of follow-up after someone asks for help.
People affected: people asking for help, church staff, volunteers
Barrier removed: coordination and memory gaps
Desired transformation: people receive timely care and stay connected
Recommended solution shape: workflow_process + app
Why: a human care workflow is needed, and software can support tracking
Next safe action: create discovery issue
Missing context: current follow-up process, who owns care, privacy constraints
Guardrails: planning only, no production, no paid resources, no migrations
```

## Machine-Readable Output Contract

Agents should produce a `problem_solution_intake` artifact:

```json
{
  "kind": "problem_solution_intake",
  "schemaVersion": 1,
  "mode": "problem_first",
  "rawRequest": "Churches keep dropping follow-up after someone asks for help.",
  "problem": {
    "summary": "Church follow-up falls through after help requests.",
    "affectedPeople": ["people asking for help", "church staff", "volunteers"],
    "currentWorkaround": "manual memory, text threads, spreadsheets",
    "barriers": ["ownership gaps", "visibility gaps", "unclear next step"],
    "possibleRootCauses": ["no shared care workflow", "no accountability loop"],
    "needAddressed": "timely care coordination",
    "desiredTransformation": "people receive care and stay connected",
    "movementTowardLife": "people move from isolated need to supported care",
    "helpsPeopleHelpOthers": "volunteers can respond and follow through"
  },
  "vision": {
    "summary": "",
    "proposedSolution": "",
    "firstUsefulScope": "",
    "nonGoals": []
  },
  "solutionShape": {
    "primary": "workflow_process",
    "secondary": ["app"],
    "rationale": "The care process must be clarified before software supports it.",
    "existingAppFit": {
      "status": "ambiguous",
      "candidateApps": [],
      "reason": "No existing app has been selected yet."
    }
  },
  "questions": {
    "answered": ["problem.summary", "problem.affectedPeople"],
    "missing": ["current follow-up process", "privacy constraints"]
  },
  "routing": {
    "nextAgent": "discovery",
    "recommendedLabel": "ai:plan",
    "nextArtifact": "discovery_plan",
    "nextSafeAction": "create_planning_issue",
    "reason": "Audience, current workflow, and root causes need discovery before a build packet."
  },
  "ownerReadableSummary": "Mode: problem_first. Recommended solution shape: workflow_process + app. Next: create discovery issue.",
  "guardrails": {
    "planningOnly": true,
    "noProductionDeploy": true,
    "noPaidResources": true,
    "noMigrations": true,
    "noSecretsOrEnvChanges": true,
    "noGeneratedCodeAutoMerge": true,
    "noPublicIntakeUiYet": true,
    "repositoryVisibilityUnchanged": true,
    "requiresPacketBeforeBuild": true
  }
}
```

## Required Fields

Every `problem_solution_intake` artifact must include:

- `kind`
- `schemaVersion`
- `mode`
- `rawRequest`
- `problem.summary`
- `problem.affectedPeople`
- `problem.barriers`
- `problem.needAddressed`
- `problem.desiredTransformation`
- `problem.movementTowardLife`
- `solutionShape.primary`
- `solutionShape.rationale`
- `questions.answered`
- `questions.missing`
- `routing.nextAgent`
- `routing.recommendedLabel`
- `routing.nextSafeAction`
- `ownerReadableSummary`
- all guardrails

Vision-first artifacts must also include:

- `vision.summary`
- `vision.proposedSolution`
- `vision.firstUsefulScope`
- `vision.nonGoals`

## Follow-Up Issue Requirements

Any follow-up issue created from this intake must include:

- raw request
- selected mode
- problem summary
- affected people
- barrier removed
- need addressed
- desired transformation
- recommended solution shape
- missing context
- next safe action
- required source-of-truth files to load
- guardrails

Required source-of-truth files:

- `source-of-truth/00-why-we-build.md`
- `source-of-truth/01-ecosystem-philosophy.md`
- `source-of-truth/02-global-principles.md`
- `source-of-truth/03-life-produces-life.md`
- `source-of-truth/04-app-purpose-rules.md`
- `source-of-truth/05-ecosystem-design-gates.md`
- `source-of-truth/problem-to-solution-intake-standard.md`
- `source-of-truth/intake-command-standard.md`
- `source-of-truth/app-selection-standard.md`
- relevant app charter when one exists

## Guardrails

Problem-to-solution intake must not:

- deploy production
- create paid resources
- apply migrations
- add secrets or env vars
- auto-merge generated app code
- build public intake UI
- change repository visibility
- create a giant implementation task before the problem and solution path are clarified
- force every problem into an app
- ignore a simpler process, content, community, ministry, or workflow solution
- confuse shared ecosystem philosophy with app-specific purpose

## Success Criteria

The standard is working when:

1. AppEngine can classify intake as `problem_first`, `vision_first`, or `hybrid`.
2. AppEngine can ask the right questions for the selected mode.
3. AppEngine can recommend the right solution shape without assuming everything is an app.
4. AppEngine can produce an owner-readable summary.
5. AppEngine can produce a valid `problem_solution_intake` artifact.
6. Missing context becomes planning follow-up work, not premature implementation.
7. All guardrails remain active.
