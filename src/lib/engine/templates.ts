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
    id: "billing",
    name: "Billing + Plans",
    category: "Revenue",
    description: "Pricing tiers, subscription state, invoices, usage limits, and upgrade prompts.",
    triggers: ["saas", "subscription", "usage", "marketplace"],
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
    triggers: ["workflow", "service", "operations", "automation"],
    includes: ["Email", "In-app feed", "Preferences", "Failure alerts"]
  },
  {
    id: "marketplace",
    name: "Marketplace Core",
    category: "Commerce",
    description: "Supply/demand listings, matches, commissions, vendor profiles, and transaction records.",
    triggers: ["marketplace", "vendor", "supplier"],
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
