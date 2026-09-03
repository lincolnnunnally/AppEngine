// Smoke: the owner business command — one glance, per-app dossiers, and a
// central inbox. Extends the existing ops-stats / command-deck layer; does
// not invent a second dashboard.
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

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
    "snip-show"
  ]);
});

// A layout rewrite once removed every Admin door from the deck and nothing
// caught it: the suite only asserted the doors existed in the catalog and on
// the dossier, never that the deck actually renders one. Guard the render.
runStep("the deck itself renders each app's own admin door", () => {
  assertFileIncludes("src/components/engine/business-explorer.tsx", [
    "app.adminUrl",
    "dx-doorlink--admin",
    "app.adminReason"
  ]);
  assertFileIncludes("src/lib/engine/owner-deck.ts", ["adminState", "adminReason"]);
  // Operate is a live business with its own owner surface; it must be on the
  // deck, and its door is /desk — never a guessed /admin.
  assertFileIncludes("src/lib/engine/app-ops-catalog.ts", ["operate", 'adminPath: "/desk"']);
  const registry = read("source-of-truth/ecosystem-portfolio-registry.json");
  if (!registry.includes('"slug": "operate"')) {
    throw new Error("Operate must be in the portfolio registry or the desk cannot see it");
  }
});

// Every number on the deck states where it came from. A figure with no
// destination is the dead end this desk exists to remove.
runStep("deck numbers drill into their source", () => {
  assertFileIncludes("src/components/engine/owner-command-deck.tsx", [
    "dx-cell-link",
    "/?apps=",
    "appsFilter"
  ]);
  const deck = read("src/components/engine/owner-command-deck.tsx");
  // dx-stat-grid is the container and is legitimately a div; a dx-stat tile
  // itself must be an anchor.
  if (/<div className="dx-stat(?!-grid)/.test(deck)) {
    throw new Error("A dx-stat tile on the deck must be a link, not a dead div");
  }
});

// A missing classifier is not $0. Showing a dollar figure for an app whose
// charges cannot be attributed misreports its revenue as nothing.
runStep("unattributable revenue is never rendered as zero", () => {
  assertFileIncludes("src/lib/engine/revenue-streams.ts", ["streamSlugForApp", "isRevenueWired"]);
  assertFileIncludes("src/app/(cockpit)/reports/money/page.tsx", ["unknownStream", "not wired"]);
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
  assertFileIncludes("src/app/signin/page.tsx", ["Sign in to the desk", "AppEngine — app builder"]);
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
