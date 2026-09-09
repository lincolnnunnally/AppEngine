// Smoke: the owner business command — one glance, per-app dossiers, and a
// central inbox. Extends the existing ops-stats / command-deck layer; does
// not invent a second dashboard.
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("pastors circle is a ChurchConnect Association door, not a public brand card", () => {
  assertFileIncludes("source-of-truth/super-admin-registry.md", [
    "vidalia-toombs-pastors-circle",
    "Continuity home = ChurchConnect Association",
    "uug-website",
    "https://churchconnect.unitedundergod.org/association",
    "https://churchconnect.unitedundergod.org/admin",
    "noParallelAppEngineAdminUi"
  ]);
  assertFileIncludes("src/lib/showcase/apps-showcase.ts", [
    '"vidalia-toombs-pastors-circle"',
    "ChurchConnect Association door, not a new app brand"
  ]);
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
    "HOLD invent — Operate has /desk and /people",
    "HOLD invent — no verified /admin user-management door in app-porchlight",
    "Neighborly Tools is /app/tools"
  ]);
});

runStep("UUG apps directory: Operate live, Rally+Selah coming soon, App Engine soft-launch href", () => {
  assertFileIncludes("src/lib/showcase/apps-showcase.ts", [
    "operate",
    "https://operate.unitedundergod.org",
    'comingSoon: true',
    "https://rally.unitedundergod.org",
    "https://selah.unitedundergod.org",
    "https://appengine.unitedundergod.org/soft-launch"
  ]);
  const showcase = read("src/lib/showcase/apps-showcase.ts");
  if (showcase.includes('liveUrl: "https://www.we-succeed.org"')) {
    throw new Error("App Engine showcase card must not point at we-succeed.org");
  }
  const rallyBlock = showcase.slice(showcase.indexOf("rally:"), showcase.indexOf("selah:"));
  if (rallyBlock.includes("liveUrl:")) {
    throw new Error("Rally must not have a liveUrl — Coming soon honesty");
  }
  const selahBlock = showcase.slice(showcase.indexOf("selah:"), showcase.indexOf("// Registry entries"));
  if (selahBlock.includes("liveUrl:")) {
    throw new Error("Selah must not have a liveUrl — Coming soon honesty");
  }
  assertFileIncludes("src/app/apps-showcase/page.tsx", [
    "https://appengine.unitedundergod.org/soft-launch",
    "Coming soon",
    "app.reservedHost"
  ]);
  if (read("src/app/apps-showcase/page.tsx").includes("https://www.we-succeed.org")) {
    throw new Error("apps-showcase page must not href we-succeed.org");
  }
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
