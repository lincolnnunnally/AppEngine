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
  assertFileIncludes("src/app/signin/page.tsx", ["the businesses", "Sign in to the desk"]);
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
