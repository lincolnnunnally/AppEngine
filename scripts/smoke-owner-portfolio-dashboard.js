import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("portfolio registry module uses existing artifact standard", () => {
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "kind: \"app_portfolio_registry\"",
    "AppPortfolioRegistry",
    "loadOwnerPortfolioRegistry",
    "buildAppPortfolioRegistry",
    "noSecretsInRegistry",
    "productionApprovalRequired",
    "protectedPreviewBypassLinksBlocked"
  ]);
});

runStep("portfolio entries include required managed app and ecosystem slices", () => {
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "AppEngine Core",
    "Opportunity",
    "Life Produces Life Core",
    "Spark of Hope Slices",
    "Future Ecosystem Apps and Services",
    "\"/owner-control-center\"",
    "\"/opportunity-intake\"",
    "\"/life-core\"",
    "\"/spark-of-hope-intake-lite\"",
    "Life Produces Life Core MVP Foundation Slice",
    "production blocked until owner-approved release gate"
  ]);
});

runStep("owner dashboard renders portfolio fields and guardrails", () => {
  assertFileIncludes("src/components/engine/owner-portfolio-dashboard.tsx", [
    "data-testid=\"owner-portfolio-dashboard\"",
    "Every managed app in one place",
    "Review URL",
    "Production",
    "Latest PR/branch",
    "Next safe action",
    "Blockers",
    "No protected preview bypass links"
  ]);
});

runStep("owner control center loads and displays portfolio registry", () => {
  assertFileIncludes("src/app/(cockpit)/owner-control-center/page.tsx", [
    "OwnerPortfolioDashboard",
    "loadOwnerPortfolioRegistry",
    "portfolioRegistry",
    "<OwnerPortfolioDashboard registry={portfolioRegistry} />"
  ]);
});

runStep("dashboard styles are present and mobile-aware", () => {
  assertFileIncludes("src/app/styles.css", [
    ".owner-portfolio-dashboard",
    ".portfolio-summary-grid",
    ".portfolio-card-grid",
    ".portfolio-detail-grid",
    ".portfolio-guardrail-strip",
    "@media (max-width: 760px)"
  ]);
  assertFileIncludes("src/app/styles.css", [
    ".portfolio-summary-grid",
    ".portfolio-card-grid",
    ".portfolio-detail-grid"
  ]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["\"smoke:owner-portfolio-dashboard\""]);
});

console.log("owner-portfolio-dashboard smoke ok");

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function assertFileIncludes(relativePath, expectedValues) {
  const content = readFile(relativePath);

  for (const expected of expectedValues) {
    if (!content.includes(expected)) {
      throw new Error(`${relativePath} should include ${JSON.stringify(expected)}`);
    }
  }
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}
