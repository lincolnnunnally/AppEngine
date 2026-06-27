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

### Church / Organization Operating System

Source: ChurchConnect + Association

Mine first:

- `src/components/People.tsx`
- `src/components/GuestManagement.tsx`
- `src/components/ConnectionInbox.tsx`
- `src/components/Events.tsx`
- `src/components/Communications.tsx`
- `src/components/OnlineGiving.tsx`
- `src/components/LiveStreamManager.tsx`
- `src/components/SuperAdminDashboard.tsx`
- `Association/src/components/AssociationManagement.tsx`
- `Association/src/components/ChurchManagement.tsx`
- `Association/src/components/GivingReports.tsx`

Use when:

- The app manages a church, nonprofit, association, community, or multi-organization network.

Rebrand:

- Organization nouns
- Member/guest labels
- Event taxonomy
- Giving/payment labels
- Staff/admin roles
- Public discovery language

Credentials:

- Auth
- Database
- Email/SMS provider
- Payment provider if giving or billing remains enabled
- Streaming provider if live video remains enabled

### Managed Website + Domain Launch App

Source: Easy Peasy Websites / Website-friends

Mine first:

- `frontend/src/components/LandingPage.jsx`
- `frontend/src/components/SignupPage.jsx`
- `frontend/src/components/ClientPortal.jsx`
- `frontend/src/components/AdminDashboard.jsx`
- `frontend/src/components/BusinessFormation.jsx`
- `backend/provisioner.py`
- `backend/tests/test_domain_search.py`
- `backend/tests/test_provisioning.py`
- `LAUNCH_RUNBOOK.md`

Use when:

- A user needs a simple managed website, domain search, hosting/provisioning, and client/admin portal.

Rebrand:

- Offer name
- Site package names
- Domain/provider language
- Client portal labels
- Support language

Credentials:

- Auth
- Database
- Domain registrar/provider credentials
- Email provider
- Payment provider
- Hosting provider credentials

### Toner Fleet + Auto Ordering App

Source: Toner Management, TotalTonerManagement, TM-UserDash, TM-Admin-portal, TonerTrackerPro

Mine first:

- `src/pages/Dashboard.tsx`
- `src/pages/Printers.tsx`
- `src/pages/NetworkMonitor.tsx`
- `src/pages/AutoOrderSettings.tsx`
- `src/pages/SupplierIntegration.tsx`
- `src/pages/SupplierPricingImport.tsx`
- `server/routes/customer.ts`
- `server/routes/agent.ts`
- `server/routes/supplier.ts`
- monitoring installer code from TonerTrackerPro

Use when:

- The app monitors customer printers, predicts toner needs, automates ordering, and gives admins an operations dashboard.

Rebrand:

- Service name
- Device/printer vocabulary
- Supplier labels
- Plan names
- Support and dispatch language

Credentials:

- Auth
- Database
- Monitoring agent registration secret
- Email provider
- Supplier API credentials
- Payment provider if billing remains enabled

### Creator Clip + Publishing Platform

Source: Snip.Show / emergent

Mine first:

- `frontend/src/pages/Upload.js`
- `frontend/src/pages/Dashboard.js`
- `frontend/src/pages/VideoDetailPage.js`
- `frontend/src/pages/TimelineEditor.js`
- `frontend/src/pages/ContentLibraryPage.js`
- `frontend/src/pages/AutoSchedulerPage.js`
- `frontend/src/pages/AlgorithmInsights.js`
- `frontend/src/pages/GrowthDashboardPage.js`
- `backend/services/ai_video_editor.py`
- `backend/services/content_remix_ai.py`
- `backend/routes/video.py`
- `backend/routes/repurpose.py`
- `backend/routes/scheduler.py`

Use when:

- The app helps creators upload, clip, remix, schedule, analyze, and publish media.

Rebrand:

- Creator vocabulary
- Platform channel labels
- Clip/remix language
- Analytics labels
- Pricing/plan labels

Credentials:

- Auth
- Database
- Storage provider
- AI provider
- Social platform OAuth credentials
- Payment provider if subscriptions or marketplace remain enabled

### Product Marketplace + Proof Approval App

Source: Laser Engraving

Mine first:

- `src/components/ProductCatalogEnhanced.tsx`
- `src/components/CustomizationCanvas.tsx`
- `src/components/DesignAssetUpload.tsx`
- `src/components/FileUpload.tsx`
- `src/components/MakerDashboard.tsx`
- `src/components/MakerManagement.tsx`
- `src/components/MakerMockupGenerator.tsx`
- `src/components/OrderAllocation.tsx`
- `src/components/CheckoutForm.tsx`
- `src/components/ShareDesignDialog.tsx`
- `src/components/SharedDesignLanding.tsx`

Use when:

- The app sells customizable physical products, routes work to makers/vendors, and requires customer proof approval.

Rebrand:

- Product taxonomy
- Maker/vendor nouns
- Proof approval wording
- Shipping/fulfillment language
- Marketplace commission labels

Credentials:

- Auth
- Database
- Storage provider
- Payment provider
- Email provider
- Optional maker payout provider

### Co-parenting Case Coordination App

Source: ChildFirst Solutions

Mine first:

- `src/components/ScheduleChangeRequestPanel.tsx`
- `src/components/CommunicationAssistant.tsx`
- `src/components/ConflictReductionCard.tsx`
- `src/components/DocumentCenter.tsx`
- `src/components/CourtReadySummaryCard.tsx`
- `src/components/IssueResolutionWorkflowCard.tsx`
- `src/components/AgreementTrackerCard.tsx`
- `src/lib/services/case.ts`
- `src/lib/services/resolution.ts`
- `src/lib/services/calendar-sync.ts`

Use when:

- The app coordinates cases, schedules, documents, communication, agreements, and resolution workflows.

Rebrand:

- Case nouns
- Party/role labels
- Document categories
- Resolution workflow steps
- Safety/legal disclaimer

Credentials:

- Auth
- Database
- Email/notification provider
- AI provider if communication rewriting or summaries remain enabled
- Calendar integration credentials if sync remains enabled

### Idea Capture + Content Forge App

Source: ideas

Mine first:

- `src/components/VoiceRecorderModal.jsx`
- `src/components/OcrCard.jsx`
- `src/components/TranscribeCard.jsx`
- `src/components/MeetingRecorderModal.jsx`
- `src/components/ForgeModal.jsx`
- `src/components/PolishModal.jsx`
- `src/components/QuickTextModal.jsx`

Use when:

- The app captures ideas from voice, images, meetings, OCR, or quick text and turns them into useful drafts.

Rebrand:

- Capture categories
- Output formats
- Library/folder language
- Polish/forge terminology

Credentials:

- Auth
- Database
- Storage provider
- AI provider
- Transcription/OCR provider if not handled by the AI provider

### Brand Kit + Logo Generator App

Source: Iconium

Mine first:

- `src/components/BrandPrompt.tsx`
- `src/components/ConceptCards.tsx`
- `src/components/EditorControls.tsx`
- `src/components/LogoPreview.tsx`
- `src/components/SvgPreview.tsx`
- `src/lib/logo-generator.ts`
- `src/lib/ai/interpretBrand.ts`
- `src/lib/svg-engine.ts`

Use when:

- The app creates logos, icon systems, SVG exports, palettes, and starter brand kits.

Rebrand:

- Brand prompt questions
- Export labels
- Palette names
- Style presets
- Project nouns

Credentials:

- Auth
- Database
- AI provider
- Storage provider if exports/projects are saved

### Mutual Aid + Recovery Community App

Source: RebuildingDads + KND-google-ai

Mine first:

- `src/components/MutualAidApplication.tsx`
- `src/components/CourtDocumentation.tsx`
- `src/components/RelationshipHealthHub.tsx`
- `src/components/SupportPartnerMatching.tsx`
- `src/components/GroupChat.tsx`
- `src/components/RecoveryProgressChart.tsx`
- `src/components/VictoryStreakTracker.tsx`
- `src/pages/ResourceHub.tsx`

Use when:

- The app supports a community through recovery, support matching, mutual aid, documentation, resources, and group encouragement.

Rebrand:

- Community name
- Support categories
- Aid fund vocabulary
- Progress labels
- Safety and escalation language

Credentials:

- Auth
- Database
- Payment/donation provider if aid funds remain enabled
- Email/SMS provider
- AI provider if coaching or triage remains enabled

### Troubleshooting Knowledge Marketplace

Source: JeepFix

Mine first:

- `src/components/TroubleshootingWizard.tsx`
- `src/components/ProblemCard.tsx`
- `src/components/ProblemDetailPage.tsx`
- `src/components/SolutionPartsList.tsx`
- `src/components/PartsMarketplacePage.tsx`
- `src/components/LeaderboardPage.tsx`
- `src/components/RewardsPage.tsx`
- `src/components/RatingModal.tsx`

Use when:

- The app helps a niche community diagnose problems, share solutions, recommend parts/resources, and reward contributors.

Rebrand:

- Problem categories
- Solution vocabulary
- Marketplace item labels
- Reward and reputation labels

Credentials:

- Auth
- Database
- Payment/provider credentials if marketplace purchases remain enabled
- Email provider

### Coach / Training Growth Community

Source: RacketPro

Mine first:

- coach profile setup
- find coaches
- mental training journal
- mental imagery
- self-talk
- assessments
- achievements

Use when:

- The app connects learners to coaches and combines training plans, assessments, growth tracking, and community.

Rebrand:

- Sport/domain vocabulary
- Coach profile fields
- Assessment names
- Training journal labels
- Achievement labels

Credentials:

- Auth
- Database
- Payment provider if coaching bookings are paid
- Email/notification provider

### Media Case Evidence App

Source: Honestly

Mine first:

- `src/components/VideoRecorder.js`
- `src/components/RecordingsTab.js`
- `src/components/CounselorNotes.js`
- `src/pages/CreateCase.js`
- `src/pages/CaseDetail.js`
- `src/pages/Analysis.js`
- `src/pages/ParticipantPortal.js`

Use when:

- The app records media, organizes cases, gathers participant input, and supports review or analysis workflows.

Rebrand:

- Case vocabulary
- Participant roles
- Recording labels
- Review workflow
- Privacy/safety disclaimer

Credentials:

- Auth
- Database
- Storage provider
- AI provider if analysis remains enabled
- Email provider if participant invitations remain enabled

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
