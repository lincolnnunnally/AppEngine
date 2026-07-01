export type CoreTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  triggers: string[];
  includes: string[];
};

export const coreTemplates: CoreTemplate[] = [
  {
    id: "auth",
    name: "Authentication + Roles",
    category: "Foundation",
    description: "Customer sign-in, admin sign-in, protected routes, sessions, roles, and account recovery.",
    triggers: ["always"],
    includes: ["Sign in", "Sign up", "Admin role", "Customer role", "Session checks"]
  },
  {
    id: "customer-account",
    name: "Customer Account Portal",
    category: "Customer",
    description: "Customers manage profile, organization, plan, service usage, requests, and notifications.",
    triggers: ["customer", "portal", "saas", "service"],
    includes: ["Profile", "Organization", "Usage", "Requests", "Notifications"]
  },
  {
    id: "admin-console",
    name: "Admin Console",
    category: "Admin",
    description: "Administrators manage customers, projects, app runs, billing state, support, and audit logs.",
    triggers: ["always"],
    includes: ["Customers", "Projects", "Agent runs", "Billing", "Support", "Audit log"]
  },
  {
    id: "onboarding",
    name: "Guided Onboarding",
    category: "Growth",
    description: "First-run setup captures goals, company details, plan fit, and success criteria.",
    triggers: ["always"],
    includes: ["Welcome", "Company setup", "Goal capture", "Checklist"]
  },
  {
    id: "kindred-connection-core",
    name: "Purpose Connection App",
    category: "Connection",
    description: "Rebrandable Kindred-derived template for matching, belonging, pods, connection requests, and purpose-based discovery.",
    triggers: ["connection", "community", "dating", "friendship", "belonging", "match", "matching", "kindred", "lonely", "group", "pod"],
    includes: ["Purpose matching", "Relational posture", "Pods", "Connection requests", "Messaging"]
  },
  {
    id: "growth-dashboard",
    name: "Guided Growth Dashboard",
    category: "Growth",
    description: "Rebrandable Kindred-derived dashboard for journals, goals, check-ins, readiness, rituals, and progress scoring.",
    triggers: ["growth", "journal", "goals", "habit", "check-in", "readiness", "dashboard", "ritual", "best life"],
    includes: ["Becoming dashboard", "Journal", "Goals", "Readiness", "Ritual steps", "Alignment score"]
  },
  {
    id: "public-invite-loop",
    name: "Peer Invite Loop",
    category: "Growth",
    description: "User-owned invite flow with share messages, public landing pages, and signup attribution.",
    triggers: ["invite", "referral", "share", "friend", "viral", "growth loop", "bring a friend"],
    includes: ["Invite codes", "Share messages", "Public invite page", "Signup attribution"]
  },
  {
    id: "public-profile-sharing",
    name: "Public Profile + Share Card",
    category: "Web",
    description: "Public profile and rich-preview share-card template for people, organizations, products, testimonies, or creators.",
    triggers: ["profile", "public page", "share card", "og", "preview", "handle", "testimony", "creator"],
    includes: ["Public profile", "OG HTML", "Generated share image", "Share link"]
  },
  {
    id: "community-events-service",
    name: "Community Events + Service",
    category: "Operations",
    description: "Event, RSVP, service recommendation, imported-event, and attendance-verification template.",
    triggers: ["events", "event", "rsvp", "calendar", "service", "volunteer", "mission", "church connect", "webhook"],
    includes: ["Events", "RSVP", "Attendance", "Event curation", "Webhook import", "Service prescription"]
  },
  {
    id: "ai-coaching-covenants",
    name: "AI Coaching + Covenants",
    category: "AI",
    description: "Coaching loop that turns reflection into commitments, follow-up history, overdue signals, and pattern detection.",
    triggers: ["coach", "coaching", "mentor", "covenant", "follow-up", "accountability", "ai guidance"],
    includes: ["Coaching chat", "Covenants", "History", "Patterns", "Overdue follow-up"]
  },
  {
    id: "forgiveness-mediation",
    name: "Forgiveness / Mediation",
    category: "Care",
    description: "Relationship repair, reflection, letter drafting, and two-person mediation flow.",
    triggers: ["forgiveness", "mediation", "conflict", "repair", "co-parent", "coparent", "communication", "relationship"],
    includes: ["Forgiveness journey", "Letter drafting", "Mediation invite", "Partner reflection", "Connection reflection"]
  },
  {
    id: "admin-ops-moderation",
    name: "Admin Ops + Moderation Console",
    category: "Admin",
    description: "Owner console for users, reports, pods/events, operations, settings, AI usage, and audit logs.",
    triggers: ["admin", "moderation", "reports", "audit", "operations", "settings", "ai usage", "owner console"],
    includes: ["Dashboard", "Users", "Reports", "Operations", "Settings", "AI usage", "Audit log"]
  },
  {
    id: "church-organization-os",
    name: "Church / Organization Operating System",
    category: "Operations",
    description: "Rebrandable ChurchConnect and Association template for people, guests, events, communications, care, giving, admin, and multi-organization operations.",
    triggers: ["church","organization","nonprofit","association","members","guests","giving","events","communications"],
    includes: ["People","Guests","Events","Communications","Care","Giving","Admin","Association rollups"]
  },
  {
    id: "managed-website-domain-launch",
    name: "Managed Website + Domain Launch",
    category: "Web",
    description: "Rebrandable Easy Peasy template for website signup, domain search, client portal, admin portal, checkout, and provisioning.",
    triggers: ["website","domain","hosting","provision","client portal","business formation","easy peasy"],
    includes: ["Signup","Domain search","Client portal","Admin portal","Checkout","Provisioning"]
  },
  {
    id: "toner-fleet-auto-ordering",
    name: "Toner Fleet + Auto Ordering",
    category: "Operations",
    description: "Rebrandable toner platform template for printer inventory, fleet monitoring, auto ordering, supplier pricing, billing, and admin operations.",
    triggers: ["toner","printer","fleet","monitoring","supplier","auto order","inventory"],
    includes: ["Printers","Network monitor","Ordering","Supplier pricing","Customer portal","Admin portal"]
  },
  {
    id: "creator-clip-publishing",
    name: "Creator Clip + Publishing Platform",
    category: "Media",
    description: "Rebrandable Snip.Show template for upload, clipping, remixing, scheduling, publishing, analytics, and creator growth.",
    triggers: ["video","clip","creator","publishing","scheduler","snip","remix","content"],
    includes: ["Upload","Clip library","Timeline editor","AI remix","Scheduler","Analytics","Growth dashboard"]
  },
  {
    id: "product-marketplace-proof-approval",
    name: "Product Marketplace + Proof Approval",
    category: "Commerce",
    description: "Rebrandable Laser Engraving template for product catalogs, makers, custom design, proof approval, checkout, and fulfillment.",
    triggers: ["marketplace","maker","product","engraving","proof","design","checkout","fulfillment"],
    includes: ["Product catalog","Design canvas","Proof approval","Maker dashboard","Order allocation","Checkout"]
  },
  {
    id: "coparenting-case-coordination",
    name: "Co-parenting Case Coordination",
    category: "Care",
    description: "Rebrandable ChildFirst template for schedule changes, documents, communication support, court-ready summaries, agreements, and resolution workflows.",
    triggers: ["coparent","co-parent","custody","case","schedule","court","resolution","agreement"],
    includes: ["Schedule changes","Document center","Communication assistant","Court summaries","Resolution workflows","Agreements"]
  },
  {
    id: "idea-capture-content-forge",
    name: "Idea Capture + Content Forge",
    category: "Intake",
    description: "Rebrandable Ideas template for voice, OCR, meeting recording, transcription, quick notes, forge, polish, and library organization.",
    triggers: ["idea","voice","ocr","transcribe","meeting","forge","polish","capture"],
    includes: ["Voice capture","OCR","Meeting recorder","Transcription","Forge","Polish","Library"]
  },
  {
    id: "brand-kit-logo-generator",
    name: "Brand Kit + Logo Generator",
    category: "Design",
    description: "Rebrandable Iconium template for brand prompts, logo concepts, SVG previews, editor controls, palettes, and exports.",
    triggers: ["logo","brand","icon","svg","palette","identity","iconium"],
    includes: ["Brand prompt","Concept cards","Logo preview","SVG export","Palette","Editor controls"]
  },
  {
    id: "mutual-aid-recovery-community",
    name: "Mutual Aid + Recovery Community",
    category: "Care",
    description: "Rebrandable RebuildingDads/KND template for mutual aid, support matching, court documentation, recovery progress, group chat, and resources.",
    triggers: ["recovery","mutual aid","support","dads","resource hub","group chat","partner matching"],
    includes: ["Aid applications","Support matching","Court documentation","Progress chart","Group chat","Resources"]
  },
  {
    id: "troubleshooting-knowledge-marketplace",
    name: "Troubleshooting Knowledge Marketplace",
    category: "Content",
    description: "Rebrandable JeepFix template for problem cards, troubleshooting, solution guides, parts/resources, ratings, rewards, and reputation.",
    triggers: ["troubleshooting","problem","solution","parts","knowledge base","reviews","leaderboard"],
    includes: ["Problem cards","Wizard","Solution guides","Parts marketplace","Ratings","Rewards"]
  },
  {
    id: "coach-training-growth-community",
    name: "Coach / Training Growth Community",
    category: "Growth",
    description: "Rebrandable RacketPro template for coach profiles, coach discovery, training journals, mental practice, assessments, and achievements.",
    triggers: ["coach","training","sports","journal","assessment","achievement","racket"],
    includes: ["Coach profiles","Find coaches","Training journal","Mental practice","Assessments","Achievements"]
  },
  {
    id: "media-case-evidence",
    name: "Media Case Evidence",
    category: "Media",
    description: "Rebrandable Honestly template for video recording, case creation, participant portal, counselor notes, recordings, and analysis.",
    triggers: ["recording","evidence","case","participant","video","analysis","counselor"],
    includes: ["Video recorder","Case detail","Participant portal","Counselor notes","Recordings","Analysis"]
  },
  {
    id: "billing",
    name: "Billing + Plans",
    category: "Revenue",
    description: "Pricing tiers, subscription state, invoices, usage limits, and upgrade prompts.",
    // Foundational Build Packet v1: payments/billing ship as a standard, always-on
    // module (real Stripe checkout, feature-flagged off-able). See foundation-modules.ts.
    triggers: ["always"],
    includes: ["Plans", "Subscription", "Invoices", "Usage limits"]
  },
  {
    id: "dashboard",
    name: "Operational Dashboard",
    category: "Product",
    description: "Work surface for status, tasks, alerts, key metrics, and next best actions.",
    triggers: ["always"],
    includes: ["Metrics", "Status", "Tasks", "Alerts", "Activity"]
  },
  {
    id: "notifications",
    name: "Notifications",
    category: "Retention",
    description: "Email and in-app messages for account events, workflow updates, failures, and opportunities.",
    // Foundational Build Packet v1: email is a standard, always-on module (Resend).
    triggers: ["always"],
    includes: ["Email", "In-app feed", "Preferences", "Failure alerts"]
  },
  {
    id: "marketplace",
    name: "Marketplace Core",
    category: "Commerce",
    description: "Supply/demand listings, matches, commissions, vendor profiles, and transaction records.",
    // Foundational Build Packet v1: the product catalog / commerce surface is standard
    // and always-on (real storefront + checkout), feature-flagged off-able.
    triggers: ["always"],
    includes: ["Listings", "Vendors", "Matches", "Commissions", "Transactions"]
  },
  {
    id: "ai-runs",
    name: "AI Run History",
    category: "AI",
    description: "Traceable AI requests, prompts, outputs, cost, artifacts, and retry history.",
    triggers: ["ai", "agent", "generate", "automation"],
    includes: ["Prompts", "Outputs", "Artifacts", "Costs", "Retries"]
  }
];

export function selectTemplates(input: string) {
  const text = input.toLowerCase();
  return coreTemplates.filter((template) => {
    if (template.triggers.includes("always")) return true;
    return template.triggers.some((trigger) => text.includes(trigger));
  });
}
