I'll start by auditing the existing AppEngine structure before mapping anything new. Let me explore the repo layout.

The repo lives in `production-app/`. Let me map it deeply, focusing on the pipeline-related directories.

This is a large, mature pipeline. Let me read the new loop concepts first, then the existing pipeline docs. Let me locate the loop docs and read the key files.

Now let me read the new loop docs and the RUN-001 record together.

The new loop system is clear and even has its own reconciliation section. Now let me read the existing pipeline docs across the 8 areas. Batch one:

Now the key build-packet, routing, registry, and handoff docs, plus the loop-runs engine wiring:

The picture is forming: there are actually **two** parallel intake vocabularies already (`opportunity_*` and `problem_*`). Let me read the handoff chain, review gates, the loop-runs wiring, and package.json scripts to see what's actually wired.

Let me confirm the manifest wiring, the opportunity→build-packet bridge, and whether RUN-001/ChurchConnect already exists in any engine store (vs. only as a markdown file).

I now have the full picture. Let me verify how the existing pipeline entry scripts work (to judge whether RUN-001 can actually be fed through them), and confirm the loop UI is real.

I have everything I need for a grounded reconciliation. No new files created — this is audit-only. Here is the report.

---

# AppEngine Reconciliation Report — Loop Language vs. Existing Pipeline

**Audited:** `app-engine/production-app/` (the real repo per memory). **Date:** 2026-06-21.

## Headline finding

The existing AppEngine pipeline **already implements every stage** your new loop language describes — intake, clarification, routing, portfolio registry, build packet, Codex/ChatGPT handoff, review gates, and smoke tests are all present, wired, and smoke-tested. The new loop docs are a **thin doctrine wrapper**, and `APPENGINE_LOOP_SYSTEM.md` even says so itself in its "Existing Repo Reconciliation" section.

Three things are genuinely true and worth acting on:

1. **The loop intake is real and wired — but it runs *parallel* to the existing pipeline, not through it.** `loop-run-records.ts` writes to its own `manual-loop-runs` store and is **not referenced by the orchestrator or the portfolio registry**. It's a third intake vocabulary sitting next to two that already exist.
2. **The repo already carried duplication *before* the loop docs:** there are **two** full intake→packet chains — an `opportunity_*` chain and a `problem_*` chain — plus `problem-intake-lite` and the `intake-command`/`chatgpt-handoff` front doors. The loop docs added a third front door.
3. **RUN-001 (ChurchConnect Visitor Capture) has never touched the pipeline.** It exists *only* as a markdown loop record (`loop-runs/…run-001…md`). It is not a candidate, not in the portfolio registry, not a build packet. Its own record shows it blocked before implementation because the ChurchConnect checkout is outside the writable root.

Two of your "recent new concepts" don't need building — they map onto existing structures:
- **"completed run records become catalog entries" → the existing `app_portfolio_registry`.** Do **not** build a catalog (matches your Task 5).
- **"project is container of loops" → existing `projects → runs`** (`/api/engine/projects/[projectId]/runs`).
- **`LOOP_GOAL_AND_REVIEW_GATE.md` does not exist anywhere** — that concept is already covered inside `APPENGINE_LOOP_SYSTEM.md` (Exit Condition) and the existing review gates.

---

## 1. Reconciliation table — existing pipeline by area

