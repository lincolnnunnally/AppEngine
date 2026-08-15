// App operations catalog — the business map on top of the portfolio registry.
// Does NOT invent apps. Every slug here already lives in
// ecosystem-portfolio-registry.json. Admin doors are recorded only when the
// path exists in that app's code (never a guessed /admin that 404s). Families
// exist so Lincoln can run Toner as one platform and keep per-app dashboards
// for staff or a future sale. SERVER-SAFE (no secrets).

export type AppFamilyId =
  | "factory"
  | "toner"
  | "church"
  | "belonging"
  | "family"
  | "transformation"
  | "commerce"
  | "parked";

export type AppOpsCatalogEntry = {
  slug: string;
  family: AppFamilyId;
  purpose: string;
  // Path on the app's own host, or an absolute URL when the door is not the
  // serving origin (e.g. Toner family admin lives at toner.management/admin).
  adminPath?: string;
  adminUrl?: string;
  adminNote?: string;
};

export const APP_FAMILIES: Record<AppFamilyId, { label: string; blurb: string }> = {
  factory: {
    label: "Factory",
    blurb: "App Engine — the builder, not a public product."
  },
  toner: {
    label: "Toner family",
    blurb: "One platform, several front doors. Manage it here; the per-brand admin goes with the product if you hire staff or sell a door."
  },
  church: {
    label: "Church & ministry",
    blurb: "ChurchConnect and the ministry surfaces that activate people to serve."
  },
  belonging: {
    label: "Belonging & community",
    blurb: "Friendship, romance, and neighborhood — people finding people."
  },
  family: {
    label: "Family support",
    blurb: "Kids Need Dads and ChildFirst — fathers, children, and repair."
  },
  transformation: {
    label: "Hope & growth",
    blurb: "Hope, purpose, and the next faithful step."
  },
  commerce: {
    label: "Practical services",
    blurb: "Websites, laser, ideas, and the other working tools."
  },
  parked: {
    label: "Parked / historical",
    blurb: "Superseded or parked entries kept so the record stays honest."
  }
};

