// Module Catalog — the factory's reusable "Lego" build blocks.
//
// Companion to app_portfolio_registry (which catalogs whole APPS). This catalogs
// the reusable CAPABILITY modules that apps are composed from, so the factory
// reuses a block instead of rebuilding it in each app (the inventory's "build it
// once" rule). Distinct from life_core's data CONTRACTS (journey stage, feed).
//
// SEEDED FROM REAL CODE: primarySource points at the strongest existing
// implementation already built in a repo (mostly ChurchConnect, the most
// complete ecosystem app) — mine that first, never rebuild from scratch
// (THE ONE RULE). usedByApps slugs reference app_portfolio_registry entries.

export type ModuleCategory =
  | "foundation"
  | "connection"
  | "communication"
  | "intake"
  | "content"
  | "media"
  | "growth"
  | "care"
  | "operations"
  | "commerce"
  | "safety"
  | "web"
  | "design"
  | "ai"
  | "analytics";

export type ModuleStatus = "in_use" | "extractable" | "planned";

export type ModuleCatalogEntry = {
  slug: string;
  name: string;
  category: ModuleCategory;
  purpose: string;
  capabilities: string[];
  usedByApps: string[];
  // Where the strongest existing implementation lives — mine this first.
  primarySource: string;
  status: ModuleStatus;
};

export type ModuleCatalog = {
  kind: "module_catalog";
  schemaVersion: 1;
  modules: ModuleCatalogEntry[];
  guardrails: {
    reuseNeverRebuild: true;
    oneHomePerModule: true;
    customerDataStaysIsolated: true;
    noProviderNamesToUsers: true;
  };
};