| Area | Existing file / script | Purpose | Overlaps with loop docs | Verdict | Next action |
|---|---|---|---|---|---|
| **Problem intake** | [problem-to-solution-intake-standard.md](production-app/source-of-truth/problem-to-solution-intake-standard.md), [intake-command-standard.md](production-app/source-of-truth/intake-command-standard.md), [create-intake-packet.js](production-app/scripts/create-intake-packet.js), [problem-intake-lite.ts](production-app/src/lib/engine/problem-intake-lite.ts) | Turn a raw request into a structured `problem_solution_intake` / `intake_packet` | Loop "Idea Intake" + loop-run-record `goal` | **KEEP** | Make loop intake emit/attach an `intake_packet`, not a private record |
| **Opportunity intake** (parallel) | [opportunity-intake-foundation.md](production-app/source-of-truth/opportunity-intake-foundation.md), [opportunity-intake.ts](production-app/src/lib/engine/opportunity-intake.ts) | Customer-facing problem→solution front door (`opportunity_intake`) | Same role as problem intake **and** loop intake | **REVISE / converge** | Pick one canonical front door; see §3 dedup |
| **Opportunity clarification** | [opportunity-clarification-engine.md](production-app/source-of-truth/opportunity-clarification-engine.md), [opportunity-clarification.ts](production-app/src/lib/engine/opportunity-clarification.ts) | `opportunity_intake` → `opportunity_clarification` | Loop "Clarify problem and who it is for" | **KEEP** | Use as the loop's clarify step |
| **Solution routing** | [opportunity-solution-path-router.md](production-app/source-of-truth/opportunity-solution-path-router.md), [problem-portfolio-routing-standard.md](production-app/source-of-truth/problem-portfolio-routing-standard.md), `opportunity-solution-path.ts`, `create-problem-portfolio-routing.js` | Route a clarified problem to app/vNext/non-app candidate | Loop implicit "Define → route" | **KEEP** (two impls overlap) | Standardize on one router output |
| **Portfolio registry** | [app-portfolio-registry.md](production-app/source-of-truth/app-portfolio-registry.md), [app-portfolio-registry.ts](production-app/src/lib/engine/app-portfolio-registry.ts), `create-app-portfolio-registry-standard.js` | Owner-facing map of every managed app/candidate | **This *is* your "catalog of completed runs"** | **KEEP — this is the catalog** | Wire loop run records to register here; do **not** build a catalog |
| **Build packets** | [app-build-packet.md](production-app/source-of-truth/app-build-packet.md), [candidate-to-packet-bridge.md](production-app/source-of-truth/candidate-to-packet-bridge.md), [opportunity-appengine-candidate-bridge.md](production-app/source-of-truth/opportunity-appengine-candidate-bridge.md), `create-app-build-packet.js`, `opportunity-build-packet-bridge.ts` | Convert approved candidate → chartered, phased build packet | Loop "Define acceptance criteria → requirements → task plan" | **KEEP** | This is the loop's "build packet" step verbatim |
| **Codex handoff** | [chatgpt-handoff-issue-standard.md](production-app/source-of-truth/chatgpt-handoff-issue-standard.md), `create-chatgpt-handoff-packet.js`, [build-execution-request.ts](production-app/src/lib/engine/build-execution-request.ts), [handoff-relay-reducer.md](production-app/source-of-truth/handoff-relay-reducer.md), `orchestrator-approved-handoff-export.md` | Conversation/packet → GitHub issue → Codex build-execution request | Loop "Build (Codex worker)" + RUN-001 `agent_assigned: Codex` | **KEEP** | RUN-001's "Codex" is prose only — route it through `build-execution-request` |
| **Review gates** | [solution-candidate-review-gate.md](production-app/source-of-truth/solution-candidate-review-gate.md), [packet-draft-approval-gate.md](production-app/source-of-truth/packet-draft-approval-gate.md), [release-gate-standard.md](production-app/source-of-truth/release-gate-standard.md), [controlled-production-release-gate.md](production-app/source-of-truth/controlled-production-release-gate.md), design/ux/compatibility gates | Gate candidates/packets/releases before progressing | Loop "Review against acceptance criteria / Pass?" + the imagined `LOOP_GOAL_AND_REVIEW_GATE.md` | **KEEP** | The loop's review gate already exists; don't author a new gate doc |
| **Smoke tests** | 100+ `scripts/smoke-*.js` incl. [smoke-appengine-loop-system.js](production-app/scripts/smoke-appengine-loop-system.js) | "Run tests and checks" per stage | Loop "Run tests and checks" | **KEEP** | Loop already has `smoke:appengine-loop-system`; reuse pattern |

---

## 2. New-concept → existing-implementation map

| Recent concept | Maps to existing | Status | Verdict |
|---|---|---|---|
| **APPENGINE_LOOP_SYSTEM.md** | Manifest-loaded ([agents/manifest.yaml:31](production-app/agents/manifest.yaml)); backed by `loop-run-records.ts` + `/api/engine/loop-runs` + `loop-intake` page/form + smoke | **Wired, but standalone** | **KEEP + WIRE UP** to orchestrator/portfolio |
| **LOOP_GOAL_AND_REVIEW_GATE.md** | No such file exists. Covered by `APPENGINE_LOOP_SYSTEM.md` (Exit Condition) + `solution-candidate-review-gate` + `release-gate-standard` | **Missing / redundant** | **DO NOT ADD** — fold into existing gates |
| **RUN-001 ChurchConnect Visitor Capture** | Only `loop-runs/…run-001…md`. Not a candidate/packet/registry entry | **Markdown-only, blocked pre-impl** | **WIRE UP** — feed through pipeline (§4) |
| **"project is container of loops"** | `projects` + `/api/engine/projects/[projectId]/runs` already model project→runs | **Exists in code** | **KEEP** — reuse projects/runs, rename "runs"→"loops" only in docs |
| **"completed run records become catalog entries"** | `app_portfolio_registry` artifact + `app-portfolio-registry.ts` | **Exists** | **DO NOT build a catalog** — register completed loops into the portfolio registry |

