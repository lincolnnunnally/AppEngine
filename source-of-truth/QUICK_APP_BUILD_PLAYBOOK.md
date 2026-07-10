# QUICK APP BUILD PLAYBOOK — how we ship an app in hours

> **Who this is for:** a future Claude session about to build, port, or launch an ecosystem app.
> This is the PROVEN playbook distilled from the 2026-07-09/10 build wave (EasyPeazy, Kindred,
> Kids Need Dads, ChurchConnect Atlas→LPL, Stripe live wiring, 14 UUG subdomains, 10 CF zone
> stagings — all E2E-verified in production). Origin: Lincoln's directive 2026-07-10, verbatim:
> *"make sure when you are building, if there is a way to make a system of building that is
> faster and easier, take note of that and add that to our practices for quick app building.
> saving components as modules that will be helpful to have on the shelf."*
>
> Companions: `BUILD-LEDGER.md` (claim before building), `CURRENT_SCOPE.md`, the module-first
> owner directive (2026-07-09), and the memory files in the AppEngine project memory dir.
> The ONE RULE always applies: **read existing source and port it — never rebuild from scratch.**

---

## 1. THE SHELF

Everything below already exists and is verified. Check the shelf BEFORE writing anything new.

### 1a. The 50 factory modules (`production-app/src/lib/engine/modules/`)

Each is one file implementing the `AppModule` contract in `types.ts` (slug, name, tier,
`featureFlagEnv`, `files(ctx)`, optional `schemaSql`/`seedSql`/`envLines`/`navLinks`/`requiredEnv`),
registered in `registry.ts`, covered by `smoke:modules-registry` + `e2e:compose-selection`.
The generator composes foundation modules into every app; optional modules only when selected.
All were ported from real ecosystem source (ChurchConnect, Kindred-Connection, RebuildingDads,
JeepFix, Website-friends, ideas, Iconium, honestly, Association…) — the file header of each
module names its exact lineage.

**Foundation (1)**
- `identity-auth` — the gold-standard module: NextAuth with sanitized client session (no raw sessionToken), Resend magic-link email, DB-backed roles from `app_user_profiles` (admin is grantable), unique emails, per-error sign-in page.

