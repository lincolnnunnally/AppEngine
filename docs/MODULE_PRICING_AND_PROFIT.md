# Module composition — pricing & profit

**Status:** executable estimate in `src/lib/engine/pricing/`  
**API:** `GET/POST /api/pricing/estimate`  
**Smoke:** `node scripts/smoke-pricing-estimate.js`  
**Module quality gate:** `node scripts/smoke-modules-registry.js` (52 modules, schema OK)

---

## Customer prices (what they pay)

| Item | Price |
|------|------:|
| **Core private app/tool** (one primary job, private URL) | **$25** |
| **Each catalog feature / module add-on** | **$10** (some heavier = $20) |
| **Custom work** (beyond catalog) | **+$25**, floor **$50** total |

Conversation / clarify is free. Pay is for the composed build.

---

## Cost to *us* (internal — not shown as tokens to customers)

Composition uses **pre-written module emitters**. We do **not** rebuild each module with an agent for every customer.

| Component | Expected cost | p90 cost | Why |
|-----------|--------------:|---------:|-----|
| Base shell compose + deploy + intake chat | **$0.40** | **$2.00** | Deterministic generator + short model chat |
| Each optional module emit + migrate | **$0.15** | **$0.75** | Select slug → write files (already authored) |
| Custom generation (if any) | **$3.00** | **$12.00** | Bounded AI only |

**Formula**

```
expectedCost = $0.40 + ($0.15 × N modules) + custom?
p90Cost      = $2.00 + ($0.75 × N modules) + custom?
price        = $25 + sum(feature prices) [+ custom rules]
profit       = price − cost
margin       = profit / price
```

Target: **p90 margin ≥ 70%** and **p90 profit ≥ $15**.

---

## Profit examples (calculated)

| Package | Customer pays | p90 cost (us) | p90 profit | p90 margin |
|---------|--------------:|--------------:|-----------:|-----------:|
| Core only | $25 | ~$2 | ~$23 | ~92% |
| Core + CRM | $35 | ~$2.75 | ~$32 | ~92% |
| Core + CRM + notify | $45 | ~$3.50 | ~$41 | ~92% |
| Local service (CRM + public + payments $20) | $65 | ~$4.25 | ~$61 | ~93% |
| Back office (finance + CRM) | $45 | ~$3.50 | ~$41 | ~92% |
| Core + custom | $50 floor | ~$14 | ~$36 | ~72% |

**Bottom line:** On the **module path**, **$25 core** and **$10/feature** are highly profitable.  
Margin only gets thin if we allow **uncapped custom agent coding** — so custom is surcharged and floored.

---

## Modules readiness

- **52 installable modules** registered and smoke-tested (emit files, schema FK consistency).  
- Sellable checklist only lists features whose module slugs are **build-ready**.  
- Re-run: `node scripts/smoke-modules-registry.js` after module edits.

We do **not** need different broken versions of every module for v1. We need:

1. **Shells** (core private tool)  
2. **Optional modules** toggled by checklist  
3. **Archetypes** (default packs for common roles)

If a module fails smoke, it is **not sellable** until fixed — not sold as “version B.”

---

## Archetypes (not infinite apps)

Most businesses share one operating system: **who we serve, what we promised, money, follow-up**.  
Specialization = labels + which modules are on.

Examples (defaults, customer can still toggle):

| Archetype | Starts with | From $ |
|-----------|-------------|-------:|
| Personal tracker | core | $25 |
| Local service | core + CRM | $35 |
| Sales pipeline | core + CRM + notify | $45 |
| Back office lite | core + finance + CRM | $45 |
| Storefront | core + orders + public page | $45 |

Chat **suggests** an archetype + features; human **confirms** checklist; price is calculated.

---

## Custom creations

Allowed, but billed correctly:

1. Prefer catalog features first.  
2. If custom work required → `customWork: true` → **+$25**, **min $50**.  
3. Hard cap generation loops; refuse open-ended “build anything for $25.”

---

## API usage

```bash
# Catalog + ops profit reference
curl -s 'https://www.we-succeed.org/api/pricing/estimate?catalog=1' | jq .

# Estimate
curl -s -X POST 'https://www.we-succeed.org/api/pricing/estimate' \
  -H 'content-type: application/json' \
  -d '{"needText":"mechanic follow-ups","featureIds":["crm","notify"]}'
```

