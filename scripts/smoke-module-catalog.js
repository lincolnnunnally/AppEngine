import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const MODULE_SLUGS = [
  "identity-auth",
  "connection-engine",
  "purpose-onboarding",
  "becoming-growth-dashboard",
  "public-invite-loop",
  "public-profile-og-sharing",
  "event-curation-service-loop",
  "relationship-repair",
  "admin-ops-moderation",
  "needs-helper-matching",
  "communication",
  "directory-community",
  "events-scheduling",
  "checkin",
  "intake",
  "recommendation-navigator",
  "testimony-engine",
  "scripture-sermon-tools",
  "discipleship-content",
  "live-service-streaming",
  "care-counseling",
  "mentorship-coaching",
  "growth-tracking",
  "crm-follow-up",
  "volunteer-safety",
  "payments-billing",
  "website-builder",
  "domains-publishing",
  "branding-design",
  "ai-assist",
  "analytics-hope-index",
  "idea-capture-forge",
  "marketplace-orders",
  "design-studio",
  "case-management",
  "mediated-communication",
  "knowledge-base",
  "mutual-aid-benevolence",
  "achievements-gamification",
  "ratings-reviews",
  "finance-accounting",
  "multi-org-association",
  "media-recording",
  "fleet-monitoring-agent",
  "supplier-order-automation",
  "proof-approval-artifact",
  "content-publishing-scheduler",
  "creator-analytics-coaching",
  "business-formation-provisioning",
  "brand-kit-generator"
];

runStep("module catalog engine defines the Lego set + query", () => {
  assertFileIncludes("src/lib/engine/module-catalog.ts", [
    'kind: "module_catalog"',
    "export function loadModuleCatalog",
    "export function findModulesForNeed",
    "reuseNeverRebuild: true",
    "oneHomePerModule: true",
    "usedByApps",
    "primarySource"
  ]);
  assertFileIncludes("src/lib/engine/module-catalog.ts", MODULE_SLUGS.map((slug) => `slug: "${slug}"`));
});

runStep("catalog reuses app registry slugs (no parallel naming)", () => {
  // usedByApps must reference real seeded app slugs so reuse maps to the registry.
  assertFileIncludes("src/lib/engine/module-catalog.ts", [
    '"kindred-connections"',
    '"churchconnect"',
    '"spark-of-hope"',
    '"easy-peasy-website"',
    '"laser-engrave-market"'
  ]);
});

runStep("owner-facing catalog page is wired and owner-gated", () => {
  assertFileIncludes("src/app/(cockpit)/module-catalog/page.tsx", [
    "canAccessEngineOwner",
    "/soft-launch",
    "loadModuleCatalog",
    'data-testid="module-catalog-page"'
  ]);
  assertFileIncludes("src/components/engine/app-shell.tsx", ['label: "Module catalog"', 'href: "/module-catalog"']);
});

runStep("source of truth documents the module catalog", () => {
  assertFileIncludes("source-of-truth/module-catalog.md", [
    "Module Catalog",
    "module_catalog",
    "reuse",
    "never rebuild"
  ]);
  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/module-catalog.md"]);
  assertFileIncludes("package.json", ["smoke:module-catalog"]);
});

console.log("module-catalog smoke ok");

function assertFileIncludes(filePath, expected) {
  const source = fs.readFileSync(path.join(root, filePath), "utf8");
  for (const phrase of expected) {
    if (!source.includes(phrase)) {
      throw new Error(`${filePath} missing ${JSON.stringify(phrase)}`);
    }
  }
}

function runStep(label, fn) {
  try {
    fn();
    console.log(`ok - ${label}`);
  } catch (error) {
    console.error(`not ok - ${label}`);
    throw error;
  }
}
