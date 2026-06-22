import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPriorWorkCheck } from "./lib/prior-work-check.js";

const repoRoot = process.cwd();
const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-registry-canonical-"));
process.env.APPENGINE_STATE_ROOT = stateRoot;

// Seed the canonical registry + loop stores in the shapes registerAppProject /
// attachCompletedLoop write. This proves the data contract end-to-end via
// prior_work_check (which reads the canonical store), independent of the TS path.
seedStore("app_portfolio_registry", "registered-apps.json", {
  schemaVersion: 1,
  entries: [
    {
      slug: "churchconnect",
      name: "ChurchConnect",
      type: "existing_app",
      status: "gated_intake",
      gatePacketId: "intake-2026-06-21-churchconnect-abc123",
      sourceOfTruthFiles: [],
      completedLoops: [
        {
          runId: "run-001-churchconnect-visitor-capture",
          goal: "ChurchConnect visitor capture loop",
          status: "completed",
          completedAt: "2026-06-21T00:00:00.000Z",
          evidence: ["AC1", "AC2"]
        }
      ],
      createdAt: "2026-06-21T00:00:00.000Z",
      updatedAt: "2026-06-21T00:00:00.000Z"
    }
  ]
});
seedStore("loop_run_records", "manual-loop-runs.json", { schemaVersion: 1, records: [] });

runStep("canonical registry module exists (register/list/find/attach)", () => {
  assertFileIncludes("src/lib/engine/app-portfolio-registry-store.ts", [
    "export async function registerAppProject",
    "export async function listRegisteredAppProjects",
    "export async function findRegisteredMatches",
    "export async function attachCompletedLoop",
    'kind: "app_portfolio_registry" as const'
  ]);
  assertFileIncludes("src/lib/engine/durable-state-adapter.ts", ['"app_portfolio_registry"']);
});

runStep("test 1: a new gated request registers in app_portfolio_registry", () => {
  assertFileIncludes("src/lib/engine/problem-intake-gate.ts", ["registerAppProject", '"gated_intake"']);
});

runStep("test 2: completed loops attach to the correct app/project, shown by the registry", () => {
  assertFileIncludes("src/lib/engine/loop-run-records.ts", ["attachLoopRunToRegistry", "attachCompletedLoop"]);
  assertFileIncludes("src/lib/engine/app-portfolio-registry.ts", [
    "registeredAppProjects",
    "listRegisteredAppProjects"
  ]);
});

runStep("test 3 + acceptance: prior_work_check resolves against the registry before build", () => {
  const artifact = runPriorWorkCheck({
    request: { runId: "run-x", title: "ChurchConnect visitor capture follow-up", goal: "Improve follow-up." },
    targetRepo: { name: "ChurchConnect", candidatePaths: ["loop-runs"], backupSchemaPaths: [] },
    capabilities: [{ id: "visitor-capture", description: "visitor capture", componentHints: ["ZzzNoSuchComponent"] }]
  });

  assertEqual(artifact.verdict, "extend_existing", "registry prior work blocks build_new");
  assertTrue(
    artifact.registrySearch.registeredMatches.some((match) => match.slug === "churchconnect"),
    "found the registered ChurchConnect app"
  );
  assertTrue(
    artifact.registrySearch.completedLoopMatches.some((loop) => loop.runId === "run-001-churchconnect-visitor-capture"),
    "found the completed loop evidence"
  );
});

runStep("test 4: legacy stores cannot become competing sources of truth", () => {
  assertFileIncludes("src/lib/engine/development-store.ts", ["CANONICAL_SOURCE_NOTE", "legacy/read-only derivation input"]);
  assertFileIncludes("src/lib/engine/project-memory.ts", ["CANONICAL_SOURCE_NOTE", "legacy/read-only derivation input"]);
  assertFileIncludes("scripts/lib/prior-work-check.js", ["searchPortfolioRegistry", "app_portfolio_registry"]);
  // prior_work_check resolves against the registry, never against the legacy stores.
  assertFileExcludes("scripts/lib/prior-work-check.js", ["development_projects", "project_memory"]);
});

runStep("build_new still authorized when the registry has no match", () => {
  const artifact = runPriorWorkCheck({
    request: { runId: "fresh", title: "Totally fresh greenfield widget tool", goal: "New thing." },
    targetRepo: { name: "fresh-thing", candidatePaths: ["loop-runs"], backupSchemaPaths: [] },
    capabilities: [{ id: "greenfield", description: "x", componentHints: ["ZzzNoSuchComponent"], tableHints: ["zzz_no_such_table"] }]
  });
  assertEqual(artifact.verdict, "build_new", "no prior work -> build_new");
  assertEqual(artifact.registrySearch.registeredMatches.length, 0, "no false registry match");
});

console.log(`portfolio-registry-canonical smoke ok (${stateRoot})`);

function seedStore(kind, key, value) {
  const dir = path.join(stateRoot, kind);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, key), `${JSON.stringify(value, null, 2)}\n`);
}

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
  const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  for (const expected of expectedValues) {
    if (!content.includes(expected)) {
      throw new Error(`${relativePath} should include ${JSON.stringify(expected)}`);
    }
  }
}

function assertFileExcludes(relativePath, blockedValues) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  for (const blocked of blockedValues) {
    if (content.includes(blocked)) {
      throw new Error(`${relativePath} should not include ${JSON.stringify(blocked)}`);
    }
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, label) {
  if (!value) throw new Error(`expected: ${label}`);
}
