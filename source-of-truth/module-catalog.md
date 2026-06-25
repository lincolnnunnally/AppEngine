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

The catalog is not abstract — it is mined from the completed repos. **ChurchConnect** is the richest source: its `purpose_assessment`/`purpose_matching` routes are the connection engine; `broadcasting`/`church_sms`/`email_service` are Communication; `stripe_payments`/`universal_giving`/`OnlineGiving` are Payments & Giving; `scripture_library`/`sermon_prep` are Scripture & Sermon Tools; `streaming`/`LiveStreamManager` are Live Service; `volunteer_force`/`background_checks` are Volunteer & Safety; `website_handoff`/`spaceship_domains` are Domains & Publishing; and so on. Each block's `primarySource` names the actual files to mine first. More repos (Iconium, Easy Peasy, Spark of Hope) are folded in as they're reviewed.

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