// The Lego set, mined from the real repos (ChurchConnect unless noted).
const MODULES: ModuleCatalogEntry[] = [
  {
    slug: "identity-auth",
    name: "Identity & Auth",
    category: "foundation",
    purpose: "One login and one canonical person identity across the ecosystem, including phone/OTP and OAuth.",
    capabilities: ["login", "accounts", "person identity", "roles", "sessions", "phone otp", "oauth", "password reset"],
    usedByApps: ["churchconnect", "spark-of-hope", "live-on-mission", "best-life", "kindred-connections", "kids-need-dads", "childfirst-solutions"],
    primarySource: "ChurchConnect backend/routes/auth_phone.py + auth_custom.py + oauth.py + src/components/PasswordReset.tsx",
    status: "extractable"
  },
  {
    slug: "connection-engine",
    name: "Connection Engine (assess + match)",
    category: "connection",
    purpose:
      "Assess and grow each person, then match on mindset/heartset for friendship and mutual growth — groups (pods) before pairs. The reusable belonging engine behind community apps.",
    capabilities: ["matching", "belonging", "assessment", "loneliness prescription", "relational posture", "pods / groups", "coaching", "growth pairing"],
    usedByApps: ["kindred-connections", "churchconnect", "kids-need-dads"],
    primarySource: "Kindred-Connection (GitHub) backend/routers/soul_match.py + relational_posture.py + loneliness_prescription.py + pods.py — the canonical engine; ChurchConnect purpose_matching.py is a second impl",
    status: "extractable"
  },
  {
    slug: "needs-helper-matching",
    name: "Needs ↔ Helper Matching",
    category: "connection",
    purpose: "Match a need with a helper (asymmetric) — one engine behind every needs/service/outreach feature.",
    capabilities: ["need matching", "helper matching", "service requests", "outreach", "pay it forward"],
    usedByApps: ["live-on-mission", "churchconnect"],
    primarySource: "ChurchConnect backend/routes/church_outreach.py + care.py + pay_it_forward.py",
    status: "extractable"
  },
  {
    slug: "communication",
    name: "Communication",
    category: "communication",
    purpose: "The pipes — messaging, SMS, email, broadcasts, notifications — shared by most apps.",
    capabilities: ["messaging", "sms", "email", "broadcast", "notifications", "campaigns", "recipient targeting"],
    usedByApps: ["churchconnect", "live-on-mission", "kindred-connections"],
    primarySource: "ChurchConnect src/components/BroadcastHub.tsx + backend/routes/broadcasting.py + church_sms.py + email_service.py",
    status: "extractable"
  },
  {
    slug: "directory-community",
    name: "Directory & Community",
    category: "communication",
    purpose: "Member directories, public community portals, and discovery.",
    capabilities: ["directory", "community portal", "discovery", "public profiles", "rosters"],
    usedByApps: ["churchconnect", "milstead-us"],
    primarySource: "ChurchConnect src/components/ChurchDirectory.tsx + CommunityPortal.tsx + ChurchDiscovery.tsx",
    status: "extractable"
  },
  {
    slug: "events-scheduling",
    name: "Events & Scheduling",
    category: "operations",
    purpose: "Events, RSVPs, calendars, booking, and facilities.",
    capabilities: ["events", "rsvp", "calendar", "booking", "scheduling", "facilities"],
    usedByApps: ["churchconnect", "live-on-mission"],
    primarySource: "ChurchConnect backend/routes/events.py + event_management.py + facilities.py",
    status: "extractable"
  },
  {
    slug: "checkin",
    name: "Check-in & Staffing",
    category: "operations",
    purpose: "Secure check-in and staffing for events, kids, and services.",
    capabilities: ["check-in", "childcare check-in", "staffing", "attendance"],
    usedByApps: ["churchconnect"],
    primarySource: "ChurchConnect backend/routes/checkin.py + childcare_staffing.py",
    status: "extractable"
  },
  {
    slug: "intake",
    name: "Intake",
    category: "intake",
    purpose: "Guided problem → structured profile. Opportunity is intake for people; AppEngine is intake for builders.",
    capabilities: ["intake", "clarification", "structured capture", "problem framing"],
    usedByApps: ["churchconnect"],
    primarySource: "AppEngine problem_intake_gate + opportunity-intake (canonical, in this repo)",
    status: "in_use"
  },
  {
    slug: "recommendation-navigator",
    name: "Recommendation / Navigator",
    category: "intake",
    purpose: "Suggest the next app, person, or resource for where someone is.",
    capabilities: ["recommendation", "routing", "next step", "navigator"],
    usedByApps: ["best-life"],
    primarySource: "AppEngine opportunity-solution-path router + ChurchConnect purpose_discovery.py",
    status: "in_use"
  },
  {
    slug: "testimony-engine",
    name: "Testimony Engine",
    category: "content",
    purpose: "Capture, store, surface, and review real stories — and close the loop from solved problem back to testimony.",
    capabilities: ["testimony", "stories", "encouragement", "review queue", "approval"],
    usedByApps: ["spark-of-hope", "churchconnect"],
    primarySource: "ChurchConnect backend/routes/testimonies.py + Spark of Hope testimony intake",
    status: "extractable"
  },
  {
    slug: "scripture-sermon-tools",
    name: "Scripture & Sermon Tools",
    category: "content",
    purpose: "Scripture library/search and AI-assisted sermon prep, research, and suggestions.",
    capabilities: ["scripture library", "scripture search", "sermon prep", "sermon research", "reading"],
    usedByApps: ["churchconnect"],
    primarySource: "ChurchConnect backend/routes/scripture_library.py + scripture_ai.py + sermon_prep.py + src/components/ScriptureLibrary.tsx",
    status: "extractable"
  },
  {
    slug: "discipleship-content",
    name: "Discipleship & Content",
    category: "content",
    purpose: "Reading plans, devotionals, daily motivation, and challenges that move people forward.",
    capabilities: ["reading plans", "devotionals", "daily motivation", "challenges", "discipleship"],
    usedByApps: ["churchconnect", "best-life", "spark-of-hope"],
    primarySource: "ChurchConnect backend/routes/reading_plans.py + devotionals.py + discipleship_routes.py + challenges.py",
    status: "extractable"
  },
  {
    slug: "live-service-streaming",
    name: "Live Service & Streaming",
    category: "media",
    purpose: "Live worship/service control, streaming, recording, and service planning.",
    capabilities: ["live streaming", "service control", "worship planning", "recording", "presentation"],
    usedByApps: ["churchconnect"],
    primarySource: "ChurchConnect src/components/LiveStreamManager.tsx + ServiceController.tsx + WorshipServicePlanner.tsx + backend/routes/streaming.py",
    status: "extractable"
  },
  {
    slug: "care-counseling",
    name: "Care & Counseling",
    category: "care",
    purpose: "Care requests, counseling, and encouragement loops so no one in crisis is missed.",
    capabilities: ["care requests", "counseling", "encouragement", "follow-up care"],
    usedByApps: ["churchconnect", "kids-need-dads"],
    primarySource: "ChurchConnect backend/routes/care.py + counselor.py + encouragement_loop.py",
    status: "extractable"
  },
  {
    slug: "mentorship-coaching",
    name: "Mentorship / Coaching",
    category: "growth",
    purpose: "Match mentors, run guidance/coaching, and pair people for growth.",
    capabilities: ["mentorship", "coaching", "guidance", "pairing"],
    usedByApps: ["spark-of-hope", "best-life", "kids-need-dads"],
    primarySource: "Kindred-Connection (GitHub) backend/routers/coaching.py + ChurchConnect backend/routes/counselor.py",
    status: "extractable"
  },
  {
    slug: "growth-tracking",
    name: "Growth Tracking",
    category: "growth",
    purpose: "Habits, goals, reading progress, skills, and milestones over time.",
    capabilities: ["habits", "goals", "progress", "skills", "tracking", "milestones"],
    usedByApps: ["best-life", "churchconnect"],
    primarySource: "ChurchConnect backend/routes/reading_plans.py + challenges.py (progress tracking)",
    status: "extractable"
  },
  {
    slug: "crm-follow-up",
    name: "CRM / Follow-up",
    category: "operations",
    purpose: "Track people and automate follow-up so no one falls through the cracks (guests, members, leads).",
    capabilities: ["crm", "follow-up", "guest management", "people records", "pipeline", "reminders"],
    usedByApps: ["churchconnect", "toner-management"],
    primarySource: "ChurchConnect backend/routes/church_crm.py + people.py + src/components/ConnectionInbox.tsx + GuestManagement.tsx",
    status: "extractable"
  },
  {
    slug: "volunteer-safety",
    name: "Volunteer & Safety",
    category: "safety",
    purpose: "Volunteer scheduling plus background checks and waivers for safe service.",
    capabilities: ["volunteer scheduling", "background checks", "waivers", "compliance", "availability"],
    usedByApps: ["churchconnect", "live-on-mission"],
    primarySource: "ChurchConnect backend/routes/volunteer_force.py + background_checks.py + src/components/VolunteerAvailability.tsx + WaiverManagement.tsx",
    status: "extractable"
  },
  {
    slug: "payments-billing",
    name: "Payments, Billing & Giving",
    category: "commerce",
    purpose: "Donations, online giving, subscriptions, and invoicing.",
    capabilities: ["payments", "online giving", "donations", "billing", "subscriptions", "invoicing", "stripe"],
    usedByApps: ["churchconnect", "toner-management", "laser-engrave-market"],
    primarySource: "ChurchConnect backend/routes/stripe_payments.py + stripe_billing.py + universal_giving.py + src/components/OnlineGiving.tsx",
    status: "extractable"
  },
  {
    slug: "website-builder",
    name: "Website Builder",
    category: "web",
    purpose: "Generate simple sites and branded landing pages fast.",
    capabilities: ["website builder", "landing pages", "site generation", "branded pages"],
    usedByApps: ["easy-peasy-website", "churchconnect", "milstead-us"],
    primarySource: "Website-friends (GitHub, Easy Peasy) src/components/WebsitesAndDomains.tsx + LandingPage.tsx + ChurchConnect src/components/WebsiteSetupWizard.tsx",
    status: "extractable"
  },
  {
    slug: "domains-publishing",
    name: "Domains & Publishing",
    category: "web",
    purpose: "Register domains and publish/hand off generated sites (incl. WordPress).",
    capabilities: ["domain registration", "publishing", "site handoff", "wordpress"],
    usedByApps: ["easy-peasy-website", "churchconnect"],
    primarySource: "Website-friends (GitHub) src/components/admin/DomainSearchModal.tsx + client/Web3Domains.tsx + ChurchConnect backend/routes/spaceship_domains.py + website_handoff.py",
    status: "extractable"
  },
  {
    slug: "branding-design",
    name: "Branding & Design",
    category: "design",
    purpose: "In-app design editing, templates, branding settings, and logo/icon generation.",
    capabilities: ["design editor", "templates", "branding", "logo generation", "icons"],
    usedByApps: ["churchconnect", "iconium"],
    primarySource: "ChurchConnect src/components/CanvaDesignHub.tsx + InAppDesignEditor.tsx + ChurchBrandingSettings.tsx (Iconium is an early ~11KB stub, not a source yet)",
    status: "extractable"
  },
  {
    slug: "ai-assist",
    name: "AI Assist",
    category: "ai",
    purpose: "AI services for content generation, scripture/sermon help, and media analysis.",
    capabilities: ["ai content", "ai scripture", "video analysis", "summarization", "suggestions"],
    usedByApps: ["churchconnect", "iconium"],
    primarySource: "ChurchConnect backend/routes/ai_services.py + scripture_ai.py + church_video_analyzer.py",
    status: "extractable"
  },
  {
    slug: "analytics-hope-index",
    name: "Analytics / Hope Index",
    category: "analytics",
    purpose: "Reporting, engagement metrics, surveys, and a cross-app hope/belonging index.",
    capabilities: ["analytics", "reporting", "surveys", "user analytics", "hope index", "dashboards"],
    usedByApps: ["churchconnect", "spark-of-hope", "best-life"],
    primarySource: "ChurchConnect backend/routes/reporting.py + user_analytics.py + src/components/SurveyAnalytics.tsx",
    status: "extractable"
  },
  {
    slug: "idea-capture-forge",
    name: "Idea Capture & Content Forge",
    category: "intake",
    purpose: "Capture an idea by voice, photo, OCR, or text, then forge/polish it into an article, post, app, or video. AppEngine's idea front door.",
    capabilities: ["voice capture", "photo/ocr capture", "transcription", "idea forge", "content polish", "quick note"],
    usedByApps: ["churchconnect", "spark-of-hope"],
    primarySource: "ideas (GitHub) src/components/VoiceRecorderModal.jsx + OcrCard.jsx + TranscribeCard.jsx + ForgeModal.jsx + PolishModal.jsx + forge.js",
    status: "extractable"
  },
  {
    slug: "marketplace-orders",
    name: "Marketplace & Orders",
    category: "commerce",
    purpose: "Product catalog, ordering, checkout, vendor/maker management, and parts marketplace.",
    capabilities: ["product catalog", "orders", "checkout", "vendor management", "inventory", "coupons", "marketplace"],
    usedByApps: ["laser-engrave-market"],
    primarySource: "LaserEngraving (GitHub) src/components/ProductCatalogEnhanced.tsx + OrderAllocation.tsx + CheckoutForm.tsx + MakerManagement.tsx + JeepFix PartsMarketplacePage.tsx",
    status: "extractable"
  },
  {
    slug: "design-studio",
    name: "Design Studio & File Upload",
    category: "design",
    purpose: "Custom design canvas, asset upload, fonts, mockup generation, and proof preview.",
    capabilities: ["design canvas", "file upload", "asset catalog", "mockup generation", "fonts", "proof preview"],
    usedByApps: ["laser-engrave-market", "iconium"],
    primarySource: "LaserEngraving (GitHub) src/components/CustomizationCanvas.tsx + DesignAssetUpload.tsx + FileUpload.tsx + MakerMockupGenerator.tsx + GoogleFontPicker.tsx",
    status: "extractable"
  },
  {
    slug: "case-management",
    name: "Case Management & Documentation",
    category: "operations",
    purpose: "Case timelines, document parsing, court-ready summaries, and agreement/attendance/exchange tracking.",
    capabilities: ["case timeline", "document center", "document parsing", "court-ready summary", "agreement tracking", "attendance tracking"],
    usedByApps: ["childfirst-solutions", "kids-need-dads"],
    primarySource: "childfirst-solutions (GitHub) src/components/CaseTimeline.tsx + DocumentCenter.tsx + CourtReadySummaryCard.tsx + AgreementTrackerCard.tsx + RebuildingDads CourtDocumentation.tsx",
    status: "extractable"
  },
  {
    slug: "mediated-communication",
    name: "Mediated Communication",
    category: "communication",
    purpose: "AI-assisted neutral, conflict-reducing communication with exchange notes and conflict tracking.",
    capabilities: ["neutral messaging", "conflict reduction", "communication insights", "exchange notes", "ai tone assist"],
    usedByApps: ["childfirst-solutions", "kids-need-dads"],
    primarySource: "childfirst-solutions (GitHub) src/components/CommunicationAssistant.tsx + ConflictReductionCard.tsx + CommunicationInsightsCard.tsx + ExchangeNotesCard.tsx",
    status: "extractable"
  },
  {
    slug: "knowledge-base",
    name: "Knowledge Base & Troubleshooting",
    category: "content",
    purpose: "Community Q&A, troubleshooting wizards, and solution guides with parts/resources.",
    capabilities: ["q&a", "troubleshooting wizard", "solution guides", "categories", "how-to"],
    usedByApps: ["churchconnect"],
    primarySource: "JeepFix (GitHub) src/components/TroubleshootingWizard.tsx + ProblemDetailPage.tsx + SolutionPartsList.tsx + CategoryPage.tsx",
    status: "extractable"
  },
  {
    slug: "mutual-aid-benevolence",
    name: "Mutual Aid & Benevolence",
    category: "care",
    purpose: "Community aid funds, aid applications, benevolence cases, and stewardship.",
    capabilities: ["aid applications", "benevolence fund", "benevolence cases", "stewardship", "financial assistance"],
    usedByApps: ["churchconnect", "kids-need-dads", "live-on-mission"],
    primarySource: "RebuildingDads (GitHub) src/components/MutualAidApplication.tsx + BrotherhoodFundSettings.tsx + honestly src/components/CreateCase.js + CaseDetail.js",
    status: "extractable"
  },
  {
    slug: "achievements-gamification",
    name: "Achievements & Gamification",
    category: "growth",
    purpose: "Badges, achievements, streaks, rewards, and leaderboards that reinforce momentum.",
    capabilities: ["badges", "achievements", "streaks", "rewards", "leaderboards"],
    usedByApps: ["best-life", "live-on-mission", "kids-need-dads"],
    primarySource: "RebuildingDads (GitHub) src/components/AchievementsBadge.tsx + JeepFix RewardsPage.tsx + LeaderboardPage.tsx + Kindred-Connection backend/routers/streak.py",
    status: "extractable"
  },
  {
    slug: "ratings-reviews",
    name: "Ratings & Reviews",
    category: "operations",
    purpose: "Ratings, reviews, and reputation for makers, content, and churches.",
    capabilities: ["ratings", "reviews", "reputation", "feedback"],
    usedByApps: ["laser-engrave-market", "churchconnect"],
    primarySource: "JeepFix (GitHub) src/components/RatingModal.tsx + LaserEngraving MakerReview.tsx + ChurchConnect backend/routes/church_reviews.py",
    status: "extractable"
  },
  {
    slug: "finance-accounting",
    name: "Finance & Accounting",
    category: "commerce",
    purpose: "Budgets, expense tracking, and giving/financial reports for an organization.",
    capabilities: ["budgets", "expense tracking", "giving reports", "financial reporting", "accounting"],
    usedByApps: ["churchconnect"],
    primarySource: "Association (GitHub) src/components/BudgetOverview.tsx + ExpenseTracking.tsx + GivingReports.tsx + Finances.tsx",
    status: "extractable"
  },
  {
    slug: "multi-org-association",
    name: "Multi-Org / Association",
    category: "operations",
    purpose: "Manage many organizations (e.g. churches) under one association, with profiles and rollups.",
    capabilities: ["multi-org", "association management", "org profiles", "rollups", "tiered access"],
    usedByApps: ["churchconnect"],
    primarySource: "Association (GitHub) src/components/AssociationManagement.tsx + ChurchManagement.tsx + ChurchProfileFields.tsx",
    status: "extractable"
  },
  {
    slug: "media-recording",
    name: "Media Recording & Clips",
    category: "media",
    purpose: "Record video/audio, capture quick recordings, and produce shareable clips.",
    capabilities: ["video recording", "audio recording", "quick record", "clips", "recordings library"],
    usedByApps: ["churchconnect", "spark-of-hope"],
    primarySource: "honestly (GitHub) src/components/VideoRecorder.js + QuickRecord.js + RecordingsTab.js + Snip.Show (clips)",
    status: "extractable"
  }
];