const CATALOG: Record<string, AppOpsCatalogEntry> = {
  appengine: {
    slug: "appengine",
    family: "factory",
    purpose: "The factory that builds and now runs the portfolio.",
    adminPath: "/admin"
  },
  churchconnect: {
    slug: "churchconnect",
    family: "church",
    purpose: "Church operating platform — enter once, handled everywhere.",
    adminPath: "/admin",
    adminNote: "ChurchConnect super admin. Staff can run the church world from here; this deck only shows the glance."
  },
  "churchconnect-bridge": {
    slug: "churchconnect-bridge",
    family: "church",
    purpose: "Bridge slice — do not treat as a second ChurchConnect."
  },
  "milstead-church": {
    slug: "milstead-church",
    family: "church",
    purpose: "Milstead Baptist Church — a ChurchConnect tenant, not the community app."
  },
  "live-on-mission": {
    slug: "live-on-mission",
    family: "church",
    purpose: "Practical service — hope put into action.",
    adminPath: "/admin-ops"
  },
  "united-under-god": {
    slug: "united-under-god",
    family: "church",
    purpose: "The head of the movement — the why, not a product hub."
  },
  "toner-management": {
    slug: "toner-management",
    family: "toner",
    purpose: "The complete managed toner system.",
    adminUrl: "https://toner.management/admin",
    adminNote: "Toner Central admin — one ops plane for every toner front door."
  },
  "toner-connect": {
    slug: "toner-connect",
    family: "toner",
    purpose: "Same toner platform, Toner Connect brand.",
    adminUrl: "https://toner.management/admin",
    adminNote: "Same Toner Central admin as toner.management — one platform."
  },
  "printer-protector-monitoring": {
    slug: "printer-protector-monitoring",
    family: "toner",
    purpose: "Printer Protector agent — monitoring, not a separate business.",
    adminUrl: "https://toner.management/admin"
  },
  "kindred-connections": {
    slug: "kindred-connections",
    family: "belonging",
    purpose: "Friendship-first belonging. Not dating.",
    adminPath: "/admin"
  },
  "aligned-souls": {
    slug: "aligned-souls",
    family: "belonging",
    purpose: "Soul-level matching. Separate from Kindred. Pause-dating is the win.",
    adminPath: "/app/admin"
  },
  neighborly: {
    slug: "neighborly",
    family: "belonging",
    purpose: "Canonical Community Connections — Milstead first."
  },
  milstead: {
    slug: "milstead",
    family: "belonging",
    purpose: "Milstead community app (milstead.us) — not milstead.church."
  },
  "community-connections": {
    slug: "community-connections",
    family: "parked",
    purpose: "Parked prototype. Neighborly is the live implementation."
  },
  "kindred-dating": {
    slug: "kindred-dating",
    family: "parked",
    purpose: "Historical placeholder. Shipped as Aligned Souls."
  },
  "kids-need-dads": {
    slug: "kids-need-dads",
    family: "family",
    purpose: "Support for fathers rebuilding with their children.",
    adminNote: "Admin is inside the signed-in app for staff — there is no separate /admin URL."
  },
  "childfirst-solutions": {
    slug: "childfirst-solutions",
    family: "family",
    purpose: "Child-focused decisions when families are in conflict."
  },
  "spark-of-hope": {
    slug: "spark-of-hope",
    family: "transformation",
    purpose: "Real testimony for people ready to give up."
  },
  opportunity: {
    slug: "opportunity",
    family: "transformation",
    purpose: "Problems become next steps."
  },
  "best-life": {
    slug: "best-life",
    family: "transformation",
    purpose: "Growth past survival."
  },
  honestly: {
    slug: "honestly",
    family: "transformation",
    purpose: "Honest conversation as a path to repair."
  },
  pulse: {
    slug: "pulse",
    family: "transformation",
    purpose: "Leaders hearing what their people want and value."
  },
  immerse: {
    slug: "immerse",
    family: "transformation",
    purpose: "Adventure and presence off the screen."
  },
  presence: {
    slug: "presence",
    family: "transformation",
    purpose: "Presence moments — being with people, not content."
  },
  "speak-to-me": {
    slug: "speak-to-me",
    family: "transformation",
    purpose: "Scripture spoken in a way a person can hear."
  },
  "barefoot-coalition": {
    slug: "barefoot-coalition",
    family: "transformation",
    purpose: "A coalition identity — participation loop still to come."
  },
  "million-mistakes": {
    slug: "million-mistakes",
    family: "parked",
    purpose: "Concept only — no live surface yet."
  },
  "easy-peasy-website": {
    slug: "easy-peasy-website",
    family: "commerce",
    purpose: "Websites and hosting without the tech overwhelm."
  },
  "snip-show": {
    slug: "snip-show",
    family: "commerce",
    purpose: "Local snipping for creators — rebuild in progress."
  },
  "laser-engrave-market": {
    slug: "laser-engrave-market",
    family: "commerce",
    purpose: "Custom laser engraving and design."
  },
  iconium: {
    slug: "iconium",
    family: "commerce",
    purpose: "Logos that actually work — hybrid generate + retrieve."
  },
  ideas: {
    slug: "ideas",
    family: "commerce",
    purpose: "Capture thinking, turn it into finished content."
  },
  dreamstand: {
    slug: "dreamstand",
    family: "commerce",
    purpose: "Kids selling lemonade-stand style — already in real use."
  },
  sandlot: {
    slug: "sandlot",
    family: "commerce",
    purpose: "Kids trading and meeting up around toys."
  }
};

export function getAppOpsCatalogEntry(slug: string): AppOpsCatalogEntry | null {
  return CATALOG[slug] ?? null;
}

export function familyForSlug(slug: string): AppFamilyId {
  return CATALOG[slug]?.family ?? "commerce";
}

export function familyLabel(id: AppFamilyId): string {
  return APP_FAMILIES[id].label;
}

export function listHelpApps(): Array<{ slug: string; nameHint: string; family: AppFamilyId }> {
  return Object.values(CATALOG)
    .filter((entry) => entry.family !== "parked")
    .map((entry) => ({
      slug: entry.slug,
      nameHint: entry.slug,
      family: entry.family
    }));
}

// Resolve a real admin door. Relative paths attach to the app's serving URL.
// App Engine's own admin stays on this origin. Never invent a path.
export function resolveAdminDoor(
  slug: string,
  servingUrl: string | null
): { url: string; note: string } | null {
  const entry = CATALOG[slug];
  if (!entry) return null;
  if (entry.adminUrl) {
    return { url: entry.adminUrl, note: entry.adminNote ?? "" };
  }
  if (entry.adminPath) {
    if (slug === "appengine") {
      return { url: entry.adminPath, note: entry.adminNote ?? "" };
    }
    if (servingUrl && /^https?:\/\//.test(servingUrl)) {
      return {
        url: `${servingUrl.replace(/\/+$/, "")}${entry.adminPath}`,
        note: entry.adminNote ?? ""
      };
    }
  }
  return entry.adminNote ? { url: "", note: entry.adminNote } : null;
}

export function siblingsInFamily(slug: string): string[] {
  const family = familyForSlug(slug);
  if (family === "parked") return [];
  return Object.values(CATALOG)
    .filter((entry) => entry.family === family && entry.slug !== slug)
    .map((entry) => entry.slug);
}