---

## 3. The four buckets

**A. Exists & should be used (don't rebuild):**
- Full chain: `intake → clarification → solution routing → portfolio routing → solution-candidate-review → candidate-to-packet bridge → packet-draft-approval → final-packet-materialization → phase-issue-generation → handoff` (all have docs, engine code, scripts, and smoke tests).
- `app_portfolio_registry` = the catalog. `projects/runs` = project-as-container-of-loops. Review gates = the loop's review gate.

**B. Duplicated & should be retired/converged:**
- **Two intake→packet chains:** `opportunity_*` (5-step, code-backed via `opportunity-build-packet-bridge.ts`) and `problem_*` (`problem_solution_intake → problem_portfolio_routing → solution_candidate_review → candidate_packet_bridge`). They converge on the same `candidate_packet_bridge`/portfolio. **Pick one canonical chain**; keep the other only as an alias.
- **Three front doors** for the same act of "describe a problem": `opportunity-intake`, `problem-intake-lite`, and the new `loop-intake`. Converge to one.
- **`LOOP_GOAL_AND_REVIEW_GATE.md`** as a planned new doc — retire the idea; it duplicates existing gates.

**C. Missing & should be added (small, not new architecture):**
- A **link from loop run records → portfolio registry / projects.runs**. Today `loop-run-records.ts` is isolated (confirmed: not referenced by `orchestrator.ts` or `app-portfolio-registry.ts`). This is the one real wiring gap.
- RUN-001 needs to actually enter the pipeline (it never has).

**D. Scaffold/dry-run vs. actually wired:**
- **Actually wired:** loop intake (engine+API+UI+smoke); the dry-run *generator* scripts (`create-*`/`smoke-*`) all run and emit artifacts; opportunity & problem chains have engine code + routes.
- **Scaffold/dry-run only (by design, owner-gated):** GitHub issue creation, label changes, Codex auto-execution, PR creation, deploys, migrations — all blocked per `#139` vs `#155–#160` guardrails repeated in every artifact. RUN-001's `agent_assigned: Codex` and "ChurchConnect repo handoff" are **prose, not executed**.

---

## 4. Task 6 — feeding RUN-001 through the existing pipeline

RUN-001 *can* be expressed entirely in existing artifacts (no new architecture). The mapping:

| Loop stage | Existing command / artifact | RUN-001 content |
|---|---|---|
| Intake | `INTAKE_REQUEST="ChurchConnect visitor capture: mobile public form → stored submissions → owner-only admin list → persistent followed-up state" npm run intake:create` | from RUN-001 `goal` |
| Routing | `npm run problem:portfolio-route` → `existing_app_improvement` (ChurchConnect exists) | candidate type |
| Review gate | `npm run solution:candidate-review` → expect `ready_for_vnext_packet` | AC1–AC4 |
| Packet | `npm run candidate:packet-bridge` → `npm run packet:draft-approval` → `npm run packet:materialize-final` | acceptance criteria → phased packet |
| Codex handoff | `npm run handoff:create` (chatgpt_handoff_packet) → `build-execution-request` | replaces prose "agent_assigned: Codex" |

**Hard blocker (already discovered by RUN-001 itself, not new):** the ChurchConnect app checkout lives outside this workspace's writable root, so the *final* "ChurchConnect repo handoff → implementation" step cannot execute from here. Everything up to and including the **build-execution-request / handoff packet** can. The handoff packet is exactly the bridge object meant to cross that boundary.

I did **not** run these or create artifacts — that adds files, and your Task 4 says don't build new architecture yet. Say the word and I'll run the dry-run chain to materialize RUN-001 as a real `vnext_packet` + handoff packet (local, owner-gated, no deploy/issue/PR), which is the legitimate "feed it through the existing pipeline" move.

---

## Recommended next actions (in order)

1. **Decide the canonical chain** — `opportunity_*` vs `problem_*` vs `loop`. (This is the one decision only you can make; everything else follows.)
2. **Wire `loop-run-records.ts` into the portfolio registry + projects.runs** instead of its private store — closes the only real gap and kills the "separate catalog" risk.
3. **Run RUN-001 through the existing chain** to a `vnext_packet` + `build_execution_request` (with my help, on approval).
4. **Don't create** `LOOP_GOAL_AND_REVIEW_GATE.md` or any catalog system.

Want me to (a) draft the convergence decision as an `AskUserQuestion` so we lock the canonical chain, or (b) execute the RUN-001 dry-run chain now?