export function loadModuleCatalog(): ModuleCatalog {
  return {
    kind: "module_catalog",
    schemaVersion: 1,
    modules: MODULES.map((module) => ({ ...module, capabilities: [...module.capabilities], usedByApps: [...module.usedByApps] })),
    guardrails: {
      reuseNeverRebuild: true,
      oneHomePerModule: true,
      customerDataStaysIsolated: true,
      noProviderNamesToUsers: true
    }
  };
}

export type ModuleMatch = {
  module: ModuleCatalogEntry;
  score: number;
  matchedOn: string[];
};

// Find reusable blocks for a described need, so a build reuses them instead of
// rebuilding. Matches the need's words against each module's name/capabilities/
// category/purpose. Returns highest-scoring first.
export function findModulesForNeed(need: string, catalog: ModuleCatalog = loadModuleCatalog()): ModuleMatch[] {
  const tokens = tokenize(need);
  if (!tokens.length) return [];

  const matches: ModuleMatch[] = [];
  for (const module of catalog.modules) {
    const haystack = [module.name, module.purpose, module.category, ...module.capabilities].join(" ").toLowerCase();
    const matchedOn: string[] = [];
    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) {
        score += module.capabilities.some((capability) => capability.toLowerCase().includes(token)) ? 2 : 1;
        matchedOn.push(token);
      }
    }
    if (score > 0) {
      matches.push({ module, score, matchedOn });
    }
  }
  return matches.sort((a, b) => b.score - a.score);
}

function tokenize(value: string): string[] {
  const stop = new Set(["the", "a", "an", "and", "or", "for", "to", "of", "with", "need", "want", "help", "people", "app"]);
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 2 && !stop.has(token))
    )
  );
}