Response includes:

- `customerSummary` — total + line items (safe for users)  
- `opsSummary` / `profit` — cost and margin (ops only)  
- `moduleSlugs` — pass straight into AppEngine compose (`module_slugs`)

---

## Next product wiring

1. UI checklist on Solution Desk or AppEngine soft-launch using this API  
2. Pay → compose with `module_slugs` from estimate  
3. Log actual build cost after N jobs → tighten `BASE_SHELL_COST` / `PER_MODULE_COST` constants

---

## Decided — do not re-ask (owner, 2026-10-26)

- **Build prices above are set.** $25 core, $10 per add-on ($20 heavier), custom +$25 with a $50 floor. Agents have re-asked this several times; it is settled.
- **Where App Engine shows up:** it is **both** part of our platforms **and** offered on its own — one engine, one checkout:
  - inside **ChurchConnect** as "Build a ministry app" (youth, elderly, outreach, app-building as an outreach activity),
  - inside **Operate** as "Build a tool for your business",
  - **standalone** at appengine.unitedundergod.org for individuals.
  The platform entry points hand off by SSO with the church/business context prefilled. Do not fork a second builder.
- **Busy apps are told to upgrade, never switched off.** See "Hosting & usage" below.

## Hosting & usage (what keeping an app alive costs us)

Each customer app = one Vercel project (team Pro plan) + one Neon project (its own database).

| Cost | Per typical small app / month |
|------|------:|
| Neon database (free plan covers the first 100 projects; after that $0.106–$0.222 per compute-hour, compute sleeps after 5 min idle) | $0 → ~$0.30–$1.70 |
| Vercel hosting (inside Pro's included usage + $20 credit; the $20 seat is already paid) | ~$0.01–$0.10 |
| Email (Resend free 3,000/mo; Pro $20 for 50,000) | ~$0 unless the app sends mail |
| An update/redeploy | ~$0.03 each |

**Totals:** ~$0.05–$0.15 per app per month while we're under 100 apps; ~$0.60–$2 per app per month beyond that. A busy app costs more — that is what the usage safeguard catches.

**Standard allowance per app per month** (`STANDARD_ALLOWANCE` in `src/lib/engine/app-usage.ts`): 500 MB storage, 50 compute-hours, 2 GB data served.

**Safeguard:** `/api/cron/usage` runs daily. It measures every live app (Neon API + `pg_database_size`), emails the app's owner once at 80% ("heads-up") and once past 100% ("time for a bigger plan — nothing is switched off"), at most once per level per month, and puts the app in the owner deck's attention queue. Smoke: `npm run smoke:app-usage`.

**Hosting price — DECIDED (Lincoln, 2026-11-01): usage-based, no yearly fee.** Source of truth: LPL
`03_APP_ENGINE__SOURCE_OF_TRUTH.md` §9a. His words: "A micro app that doesn't cost us anything we could host for free.
I don't want anything getting in the way of someone willing to make an app. And then when app gets busy, then we can
start billing for its activity."

- **Free while inside the free allowance**, with no end date. Starting allowance: 10 compute-hours (CU-hours),
  500 MB storage and 2 GB served per app per month. That costs $0 on Neon's free plan (first 100 apps) and at most
  about $1.06 a month per app after that.
- **Past the allowance, bill the activity only**: (measured cost of the overage) × `APP_ENGINE_BILLING_MARGIN` (1.3),
  drawn from prepaid App Engine credits (`billing.ts`) so card fees never eat a small charge.
- **Never switched off.** The 80% and 100% notices stay. The 100% notice now says what activity past the allowance
  costs, instead of "time for a bigger plan".
- **The old recommendation is superseded:** the "$49/year" figure and a separate bigger-plan price were never adopted.

Cost reference (prices checked 2026-11-01): Neon $0.106 per CU-hour and $0.35 per GB-month; Vercel Pro $20 a month
with a $20 usage credit and 1 TB transfer, then about $0.15/GB. The smallest database (0.25 CU) awake for one hour
uses 0.25 CU-hours, about 2.7¢. Cost follows how many hours a day an app is in use, not how many people use it.

**Not built yet:** metering the overage and drawing it from credits, and lowering `STANDARD_ALLOWANCE.computeHours`
from 50 to 10. Open item: what happens if a busy app's owner has no credits (Lincoln's call).
