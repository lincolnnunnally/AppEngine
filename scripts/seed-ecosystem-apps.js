import fs from "node:fs";
import path from "node:path";

// Seeds known existing/planned ecosystem apps into app_portfolio_registry so
// prior_work_check can recommend reuse/extension before suggesting new work.
//
// Idempotent upsert by slug. Preserves any completed-loop evidence and createdAt
// on existing entries, and NEVER fabricates completed loops (planned apps stay
// planned). Statuses below are seed defaults Lincoln can correct against the
// canonical ecosystem map; they are not build claims (completedLoops is always
// left untouched).

const ECOSYSTEM_APPS = [
  {
    slug: "churchconnect",
    name: "ChurchConnect",
    status: "active_product",
    type: "ministry_tool",
    purpose: "Church first-time visitor follow-up, guest connection, and assimilation.",
    domain: "church / ministry",
    problemCategories: [
      "church visitor follow-up",
      "first-time visitors",
      "guest connection",
      "assimilation",
      "connection cards",
      "visitor registration"
    ]
  },
  {
    slug: "spark-of-hope",
    name: "Spark of Hope",
    status: "active_product",
    type: "ministry_tool",
    purpose: "Share testimonies and stories of hope and encouragement.",
    domain: "ministry / storytelling",
    problemCategories: ["testimony", "hope", "story sharing", "encouragement", "faith stories"]
  },
  {
    slug: "live-on-mission",
    name: "Live On Mission",
    status: "existing_app",
    type: "ministry_tool",
    purpose: "Mobilize people to serve, volunteer, and live on mission.",
    domain: "ministry / outreach",
    problemCategories: ["serve", "volunteer", "mission", "outreach", "service opportunities"]
  },
  {
    slug: "best-life",
    name: "Best Life",
    status: "planned_app",
    type: "ministry_tool",
    purpose: "Personal growth, discipleship, and healthy-habit formation.",
    domain: "discipleship / personal growth",
    problemCategories: ["discipleship", "habits", "personal growth", "spiritual formation"]
  },
  {
    slug: "united-under-god",
    name: "United Under God",
    status: "planned_app",
    type: "ministry_tool",
    purpose: "Unite believers in prayer, mission, and shared community.",
    domain: "ministry / community",
    problemCategories: ["unity", "prayer", "community", "collaboration"]
  },
  {
    slug: "milstead-us",
    name: "Milstead.us",
    status: "active_product",
    type: "ministry_tool",
    purpose: "Milstead personal/business web presence and property.",
    domain: "business / website",
    problemCategories: ["website", "business presence", "milstead", "landing page", "community"]
  },
  {
    slug: "toner-management",
    name: "Toner Management",
    status: "active_product",
    type: "business_tool",
    purpose: "Monitor printer toner levels and manage reorders.",
    domain: "business / operations",
    problemCategories: ["printer toner monitoring", "toner reorder", "printer supplies", "consumables tracking"]
  },
  {
    slug: "kids-need-dads",
    name: "Kids Need Dads",
    status: "planned_app",
    type: "ministry_tool",
    purpose: "Support fatherhood, mentoring, and father engagement.",
    domain: "ministry / family",
    problemCategories: ["fatherhood", "mentoring", "father engagement", "family support"]
  },
  {
    slug: "kindred-connections",
    name: "Kindred Connections",
    status: "existing_app",
    type: "ministry_tool",
    purpose:
      "Belonging + growth engine: assess and grow each person, then match on mindset/heartset for friendship and mutual growth. The reusable Connection engine behind community configs (e.g. RacketPro, JeepFix) and the people layer of ChurchConnect / Kids Need Dads — build configs on it, do not rebuild it.",
    domain: "ministry / belonging / matching",
    problemCategories: [
      "belonging",
      "connection",
      "loneliness",
      "matching people",
      "community",
      "mentorship",
      "mindset and heartset"
    ]
  },
  {
    slug: "childfirst-solutions",
    name: "ChildFirst Solutions",
    status: "existing_app",
    type: "ministry_tool",
    purpose: "Co-parenting support — parenting plans, neutral communication, documentation, and court prep.",
    domain: "family / co-parenting",
    problemCategories: ["co-parenting", "custody", "parenting plan", "child support", "family conflict"]
  },
  {
    slug: "iconium",
    name: "Iconium",
    status: "active_product",
    type: "business_tool",
    purpose: "AI icon, logo, and image generation.",
    domain: "creative / design",
    problemCategories: ["icon generation", "logo design", "image generation", "branding", "ai art"]
  },
  {
    slug: "easy-peasy-website",
    name: "Easy Peasy Website",
    status: "active_product",
    type: "business_tool",
    purpose: "All-in-one rapid website builder (easypeazy.site).",
    domain: "business / website",
    problemCategories: ["website builder", "landing page", "small business website", "web presence"]
  },
  {
    slug: "snip-show",
    name: "Snip.Show",
    status: "active_product",
    type: "business_tool",
    purpose: "Create and share short video clips.",
    domain: "creative / content",
    problemCategories: ["video clips", "clip sharing", "content creation", "highlights"]
  },
  {
    slug: "laser-engrave-market",
    name: "Laser Engrave Market",
    status: "active_product",
    type: "business_tool",
    purpose: "Laser-engraving marketplace for custom products.",
    domain: "business / marketplace",
    problemCategories: ["laser engraving", "custom products", "marketplace", "personalized gifts"]
  }
];

function stateRoot() {
  if (process.env.APPENGINE_STATE_ROOT) return process.env.APPENGINE_STATE_ROOT;
  return path.join(process.cwd(), ".app-engine", "state");
}

function registryPath() {
  return path.join(stateRoot(), "app_portfolio_registry", "registered-apps.json");
}

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(registryPath(), "utf8"));
    if (parsed && Array.isArray(parsed.entries)) return parsed;
  } catch {
    // absent or unreadable -> start from an empty registry
  }
  return { schemaVersion: 1, entries: [] };
}

function writeStore(store) {
  const file = registryPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(store, null, 2)}\n`);
}

const now = new Date().toISOString();
const store = readStore();
let added = 0;
let updated = 0;

for (const app of ECOSYSTEM_APPS) {
  const existing = store.entries.find((entry) => entry.slug === app.slug);
  if (existing) {
    // Upsert reuse metadata; PRESERVE completedLoops + createdAt. Never fabricate loops.
    existing.name = app.name;
    existing.type = app.type;
    existing.status = app.status;
    existing.purpose = app.purpose;
    existing.domain = app.domain;
    existing.problemCategories = app.problemCategories;
    existing.sourceOfTruthFiles = existing.sourceOfTruthFiles || [];
    if (!Array.isArray(existing.completedLoops)) existing.completedLoops = [];
    existing.updatedAt = now;
    updated += 1;
  } else {
    store.entries.unshift({
      slug: app.slug,
      name: app.name,
      type: app.type,
      status: app.status,
      purpose: app.purpose,
      domain: app.domain,
      problemCategories: app.problemCategories,
      sourceOfTruthFiles: [],
      completedLoops: [],
      createdAt: now,
      updatedAt: now
    });
    added += 1;
  }
}

writeStore(store);
console.log(`seed-ecosystem-apps: ${added} added, ${updated} updated -> ${registryPath()}`);
console.log(`registry now holds ${store.entries.length} app/project entries.`);
