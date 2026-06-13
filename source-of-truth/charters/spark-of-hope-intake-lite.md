# Spark of Hope Intake Lite Charter

## Purpose

Spark of Hope Intake Lite helps a person or church collect one hopeful story, preserve the story safely, and prepare a small encouragement response workflow.

This pilot exists to prove the AppEngine handoff path in a real, bounded, mission-aligned app without turning the pilot into the full Spark of Hope product.

## Primary Users

- People sharing hopeful stories.
- Church staff reviewing submitted stories.
- Encouragement volunteers preparing a response.
- AppEngine owner/admin users monitoring the pilot through Super Admin.

## People Or Organizations Helped

- A person with a hopeful story who needs a simple and trusted way to share it.
- A church or ministry team that wants to receive, review, and respond to stories with care.
- Volunteers who need enough context to encourage someone without being overwhelmed by private or unnecessary data.
- AppEngine operators proving that a generated app can move through intake, planning, review, and release gates safely.

## Barrier Removed

Spark of Hope Intake Lite removes the barrier of scattered, informal, or unsafe story collection by giving story sharers and church teams a simple, bounded, private intake and response path.

## Need Addressed

Story sharers need a trusted way to share hopeful experiences without feeling exposed, and church teams need a responsible way to review stories, protect privacy, and prepare encouragement.

## Movement Toward Life

The app helps a person move from holding a story alone toward being heard, stewarded, and encouraged, while helping a church team move from vague intention to concrete care.

## Transformation Outcome

The intended transformation is a calm, trusted story-intake workflow where hope is received responsibly, encouragement can be prepared safely, and the pilot proves AppEngine can create bounded life-giving apps without scope bleed.

## Tool Classification

- Direct Transformation Tool.
- Reason: Spark of Hope Intake Lite directly helps people share hope, be heard, and receive encouragement while helping churches steward stories responsibly.

## Life Produces Life Pattern

- Spark: A person has a hopeful story, testimony, encouragement, or small sign of life worth preserving.
- Serve: The app gives that person a simple way to share the story and gives a church team a way to respond.
- Strength: The story sharer is treated with care, reviewers can steward the story responsibly, and volunteers can encourage without confusion.
- Best Life: The intake and response path becomes calm, trusted, and useful instead of scattered across texts, forms, and memory.
- Multiply Life: Later versions may help churches learn from stories, encourage more people, and route follow-up care while staying inside the Spark of Hope charter.

## What This App Should Do

- Provide a simple public story intake concept.
- Capture only the minimum story information needed for review and encouragement.
- Preserve story submissions with clear privacy and review boundaries.
- Support a lightweight review flow for church staff or approved admins.
- Support a small encouragement response workflow for approved volunteers.
- Expose planned management, health, logs, users/admin, deployment, and status surfaces for AppEngine Super Admin.
- Stay buildable and reviewable through phased AppEngine follow-up issues.
- Keep preview planning dry-run friendly until release gates and owner approval allow more.

## What This App Should Not Become

- The full Spark of Hope platform.
- A counseling, crisis response, medical, legal, or emergency support system.
- A public social network, testimony feed, or viral content platform.
- A donor, billing, payment, fundraising, or campaign-management system.
- A church CRM or full volunteer-management system.
- A cross-app identity, billing, story, or user database shared with unrelated apps.
- A production deployment, paid provider setup, or generated app code merge without review and owner approval.
- A workflow that collects private, sensitive, or unnecessary user data beyond the bounded story-intake purpose.

## Success Definition

The Charter phase succeeds when this charter exists at `source-of-truth/charters/spark-of-hope-intake-lite.md`, clearly states the app boundaries, names the first useful scope, records MVP stages, and gives later agents a build-ready handoff for phased follow-up issues.

The pilot app succeeds when a dry-run App Build Packet creates safe phased follow-up issues for story intake, review, encouragement, testing, release gate, and Super Admin registration without production deployment, paid provider creation, or generated app code merge without review.

## First Useful Scope

The first useful scope is a preview-planned v1 pilot that can demonstrate:

- A story intake form concept.
- A protected review/admin concept.
- An encouragement response preparation concept.
- Super Admin registry/status planning.
- Health and release-gate planning.

This scope should proceed to design and architecture before build. It should not proceed directly to MVP implementation from this Charter phase.

## MVP Stages

1. Stage 1: Public story intake concept
   - Goal: Let a person submit one hopeful story with clear consent, privacy copy, and validation.
2. Stage 2: Protected review queue concept
   - Goal: Let approved owner/admin users review story submissions and mark review status.
3. Stage 3: Encouragement response workflow
   - Goal: Let approved staff or volunteers prepare a small encouragement response without exposing unnecessary private data.
4. Stage 4: Super Admin visibility
   - Goal: Register planned management, health, logs, admin, user/status, deployment, and release-gate surfaces.
5. Stage 5: Preview readiness
   - Goal: Verify design quality, UX, compatibility, identity/auth, provider/cost, deployment environment, release gate, and monitoring before preview.

## App Build Packet

- Packet path: planned through the AppEngine App Build Packet artifact from source issue `#32`.
- Current phase: `charter`.
- App slug: `spark-of-hope-intake-lite`.
- Deployment target: Vercel preview planning only.
- Release version: `v1`.
- Production deployment: blocked until owner approval and Release Gate completion.

## Identity/Auth

- Provider: Auth.js.
- Session strategy: Server-side session checks with app-scoped roles and memberships.
- Owner source: `APP_ENGINE_OWNER_EMAIL`.
- Roles: `owner`, `admin`, `customer`.
- Membership model: app-scoped users, profiles, accounts or organizations, memberships, roles, and permissions.
- Protected routes/APIs: `/app`, `/account`, `/admin`, `/api/customer/*`, `/api/admin/*`.
- Local setup behavior: local setup may use development-only fallback behavior only before production auth is configured.
- Production auth gate: public deployments must require configured auth for protected customer, admin, and Super Admin surfaces.

## Super Admin Integration

- Management: planned AppEngine Super Admin entry for the app.
- Monitoring: planned status surface and post-launch monitoring task.
- Health: `/api/engine/apps/spark-of-hope-intake-lite/health`.
- Logs: planned provider or Super Admin log link.
- Users/admin: `/admin/apps/spark-of-hope-intake-lite`.
- Billing/status if needed: not required for MVP; status should state `not_applicable` unless future paid features are approved.
- Admin actions: open app, open admin, view health, view logs, manage users, create incident, create follow-up work.
- Registry status: `planned`.
- Registry entry path or source: planned Super Admin registry entry from the App Build Packet and later registration phase.

## Deployment Environment

- Provider/cost review: required before provisioning or release approval.
- Frontend provider: Vercel.
- API/backend provider if needed: Vercel Functions; separate backend not required initially.
- Database provider: Neon, using a generated-app branch or app-scoped database plan.
- Environment variables needed: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `APP_ENGINE_OWNER_EMAIL`, `NEXT_PUBLIC_APP_URL`.
- Preview URL: planned.
- Production URL: approval-gated.
- Custom domain/subdomain: planned before production.
- Logs: planned Vercel, Render if later needed, or Super Admin log link.
- Health checks: `/api/engine/apps/spark-of-hope-intake-lite/health`.
- Rollback notes: preview rollback by closing or updating the preview PR; production rollback requires an approved release rollback plan before production is allowed.

## Provider And Cost Boundaries

- Preview cost posture: `free_or_low_cost`.
- Production cost posture: `approval_required`.
- Monthly ceiling during pilot dry run: zero paid resources.
- Upgrade trigger: usage, reliability, customer value, or revenue justifies paid resources.
- New paid resources: blocked unless provider/cost review and owner approval are recorded.
- Not required initially: separate API backend, file storage, payments, AI model calls, paid analytics, paid monitoring.

## Release Gate

