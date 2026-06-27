# Kindred Connection Mining Audit

Date: 2026-06-27
Owner: Lincoln
Source repo: `/Users/lincolnnunnally/Documents/Kindred Connections`

## Purpose

This audit mines Kindred Connections for reusable modules and rebrandable app templates. The goal is not to restart Kindred. The goal is to preserve the strongest completed work and make it available to AppEngine, AIPOS, and future app builds as cataloged source material.

## Source State

- Local branch inspected: `main`
- Local branch note: `emergent` also exists and is tracked locally/remotely.
- Current checkout status: clean at inspection time.
- `main` includes the Abundant Life first-week ritual and the rich FastAPI/React app structure.
- `emergent` remains an important launch-prep branch reference, but this mining pass used the current checkout so the newest known local work is included.

## What Kindred Already Contains

Kindred is a full connection and growth app, not a single matching feature.

Major reusable surfaces found:

- Auth, sessions, protected routes, admin route gating, account deletion.
- Deep onboarding for purpose, values, goals, drivers, motivation, and profile setup.
- AI purpose analysis, soul match insight, sweet spot generation, soul letters, coaching, and adaptive readiness prompts.
- Discover, match detail, friendship/dating mode, connection request/accept, messages, WebSocket updates, and notifications.
- Becoming dashboard, journal, goals, check-ins, readiness sliders, alignment score, streak pause, and Abundant Life ritual.
- Growth pods, pod invites, pod chat, loneliness cohorts, loneliness-to-service prescription.
- Events, RSVPs, attendance verification, event curation, ChurchConnect webhook ingestion.
- Public profile pages, invite pages, OG cards, share links, and rich preview image generation.
- Forgiveness, mediation, relational posture assessment, identity work, and Knowing journey.
- Admin dashboard, users, reports, pods, events, operations, settings, AI usage, and audit log.
- Safety, block/report, moderation, privacy policy, terms, 404 page, and error boundary.
- Design system guidance, organic brand palette, Tailwind/Shadcn component library, and data-testid discipline.

## Catalog Modules To Mine

These should be represented in AppEngine's module catalog and treated as reusable blocks.

| Module | Source Files | Reuse Target |
|---|---|---|
| Connection Engine | `backend/routers/soul_match.py`, `backend/routers/relational_posture.py`, `backend/routers/pods.py`, `backend/routers/knowing.py`, `frontend/src/pages/Discover.js`, `MatchDetail.js`, `Connections.js` | Kindred, Kids Need Dads, ChurchConnect, RacketPro, JeepFix, future community apps |
| Purpose Onboarding | `backend/server.py`, `frontend/src/pages/Onboarding.js`, `frontend/src/pages/Profile.js`, `design_guidelines.json` | Any app that needs user/app setup before value delivery |
| Becoming Growth Dashboard | `backend/routers/becoming.py`, `backend/routers/streak.py`, `frontend/src/pages/Becoming.js`, `Journal.js`, `Goals.js` | Best Life, Spark of Hope, Kids Need Dads, coaching apps |
| AI Coaching & Covenants | `backend/routers/coaching.py`, `frontend/src/pages/Coaching.js` | Best Life, Spark, mentorship/coaching products |
| Public Invite Loop | `backend/routers/invites.py`, `frontend/src/pages/Invite.js`, `PublicInvite.js`, `frontend/src/pages/Auth.js` | Any app that grows by trusted peer invitation |
| Public Profile & OG Sharing | `backend/routers/public_profile.py`, `frontend/src/pages/PublicProfile.js`, `frontend/src/pages/Settings.js` | Creator, profile, testimony, church, marketplace, and community apps |
| Events + Service Loop | `backend/routers/events.py`, `backend/routers/event_curation.py`, `backend/routers/webhooks.py`, `backend/routers/loneliness_prescription.py`, `frontend/src/pages/Events.js`, `EventCreate.js`, `EventDetail.js`, `admin/AdminEventsCurate.js` | Live On Mission, ChurchConnect, Kindred, service/community apps |
| Relationship Repair | `backend/routers/forgiveness.py`, `frontend/src/pages/Forgiveness.js`, `ForgivenessJourney.js`, `Mediation.js`, `ConnectionReflection.js` | Kids Need Dads, ChildFirst, care/counseling tools |
| Admin Ops & Moderation | `backend/routers/admin.py`, `frontend/src/pages/admin/*`, `backend/core.py` | Every serious app needing owner review, safety, reports, AI usage, and audit |

## Rebrandable Template Candidates

These are app-level patterns a new app can start from by changing brand, copy, credentials, and app-specific taxonomy.

1. Purpose Connection App
2. Guided Growth Dashboard App
3. Peer Invite / Referral Loop
4. Public Profile + Share Card App
5. Community Events + Service App
6. AI Coaching + Covenant App
7. Forgiveness / Mediation App
8. Admin Ops + Moderation Console

## Credentials And Providers Found

No secret values should be copied. Only these variable names and purposes should travel into templates.

- `MONGO_URL`: legacy Kindred runtime database URL.
- `DB_NAME`: legacy Kindred database name.
- `JWT_SECRET`: session/JWT signing secret.
- `EMERGENT_LLM_KEY`: current AI + object storage integration key in Kindred.
- `RESEND_API_KEY`: optional email delivery.
- `SENDER_EMAIL`: email sender identity.
- `APP_PUBLIC_URL`: public app URL for share links, redirects, and cards.
- `CHURCHCONNECT_WEBHOOK_SECRET`: HMAC secret for ChurchConnect event ingestion.
- `REACT_APP_BACKEND_URL`: frontend API base URL.

For new Lincoln-owned ecosystem apps, the Launch Pack should translate these into the consolidated Supabase ecosystem convention unless the app has an approved exception.

## Extraction Rules

- Do not copy Kindred user data, `.env` files, local database state, or private runtime credentials.
- Do not preserve Kindred brand text unless the target app is actually Kindred.
- Keep the user-facing tone only when it fits the new app; rebrand copy and intent per app.
- Prefer extracting module contracts and source paths before copying code.
- For Supabase ecosystem apps, map identity to the shared `person` convention before implementation.
- Keep old Mongo paths as source-reference only until a specific app Launch Pack approves runtime use.

## Kindred Portfolio Status Update

Kindred is no longer just `audit-needed` for module extraction. The next safe action is a Launch Pack/restart audit inside the Kindred repo itself, followed by deployment/review verification.

Remaining blockers:

- AIPOS + Launch Pack docs need to be installed or filled inside the Kindred repo.
- Runtime database/provider decision needs to be reconciled with the consolidated Supabase ecosystem rule.
- Live review URL and production launch path still need verification.