**People, connection & community (9)**
- `directory-community` — people directory + profiles + search + data-quality score (ChurchConnect people.py).
- `connection-engine` — assess relational posture + mindset/heartset, match people (ChurchConnect purpose_matching).
- `needs-helper-matching` — asymmetric need↔helper matching: someone posts a need, helpers claim it.
- `public-invite-loop` — trusted-peer invitations (Kindred's invite system).
- `public-profile-og-sharing` — public profile pages + rich OG share previews.
- `multi-org-association` — manage many organizations under one association.
- `crm-follow-up` — track guests/members/leads through a pipeline with follow-ups.
- `ratings-reviews` — ratings, reviews, and reputation for makers/content.
- `membership-registry` — free membership program with a verifiable badge: statement-of-intent join flow, owner review queue, public member/verification pages, badge served only while membership is active (UUG SEAL lineage, 2026-07-10).

**Growth, care & formation (10)**
- `purpose-onboarding` — deep first-run capture of purpose, values, story.
- `becoming-growth-dashboard` — personal growth dashboard (reflection journal, goals).
- `growth-tracking` — per-user progress + streak layer: habits, goals.
- `achievements-gamification` — badges, points, streaks, leaderboard + the progress-toast celebration UI (see 1c).
- `mentorship-coaching` — 1:1 guidance sessions that end with ONE next step.
- `testimony-engine` — capture, store, surface, review real stories; close the loop.
- `relationship-repair` — guided forgiveness, reflection, letter drafting, two-person flows.
- `care-counseling` — care requests, helper matching with safety check-in.
- `mediated-communication` — AI-assisted neutral, conflict-reducing co-parenting messaging.
- `case-management` — case timelines, document center, court-ready summaries.

**Church & events ops (9)**
- `scripture-sermon-tools` — personal scripture/reference library + sermon outline templates.
- `discipleship-content` — reading plans, daily devotionals, daily motivation.
- `live-service-streaming` — plan/run a live service, attach the stream.
- `checkin` — secure check-in + staffing for events, kids, services.
- `events-scheduling` — events, RSVPs/registrations, facilities + facility booking.
- `event-curation-service-loop` — activities & events with RSVP + attendance loop.
- `volunteer-safety` — volunteer scheduling + background checks + waivers.
- `mutual-aid-benevolence` — community aid fund with hardship applications.
- `communication` — messaging pipes: broadcasts + queued notification pipeline.

**Commerce, money & business ops (8)**
- `payments-billing` — online giving, donations, recurring gifts (ChurchConnect stripe_payments + OnlineGiving; `FEATURE_GIVING`, needs STRIPE_SECRET_KEY).
- `marketplace-orders` — real marketplace layer over a product catalog: browse + order.
- `finance-accounting` — budgets, expense tracking, giving/financial reports.
- `supplier-order-automation` — forecast supply needs, compare vendor pricing, order.
- `business-formation-provisioning` — guide a customer from signup into domain/formation.
- `proof-approval-artifact` — generate + preserve an immutable customer approval artifact.
- `admin-ops-moderation` — owner/admin operations console (users, reports, quiet-account nudges).
- `analytics-hope-index` — reporting, engagement metrics, surveys, cross-app hope index.

**Creator, content & AI (6)**
- `content-publishing-scheduler` — plan, schedule, publish, repurpose content.
- `creator-analytics-coaching` — analyze content performance + algorithm signals, coach.
- `media-recording` — record video/audio in the browser, quick captures.
- `idea-capture-forge` — capture an idea as a note, forge it into shippable specs.
- `ai-assist` — AI services for content generation and suggestions.
- `knowledge-base` — community troubleshooting KB with categories.

**Brand, web & platform (6)**
- `brand-kit-generator` — brand prompt → logo concepts, SVG previews, kit.
- `branding-design` — in-app branding settings + simple design editing/templates.
- `design-studio` — upload design assets, arrange text + elements (Laser lineage).
- `website-builder` — site setup wizard + branded landing-page builder.
- `location-proximity` — shared privacy-hardened "what's near me" geo layer (wired from existing `src/lib/geo/`; owns no per-app table).
- `fleet-monitoring-agent` — register customer devices, collect readings + heartbeats (toner/printer lineage).

Also on the shelf but NOT in this registry: the 5 foundation modules in `foundation-modules.ts`
(product catalog, support, Resend email, Stripe payments, admin-stats) and the natively-running
factory pieces (intake, recommendation-navigator, `domains.ts`).

### 1b. The 3 proven DB-adapter patterns (Mongo/motor code → shared LPL Supabase Postgres)

All three keep ~100% of app route/service code untouched by reimplementing the Mongo API slice
the app actually uses. All switch on `SUPABASE_DB_URL` (unset = legacy backend → **that env var
is the rollback lever**), pool conservatively, and raise loudly on unsupported operators.
Doc `id` (str uuid) is the row key — no ObjectId.

| Pattern | Proven file | Driver | Storage | Pick when |
|---|---|---|---|---|
| **Relational async** | `Website-friends/backend/supabase_db.py` (EasyPeazy) | asyncpg, motor drop-in | real typed `ep_*` tables, explicit COLLECTIONS map, column types from information_schema | schema is already real relational tables; you want typed columns, DB constraints, atomic RPCs |
| **JSONB sync** | `ChurchConnect/ChurchConnect/backend/db_compat.py` | psycopg2 ThreadedConnectionPool, PyMongo drop-in | one `cc_<collection>(id, doc jsonb, created_at)` table per collection + GIN index, lazy ensure_table | big synchronous PyMongo app needs widest operator/aggregate coverage ($elemMatch, $lookup, bulk_write, TTL-sweeper, DuplicateKeyError parity) with zero schema modeling |
| **JSONB async** | `snip.show/backend/db_supabase.py` (the lineage template, ~378 lines) | asyncpg, motor drop-in | `snip_<collection>(id, doc jsonb)` + expression indexes | small async motor app needs a minimal schema-free bridge; this is the reference to copy |

Shared tricks worth reusing: equality via `@>` jsonb containment (type-correct, matches array
elements); comparisons via `doc->>'field'` with numeric cast (ISO-8601 dates sort lexically);
writes = `SELECT … FOR UPDATE` in a transaction, mutate in Python, write doc back by PK;
asyncpg params bound as text and cast in SQL (`($n::text)::uuid`) to sidestep codec issues;
Postgres UniqueViolation translated to Mongo DuplicateKeyError.

### 1c. Shared UI pieces

- **Progress-toast / celebration** — `NotificationContext.tsx` pattern (built 2026-07-09 to
  replace RebuildingDads' native `alert()` dialogs, which "look like a system error instead of
  progress"): non-blocking, auto-dismissing toasts with a celebratory variant for progress
  moments. Emitted by the achievements module as `src/lib/ui/progress-toast.tsx` and wired into
  streak check-in. Use it anywhere an app celebrates or confirms progress — never `alert()`.
- **Owner admin standard** — every app ships built-in admin for `lincoln@unitedundergod.org`;
  previews must work end-to-end before handoff.
- **Apps showcase** — `apps.unitedundergod.org` is registry-driven; new live apps get a roster
  entry (see pipeline step 6).

### 1d. Auth patterns (pick one, copy the proven file)

1. **GoTrue stateless token grant (backends on shared LPL Supabase).** Verify passwords via a
   stateless `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` with the ANON key (httpx/
   fetch). Copy Kindred `backend/core.py::gotrue_sign_in` or Laser
   `backend/app/routers/auth_router.py::_password_grant`.
   ⚠️ **SESSION-POISONING TRAP:** NEVER call `sb.auth.sign_in_with_password` (or js
   `signInWithPassword`) on the shared SERVICE-ROLE client — it silently stores the user session
   and every later PostgREST call runs as `authenticated` under RLS default-deny → 200s with
   EMPTY rows and no errors. Ecosystem audited clean 2026-07-09; keep it clean. Browser anon-key
   clients holding sessions are fine — that's their job.
   Companion: **shared-GoTrue admin-role pattern** — gate admin via a per-app
   `{prefix}_admin_users` table (RLS: authenticated SELECT own row only, NO write policies →
   service-role-only writes). NEVER client-editable `user_metadata.role` (GoTrue allows the
   self-grant write; the table gate 403s it). Copy RebuildingDads `knd-admin-*` v2 functions.
   Shared-auth adoption: "email already registered" on shared GoTrue is NORMAL (sibling app's
   user) — adopt the identity if the password verifies; never reset the shared password.
2. **NextAuth `identity-auth` module (factory-generated Next.js apps).** Compose it — don't
   hand-write auth. It fixes the four audited gaps of the old frozen template (sanitized client
   session, magic-link email, DB-backed grantable roles, unique emails). Per-app login failures
   in generated apps are usually AUTH_URL/callback config, not code.
3. **Custom JWT + bcrypt (maximum portability).** ChurchConnect's Mongo-era custom JWT
   (`/api/auth/signup` + `/signin`) survived the Atlas→LPL port unchanged, and bcrypt hashes
   port **byte-identical** across databases (proven: seeded `$2b$12$` hashes logged in on LPL).
   EasyPeazy does the same with own bcrypt in `ep_users`. Pick this when the app must not
   depend on GoTrue at all.

---

## 2. THE STANDARD PIPELINE — new-app / port checklist

Work the steps in order; each has been executed multiple times. Claim the item on
`BUILD-LEDGER.md` first (pull → claim-commit → work).

**Step 0 — Source.** Find the real existing source (ONE RULE). Check the module shelf (1a),
the sibling apps' proven files (1b/1d), and the memory index before writing anything.

**Step 1 — Repo.** Work on a branch (or worktree — see Velocity). If porting a dead-backend app
(Bolt/Emergent), remember: Emergent apps are prototypes with ZERO customers/data (settled
2026-07-09) — fresh port, no data migration, repoint DNS freely.

**Step 2 — LPL Supabase schema (additive, prefixed, RLS on).** All of Lincoln's apps share the
LPL Supabase (`uqhqulrqcygsmmzdzemx`); Neon is only for the factory itself + customer-generated
apps.
- **List tables FIRST** — unprefixed `user_profiles`/`messages`/`conversations` etc. already
  exist (other apps'). Prefix everything: `ep_`, `cc_`, `kindred_`, `knd_`, `cf_`…
- RLS enabled on every table, default-deny; record migrations (e.g. `20260709000000`).
- **NO triggers on `auth.users`** — shared GoTrue fires them for every app. Create profile rows
  lazily in the app's auth context instead. `mailer_autoconfirm=false` on LPL → signup shows a
  "Check Your Email" screen; design for it.
- DDL path that works: Supabase Management API `POST /v1/projects/{ref}/database/query` with the
  CLI keychain token (`security find-generic-password -s "Supabase CLI" -w`, strip the
  `go-keyring-base64:` prefix, `base64 -d`). Use **curl** — Cloudflare blocks python-urllib UA.
- After DDL: `NOTIFY pgrst, 'reload schema'` (PostgREST caches the schema).
- Porting a migration pile: reuse the schema auto-extractor pattern
  (RebuildingDads `extract_schema.mjs` — extracts + prefix-renames from a repo's migrations) and
  the drift-scanner (`scan_columns.py` pattern — AST-scan all db call sites + pydantic dump
  surfaces, diff vs information_schema). Codemods must also catch PostgREST *embedded* joins in
  `.select()` strings (`achievement:knd_achievements(*)`) and string-array table lists, not just
  `.from()`/`.rpc()`.
- Connection strings: use the **session pooler** DSN (`aws-1-us-east-2.pooler.supabase.com`) —
  the direct host is IPv6-only and Render can't reach it. Transaction pooler (port 6543) is the
  escape hatch under connection pressure.

**Step 3 — Free-tier deploy.**
- **Render (backends):** create the service via API on the FREE plan from a repo branch with
  `rootDir` (Docker or native). Env upsert = `PUT /v1/services/{id}/env-vars/{KEY}`, then
  `POST /deploys` — an env change alone does NOT redeploy. Free tier = cold starts; design
  health checks accordingly (`/api/health`).
- **Vercel (frontends):** git-link the project to the repo branch with the right rootDir. CRA
  gotchas: set `CI=false` (eslint warnings fail the build) and `.npmrc` `legacy-peer-deps`;
  `REACT_APP_*` vars are BAKED at build time — env change needs a rebuild, and stale bundles are
  a classic "login broken" cause.
- **Secrets flow from the vault** (`app_user_env_vars` on factory Neon, encrypted with
  `sha256(APP_ENGINE_VAULT_KEY || AUTH_SECRET)` where the effective key is the PROD Vercel
  AUTH_SECRET — local scripts can neither decrypt nor re-encrypt rows; see gotcha #17). Working
  copies of RENDER_API_KEY / CLOUDFLARE_API_TOKEN / ANTHROPIC_API_KEY / STRIPE_SECRET_KEY live
  in the vault; per-service working DSNs/secrets live on each Render service env. Key entry UI =
  `/integrations` (extend `KNOWN_KEYS`/`INTEGRATION_FIELDS`, never a new form).
- **Stripe:** backends expect env name `STRIPE_API_KEY` (not STRIPE_SECRET_KEY). The live key is
  a 107-char `rk_live_` RESTRICTED key — `/v1/account` denied is NORMAL. Create a FRESH webhook
  endpoint per app and capture `.secret` from the creation response (existing endpoints'
  secrets are unreadable). Never touch the UUG WordPress webhook `we_1PuIwCDBmXajoC5V…`.

**Step 4 — Domain mint.**
- Subdomain: CF add-only adapter (`src/lib/engine/cloudflare-dns.ts`) mints
  `<slug>.unitedundergod.org` → CNAME `cname.vercel-dns.com`, **DNS-only/grey-cloud**;
  auto-runs on `promoteDeploymentToProduction`. Manual mints follow the same shape. The adapter
  is add-only by construction (no update/delete verbs, backs off existing names, refuses infra
  labels) — that's what makes DNS ops safe to run fast.
- Attach the domain to the Vercel project, then **check `GET /v8/certs?domain=` FIRST** — if
  empty, force-issue with `POST /v8/certs {"cns":[apex,"www.…"]}` (succeeds instantly). Certs
  may NEVER auto-issue when the domain was attached before DNS pointed at Vercel (gotcha #1).
- Apex/custom domains: stage the CF zone via API with full record parity BEFORE asking for the
  NS swap; remove any DNSSEC DS record first; new zones get the **aida/donald** NS pair
  (chance/melinda refuse them). NS swap itself is owner-gated (registrar login).
- Verify HTTPS 200 with the right title before calling it live.

**Step 5 — E2E proof (throwaway accounts, browser-level for user-facing).**
- Pattern: `claude-verify-YYYYMMDD@unitedundergod.org` (+`-b-`, `-c-` variants). Prove the REAL
  flow: signup → login → core loop → payment/checkout (a `cs_live_` URL is proof enough — never
  complete a charge) → data row confirmed by direct SQL.
- **Browser-level, not just curl, for anything user-facing:** curl can't catch CORS preflight
  failures — e.g. `supabase.functions.invoke()` sends `x-application-name`, which must be in the
  edge function's `Access-Control-Allow-Headers`.
- Negative tests are part of the proof: wrong password → 401, unauth → 401 fail-closed, anon
  sees no rows (RLS), self-granted `user_metadata.role='admin'` → 403.
- Clean up: ban/delete throwaway accounts and test rows, or record them as deletable in the
  ledger/memory.

**Step 6 — Record it.**
- Showcase roster: move the app coming-soon → live with its URL (registry-driven apps page).
- `BUILD-LEDGER.md`: move the claim to ✅ DONE with commits/PR + rollback recipe.
- Memory: write the gotchas you hit. If you built something reusable, register it as a module
  (section 4) — that's the owner directive, not optional.

---

## 3. THE GOTCHA LIST — landmines already hit once (one line + fix)

**DNS / TLS / Vercel**
1. Vercel cert may NEVER auto-issue when a domain was attached before its DNS pointed at Vercel (verified:true, misconfigured:false, but TLS hangs) → check `/v8/certs?domain=` first; if empty, `POST /v8/certs {cns:[apex,www]}`.
2. New CF zones get the **aida/donald** NS pair; the older chance/melinda pair REFUSES them → owner swap lists must name the pair per zone.
3. A stale DNSSEC **DS record must be deleted BEFORE any NS swap** or the domain blacks out (we-succeed.org DS 46726/13/2 was the live example).
4. Projects with `autoAssignCustomDomains:false` serve domains via per-deployment **alias pinning** — any push/auto-build re-takes the alias with whatever it built (childfirst trap) → land env-needing wiring first; keep the rollback `dpl_` id.
5. Next 16 uses **`proxy.ts`, not `middleware.ts`** — middleware silently never runs under the old filename.
6. `AUTH_URL` pins factory sign-in to one canonical host → never serve the factory directly on a second host; 308-alias extra domains instead.
7. CF DNS work on shared zones must be ADD-ONLY; verify pre-existing records (WP A, MX, SPF, DKIM) field-by-field after — the zone hosts live WordPress + email.
8. Cloudflare blocks python-urllib's UA → use curl for CF/Supabase management APIs.

**Shared LPL Supabase / GoTrue**
9. **Session poisoning:** `sign_in_with_password` on the shared service-role client downgrades every later call to `authenticated` → RLS-empty 200s; use the stateless token grant (section 1d). Audit done 2026-07-09 — don't re-audit, just don't reintroduce.
10. No triggers on `auth.users` (fires for every app on shared GoTrue) → lazy profile creation in app code.
11. "Email already registered" on shared GoTrue = sibling app's user → adopt identity if password verifies; NEVER reset the shared password.
12. Unprefixed table names are taken → list tables first, prefix everything.
13. PostgREST caches schema → `NOTIFY pgrst, 'reload schema'` after DDL.
14. Direct DB host is IPv6-only (Render unreachable) → session-pooler DSN; transaction pooler :6543 if connections run hot.
15. LPL DB password rotated 2026-07-09 → any DSN from before then is dead.
16. supabase-py 2.28.0 conflicts with websockets 16 → pin `websockets>=13,<16`.
17. Edge-function secrets are PROJECT-GLOBAL on shared LPL → suffix per app (`STRIPE_WEBHOOK_SECRET_KND`).
18. `supabase.functions.invoke()` sends `x-application-name` → must be in the function's `Access-Control-Allow-Headers` or browsers fail preflight (curl can't catch it — browser-test).
19. Admin gating: never `user_metadata.role` (client-writable) → per-app `{prefix}_admin_users` table, service-role-only writes.

**Stripe / payments**
20. Deno edge webhooks: sync `constructEvent` THROWS → `constructEventAsync` + `Stripe.createSubtleCryptoProvider()`; `verify_jwt` OFF on the webhook function (the signature is the auth).
21. Existing webhook endpoints' signing secrets are unreadable via API → always create a fresh endpoint per app and capture `.secret` from the creation response.
22. Owner key-paste failure modes: Stripe docs dummy, then the dashboard key-object ID (`mk_…` row id, not the secret) → vault warns at save; verify by making a real API call.
23. Restricted `rk_live_` key: `/v1/account` denied is normal — checkout.sessions/webhook_endpoints/products all work.
24. Backends' env name is `STRIPE_API_KEY`, not STRIPE_SECRET_KEY.
25. Stripe Checkout header shows the ACCOUNT-level public business name (shared across apps) → owner branding call, don't change unilaterally.

**Vault / env / deploy plumbing**
26. Vault rows encrypt with PROD AUTH_SECRET (sensitive/write-only on Vercel) → local scripts can't decrypt or re-encrypt; fix rows via the proven temp one-shot prod endpoint + rollback pattern; back up `value_encrypted` first.
27. The Vercel-env RENDER_API_KEY is a stale 401 blob → the VAULT copy is the live key. Local `.env.local` VERCEL_TOKEN has been flaky/expired → verify before relying.
28. Render env change alone does NOT redeploy → `PUT …/env-vars/{KEY}` then `POST /deploys`.
29. CRA on Vercel: `CI=false` + `.npmrc legacy-peer-deps`; `REACT_APP_*` is baked at build → stale-bundle backend URLs are a classic phantom login bug (ChurchConnect #13–#16). Same family: Render `FRONTEND_URL=http://localhost:5173` made email links point at localhost.
30. A vault row can be the literal copy-paste template (`[YOUR-PASSWORD]`) → validate values before wiring them into a deploy.

**Factory / modules / codegen**
31. Base-vs-module file collisions: the base generator used to silently overwrite module pages → generic module-wins filter in `buildGeneratedFiles` + `intendedBaseOverrides` allowlist in the smoke; keep new base files out of module paths.
32. `@neondatabase/serverless` has NO dynamic-identifier `sql(col)` → `sql.query(text, params)` with whitelisted identifiers.
33. Workflow/agent-ported code sometimes arrives HTML-entity-escaped (`<` → `&lt;`) → unescape, compile, faithfulness-check before registering.
34. Module composition is NEW-APPS-ONLY → existing external apps get the wire-to-our-resources pattern, not composition.
35. Selection is over-inclusive (no score cap — a church app composed 33 modules) → trim the selected set deliberately until the threshold gap is fixed.

**Porting / repos / environment**
36. Mongo-app ports: dual-backend id filter for `ObjectId(_id)` lookups; TTL indexes need the sweeper-thread emulation; `$expr` filters evaluate Python-side.
37. Codemods must catch PostgREST embedded joins inside `.select()` strings and string-array table lists — not just `.from()`/`.rpc()` calls.
38. ~/Documents is iCloud-synced: "X 2" duplicate folders + git races → trust origin/main, prefer worktrees outside Documents for parallel work.
39. Nicely-named repos can be the WRONG source (Snip.Show vs `emergent`; TotalTonerManagement main was an unrelated codebase) → confirm canonicity before building.
40. Owner dashboards show superseded ERROR/CANCELED deploy attempts → always verify CURRENT state and say so when reporting ("those red rows are superseded builds").
41. Emergent apps = prototypes with zero customers/data (settled) → fresh ports, never ask about exports.
42. In-app preview dialogs (`alert()`) carry the host-app icon — a Venmo test alert looked like an Anthropic popup → use progress-toast, never alert().
43. bcrypt hashes port byte-identical across DB backends → never force password resets during a DB port; prove one seeded login instead.

---

## 4. MODULE-FIRST RULES (owner directive 2026-07-09)

Lincoln, verbatim: *"if you have to build something make sure you create a module for it so we
can use it in another build. especially for the toner apps. we have several to build... and
several connection related apps."*

- **Compose** when a registry module already covers the need and the app is factory-generated
  (Next/Neon): select it, done. Ask "does a registry module already cover this?" FIRST.
- **Port** when the app is an existing external stack (FastAPI/CRA/Vite…): copy the proven
  sibling file (adapters 1b, auth 1d, admin functions, UI pieces) and adapt names/prefixes.
  Composition never retrofits existing apps.
- **Build-and-register** when nothing covers it and it's plausibly reusable (default YES for
  toner/printer-fleet and connection/matching domains): build it for the app AND extract the
  module. Modules emit Next+Neon code; for non-Next apps still factor logic + schema so a module
  version exists.

**How to register:** one file in `src/lib/engine/modules/` implementing the `AppModule` contract
(`types.ts`): slug, name, `tier: "optional"`, `featureFlagEnv: "FEATURE_X"`, `files(ctx)` emitting
real code (functional/isolated/usable/composable/verified), optional
`schemaSql/seedSql/envLines/navLinks/requiredEnv`. Import + add it in `registry.ts`. Header
comment names the exact source lineage. Then run `npm run smoke:modules-registry` (structure, no
table/path collisions) and `npm run e2e:compose-selection` (composed-app tsc) — both must stay
green. Standard verified end-to-end: 48 modules, 141+ tables, zero collisions.

---

## 5. VELOCITY NOTES — what measurably made this week fast

1. **Verified backup before risky ops = confidence to move fast.** The Atlas cutover ran same-day
   because a verified mongodump existed and `MONGO_URL` stayed in place; the vault fix pattern
   backs up `value_encrypted` first. Engineering replaces approval — backup, reversible lever,
   then GO.
2. **Pure-env rollback levers.** Design the switch as one env var (`SUPABASE_DB_URL` set/unset =
   PG shim vs legacy Mongo). Rollback = delete a var + redeploy; no code revert.
3. **Reuse sibling apps' proven files.** The fastest builds copied, not wrote: snip.show JSONB
   adapter → ChurchConnect shim; Kindred `gotrue_sign_in` / Laser `_password_grant`;
   `knd-admin-*` v2; `extract_schema.mjs`; `scan_columns.py`. Keep naming this lineage in file
   headers so the chain stays findable.
4. **Worktrees for parallel agents.** Multiple agents share these repos — a worktree off
   origin/main (outside iCloud paths) avoids branch collisions; rebase+retry on push conflicts;
   claim on the BUILD-LEDGER first.
5. **Background watchers for slow external state.** NS swaps, zone activations, deploy builds:
   start a background poller and keep building — don't foreground-wait on DNS.
6. **Force the cert, don't wait.** `/v8/certs` check + force-issue turned "TLS pending, hours" into
   seconds. Generalize: when a platform "should eventually" converge, look for the API verb that
   forces it now.
7. **Fan-out workflows with pinned source paths.** The 14-subdomain rollout ran 8 agents with
   zero failures; module batch-porting hit ~85% first-pass yield once exact source paths were
   pinned (unpinned big-repo tasks stalled). Always verify ported output (compile + faithfulness)
   before registering.
8. **Add-only-by-construction adapters.** The CF DNS adapter can't delete or update — so DNS
   automation needs no human review to be safe. Build destructive-verb-free adapters for any
   shared infrastructure.
9. **Throwaway verify accounts + negative tests as a standard kit.** `claude-verify-YYYYMMDD@…`,
   prove the real flow at browser level, prove the 401s/RLS-empties, clean up. An unpaid
   `cs_live_` checkout URL is full payment proof with zero money moved.
10. **List-first, add-only, prefix-always** on shared resources (tables, DNS records, Stripe
    webhooks, env vars) — collisions are the #1 source of silent cross-app breakage, and
    prefixes make every app's footprint greppable and reversible.