- Launch version: `v1`.
- Provider/cost review: required before provider provisioning or release approval.
- Designer review: required before Release Gate approval.
- Customer Perspective review: required before Release Gate approval.
- Compatibility plan: required before Release Gate approval.
- Preview deploy contract: preview before production, with health and logs planned.
- Production approval: required and blocked until owner approval is recorded.
- Post-launch monitoring: required.
- Super Admin status update: required as the app moves from `planned` to `building`, `preview`, and any later approved status.
- vNext/follow-up rules: post-v1 work must use vNext packets or scoped follow-up issues.

## Design Quality And UX Review

- Simple navigation: required.
- Clear primary action: required on story intake, review, and response screens.
- Mobile-first layout: required, with mobile treated as first-class.
- Readable copy: required, using plain, calm, human language.
- Accessible spacing/contrast: required.
- Trust-building elements: required because story intake may feel personal or sensitive.
- Audience-specific emotional fit: required; the app should feel careful, hopeful, and practical, not generic or performative.
- Empty states: required for no submissions and no assigned response work.
- Error states: required for failed submission, validation failure, auth failure, and admin actions.
- Loading states: required where submissions, review queue, or admin status load asynchronously.
- Onboarding: required for first-time story sharers and admin setup.
- Admin screens: required or explicitly planned before release approval.

## Compatibility

- iPhone Safari: required.
- iPad Safari: required.
- Desktop Safari: required.
- Chrome mobile: required on Android or iOS where practical.
- Chrome desktop: required.
- Edge desktop: required.
- Firefox desktop: required.
- Required viewports: `360x640`, `390x844`, `430x932`, `768x1024`, `1024x768`, `1280x720`, `1440x900`.
- Touch targets: required.
- Forms and validation: required.
- Auth flows: required.
- File uploads if used: not in MVP unless a later phase adds them; must be tested if introduced.
- Payments if used: not in MVP unless a later approved vNext adds them; must be tested if introduced.
- Admin screens: required for tablet and desktop usability.
- Super Admin status: required for planned management/status surfaces.

## Data Ownership And Privacy Notes

- Story data belongs to the submitting person and the app-scoped church or ministry workflow authorized to review it.
- Collect only data needed for story review and encouragement response.
- Do not expose submissions publicly by default.
- Do not reuse stories across unrelated apps without explicit consent and a documented integration reason.
- Do not store secrets, provider tokens, OAuth secrets, or private credentials in issues, docs, generated artifacts, or registry entries.
- Later data-model work must define retention, deletion, review status, export needs, and admin access boundaries.

## Boundaries And Related Apps

- Related app: Spark of Hope, but this pilot is not the full Spark of Hope product.
- Related system: AppEngine Super Admin, for management and status only.
- Allowed integrations: AppEngine issue workflow, Super Admin registry/status, Auth.js, Neon, Vercel preview planning.
- Boundary guardrail: do not import ChurchConnect, Live On Mission, United Under God, Kids Need Dads, Toner Management, or other ecosystem app workflows unless a future packet documents the integration reason and data boundary.

## Required Integrations

- AppEngine App Build Packet and phased follow-up issue workflow.
- Auth.js identity/auth plan.
- Neon database planning for generated app persistence.
- Vercel preview planning.
- AppEngine Super Admin registry planning.
- Health endpoint planning at `/api/engine/apps/spark-of-hope-intake-lite/health`.

## Charter Acceptance Criteria

- The app charter exists at `source-of-truth/charters/spark-of-hope-intake-lite.md`.
- The app purpose, primary users, people helped, and Life Produces Life pattern are documented.
- Boundaries clearly state what this app must not become.
- MVP stages are named and remain small enough for phased follow-up issues.
- Identity/Auth, Super Admin, provider/cost, deployment environment, design quality, compatibility, release gate, and privacy expectations are documented at the charter level.
- Production deployment, paid provider resources, and generated app code merge remain blocked until the required reviews and owner approvals exist.

## Charter Handoff Summary

The Charter phase is complete when this file is committed or attached to a PR. The recommended next step is the `architecture` phase, followed by `provider_cost`, `data_model`, `identity_auth`, `ui_design`, and later review/build phases from the App Build Packet. Later agents should treat this charter as the app boundary and should create scoped follow-up issues rather than expanding this Charter phase into a full app build.
