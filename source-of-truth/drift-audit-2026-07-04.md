# Drift Audit — 2026-07-04

> Owner concern (Lincoln): parallel/duplicate surfaces built instead of extending what existed (the ONE-RULE violation). Ran a 6-lens read-only audit of the app. This is the durable record; secrets consolidation (finding #1) shipped in PR #300.
>
> **Update 2026-07-09 (finding #1 recurrence, fixed):** entry drifted again — the key VAULT form (`KNOWN_KEYS`: RENDER_API_KEY, SUPABASE_DB_URL, ANTHROPIC_API_KEY…) lived only on `/account` "Your keys" while `/integrations` claimed to be the one home. Fixed by embedding the SAME `EnvVault` component (same `/api/account/env` write path) at the top of `/integrations` with ecosystem apps as scope options; `/account` now shows the form only to non-owner customers (owner gets a link). Owner saves of engine-runtime keys (RENDER_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, CLOUDFLARE_API_TOKEN) also mirror into We Succeed's Vercel env via the PR #300 `setProjectEnvValue` funnel, so one entry powers both the vault and the engine. Rule going forward: a new key gets added to `KNOWN_KEYS` (vault) or `INTEGRATION_FIELDS`/registry (Vercel env) — never a new form.

All paths confirmed under `production-app/`. Here is the report.

---

# AppEngine Drift Audit — ONE-RULE Violation Report

**Verdict: The concern is well-founded. This is real, pervasive drift, not a few stray files.** Six independent domain audits found **15 confirmed instances of parallel-surface duplication**, concentrated in four domains: secrets/env, the app registry, intake, and deploy/build. In every case the pattern is identical — instead of *growing* the surface that already existed, a second (and sometimes third) copy was built beside it. The most damaging cases aren't just messy; they've already **diverged into wrong answers**: two hand-maintained app rosters disagree (16 vs 24 vs 15 apps), an auth-provider check reports "no auth" when email sign-in is live, and every intake/deploy record is now split across two stores. The good news: the *core* of two domains (auth identity, ops collection) is clean and correctly consolidated, so the fix is containment, not a rewrite. All paths below are under `production-app/`.

## Confirmed drift, ranked (most severe first)

| # | Sev | What exists (canonical) | What was built parallel | Consolidate to |
|---|-----|------------------------|-------------------------|----------------|
| 1 | 🔴 High | `/integrations` writes secrets straight to Vercel — `src/lib/engine/integrations-config.ts` (2026-06-27, original) | TWO more secret surfaces: `/account` "Your keys" → `src/lib/engine/env-vault.ts` (DB-encrypted, PR #232) **and** `/credentials` → `src/lib/engine/ecosystem-credential-registry.ts` (PR #274). All 3 read the same Vercel env-names API for the same We-Succeed project keys | ONE store (env-vault DB) + ONE Vercel client; `/credentials` stays as read-only map; redirect `/integrations` into the vault |
| 2 | 🔴 High | `app-portfolio-registry.ts` — the roster every API route + dashboard consumes (`IMPORTED_ECOSYSTEM_APPS`, 16 apps) | `source-of-truth/ecosystem-portfolio-registry.json` (24 apps), read by `portfolio-url-status.ts`. Both render on the same screen; they **already disagree** and use mismatched slugs (`ideas-idea-capture` vs `ideas`) | Fold JSON's `domain` block into the TS entry shape; retire the JSON; one roster |
| 3 | 🔴 High | Engine deploy pipeline → canonical `deployments` Postgres table (`execution.ts`, 2026-06-03) | Customer pipeline `runCustomerBuildJob()` (`customer-build.ts`, 2026-06-27) → brand-new `app_build_jobs` table (`build-jobs.ts`). Same job, never touches `deployments`; an app is visible in one store, invisible in the other | Record customer transitions as `deployments` rows; retire `app_build_jobs` |
| 4 | 🔴 High | `problem-intake-gate` — self-declared "official front door" (`problem-intake-gate.ts`) | Two more full front doors: `problem-intake-lite.ts` (self-marked **deprecated**, still live) and `opportunity-intake.ts`. Both now internally call the gate anyway | Retire lite (redirect `/problem-intake-lite` → `/problem-intake`); make opportunity a thin adapter |
| 5 | 🔴 High | Intake persists under kind `problem_intake_gate` (durable adapter) | `opportunity_intake` (second adapter kind) **and** lite writing raw JSON to `/tmp/appengine-problem-intake-lite/store.json` — outside the durable adapter, can't migrate to Neon | Collapse to the one gate store |
| 6 | 🔴 High | Canonical `ProblemIntakeForm` at `src/components/engine/problem-intake-form.tsx` | Second component, **same name**, at `src/components/problem-intake-lite/problem-intake-form.tsx` — same fields, same job | Delete the lite copy + page |
| 7 | 🟡 Med | `src/lib/auth/access.ts` provider-detection helpers (whoami uses them, **includes email**) | Re-implemented in 4 engine modules (`setup-profile.ts`, `production-auth-readiness.ts`, `execution.ts` ×2). **Divergence:** they never got the email/Resend update — report "no auth" when only email sign-in is live | Export env-parameterized `access.ts` helpers; delete the copies |
| 8 | 🟡 Med | Public cockpit home `ConversationalIntake` should route to the gate | Hardcodes `FRAME='problem'` → posts to `/api/problem-intake-lite`; nav's only Intake link points at the deprecated lite path | Repoint to the gate endpoint |
| 9 | 🟡 Med | `deployGeneratedAppToVercel()` in `vercel-deploy.ts` owns the bundle read + env-upsert | `readGeneratedBundle()` duplicated verbatim in `preview-auto-deploy.ts`; Vercel env-upsert copy-pasted into `ops-push-env.ts` + `integrations-config.ts` | Extract shared `readGeneratedBundle` + one `vercel-api` client |
| 10 | 🟡 Med | `OpsAttentionPanel` already emits per-app `needs_domain`/`not_reporting` | Separate `UrlStatusBoardPanel` restates the same "needs a domain" action from static JSON — can disagree with the live check | Fold URL facts into the ops attention queue |
| 11 | 🟢 Low | `app-portfolio-registry.ts` owns slug→name | `ecosystem-credential-registry.ts` re-hardcodes each app's slug+name (comment admits "must match by hand"); `appengine-core` vs `appengine` already mismatched | Reference the roster slug instead of re-typing |
| 12 | 🟢 Low | Per-route `canAccessEngine*` gates are the real access record | `production-auth-readiness.ts` hand-maintains a route list — lists 6 admin APIs when **35** exist; mislabels intake POST routes | Assert the gate invariant via a scan, not a hand list |
| 13 | 🟢 Low | The TS/JSON roster | Stale third copy `source-of-truth/ecosystem-portfolio-registry.md` (15 apps, "Generated 2026-06-27" by no script) | Delete or generate it from the canonical registry |

## Fix now vs. later

**Now (they produce wrong answers, or block Neon durable persistence):**
- **#7 auth-provider divergence** — smallest fix, real correctness bug. Owners with only email sign-in are told auth is absent.
- **#1 secrets consolidation** — three doors to the same room is the headline ONE-RULE violation; the vault is also the only store that feeds deploy-time.
- **#4/#5/#6/#8 intake collapse** — the *production* front door is the surface the code says to stop using, and lite's `/tmp` store can never reach Neon. Fixing the store unblocks durable persistence for all intake at once.
- **#2/#3 the two disagreeing rosters + two deploy stores** — every day of edits deepens the divergence.

**Later (pure DRY, no active bug):** #9 (extract shared Vercel/bundle helpers), #10 (fold the URL board), #11–#13 (registry re-declarations, hand-maintained route list, stale MD).

## Domains that were clean

Not everything drifted — worth stating plainly:
- **Auth core** — role/owner-email resolution (`roles.ts`), the four access gates (`access.ts`), session shaping, the single NextAuth instance, one `/signin`, one whoami. Only the *provider-detection helper* was copied (#7).
- **Ops collection** — exactly one snapshot collector (`ops-stats.getOpsSnapshot`) and one attention builder; `/api/admin/stats` is correctly the one dogfooded contract.
- **Deploy spine** — `deployGeneratedAppToVercel` and `promoteDeploymentToProduction` are genuinely shared; both pipelines reuse the promote path. The drift is the *stores and copied helpers* around that spine, not the spine.
- **Durable registry stores** — `app_portfolio_registry` and `app_owner_registered_apps` do distinct jobs and are correctly layered with a documented precedence rule. The legacy `app_projects`/`app_templates` tables are the separate generated-app model, explicitly demarcated.

**Bottom line:** ~4 high-severity consolidations (secrets, roster, deploy store, intake) address the bulk of the ONE-RULE violation and clear two active correctness bugs plus the Neon persistence blocker.