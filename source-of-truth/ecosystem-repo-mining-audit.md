# Ecosystem Repo Mining Audit

Date: 2026-06-27
Owner: Lincoln

## Purpose

This audit records what has already been mined from the wider app ecosystem so future builders reuse the strongest existing source instead of restarting apps from scratch.

This is a companion to:

- `ecosystem-build-ledger.md`
- `ecosystem-portfolio-registry.md`
- `rebrandable-template-catalog.md`
- `template-credential-contract.md`

## Mining Rule

Before any app build starts, the builder must answer:

1. Which canonical app is this?
2. Which existing repo or local checkout is the strongest source?
3. Which reusable template should be rebranded first?
4. Which shared modules already exist?
5. Which Launch Pack fields block deployment?

If these are unknown, the task is not ready for implementation.

## Repo Family Findings

### AppEngine / We Succeed

Status: canonical active

Mined as:

- factory/orchestrator
- portfolio registry home
- reusable module catalog home
- AIPOS + Launch Pack distribution point

Mine first:

- `source-of-truth/ecosystem-build-ledger.md`
- `source-of-truth/ecosystem-portfolio-registry.md`
- `source-of-truth/module-catalog.md`
- `src/lib/engine/module-catalog.ts`
- `src/lib/engine/templates.ts`

Next safe action:

- Keep the catalog source-backed and update it only from mined repo evidence.

### ChurchConnect / Association

Status: ChurchConnect canonical active; Association is merge/config source

Mined as:

- church and organization operating system
- people, guests, follow-up, events, communications, care, giving, live service, and admin surfaces
- association-tier/multi-organization extension source

Mine first:

- `src/components/People.tsx`
- `src/components/GuestManagement.tsx`
- `src/components/ConnectionInbox.tsx`
- `src/components/Events.tsx`
- `src/components/Communications.tsx`
- `src/components/OnlineGiving.tsx`
- `src/components/LiveStreamManager.tsx`
- `src/components/SuperAdminDashboard.tsx`
- Association: `src/components/AssociationManagement.tsx`
- Association: `src/components/ChurchManagement.tsx`
- Association: `src/components/BudgetOverview.tsx`
- Association: `src/components/GivingReports.tsx`

Build result:

- ChurchConnect frontend build passed on 2026-06-27.
- Build warning: several large chunks exceed the default Vite warning threshold.

Deployment condition:

- Production is gated until Launch Pack env values, health check, rollback path, and live staff follow-up proof are confirmed.

### Kindred Connections

Status: canonical active for connection engine

Mined as:

- purpose matching
- belonging/pods
- guided growth
- invites
- public profiles/share cards
- events/service loop
- forgiveness/mediation
- admin operations

Mine first:

- `backend/routers/soul_match.py`
- `backend/routers/relational_posture.py`
- `backend/routers/loneliness_prescription.py`
- `backend/routers/pods.py`
- `backend/routers/becoming.py`
- `backend/routers/invites.py`
- `backend/routers/public_profile.py`
- `backend/routers/events.py`
- `backend/routers/forgiveness.py`
- `frontend/src/pages/Discover.js`
- `frontend/src/pages/Becoming.js`
- `frontend/src/pages/PublicProfile.js`

Deployment condition:

- Needs app-local AIPOS + Launch Pack, database placement decision, and review URL.

### ChildFirst Solutions

Status: canonical active

Mined as:

- co-parenting case coordination
- schedule change workflow
- document center and parsing
- communication assistant
- court-ready summaries
- resolution workflows

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

Build result:

- Next build passed on 2026-06-27.

Deployment condition:

- Needs Launch Pack install/fill, Supabase placement review, and live preview target confirmation.

### Easy Peasy Websites / Website-friends

Status: canonical candidate

Mined as:

- managed website setup
- domain search
- client portal
- admin portal
- checkout and provisioning
- business formation upsell

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

Build result:

- Frontend build passed on 2026-06-27.

Deployment condition:

- Needs canonical name/alias decision, provider credentials, backend health check, and domain/provisioning safety review.

### Snip.Show / emergent

Status: canonical candidate; `emergent` is rich source, `Snip.Show` is likely product-name shell

Mined as:

- clip upload and library
- video detail and timeline editing
- AI remixing
- social publishing/scheduling
- creator analytics
- revenue/CRM/referrals
- marketplace/API/whitelabel source

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

Build result:

- `emergent/frontend` build passed with React hook warnings.
- `snip.show/frontend` build passed with two React hook warnings.

Deployment condition:

- Needs canonical merge decision before deployment. Do not deploy two clip tools.

### Toner Management

Status: canonical candidate

Mined as:

- toner fleet management
- customer portal
- admin operations
- printer monitoring agent
- automated ordering
- supplier pricing
- billing/shipment labels

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
- `db/migrations/0001_core_neon_schema.sql`
- `db/migrations/0002_billing_and_shipment_labels.sql`

Build result:

- `toner-management-app` build passed on 2026-06-27.

Deployment condition:

- Needs canonical repo decision between local deploy-facing app, TotalTonerManagement, TM-UserDash, TM-Admin-portal, and TonerTrackerPro.

### Laser Engrave Market

Status: canonical active

Mined as:

- product marketplace
- maker marketplace
- custom design canvas
- asset upload/catalog
- mockup generation
- checkout/payments
- order allocation
- design sharing
- proof approval workflow

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
- `supabase/migrations/*design*`
- `supabase/migrations/*maker*`

