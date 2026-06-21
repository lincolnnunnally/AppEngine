import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPriorWorkCheck } from "./lib/prior-work-check.js";

const repoRoot = process.cwd();
const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-pwc-hardening-"));
process.env.APPENGINE_STATE_ROOT = stateRoot;
const registryPath = path.join(stateRoot, "app_portfolio_registry", "registered-apps.json");

runStep("existing app found -> extend (no duplicate build)", () => {
  seedRegistry([entry("toner-management", "Toner Management", [])]);
  const artifact = check({ title: "Toner Management reorder follow-up", repo: "Toner Management" });
  assertEqual(artifact.verdict, "extend_existing", "verdict");
  assertEqual(artifact.passed, true, "passed");
  assertEqual(artifact.decision.authorizesPacket, "vnext_packet", "authorizes vnext, not a new build");
  assertTrue(
    artifact.registrySearch.registeredMatches.some((match) => match.slug === "toner-management" && match.score === "exact"),
    "exact registry match"
  );
});

runStep("existing completed loop found -> recommend reuse/extension", () => {
  seedRegistry([entry("toner-management", "Toner Management", [{ runId: "loop-7", goal: "toner reorder loop", status: "completed" }])]);
  const artifact = check({ title: "Toner Management reorder", repo: "Toner Management" });
  assertEqual(artifact.verdict, "extend_existing", "verdict");
  assertTrue(
    artifact.registrySearch.completedLoopMatches.some((loop) => loop.runId === "loop-7"),
    "completed loop evidence surfaced for reuse"
  );
});

runStep("no prior work found -> continue safely (build_new)", () => {
  clearRegistry();
  const artifact = check({ title: "Totally fresh greenfield gizmo", repo: "fresh-gizmo" });
  assertEqual(artifact.verdict, "build_new", "verdict");
  assertEqual(artifact.passed, true, "passed");
  assertEqual(artifact.registrySearch.available, true, "registry available (absent != failure)");
  assertEqual(artifact.registrySearch.registeredMatches.length, 0, "no matches");
});

runStep("registry unavailable -> build blocked (fail-closed)", () => {
  corruptRegistry();
  const artifact = check({ title: "Anything at all", repo: "anything" });
  assertEqual(artifact.verdict, "blocked_registry_unavailable", "verdict");
  assertEqual(artifact.passed, false, "not passed");
  assertEqual(artifact.decision.proceed, false, "does not proceed");
  assertEqual(artifact.registrySearch.available, false, "registry lookup failed");
});

runStep("unclear/partial prior work -> needs_human_review", () => {
  seedRegistry([entry("visitor-tracker", "Visitor Tracker", [])]);
  const artifact = check({ title: "Visitor follow-up reminders", repo: "Visitor Helper" });
  assertEqual(artifact.verdict, "needs_human_review", "verdict");
  assertEqual(artifact.passed, false, "not passed");
  assertEqual(artifact.decision.authorizesPacket, "none", "no packet authorized without a human decision");
});

runStep("brand-new gated intake does not self-block (build_new)", () => {
  // The gate registers the in-flight request as a gated_intake placeholder BEFORE
  // prior_work_check runs. The current request's own placeholder must not count.
  seedRegistry([entry("toner-management", "Toner Management", [], "gated_intake", "gate-self-123")]);
  const artifact = check({ title: "Toner Management", repo: "Toner Management", selfGatePacketId: "gate-self-123" });
  assertEqual(artifact.verdict, "build_new", "verdict");
  assertEqual(artifact.passed, true, "passed");
  assertEqual(artifact.registrySearch.registeredMatches.length, 0, "own placeholder excluded");
});

runStep("another request's gated_intake placeholder is not exact prior work", () => {
  // A gated_intake placeholder (completedLoops: 0) from a different request is at
  // most a partial signal -> human review, never an exact auto-extend.
  seedRegistry([entry("toner-management", "Toner Management", [], "gated_intake", "gate-other-999")]);
  const artifact = check({ title: "Toner Management", repo: "Toner Management", selfGatePacketId: "gate-self-123" });
  assertEqual(artifact.verdict, "needs_human_review", "verdict");
  assertTrue(
    artifact.registrySearch.registeredMatches.every((match) => match.score !== "exact"),
    "no exact match from a bare placeholder"
  );
});

runStep("acceptance: a build_new verdict that recorded registry prior work is refused", () => {
  // Defense in depth at the packet layer: even a hand-supplied build_new verdict
  // cannot create an app_build_packet for something already in the registry.
  const verdictPath = path.join(stateRoot, "contradictory-build-new.json");
  fs.writeFileSync(
    verdictPath,
    JSON.stringify({
      kind: "prior_work_check",
      passed: true,
      verdict: "build_new",
      sourceRequest: { runId: "x", title: "Toner Management", goal: "" },
      targetRepo: { name: "Toner Management" },
      registrySearch: { available: true, registeredMatches: [{ slug: "toner-management", score: "exact" }], completedLoopMatches: [] }
    })
  );

  assertThrows(
    () =>
      execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-app-build-packet.js")], {
        cwd: repoRoot,
        env: { ...process.env, APP_BUILD_PACKET_PRIOR_WORK: verdictPath, APP_NAME: "Toner Management" },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }),
    "found"
  );
});

console.log(`prior-work-registry-hardening smoke ok (${stateRoot})`);

function check({ title, repo, selfGatePacketId }) {
  return runPriorWorkCheck({
    request: { runId: "run", title, goal: "x", gatePacketId: selfGatePacketId },
    selfGatePacketId,
    targetRepo: { name: repo, candidatePaths: ["loop-runs"], backupSchemaPaths: [] },
    capabilities: [{ id: "cap", description: "x", componentHints: ["ZzzNoSuchComponent"] }]
  });
}

// Default to a built/reusable status: an entry is genuine prior work when it has
// completed loops OR a non-placeholder status. gated_intake placeholders are
// in-flight and must be passed explicitly.
function entry(slug, name, completedLoops, status = "deployed", gatePacketId = "") {
  const at = "2026-06-21T00:00:00.000Z";
  return {
    slug,
    name,
    type: "existing_app",
    status,
    gatePacketId,
    sourceOfTruthFiles: [],
    completedLoops: completedLoops.map((loop) => ({ ...loop, completedAt: at, evidence: [] })),
    createdAt: at,
    updatedAt: at
  };
}

function seedRegistry(entries) {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, `${JSON.stringify({ schemaVersion: 1, entries }, null, 2)}\n`);
}

function clearRegistry() {
  fs.rmSync(registryPath, { force: true });
}

function corruptRegistry() {
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, "{ this is not valid json ");
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
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value, label) {
  if (!value) throw new Error(`expected: ${label}`);
}

function assertThrows(fn, expectedMessage) {
  try {
    fn();
  } catch (caught) {
    if (!String(caught.message).includes(expectedMessage)) {
      throw new Error(`Expected error to include "${expectedMessage}", received "${caught.message}"`);
    }
    return;
  }
  throw new Error(`Expected function to throw including "${expectedMessage}"`);
}
