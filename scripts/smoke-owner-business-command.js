// Smoke: the owner business command — one glance, per-app dossiers, and a
// central inbox. Extends the existing ops-stats / command-deck layer; does
// not invent a second dashboard.
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("pastors circle is a ChurchConnect Association door listed on apps.uug", () => {
  assertFileIncludes("source-of-truth/super-admin-registry.md", [
    "vidalia-toombs-pastors-circle",
    "Continuity home = ChurchConnect Association",
    "https://churchconnect.unitedundergod.org/association/pastors-circle",
    "https://churchconnect.unitedundergod.org/admin",
    "noParallelAppEngineAdminUi"
  ]);
  const registry = read("source-of-truth/super-admin-registry.md");
  if (registry.includes("until a Pastors Circle deep link exists")) {
    throw new Error("Pastors Circle registry must record the EXIST deep link, not a planned /association fallback");
  }
  assertFileIncludes("src/lib/showcase/apps-showcase.ts", [
    '"vidalia-toombs-pastors-circle"',
    "https://churchconnect.unitedundergod.org/association/pastors-circle",
    "ChurchConnect Association door, not a new app brand"
  ]);
  const showcase = read("src/lib/showcase/apps-showcase.ts");
  const start = showcase.indexOf('"vidalia-toombs-pastors-circle"');
  const nextHidden = showcase.indexOf('"churchconnect-bridge"', start);
  const pastorsBlock = showcase.slice(start, nextHidden === -1 ? undefined : nextHidden);
  if (pastorsBlock.includes("hide:")) {
    throw new Error("Pastors Circle must be a LIVE apps.uug card — HOLD listing-separate is lifted");
  }
});

runStep("catalog records verified admin doors only", () => {
  assertFileIncludes("src/lib/engine/app-ops-catalog.ts", [
    "toner-management",
    "https://toner.management/admin",
    'adminPath: "/admin"',
    'adminPath: "/admin-ops"',
    'adminPath: "/app/admin"',
    "kindred-connections",
    "aligned-souls",
    "kids-need-dads",
    "neighborly",
    "furfriend",
    "ai-website-design",
    "spark-of-hope",
    "snip-show",
    "operate",
    "porchlight",
    "Platform owner view across shops (owner-only). Opens signed in via dashboard handoff.",
    "HOLD invent — no verified /admin user-management door in app-porchlight",
    "Neighborly Tools is /app/tools",
    'slug: "plenty"',
    'family: "church"',
    'adminPath: "/run/people"',
    "Pantry desk user-management lives on Plenty"
  ]);
  const catalog = read("src/lib/engine/app-ops-catalog.ts");
  const plentyStart = catalog.indexOf('slug: "plenty"');
  const plentyNext = catalog.indexOf('slug: "', plentyStart + 12);
  const plentyBlock = catalog.slice(plentyStart, plentyNext === -1 ? undefined : plentyNext);
  if (!plentyBlock.includes('adminPath: "/run/people"') || !plentyBlock.includes('family: "church"')) {
    throw new Error("Plenty catalog entry must be church family with adminPath /run/people");
  }
  if (plentyBlock.includes('adminPath: "/admin"')) {
    throw new Error("Plenty has no /admin door — user-management is /run/people");
  }
  assertFileIncludes("source-of-truth/super-admin-registry.md", [
    "lincolnnunnally/plenty",
    "https://plenty.unitedundergod.org/run/people",
    "https://plenty.unitedundergod.org/api/health"
  ]);
  const registry = read("source-of-truth/super-admin-registry.md");
  const doorStart = registry.indexOf("### Plenty");
  const doorEnd = registry.indexOf("### Testimony doors", doorStart);
  const door = registry.slice(doorStart, doorEnd === -1 ? undefined : doorEnd);
  if (doorStart < 0 || !door.includes('"userManagement": "https://plenty.unitedundergod.org/run/people"')) {
    throw new Error("Plenty registered door must point user-management at /run/people");
  }
  if (!door.includes('"logsUrl": "planned"')) {
    throw new Error("Plenty logs URL stays planned until a public logs link is verified");
  }
  if (!door.includes("noParallelAppEngineAdminUi")) {
    throw new Error("Plenty door must not invent a parallel AppEngine admin");
  }
});

