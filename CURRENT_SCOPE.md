# CURRENT_SCOPE.md — AppEngine Scope Fence

> Repo-level scope fence for **every** agent working in this repo (Claude Code, Codex,
> ChatGPT, human). Read this **before** making any change. Work only from this fence.
> When a request falls outside it, stop and ask Lincoln.

## One objective
Land and protect the **canonical AppEngine flow** on `main`, then reach **soft launch** —
without adding new scope.

Canonical flow (one of each):
`problem_intake_gate → clarification → prior_work_check → routing → candidate_packet_bridge → loop_run_records → execution → verification → app_portfolio_registry`

## In scope
- Keeping the canonical flow correct, blocking, and fail-closed.
- The ecosystem registry **seed truth** (statuses + reuse metadata) and its smoke.
- The canonical-flow **regression suite** and the read-only `/canonical-status` dashboard.
- Small, additive, test-protected fixes that directly serve the one objective.

## Out of scope (do NOT start without Lincoln)
- Provider / Cost work.
- Data Model planning or migrations.
- ChurchConnect repair, or any product-app build.
- New features, new dashboards, new app types / taxonomy expansion.
- Refreshing source-of-truth docs 02 / 03 inside a scope-fence or seed PR.
- Starting Codex build lanes.

## Rules for every agent
1. **One objective at a time** — work only from this fence and the board.
2. **Small PRs.** Change only the files the task names. No unrelated WIP in a PR.
3. **No new app types** — reuse existing allowed taxonomy values.
4. **No fake completed loops** — never fabricate build evidence.
5. Every build path stays **behind `problem_intake_gate` + `prior_work_check`**.
6. **Lincoln approves** merges to `main`, deploys, DB changes, and paid resources. Do not merge without authorization.
7. **No iCloud duplicate files** (no `"X 2"` files) committed — this repo syncs via iCloud; clean duplicates before committing.
8. If two agents diverge, the version that matches this fence wins; **neutralize** the other.
9. **Verify before reporting** (typecheck / build / smokes); report failures honestly.

## Done = soft launch
Soft launch is reached when, on `main`:
- `npm run typecheck` and `npm run build` pass,
- `npm run regression:canonical` and `npm run smoke:canonical-flow-regression` pass,
- `npm run smoke:build-gate` and `npm run smoke:codex-build-gate` pass,
- the ecosystem seed truth is in place and `npm run smoke:ecosystem-apps-seed` passes,
- `/canonical-status` renders read-only and shows the safeguards green,
- no unrelated WIP or duplicate files are on `main`.

Until Lincoln confirms soft launch, **do not expand scope.**
