# Billing plan — charging for app builds (DRAFT for Lincoln's decision)

> Status: **plan only.** No billing code is built yet, and charging stays **off** until
> Lincoln sets pricing + the payment account and explicitly says go. Claude builds the
> integration; Lincoln owns the Stripe account, the bank link, and the prices.

## 1. The cost reality (why we charge)
- The **intake is free** (deterministic, no model calls) — keep it that way; it captures interest.
- The **cost is the build step**: each real app build is many large LLM calls (currently OpenAI,
  `OPENAI_MODEL`). That's the thing to cover.
- **We don't actually know the per-build cost yet.** Pricing should be set from *measured* cost,
  not a guess. So **step 1 is metering** (below), not picking a price.

## 2. Build it in this order
1. **Meter token usage** (no charging). Record tokens + $ cost per build, per user. Run a handful
   of real builds → learn the true cost-per-build distribution (likely a range, e.g. small vs large app).
2. **Set pricing** from those numbers (cover cost + hosting + margin). *Lincoln's decision.*
3. **Add the paywall gate** at the build step — a build only runs if the user has credit / an active
   plan. Intake stays free. Fail-closed (no credit → no build, friendly message).
4. **Stripe integration** — checkout + customer portal + webhook to grant credit/plan. Test mode first.
5. **Turn it on** — Lincoln flips it live after a test purchase end-to-end.

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
- Price each build at **measured token cost × markup** (e.g. 3–5×) to cover OpenAI + hosting + support + margin.
- **Per-user spend cap** + alerting so a runaway build can't exceed bought credit.
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
