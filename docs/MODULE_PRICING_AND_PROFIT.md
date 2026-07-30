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