Deployment condition:

- Needs Launch Pack and immutable customer-proof artifact requirements preserved before launch work.

### Iconium

Status: canonical active

Mined as:

- brand prompt intake
- logo concept generation
- SVG preview/export
- editor controls
- palette/template selection

Mine first:

- `src/components/BrandPrompt.tsx`
- `src/components/ConceptCards.tsx`
- `src/components/EditorControls.tsx`
- `src/components/LogoPreview.tsx`
- `src/components/SvgPreview.tsx`
- `src/lib/logo-generator.ts`
- `src/lib/ai/interpretBrand.ts`
- `src/lib/svg-engine.ts`

Build result:

- Next build passed on 2026-06-27.

Deployment condition:

- Needs Prisma-vs-Supabase ecosystem placement decision before production.

### Ideas / Idea Capture

Status: canonical candidate

Mined as:

- voice capture
- photo/OCR capture
- meeting recorder
- transcription
- idea forge/polish
- library/folders

Mine first:

- `src/components/VoiceRecorderModal.jsx`
- `src/components/OcrCard.jsx`
- `src/components/TranscribeCard.jsx`
- `src/components/MeetingRecorderModal.jsx`
- `src/components/ForgeModal.jsx`
- `src/components/PolishModal.jsx`
- `src/components/QuickTextModal.jsx`
- `backend/tests/*`

Deployment condition:

- Needs relation decision: standalone idea app, Opportunity intake source, or AppEngine intake module.

### RebuildingDads / KND-google-ai

Status: merge sources for Kids Need Dads

Mined as:

- mutual aid
- court documentation
- relationship health
- support partner matching
- recovery/group chat
- victory streak/progress
- resource hub

Mine first:

- RebuildingDads: `src/components/MutualAidApplication.tsx`
- RebuildingDads: `src/components/CourtDocumentation.tsx`
- RebuildingDads: `src/components/RelationshipHealthHub.tsx`
- RebuildingDads: `src/components/SupportPartnerMatching.tsx`
- KND-google-ai: `src/components/GroupChat.tsx`
- KND-google-ai: `src/components/RecoveryProgressChart.tsx`
- KND-google-ai: `src/components/VictoryStreakTracker.tsx`
- KND-google-ai: `src/pages/ResourceHub.tsx`

Deployment condition:

- Needs canonical Kids Need Dads repo/app decision and shared Supabase mapping.

### JeepFix

Status: connection/problem-solving config source

Mined as:

- problem cards
- troubleshooting wizard
- solution/parts lists
- ratings and rewards
- marketplace source

Mine first:

- `src/components/TroubleshootingWizard.tsx`
- `src/components/ProblemCard.tsx`
- `src/components/ProblemDetailPage.tsx`
- `src/components/SolutionPartsList.tsx`
- `src/components/PartsMarketplacePage.tsx`
- `src/components/LeaderboardPage.tsx`
- `src/components/RewardsPage.tsx`
- `src/components/RatingModal.tsx`

Deployment condition:

- Treat as a config of Connection + Needs Matching + Knowledge Base, not a separate engine.

### RacketPro

Status: connection/growth config source

Mined as:

- coach profiles
- find coaches
- mental training journal
- imagery/self-talk
- achievements
- sports assessment/admin source

Mine first:

- coach profile setup
- find coaches
- mental training journal
- mental imagery
- self-talk
- achievements

Deployment condition:

- Treat as a sports/community config after the connection engine is canonical.

### Honestly

Status: merge source

Mined as:

- video recording
- participant portal
- case detail
- counselor notes
- analysis
- recordings tab

Mine first:

- `src/components/VideoRecorder.js`
- `src/components/RecordingsTab.js`
- `src/components/CounselorNotes.js`
- `src/pages/CreateCase.js`
- `src/pages/CaseDetail.js`
- `src/pages/Analysis.js`
- `src/pages/ParticipantPortal.js`

Deployment condition:

- Decide whether this is standalone or a benevolence/stewardship/care module inside ChurchConnect.

## Build Preflight Summary

| App / Source | Local Build Result | Launch Classification |
|---|---:|---|
| AppEngine / We Succeed | already live | live, vNext-ready |
| ChurchConnect | pass with bundle warnings | launch-gated |
| ChildFirst | pass | launch-gated |
| Iconium | pass | launch-gated |
| Easy Peasy frontend | pass | backend/env-gated |
| emergent/Snip.Show rich source | pass with React hook warnings | canonical-merge-gated |
| Snip.Show shell frontend | pass with React hook warnings | canonical-merge-gated |
| Toner deploy-facing app | pass | canonical-source-gated |
| Kindred Connections | mined, build not rerun in this pass | launch-pack-gated |
| Laser Engraving | mined from GitHub tree, build not rerun in this pass | launch-pack-gated |
| Ideas | mined from GitHub tree, build not rerun in this pass | boundary-gated |
| RebuildingDads / KND-google-ai | mined from GitHub tree, build not rerun in this pass | canonical-source-gated |

## Deployment Reality

No new production deployments should be claimed from this audit alone.

An app becomes deployable only when:

- canonical source is chosen
- AIPOS app docs are installed/fillable
- Launch Pack names provider, project, env vars, health check, rollback path, and owner review URL
- Supabase ecosystem placement is mapped
- build passes
- smoke test passes against the deployment target
- owner review and agent review are recorded

