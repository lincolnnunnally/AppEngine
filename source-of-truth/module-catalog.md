# Module Catalog (the Lego system)

The Module Catalog is AppEngine's set of reusable **build blocks** — the capabilities apps are composed from. It is the factory's "Lego store": a new app is built by snapping existing blocks together, never by rebuilding a block that already exists.

Artifact kind:

```text
module_catalog
```

## Why it exists

The drift this ends: seven agents rebuilt the same connection engine seven times; the toner platform became eleven repos of one product. A block with **one home** that every app reuses is the cure. Before building any capability, check the catalog — reuse the block, don't recreate it (THE ONE RULE).

## What it is — and is not

- **It is** the reusable code/capability blocks (Identity & Auth, Connection Engine, Needs↔Helper Matching, Communication, Events & Scheduling, Intake, Recommendation/Navigator, Testimony Engine, Mentorship/Coaching, Growth Tracking, CRM/Follow-up, Payments/Billing, Website Builder, Analytics/Hope Index).
- **It is not** the `app_portfolio_registry` (that catalogs whole **apps**) or `life_core` (that describes ecosystem **data contracts** — journey stage, unified feed). Distinct layers; the catalog `usedByApps` slugs reference the app registry.

## Seeded from real code

The catalog is not abstract — it is mined from the completed repos, **verified against the GitHub repos** (not just local clones, which can be stale or missing). Sources span repos:

- **ChurchConnect** (richest, completed): Communication (`broadcasting`/`church_sms`/`email_service`), Payments & Giving (`stripe_payments`/`universal_giving`/`OnlineGiving`), Scripture & Sermon Tools, Live Service (`streaming`/`LiveStreamManager`), Volunteer & Safety (`volunteer_force`/`background_checks`), CRM, Events, Testimony, Identity (phone OTP), Analytics.
- **Kindred-Connection** (GitHub-only, Python) — the **canonical Connection Engine**: `backend/routers/soul_match.py`, `relational_posture.py`, `loneliness_prescription.py`, `pods.py` (group-first), `coaching.py`. Richer than ChurchConnect's `purpose_matching`.
- **Website-friends / Easy Peasy** — Website Builder + Domains (`WebsitesAndDomains.tsx`, `DomainSearchModal.tsx`, `Web3Domains.tsx`).
- Iconium is an early ~11KB stub (not a source yet); more repos fold in as reviewed.

Each block's `primarySource` names the actual files to mine first.

## Each block records

- `slug`, `name`, `category`, `purpose`
- `capabilities` — what it does (used to match a need to a block)
- `usedByApps` — the registered apps already using it
- `primarySource` — where the strongest existing implementation lives, to **mine first** instead of rebuilding
- `status` — `in_use`, `extractable` (mine from an existing repo), or `planned`

## How it's used

- `loadModuleCatalog()` returns the full set; the owner sees it at `/module-catalog`.
- `findModulesForNeed(need)` matches a described need to the blocks that already cover it, so planning/building reuses them.

## Guardrails

- Reuse, never rebuild. One home per block.
- Customer data stays isolated per app; blocks share **capability and styling**, never personal data.
- No provider/infrastructure names shown to users.
