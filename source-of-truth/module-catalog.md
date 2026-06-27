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
- **Kindred-Connection / Kindred Connections** — the **canonical Connection Engine** and strongest rebrandable human-growth app source: `backend/routers/soul_match.py`, `relational_posture.py`, `loneliness_prescription.py`, `pods.py`, `knowing.py`, `identity.py`, `forgiveness.py`, `coaching.py`, `events.py`, `event_curation.py`, `webhooks.py`, `public_profile.py`, `admin.py`, and frontend pages for onboarding, becoming, discover, match detail, invites, public profiles, events, coaching, forgiveness, mediation, and admin. Mine these before rebuilding any belonging, matching, referral, profile-sharing, coaching, event-service, repair, or admin/moderation flow.
- **Website-friends / Easy Peasy** — Website Builder + Domains (`WebsitesAndDomains.tsx`, `DomainSearchModal.tsx`, `Web3Domains.tsx`).
- **ideas** — Idea Capture & Content Forge (voice/photo/OCR/transcribe → forge/polish).
- **LaserEngraving** — Marketplace & Orders + Design Studio (canvas, upload, mockups).
- **childfirst-solutions** — Case Management & Documentation + Mediated Communication.
- **Association** — Finance & Accounting + Multi-Org / Association.
- **JeepFix** — Knowledge Base & Troubleshooting + Ratings & Reviews.
- **RebuildingDads / honestly** — Mutual Aid & Benevolence + Achievements; **honestly** — Media Recording.
- Iconium is an early ~11KB stub (not a source yet); remaining repos fold in as reviewed.

Each block's `primarySource` names the actual files to mine first.

## Kindred Mining Update - 2026-06-27

Kindred now contributes more than the original `connection-engine` entry. The repo has been mined into catalog-visible reusable blocks and a separate template layer:

- `purpose-onboarding` for deep user/app setup before value delivery.
- `becoming-growth-dashboard` for journals, goals, check-ins, readiness, rituals, and progress scoring.
- `public-invite-loop` for trusted user-owned referrals and invite-attributed signup.
- `public-profile-og-sharing` for public pages, rich share previews, and generated profile cards.
- `event-curation-service-loop` for event CRUD, RSVP, attendance, imported events, and service recommendations.
- `relationship-repair` for forgiveness, reflection, letter drafting, mediation, and conflict repair.
- `admin-ops-moderation` for owner dashboards, reports, operations, settings, AI usage, and audit logs.

The rebrandable app-template layer lives in `source-of-truth/rebrandable-template-catalog.md`. New apps should choose a source-backed template, replace brand/copy/taxonomy, plug credentials, map database placement, and only then build the app-specific difference.


## Full Repo Mining Update - 2026-06-27

The wider repo-mining pass added deployment-aware module evidence for the rest of the portfolio:

- Toner contributes `fleet-monitoring-agent` and `supplier-order-automation`.
- Laser Engraving contributes `proof-approval-artifact` for immutable customer approval proof.
- Snip.Show/emergent contributes `content-publishing-scheduler` and `creator-analytics-coaching`.
- Easy Peasy contributes `business-formation-provisioning` in addition to website/domain launch work.
- Iconium contributes `brand-kit-generator`.

The deployable-app view now lives in `source-of-truth/ecosystem-deployment-queue.md`. That document is the gate between "code builds" and "safe to deploy." It records build proof, launch blockers, canonical-source blockers, and production approval status.

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
