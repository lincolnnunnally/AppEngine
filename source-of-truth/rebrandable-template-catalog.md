# Rebrandable Template Catalog

Date: 2026-06-27
Owner: Lincoln

## Purpose

This catalog turns already-built app patterns into reusable templates. A new app should not start from a blank screen. It should select the closest existing template, rebrand it, plug in credentials, map the database, and then build only the difference.

## Template Rule

Templates are not finished apps.

They are source-backed starting points with:

- proven screens and workflows
- source files to mine first
- rebrand fields
- credential fields
- database placement rules
- acceptance tests
- stop conditions

## Standard Rebrand Fields

Every template must expose these as app-specific replacements:

- App name
- App slug
- Domain or subdomain
- Logo/icon
- Color palette
- Typography
- Homepage headline
- Primary audience
- Primary transformation outcome
- Core nouns used in the app
- Email sender name/address
- Public share URL
- Admin/owner identity
- Legal links and support contact

## Standard Credential Fields

Every template must list required and optional credentials without storing values.

- Public frontend URL
- API base URL
- Auth provider keys
- Database URL or Supabase project reference
- Database anon key where appropriate
- Database service role key only for secure server environments
- AI provider key if AI features are enabled
- Email provider key if email is enabled
- Payment provider keys if payments are enabled
- Storage provider keys if uploads or generated images are enabled
- Webhook secrets for inbound integrations

## Template Catalog

### Purpose Connection App

Source: Kindred Connections

Mine first:

- `backend/routers/soul_match.py`
- `backend/routers/relational_posture.py`
- `backend/routers/pods.py`
- `backend/routers/knowing.py`
- `frontend/src/pages/Discover.js`
- `frontend/src/pages/MatchDetail.js`
- `frontend/src/pages/Connections.js`
- `frontend/src/pages/Pods.js`

Use when:

- The app connects people around purpose, need, support, growth, service, interest, or shared struggle.

Rebrand:

- Match vocabulary
- Profile fields
- Compatibility dimensions
- Group/pod naming
- CTA language

Credentials:

- Auth
- Database
- AI provider if match insight is generated
- WebSocket/API URL if realtime messaging is used

### Guided Growth Dashboard App

Source: Kindred Connections

Mine first:

- `backend/routers/becoming.py`
- `backend/routers/streak.py`
- `frontend/src/pages/Becoming.js`
- `frontend/src/pages/Journal.js`
- `frontend/src/pages/Goals.js`

Use when:

- The app helps a person make progress through reflection, goals, check-ins, rituals, or a weekly score.

Rebrand:

- Growth language
- Daily/weekly rhythm
- Score label
- Ritual steps
- Reflection prompts

Credentials:

- Auth
- Database
- AI provider if reflections/sweet spot/soul letter generation remains enabled

### Peer Invite / Referral Loop

Source: Kindred Connections

Mine first:

- `backend/routers/invites.py`
- `frontend/src/pages/Invite.js`
- `frontend/src/pages/PublicInvite.js`
- `frontend/src/pages/Auth.js`

Use when:

- Growth should happen through trusted invitations from current users.

Rebrand:

- Invite variants
- Public invite page copy
- Share preview
- Signup linking behavior

Credentials:

- Public app URL
- Auth
- Database
- Optional SMS/native share fallback has no provider credential when sent from the user's device

### Public Profile + Share Card App

Source: Kindred Connections

Mine first:

- `backend/routers/public_profile.py`
- `frontend/src/pages/PublicProfile.js`
- `frontend/src/pages/Settings.js`

Use when:

- A user, church, maker, creator, testimony, product, or profile needs a public page and rich preview card.

Rebrand:

- Public page fields
- Share card title/description
- CTA
- Image/avatar rules

Credentials:

- Public app URL
- Backend API URL
- Image/storage provider if uploaded avatars or generated cards are persisted

### Community Events + Service App

Source: Kindred Connections

Mine first:

- `backend/routers/events.py`
- `backend/routers/event_curation.py`
- `backend/routers/webhooks.py`
- `backend/routers/loneliness_prescription.py`
- `frontend/src/pages/Events.js`
- `frontend/src/pages/EventCreate.js`
- `frontend/src/pages/EventDetail.js`
- `frontend/src/pages/admin/AdminEvents.js`
- `frontend/src/pages/admin/AdminEventsCurate.js`

Use when:

- The app needs events, RSVP, attendance, service opportunities, imported events, or recommendation from personal need to action.

Rebrand:

- Event taxonomy
- Source taxonomy
- RSVP language
- Attendance/verifier roles
- Webhook source name

Credentials:

- Database
- Auth
- Webhook secret
- AI provider if event extraction/generation remains enabled

### AI Coaching + Covenant App

Source: Kindred Connections

Mine first:

- `backend/routers/coaching.py`
- `frontend/src/pages/Coaching.js`

Use when:

- The app guides a person through next steps, commitments, patterns, and follow-up.

Rebrand:

- Coach voice
- Covenant language
- Themes
- Follow-up rhythm

Credentials:

- AI provider key
- Database
- Auth

### Forgiveness / Mediation App

Source: Kindred Connections

Mine first:

- `backend/routers/forgiveness.py`
- `frontend/src/pages/Forgiveness.js`
- `frontend/src/pages/ForgivenessJourney.js`
- `frontend/src/pages/Mediation.js`
- `frontend/src/pages/ConnectionReflection.js`

Use when:

- The app supports repair, mediation, conflict reflection, co-parenting communication, or guided release.

Rebrand:

- Safety disclaimer
- Conflict categories
- Mediation prompts
- Completion states

Credentials:

- Auth
- Database
- AI provider if generated reflections/letters remain enabled
- Email or notification provider if invitations leave the app

### Admin Ops + Moderation Console

Source: Kindred Connections

Mine first:

- `backend/routers/admin.py`
- `frontend/src/pages/admin/AdminDashboard.js`
- `frontend/src/pages/admin/AdminUsers.js`
- `frontend/src/pages/admin/AdminReports.js`
- `frontend/src/pages/admin/AdminOps.js`
- `frontend/src/pages/admin/AdminSettings.js`
- `frontend/src/pages/admin/AdminAIUsage.js`
- `frontend/src/pages/admin/AdminAudit.js`

Use when:

- The app needs owner visibility, moderation, operational controls, AI cost visibility, or audit logs.

Rebrand:

- Admin nouns
- Report categories
- Ops actions
- Settings toggles
- KPI labels

Credentials:

- Admin auth
- Database
- AI provider if usage reporting tracks AI calls
- Email provider if admin-triggered messages are enabled

## Build Flow For New Apps

1. Pick the closest template.
2. Run the Prior-Work Check against the target repo.
3. Fill project-specific AIPOS docs.
4. Fill Launch Pack and Supabase placement.
5. Replace brand/copy/taxonomy.
6. Plug credentials into `.env.example` and deployment provider settings.
7. Map schema to the shared Supabase ecosystem tree unless an exception is approved.
8. Run acceptance tests.
9. Deploy to review URL.
10. Owner review + agent review create vNext recommendations.

## Stop Conditions

Stop before implementation when:

- The target repo cannot be read.
- A working existing surface already solves the same task.
- Credentials are missing and no mock-safe path exists.
- The template depends on Mongo or another legacy runtime but the app is required to use shared Supabase and no migration mapping exists.
- The app's Launch Pack does not name deployment target, env vars, health check, and rollback path.
