# Billing plan — charging for app builds (DRAFT for Lincoln's decision)

> Status: **plan only.** No billing code is built yet, and charging stays **off** until
> Lincoln sets pricing + the payment account and explicitly says go. Claude builds the
> integration; Lincoln owns the Stripe account, the bank link, and the prices.

## 1. The cost reality (why we charge)
- The **intake is free** (deterministic, no model calls) — keep it that way; it captures interest.
- The **cost is the build step**: a build fans out **one model call per task in the graph** (currently
  OpenAI, `OPENAI_MODEL`, ~900 output tokens each). Run many builds and it adds up.
- **Real signal:** Lincoln burned **~$40 in a couple days of testing**. After ~**June 18** testing
  stopped, so spend stopped — most likely just "stopped running builds" (builds are owner-gated, so
  no public traffic triggers them), not a code change. Worth a quick confirm that a build still calls
  OpenAI before relying on metering.
- **We still don't know the precise per-build cost.** Pricing should be set from *measured* cost, not
  a guess — which is why metering (now built, below) comes before any price.

## 2. Build it in this order
1. **Meter token usage** (no charging). ✅ **Built** — every model call records provider/model/token
   counts + estimated cost (`src/lib/engine/llm-usage.ts`), and a **per-run guard** caps how many paid
   calls one build makes (degrades to free deterministic output past the cap), so a single build can't
   run away. *Caveat:* durable cross-build **totals** + a daily cap accumulate only when the **database
   is enabled** (the Neon/durable-persistence switch — an owner action); without it, records are
   best-effort/local. Set the real `$/1k token` rates via env once measured.
2. **Set pricing** from those numbers (cover cost + hosting + ~30% margin). *Lincoln's decision.*
3. **Paywall gate** — ✅ **Built (dormant).** Model chosen (Lincoln, the OpenAI model): **prepaid credits,
   each build deducts its REAL measured cost × margin** (`APP_ENGINE_BILLING_MARGIN`, default 1.30 =
   cost + 30%). A build always runs to completion — it's only blocked from *starting* if the balance is
   below a small floor (`canAffordBuild`); the real cost is deducted after via `chargeForBuild(userKey,
   buildRef, actualCostCents)`. `grantFreeStarterIfNew` is the freemium hook. *Remaining:* wire the
   charge into the customer-build trigger (sum the build's metering → pass as actualCostCents).
4. **Stripe integration** — ✅ **Built (dormant).** `/api/billing/checkout` (buy a credit pack) +
   `/api/billing/webhook` (signature-verified, idempotent per Stripe event → tops up balance) + a
   credits panel + buy buttons on `/account`. No SDK (REST + HMAC). Wallet on Postgres in integer
   cents; ledger UNIQUE(reference) makes every credit/charge idempotent. Schema: `db/billing-schema.sql`.
5. **Turn it on** — Lincoln: (a) enter Stripe **test** keys in Integrations, (b) point a Stripe webhook
   at `/api/billing/webhook`, (c) set `APP_ENGINE_BILLING_ENABLED=true`, (d) run a test purchase →
   confirm balance tops up → then switch to live keys. Charging is OFF until all of this is done.

## 3. Pricing models to choose from (Lincoln picks one)
| Model | How it works | Best when |
|---|---|---|
| **Credits / pay-per-build** *(recommended)* | Buy a credit pack; each build (and maybe each big revision) spends credits priced above its token cost | Usage is spiky, cost varies by build — credits track cost honestly |
| **Subscription** | Monthly plan, N builds/revisions included, overage billed | Predictable revenue; users who build often |
| **Freemium** | First app free (the hook), then credits/subscription | Maximize signups → convert after they see value |

**Recommendation:** **freemium + credits** — one free starter app to prove the value (the locked
"first version is a real, live starter" promise), then credits for further builds/revisions. Covers
cost per build and removes the "unlimited free = unbounded OpenAI bill" risk.

## 4. Where the paywall sits
- **Free:** sign in, the whole conversation/intake, see the plan for their app.
- **Paid (the gate):** the actual **build + deploy** (the OpenAI-spending step) and large revisions.
- This keeps the funnel open (anyone can describe their idea) while protecting the cost center.

## 5. Margin / safety
- Price each build at **measured token cost + ~30% margin** (Lincoln's target) to cover OpenAI + hosting + a little profit.
  *Note:* validate that 30% also absorbs failed/retried builds and support overhead — if not, nudge it up.
- **Per-run spend guard** is built (caps calls per build). **Per-user / daily $ caps** + alerting come with the
  durable DB + the paywall.
- Keep generated apps on free-tier hosting by default (already the scope rule) so hosting cost stays low.

## 6. Who does what
- **Claude builds:** metering, the credit/paywall gate, the Stripe integration + billing UI, usage dashboard.
- **Lincoln owns (Claude cannot/will not do):** create the **Stripe account**, link the **bank**, enter any
  financial details, set the **prices**, and flip charging **live**. (Per safety rules: no financial account
  setup, no payment-detail entry, no executing charges.)

## 7. Interaction with the current state
- The auto-build is **still owner-gated**, so there's **no cost exposure from public users today** — we have
  time to build billing *before* opening auto-build to customers. The order is: sign-in (done) → metering →
  pricing decision → paywall + Stripe → open auto-build to paying customers.

## Open decisions for Lincoln
1. Pricing model (recommend freemium + credits).
2. Free allowance (recommend: 1 free starter app).
3. Rough target margin / price ceiling (we'll size it against measured cost).
4. Go-ahead to build **metering first** (free, no charging) so we can price from real numbers.
