import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPriorWorkCheck } from "./lib/prior-work-check.js";

const repoRoot = process.cwd();
const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-ecosystem-seed-"));
process.env.APPENGINE_STATE_ROOT = stateRoot;
const registryPath = path.join(stateRoot, "app_portfolio_registry", "registered-apps.json");

const SEEDED = [
  "churchconnect",
  "spark-of-hope",
  "live-on-mission",
  "best-life",
  "united-under-god",
  "milstead-us",
  "toner-management",
  "kids-need-dads"
];
const ALLOWED_STATUSES = new Set(["existing_app", "planned_app", "active_product", "ministry_tool", "business_tool"]);

runStep("seed is idempotent and registers all known ecosystem apps", () => {
  seed();
  const first = readRegistry();
  seed(); // run again
  const second = readRegistry();
  assertEqual(second.entries.length, first.entries.length, "idempotent: entry count stable on re-run");
  for (const slug of SEEDED) {
    assertTrue(second.entries.some((e) => e.slug === slug), `seeded: ${slug}`);
  }
});

runStep("each app has a clear status, purpose, and problem categories", () => {
  const reg = readRegistry();
  for (const slug of SEEDED) {
    const e = reg.entries.find((x) => x.slug === slug);
    assertTrue(ALLOWED_STATUSES.has(e.status), `${slug} status "${e.status}" is one of the allowed values`);
    assertTrue(typeof e.purpose === "string" && e.purpose.length > 0, `${slug} has a purpose`);
    assertTrue(Array.isArray(e.problemCategories) && e.problemCategories.length > 0, `${slug} has problem categories`);
  }
});

runStep("no fake completed loops are created (planned apps stay planned)", () => {
  const reg = readRegistry();
  for (const slug of SEEDED) {
    const e = reg.entries.find((x) => x.slug === slug);
    assertEqual((e.completedLoops || []).length, 0, `${slug} has zero completed loops`);
  }
});

runStep("prior_work_check matches problem categories to the right app", () => {
  assertMatch("church visitor follow-up", "we cannot follow up with first-time visitors", "churchconnect");
  assertMatch("testimony and hope stories", "share a story of hope and testimony", "spark-of-hope");
  assertMatch("serve and volunteer for mission", "help people volunteer to serve on mission", "live-on-mission");
  assertMatch("printer toner monitoring", "track printer toner and reorder supplies", "toner-management");
});

runStep("an unrelated request matches none of the seeded apps", () => {
  const artifact = check({ title: "quantum origami scheduler", goal: "fold paper on a schedule", repo: "origami" });
  const hits = artifact.registrySearch.registeredMatches.filter((m) => SEEDED.includes(m.slug));
  assertEqual(hits.length, 0, "no false-positive ecosystem matches");
});

console.log(`ecosystem-apps-seed smoke ok (${stateRoot})`);

function assertMatch(title, goal, expectedSlug) {
  const artifact = check({ title, goal, repo: title });
  const match = artifact.registrySearch.registeredMatches.find((m) => m.slug === expectedSlug);
  assertTrue(Boolean(match), `"${title}" -> ${expectedSlug} (got: ${artifact.registrySearch.registeredMatches.map((m) => m.slug).join(", ") || "none"})`);
}

function check({ title, goal, repo }) {
  return runPriorWorkCheck({
    request: { runId: "seed-test", title, goal },
    targetRepo: { name: repo, candidatePaths: ["loop-runs"], backupSchemaPaths: [] },
    capabilities: [{ id: "cap", description: goal, componentHints: ["ZzzNoSuchComponent"] }]
  });
}

function seed() {
  execFileSync(process.execPath, [path.join(repoRoot, "scripts/seed-ecosystem-apps.js")], {
    cwd: repoRoot,
    env: { ...process.env, APPENGINE_STATE_ROOT: stateRoot },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function readRegistry() {
  return JSON.parse(fs.readFileSync(registryPath, "utf8"));
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

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}

function assertTrue(value, label) {
  if (!value) throw new Error(`expected: ${label}`);
}
