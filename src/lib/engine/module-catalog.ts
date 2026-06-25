// Module Catalog — the factory's reusable "Lego" build blocks.
//
// Companion to app_portfolio_registry (which catalogs whole APPS). This catalogs
// the reusable CAPABILITY modules that apps are composed from, so the factory
// reuses a block instead of rebuilding it in each app (the inventory's "build it
// once" rule). Distinct from life_core's data CONTRACTS (journey stage, feed) —
// those describe the ecosystem; these are the buildable capability blocks.
//
// Curated, not user-generated: this is the canonical Lego set. usedByApps slugs
// reference app_portfolio_registry entries.

export type ModuleCategory =
  | "foundation"
  | "connection"
  | "communication"
  | "intake"
  | "content"
  | "growth"
  | "operations"
  | "commerce"
  | "analytics";

export type ModuleStatus = "in_use" | "extractable" | "planned";

export type ModuleCatalogEntry = {
  slug: string;
  name: string;
  category: ModuleCategory;
  purpose: string;
  capabilities: string[];
  usedByApps: string[];
  // Where the strongest existing implementation lives — mine this first, never
  // rebuild from scratch (THE ONE RULE).
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

// The Lego set, derived from the canonical Ecosystem Inventory. Each block is
// reused by several apps; the keystone (identity) is reused by all.
const MODULES: ModuleCatalogEntry[] = [
  {
    slug: "identity-auth",
    name: "Identity & Auth",
    category: "foundation",
    purpose: "One login and one canonical person identity across the whole ecosystem.",
    capabilities: ["login", "accounts", "person identity", "roles", "sessions"],
    usedByApps: [
      "churchconnect",
      "spark-of-hope",
      "live-on-mission",
      "best-life",
      "kindred-connections",
      "kids-need-dads",
      "childfirst-solutions"
    ],
    primarySource: "shared ecosystem identity (person table) + Auth.js",
    status: "in_use"
  },
  {
    slug: "connection-engine",
    name: "Connection Engine (Kindred Connections)",
    category: "connection",
    purpose:
      "Assess and grow each person, then match on mindset/heartset for friendship and mutual growth — groups before pairs, friends before romance. The reusable engine behind community apps.",
    capabilities: ["matching", "belonging", "assessment", "growth pairing", "community groups", "mindset matching"],
    usedByApps: ["kindred-connections", "churchconnect", "kids-need-dads"],
    primarySource: "Kindred-Connection repo (mine its matching/assessment logic first)",
    status: "extractable"
  },
  {
    slug: "needs-helper-matching",
    name: "Needs ↔ Helper Matching",
    category: "connection",
    purpose: "Match a need with a helper (asymmetric). One engine behind every needs/service/marketplace feature.",
    capabilities: ["need matching", "helper matching", "service requests", "volunteer matching"],
    usedByApps: ["live-on-mission", "churchconnect"],
    primarySource: "ChurchConnect needs/gifts matching schema",
    status: "extractable"
  },
  {
    slug: "communication",
    name: "Communication",
    category: "communication",
    purpose: "The pipes — messaging, groups, notifications, email/SMS — shared by most apps.",
    capabilities: ["messaging", "notifications", "groups", "email", "sms", "broadcast"],
    usedByApps: ["churchconnect", "live-on-mission", "kindred-connections"],
    primarySource: "ChurchConnect broadcast/messaging",
    status: "extractable"
  },
  {
    slug: "events-scheduling",
    name: "Events & Scheduling",
    category: "operations",
    purpose: "Events, RSVPs, calendars, and booking.",
    capabilities: ["events", "rsvp", "calendar", "booking", "scheduling"],
    usedByApps: ["churchconnect", "live-on-mission"],
    primarySource: "ChurchConnect events",
    status: "extractable"
  },
  {
    slug: "intake",
    name: "Intake",
    category: "intake",
    purpose: "Guided problem → structured profile. Opportunity is intake for people; AppEngine is intake for builders.",
    capabilities: ["intake", "clarification", "structured capture", "problem framing"],
    usedByApps: ["churchconnect"],
    primarySource: "AppEngine problem_intake_gate + opportunity-intake (canonical)",
    status: "in_use"
  },
  {
    slug: "recommendation-navigator",
    name: "Recommendation / Navigator",
    category: "intake",
    purpose: "Suggest the next app, person, or resource for where someone is.",
    capabilities: ["recommendation", "routing", "next step", "navigator"],
    usedByApps: ["best-life"],
    primarySource: "AppEngine opportunity-solution-path router",
    status: "in_use"
  },
  {
    slug: "testimony-engine",
    name: "Testimony Engine",
    category: "content",
    purpose: "Capture, store, and surface real stories — and close the loop from solved problem back to testimony.",
    capabilities: ["testimony", "stories", "encouragement", "story review", "approval queue"],
    usedByApps: ["spark-of-hope"],
    primarySource: "Spark of Hope testimony intake",
    status: "extractable"
  },
  {
    slug: "mentorship-coaching",
    name: "Mentorship / Coaching",
    category: "growth",
    purpose: "Match mentors, run an AI coach, and provide guidance.",
    capabilities: ["mentorship", "coaching", "ai coach", "guidance"],
    usedByApps: ["spark-of-hope", "best-life", "kids-need-dads"],
    primarySource: "(planned — compose from Connection Engine + Communication)",
    status: "planned"
  },
  {
    slug: "growth-tracking",
    name: "Growth Tracking",
    category: "growth",
    purpose: "Habits, goals, skills, and progress over time.",
    capabilities: ["habits", "goals", "progress", "skills", "tracking"],
    usedByApps: ["best-life"],
    primarySource: "(planned)",
    status: "planned"
  },
  {
    slug: "crm-follow-up",
    name: "CRM / Follow-up",
    category: "operations",
    purpose: "Track people and automate follow-up so no one falls through the cracks.",
    capabilities: ["crm", "follow-up", "contact tracking", "pipeline", "reminders"],
    usedByApps: ["churchconnect", "toner-management"],
    primarySource: "ChurchConnect connection/follow-up tables",
    status: "extractable"
  },
  {
    slug: "payments-billing",
    name: "Payments / Billing",
    category: "commerce",
    purpose: "Donations, subscriptions, and invoicing.",
    capabilities: ["payments", "billing", "donations", "subscriptions", "invoicing", "stripe"],
    usedByApps: ["toner-management", "laser-engrave-market", "churchconnect"],
    primarySource: "ChurchConnect Stripe integration",
    status: "extractable"
  },
  {
    slug: "website-builder",
    name: "Website Builder",
    category: "operations",
    purpose: "Generate simple sites and landing pages fast.",
    capabilities: ["website builder", "landing pages", "site generation"],
    usedByApps: ["easy-peasy-website", "churchconnect", "milstead-us"],
    primarySource: "Website-friends / Easy Peasy repo",
    status: "extractable"
  },
  {
    slug: "analytics-hope-index",
    name: "Analytics / Hope Index",
    category: "analytics",
    purpose: "Measure hope, belonging, and engagement across the journey apps.",
    capabilities: ["analytics", "metrics", "hope index", "engagement", "dashboards"],
    usedByApps: ["spark-of-hope", "live-on-mission", "best-life"],
    primarySource: "(planned — cross-experience, on life_core's unified feed)",
    status: "planned"
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