runStep("every production_live UUG directory door has a catalog entry", () => {
  // Verified 2026-09-25 against www.unitedundergod.org/apps
  // (lincolnnunnally/united-under-god src/lib/content.ts APPS).
  // Registry slugs for the external app cards. Two directory cards are pages
  // on the UUG site, not registry apps, and stay off this list:
  //   Understanding the Bible → /bible
  //   SOURCE buying → /buying/desk (buying persistence HOLD)
  const directorySlugs = [
    "live-on-mission",
    "spark-of-hope",
    "kindred-connections",
    "aligned-souls",
    "kids-need-dads",
    "childfirst-solutions",
    "best-life",
    "speak-to-me",
    "presence",
    "immerse",
    "barefoot-coalition",
    "dreamstand",
    "sandlot",
    "churchconnect",
    "plenty",
    "vidalia-toombs-pastors-circle",
    "neighborly",
    "pulse",
    "operate",
    "easy-peasy-website",
    "porchlight",
    "toner-connect",
    "toner-management",
    "ideas",
    "laser-engrave-market",
    "appengine"
  ];
  // production_live directory slugs that must not get their own catalog row.
  // Empty on purpose: every live directory app already belongs in CATALOG.
  const catalogAllowlist = new Set();
  const registry = JSON.parse(read("source-of-truth/ecosystem-portfolio-registry.json"));
  const catalog = read("src/lib/engine/app-ops-catalog.ts");
  const apps = Array.isArray(registry.apps) ? registry.apps : [];
  const bySlug = new Map(apps.map((app) => [app.slug, app]));
  const missing = [];
  for (const slug of directorySlugs) {
    const app = bySlug.get(slug);
    if (!app) {
      throw new Error(`UUG directory slug ${slug} has no registry JSON row`);
    }
    if (app.deploymentState !== "production_live") continue;
    if (catalogAllowlist.has(slug)) continue;
    if (!catalog.includes(`slug: "${slug}"`)) missing.push(slug);
  }
  if (missing.length) {
    throw new Error(`production_live directory doors missing catalog entries: ${missing.join(", ")}`);
  }
  if (catalog.includes('slug: "understanding-the-bible"') || catalog.includes('slug: "source-buying"')) {
    throw new Error("UUG site pages are not separate catalog apps");
  }
});

runStep("UUG apps directory: unlocked Continuity doors live, Selah coming soon, App Engine soft-launch href", () => {
  assertFileIncludes("src/lib/showcase/apps-showcase.ts", [
    "operate",
    "https://operate.unitedundergod.org",
    "https://churchconnect.unitedundergod.org/association/pastors-circle",
    'comingSoon: true',
    'liveUrl: "https://rally.unitedundergod.org"',
    "https://plenty.unitedundergod.org",
    "https://laser.engrave.market",
    "https://sandlot.unitedundergod.org",
    "https://backoffice.works",
    "https://selah.unitedundergod.org",
    "https://appengine.unitedundergod.org",
    "SPARK_HOPE_STORIES_URL",
    "LOM_TESTIMONIES_URL"
  ]);
  const showcase = read("src/lib/showcase/apps-showcase.ts");
  if (showcase.includes('liveUrl: "https://www.we-succeed.org"')) {
    throw new Error("App Engine showcase card must not point at we-succeed.org");
  }
  if (showcase.includes("https://swaparound.vercel.app")) {
    throw new Error("Sandlot primary door must not be swaparound.vercel.app");
  }
  const laserBlock = showcase.slice(showcase.indexOf('"laser-engrave-market"'), showcase.indexOf('"kindred-connections"'));
  if (laserBlock.includes('liveUrl: "https://laser.unitedundergod.org"')) {
    throw new Error("Laser Engrave Market customer door is laser.engrave.market");
  }
  const rallyBlock = showcase.slice(showcase.indexOf("rally:"), showcase.indexOf("selah:"));
  if (!rallyBlock.includes('liveUrl: "https://rally.unitedundergod.org"')) {
    throw new Error("Rally must be Live at rally.unitedundergod.org");
  }
  if (rallyBlock.includes("comingSoon: true")) {
    throw new Error("Rally comingSoon honesty override is lifted — /app/desk is LIVE");
  }
  const selahBlock = showcase.slice(showcase.indexOf("selah:"), showcase.indexOf("// Registry entries"));
  if (selahBlock.includes("liveUrl:")) {
    throw new Error("Selah must not have a liveUrl — Coming soon honesty");
  }
  assertFileIncludes("src/app/apps-showcase/page.tsx", [
    "https://appengine.unitedundergod.org",
    "Coming soon",
    "app.reservedHost"
  ]);
  if (read("src/app/apps-showcase/page.tsx").includes("https://www.we-succeed.org")) {
    throw new Error("apps-showcase page must not href we-succeed.org");
  }
  assertFileIncludes("src/proxy.ts", [
    "isAppEngineLeftoverPreviewHost",
    "host.startsWith(\"app-engine\")"
  ]);
});

