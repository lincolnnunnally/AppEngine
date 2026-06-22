import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("domain model defines ordered journey and ecosystem experiences", () => {
  assertFileIncludes("src/lib/engine/life-core.ts", [
    "lifeCoreJourneyStages",
    "\"survival\"",
    "\"hope\"",
    "\"action\"",
    "\"discovery\"",
    "\"becoming\"",
    "\"thriving\"",
    "\"multiplication\"",
    "lifeCoreExperienceIds",
    "\"united_under_god\"",
    "\"spark_of_hope\"",
    "\"live_on_mission\"",
    "\"best_life\"",
    "\"church_connect\"",
    "\"we_succeed\"",
    "\"child_first\""
  ]);
  assertOrdered("src/lib/engine/life-core.ts", [
    "\"survival\"",
    "\"hope\"",
    "\"action\"",
    "\"discovery\"",
    "\"becoming\"",
    "\"thriving\"",
    "\"multiplication\""
  ]);
});

runStep("United Under God and ChurchConnect remain distinct", () => {
  assertFileIncludes("src/lib/engine/life-core.ts", [
    "United Under God is the mission, unity, encouragement, collaboration, shared-burden, and problem-discovery layer.",
    "ChurchConnect is the church operations layer for communications, events, directories, volunteer coordination, and office/admin workflows.",
    "Does not become church office software.",
    "Does not become the United Under God mission network."
  ]);
  assertFileIncludes("src/app/(cockpit)/life-core/page.tsx", [
    "Mission network",
    "Body-of-Christ collaboration",
    "Church communications",
    "Church office and admin operations"
  ]);
});

runStep("adapter-backed local/mock store is registered", () => {
  assertFileIncludes("src/lib/engine/durable-state-adapter.ts", [
    "\"life_core\"",
    "Read-only foundation preview data for shared ecosystem journey, experience, testimony, opportunity, and feed contracts."
  ]);
  assertFileIncludes("src/lib/engine/life-core.ts", [
    "getAppEngineStateAdapter",
    "readJson<LifeCoreStore>",
    "lifeCoreGuardrails",
    "readOnlyFoundationPreview"
  ]);
});

runStep("API routes expose the foundation preview", () => {
  for (const route of ["overview", "profiles", "communities", "testimonies", "opportunities", "feed"]) {
    assertFileIncludes(`src/app/api/life-core/${route}/route.ts`, ["NextResponse.json", "Cache-Control", "no-store"]);
  }
  assertFileIncludes("src/app/api/life-core/overview/route.ts", ["getLifeCoreOverview", "overview"]);
  assertFileIncludes("src/app/api/life-core/communities/route.ts", ["organizations", "communities"]);
});

runStep("owner-facing page is wired and documented", () => {
  assertFileIncludes("src/app/(cockpit)/life-core/page.tsx", [
    "data-testid=\"life-core-page\"",
    "Shared contracts for transformation-focused ecosystem experiences",
    "Foundation modules future slices can reuse",
    "Unified Activity Feed"
  ]);
  assertFileIncludes("src/components/engine/app-shell.tsx", ["/life-core", "Life Core"]);
  assertFileIncludes("README.md", ["Life Produces Life Core", "/life-core", "/api/life-core/overview"]);
});

runStep("package exposes smoke script", () => {
  assertFileIncludes("package.json", ["\"smoke:life-core\""]);
});

console.log("life-core smoke ok");

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

function assertOrdered(relativePath, expectedValues) {
  const content = readFile(relativePath);
  let previousIndex = -1;

  for (const expected of expectedValues) {
    const index = content.indexOf(expected);
    if (index <= previousIndex) {
      throw new Error(`${relativePath} should include ${JSON.stringify(expected)} after the previous value`);
    }
    previousIndex = index;
  }
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}
