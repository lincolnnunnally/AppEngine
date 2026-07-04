# App Ops Reporting Standard

AppEngine helps Lincoln RUN THE BUSINESS of his apps, not just build them. Every
managed app shows, on the owner dashboard, how it is DOING — users, open support
tickets, recent orders, revenue, and an activity trend — or an honest "Not
reporting yet."

## The contract every generated app carries

Every generated app ships `GET /api/admin/stats` (a foundation module):

- Gated by a bearer token compared against the app's `APP_ENGINE_STATS_TOKEN`
  env var (timing-safe). No token configured → the endpoint stays closed (401).
- Returns `{ ok, reporting, users, ticketsOpen, ordersRecent,
  revenueCentsRecent, revenueCurrency, activity, generatedAt }`, counted from
  the app's OWN tables (`users`, `support_tickets`, `payments`).
- Deep-dive fields (added 2026-07-04, additive — apps that omit them still
  report the original three):
  - `revenueCentsRecent` — SUM of paid payments over the last 30 days, in minor
    units (cents, `bigint` — must not overflow int4 and 500 the endpoint).
    Always paired with `revenueCurrency` (ISO code, e.g. `"usd"`); a sum
    without its currency, or a negative sum, is rejected by the collector.
    Currency-safe by construction: the `payments` table carries a `currency`
    column (from Stripe's `session.currency`), and the query reports a sum ONLY
    when the window holds a single currency — a mixed-currency table reports
    `null` (not a merged figure). The dashboard totals per currency and never
    converts. (AppEngine itself reports `null` revenue: its money is a credit
    ledger, not a `payments` table.)
  - `activity` — `[{ date: "YYYY-MM-DD", count }]`, customer events per day
    (payments + support tickets for generated apps) over the trailing 14
    whole calendar days. Three states are distinct and must stay distinct:
    the field **absent** = not reported; **`[]`** = measured, zero events;
    a populated array = the trend. Producers omit zero-event days; the
    dashboard densifies the gaps so quiet days show as measured zeros.
- Numbers only: counts and aggregate sums. No names, no emails, no line items,
  no per-user data — ever. Revenue crosses the app boundary ONLY as a total.
- The collector caps each polled response body (64KB) before parsing, so a
  compromised or hostile target can't OOM the ops function with a huge payload.

## The token

- Generated per app (random, 24 bytes) in `runCustomerBuildJob` at deploy time,
  injected into the app's Vercel env as `APP_ENGINE_STATS_TOKEN` (encrypted),
  and stored on the build job row (`app_build_jobs.stats_token`).
- Never written to git, never sent to the browser, never shown in the registry.

## The collector (`src/lib/engine/ops-stats.ts`)

- Assembles targets: AppEngine itself (read in-process — the factory's "orders"
  are builds started in the last 30 days, its activity trend counts builds per
  day, and its revenue reads the platform's own `payments` table — honestly
  null until billing rows exist), owner-registered live apps,
  engine-deployed builds, and optional env-configured extras in
  `APP_ENGINE_OPS_TARGETS` (JSON: `[{ slug, name, url, token }]`) so any app
  that adopts the endpoint can report without a code change.
- Polls each app's `/api/admin/stats` with its token (6s timeout, best-effort),
  caches readings in a self-creating `app_ops_stats_cache` table (in-memory
  without a DB), and re-polls on read once a reading is older than 10 minutes —
  no cron, free tier only.
- An app that can't be reached keeps its last good reading, labeled as such.
  An app with no token/endpoint is reported "Not reporting yet" — never a fake
  number, never a silent blank.
- The deep-dive fields obey the same honesty rule per metric: an app reporting
  the original three but not revenue/activity shows "Not reported" for exactly
  those — a null is never rendered as zero, and cache rows written before the
  fields shipped read back as null, not 0.

## The attention queue (what needs Lincoln)

Alongside stats, the collector runs attention checks per app and rolls every
finding into one sorted queue on the owner dashboard — act-on-this first, each
item a plain directed action, never a bare fact:

- **Reachability** — does the live URL answer (2xx/3xx)? Down → action needed.
- **Missing env NAMES** — for engine-deployed apps (or any target that declares
  `vercelProject`), the Vercel API lists which env var NAMES are set — values
  are never read. Missing core vars (`DATABASE_URL`, `AUTH_SECRET`,
  `APP_ENGINE_OWNER_EMAIL`, `APP_ENGINE_STATS_TOKEN`) → action needed; missing
  money/mail keys (`STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `SENDER_EMAIL`) →
  watch ("not connected yet").
- **Needs a domain** — live URL still on `*.vercel.app` → watch.
- **Not reporting** — live but no ops stats → watch, with the exact wiring step.

Findings are cached with the stats readings (`needs` column, self-applying) and
refresh on the same 10-minute read cycle. `APP_ENGINE_OPS_TARGETS` entries may
carry `vercelProject` to opt external apps into the env audit.

## The owner view

- `GET /api/engine/ops/stats` (owner/admin only; `POST` forces a fresh poll)
  serves the snapshot to the owner dashboard.
- Every portfolio card carries an Ops strip: real counts (plus revenue when
  reported) for reporting apps, "Not reporting yet" for live apps that don't
  report, "Not live yet" for the rest.
- An expanded card shows the deep-dive ("How it's doing"): users, revenue as
  money, open tickets, orders, and a per-day activity trend — each metric
  individually honest ("Not reported" when absent).
- A rollup strip ("Across your apps") totals users, revenue per currency
  (never converted or merged across currencies), and 14-day events across
  reporting apps — with coverage stated plainly ("from N of M apps reporting"),
  so a partial total can't masquerade as the whole business.
- AppEngine practices the standard it ships: it exposes the same token-gated
  `/api/admin/stats` for its own counts.

## Guardrails

- Free tier only; no new paid resources.
- Secrets live in env vars and the build-jobs table, never in git.
- Counts and aggregate revenue sums only — no private user data, per-user
  detail, or payment line items cross app boundaries.
- Smoke: `npm run smoke:ops-stats` (wiring), `npm run smoke:owner-portfolio-dashboard`
  (dashboard strings).