runStep("shared-database fallback exists for apps that do not poll yet", () => {
  assertFileIncludes("src/lib/engine/lpl-ops-stats.ts", [
    "readLplOpsStats",
    "kindred_profiles",
    "knd_user_profiles",
    "lom_user_profiles"
  ]);
  assertFileIncludes("src/lib/engine/ops-stats.ts", ["readLplOpsStats", "board:"]);
  const catalog = read("src/lib/engine/app-ops-catalog.ts");
  if (catalog.includes('churchconnect') === false) {
    throw new Error("ChurchConnect must have a catalog entry");
  }
  if (catalog.includes("vidalia-toombs-pastors-circle") === false) {
    throw new Error("Vidalia / Toombs Pastors Circle must have a catalog entry");
  }
  if (catalog.includes("https://churchconnect.unitedundergod.org/admin") === false) {
    throw new Error("Pastors Circle admin must be ChurchConnect Super Admin, not a new AppEngine admin");
  }
});

runStep("home is an internal business desk, not an app builder", () => {
  assertFileIncludes("src/components/engine/owner-command-deck.tsx", [
    "the businesses",
    "revenue, 30 days",
    "BusinessExplorer",
    "/inbox"
  ]);
  assertFileIncludes("src/components/engine/business-explorer.tsx", [
    "Search a business",
    "Has orders",
    "Growing",
    "/apps/${app.slug}"
  ]);
  assertFileIncludes("src/lib/engine/stripe-summary.ts", ["loadStripeSummary", "revenue30d"]);
  assertFileIncludes("src/lib/engine/owner-deck.ts", [
    "inboxOpen",
    "deriveAppInsights",
    "openTickets",
    "familyForSlug"
  ]);
  assertFileIncludes("src/lib/auth/hosts.ts", ["dashboard.unitedundergod.org", "appengine.unitedundergod.org"]);
  assertFileIncludes("src/app/signin/page.tsx", ["Private desk", "Welcome back", "AppEngine — app builder"]);
});

runStep("per-app dossier and central inbox exist", () => {
  assertFileIncludes("src/app/(cockpit)/apps/[slug]/page.tsx", [
    "loadAppDossier",
    "This app's admin",
    "Opportunities and challenges",
    "Help requests for this app"
  ]);
  assertFileIncludes("src/app/(cockpit)/inbox/page.tsx", [
    "People who need",
    "InboxActions",
    "/help"
  ]);
  assertFileIncludes("src/app/help/page.tsx", [
    "Need a",
    "HelpForm"
  ]);
  assertFileIncludes("src/app/api/engine/inbox/route.ts", [
    "createInboxTicket",
    "APP_ENGINE_INBOX_TOKEN",
    "company"
  ]);
});

runStep("generated apps forward tickets to the owner inbox", () => {
  assertFileIncludes("src/lib/engine/foundation-modules.ts", [
    "forwardTicketToOwnerInbox",
    "APP_ENGINE_INBOX_URL",
    "app_forward"
  ]);
});

runStep("nav and reports point at the inbox and dossiers", () => {
  assertFileIncludes("src/components/engine/app-shell.tsx", [
    '{ label: "Businesses", href: "/" }',
    '{ label: "Inbox", href: "/inbox" }'
  ]);
  assertFileIncludes("src/app/(cockpit)/reports/page.tsx", ["`/apps/${record.slug}`"]);
});

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

function assertFileIncludes(rel, needles) {
  const text = read(rel);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      throw new Error(`${rel} is missing ${JSON.stringify(needle)}`);
    }
  }
}

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok  ${name}`);
  } catch (error) {
    console.error(`fail  ${name}`);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
