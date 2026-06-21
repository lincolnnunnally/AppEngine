# Problem Intake Gate

The official AppEngine front door. When Lincoln enters a problem, opportunity,
app idea, feature request, or improvement request, AppEngine must not begin
planning or building. It must first create an intake packet and name the control
gates that apply. All new work starts here.

## Rule

No user problem becomes architecture, design, or implementation work until the
intake packet and its control gates exist. Agents must not build directly from
conversation text. Intake cannot be skipped.

The gate routes only to a safe pre-build phase (`clarify_problem`,
`prior_work_check`, or `solution_candidate_review`). It can never route directly
to architecture, design, data model, MVP build, implementation, or deployment.

## Required Intake Packet Fields

Every intake packet (`problem_intake_gate` artifact) must identify:

- **raw request** — the exact request as entered.
- **problem being solved** — the underlying problem (or marked missing).
- **intended person/customer** — who this is for (or marked missing).
- **likely app or new app** — name, slug, and `new | existing | unknown`.
- **request type** — `problem | opportunity | app_idea | feature_request | improvement_request | fix | ambiguous`.
- **missing context** — what must be clarified before proceeding.
- **required source-of-truth files** — what every downstream agent must load.
- **applicable control gates** — the gates that must pass before any build.
- **blocked actions** — what is not allowed at intake.
- **recommended next issue label** — defaults to `ai:plan`.
- **next safe phase** — a pre-build phase only.

## Request Type → Applicable Control Gates

All paths require `source_of_truth_gate`, `prior_work_check_gate`, and
`owner_review_gate`. Then:

| Path | Trigger | Added gates |
| --- | --- | --- |
| new app | `app_idea`, or `opportunity`/idea with no existing app | `problem_portfolio_routing`, `solution_candidate_review_gate`, `packet_draft_approval_gate`, `app_build_packet_gate`, `identity_auth_gate`, `super_admin_gate`, `provider_cost_gate`, `design_quality_gate`, `compatibility_gate`, `release_gate` |
| existing app improvement | `feature_request`, `improvement_request`, `fix`, or an existing app named | `problem_portfolio_routing`, `solution_candidate_review_gate`, `packet_draft_approval_gate`, `vnext_packet_gate`, `design_quality_gate`, `compatibility_gate`, `release_gate` |
| clarify first | `problem`/`ambiguous` with no clear shape | `opportunity_clarification`, `problem_portfolio_routing`, `solution_candidate_review_gate` |

`prior_work_check_gate` is blocking (see `source-of-truth/prior-work-check-gate.md`):
`build_new` authorizes a new App Build Packet; `extend_existing` authorizes a
vNext/repair packet; otherwise the work stops.

## Blocked Actions At Intake

- begin architecture, begin design, begin implementation
- create app code from conversation
- create an App Build Packet before the Prior-Work Check
- production deploy, create paid resources, run migrations, change secrets/env
- Codex auto-execution, create a GitHub issue without owner approval
- skip intake

## Where It Lives

- Standard: this file (`source-of-truth/problem-intake-gate.md`).
- Engine: `src/lib/engine/problem-intake-gate.ts` (produces the `problem_intake_gate` artifact).
- API: `POST /api/engine/problem-intake-gate` (owner-gated; `GET` lists packets).
- UI: `/problem-intake` — the official entry surface.
- Entry route: the cockpit home (`/`) leads with "Start here — Problem Intake Gate"; the two downstream doors come after intake.

## Pipeline Position

```text
Lincoln enters a problem / opportunity / app idea / feature / improvement
  -> Problem Intake Gate (this gate, mandatory front door)
       produces the intake packet + applicable control gates + blocked actions
       next safe phase = clarify_problem | prior_work_check | solution_candidate_review
  -> clarification / routing
  -> Prior-Work Check (blocking)
  -> packet (App Build Packet or vNext) -> review gates -> handoff
```

## Success Criteria

The gate is working when:

1. A request produces an intake packet with every required field.
2. The packet lists the applicable control gates and blocked actions.
3. The next safe phase is never architecture, design, or implementation.
4. The cockpit entry route starts at intake; no door leads to a build before intake.
5. Architecture, design, and implementation remain blocked until the intake packet and control gates exist.
