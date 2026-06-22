// Canonical AppEngine flow regression suite.
//
// Permanently protects the one-and-only canonical path:
//   problem_intake_gate -> clarification -> prior_work_check -> routing ->
//   candidate_packet_bridge -> loop_run_records -> execution -> verification ->
//   app_portfolio_registry
//
// Executable checks run the real JS layer (prior_work_check, packet builders,
// routing) against an isolated APPENGINE_STATE_ROOT. The TS engine cannot be
// imported under Node's loader (allowJs:false + "@/" alias), so its guarantees
// are protected structurally against the source of truth.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPriorWorkCheck } from "./lib/prior-work-check.js";

const repoRoot = process.cwd();
const stateRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-canonical-regression-"));
process.env.APPENGINE_STATE_ROOT = stateRoot;
const registryPath = path.join(stateRoot, "app_portfolio_registry", "registered-apps.json");

let failures = 0;
const results = [];
const at = "2026-06-22T00:00:00.000Z";

// ---------------------------------------------------------------------------
// 1. New app request: builds once, leaves evidence, duplicate is reuse-routed.
// ---------------------------------------------------------------------------
group("1. New app request", () => {
  clearRegistry();
  const fresh = pwc({ title: "Toner Inventory Tracker", repo: "Toner Inventory Tracker" });
  assertEqual(fresh.verdict, "build_new", "fresh request -> build_new (builds once)");
  assertEqual(fresh.decision.authorizesPacket, "app_build_packet", "build_new authorizes an app_build_packet");

  // After it is built, the registry holds the app + completed-loop evidence.
  seedRegistry([
    appEntry("toner-inventory-tracker", "Toner Inventory Tracker", {
      status: "active_product",
      completedLoops: [{ runId: "exec-build-1", goal: "Build the toner inventory tracker", status: "deployed" }]
    })
  ]);
  const dup = pwc({ title: "Toner Inventory Tracker", repo: "Toner Inventory Tracker" });
  assertEqual(dup.verdict, "extend_existing", "duplicate request -> reuse/extend, not a second build");
  assertTrue(
    dup.registrySearch.completedLoopMatches.some((m) => m.runId === "exec-build-1"),
    "completed-loop evidence is created and searchable"
  );

  // Defense in depth: even a hand-supplied build_new cannot re-build a known app.
  const refused = runChild("scripts/create-app-build-packet.js", {
    APP_BUILD_PACKET_PRIOR_WORK: writeVerdict({
      kind: "prior_work_check",
      passed: true,
      verdict: "build_new",
      sourceRequest: { runId: "x", title: "Toner Inventory Tracker", goal: "" },
      targetRepo: { name: "Toner Inventory Tracker" },
      registrySearch: { available: true, registeredMatches: [{ slug: "toner-inventory-tracker", score: "exact" }], completedLoopMatches: [] }
    }),
    APP_NAME: "Toner Inventory Tracker"
  });
  assertTrue(!refused.ok && /cannot be created/.test(refused.output), "duplicate build is blocked at the packet layer");

  // Structural: exactly one execution record per approved packet (idempotent).
  assertFileIncludes("src/lib/engine/loop-run-records.ts", ["record.gatePacketId === gatePacketId", "completeLoopRun"]);
});

// ---------------------------------------------------------------------------
// 2. Existing app extension: vnext_packet, attach to existing, no new app.
// ---------------------------------------------------------------------------
group("2. Existing app extension", () => {
  clearRegistry();
  seedRegistry([appEntry("churchconnect", "ChurchConnect", { status: "active_product", problemCategories: ["church visitor follow-up"] })]);
  const verdict = pwc({ title: "ChurchConnect follow-up reminders", repo: "ChurchConnect" });
  assertEqual(verdict.verdict, "extend_existing", "existing app -> extend_existing");
  assertEqual(verdict.decision.authorizesPacket, "vnext_packet", "extend authorizes a vnext_packet, not a build");

  // vnext_packet builder requires extend_existing; build_new is refused.
  const okVnext = runChild("scripts/create-vnext-packet.js", {
    VNEXT_INPUT: writeJsonTmp("vnext-ok.json", {
      priorWorkCheck: extendVerdict("ChurchConnect"),
      name: "ChurchConnect", slug: "churchconnect", currentVersion: "v1", targetVersion: "v2"
    })
  });
  assertTrue(okVnext.ok && /vnext-packet ok/.test(okVnext.output), "extend_existing -> vnext_packet created");

  const refusedVnext = runChild("scripts/create-vnext-packet.js", {
    VNEXT_INPUT: writeJsonTmp("vnext-bad.json", {
      priorWorkCheck: { kind: "prior_work_check", passed: true, verdict: "build_new", sourceRequest: { runId: "x", title: "ChurchConnect", goal: "" }, targetRepo: { name: "ChurchConnect" }, registrySearch: { available: true, registeredMatches: [], completedLoopMatches: [] } },
      name: "ChurchConnect", slug: "churchconnect"
    })
  });
  assertTrue(!refusedVnext.ok, "a build_new verdict cannot create a vnext_packet");

  // Structural: completed loop attaches to the existing app slug (no new app).
  assertFileIncludes("src/lib/engine/loop-run-records.ts", ["attachCompletedLoop(", "record.appSlug"]);
});

// ---------------------------------------------------------------------------
// 3. Non-app problem workflow: workflow_process loop, non-build evidence, no packet.
// ---------------------------------------------------------------------------
group("3. Non-app problem workflow", () => {
  // Structural: non-build loop kind, no software verdict required, completed (not deployed).
  assertFileIncludes("src/lib/engine/loop-run-records.ts", [
    "NON_BUILD_PACKET_KINDS",
    "workflow_process",
    'solutionClass: "non_build" | "software"',
    "is required for a software build",
    'isNonBuild ? "completed" : "deployed"'
  ]);
  // Non-build completion records process-initiative evidence, never an app packet.
  assertFileIncludes("src/lib/engine/app-portfolio-registry-store.ts", ["process_initiative", "solutionClass"]);

  // Executable: a process_initiative with non_build evidence is valid registry data
  // and is discoverable, while no app_build_packet store is involved.
  clearRegistry();
  seedRegistry([
    {
      slug: "visitor-followup-process",
      name: "Visitor follow-up process",
      type: "process_initiative",
      status: "active_process",
      problemCategories: ["visitor follow-up process"],
      completedLoops: [{ runId: "exec-proc-1", goal: "Run the visitor follow-up process", status: "completed", solutionClass: "non_build", completedAt: at, evidence: [], blockers: [] }],
      sourceOfTruthFiles: [],
      createdAt: at,
      updatedAt: at
    }
  ]);
  const found = pwc({ title: "visitor follow-up process", repo: "visitor follow-up" });
  assertTrue(
    found.registrySearch.completedLoopMatches.some((m) => m.runId === "exec-proc-1"),
    "non-build (process) evidence is recorded and searchable"
  );
  assertTrue(!fs.existsSync(path.join(stateRoot, "app_build_packet")), "no app_build_packet store exists for a non-build solution");
});

// ---------------------------------------------------------------------------
// 4. Existing app + process fork: both candidates valid, only software builds a packet.
// ---------------------------------------------------------------------------
group("4. Existing app plus process fork", () => {
  const processRoute = routing({ primary: "workflow_process" });
  assertEqual(processRoute, "workflow_process_candidate", "process framing -> workflow_process_candidate");

  const reuseRoute = routing({ primary: "app", existingAppFit: { status: "existing", name: "ChurchConnect", slug: "churchconnect" } });
  assertEqual(reuseRoute, "existing_app_improvement", "reuse framing -> existing_app_improvement");

  // Only the software branch can create a software extension packet: non-build kinds
  // are explicitly excluded from the build-verdict path.
  assertFileIncludes("src/lib/engine/loop-run-records.ts", ["!isNonBuild &&"]);
});

// ---------------------------------------------------------------------------
// 5. Gate enforcement: no side-door build path.
// ---------------------------------------------------------------------------
group("5. Gate enforcement", () => {
  // analyze / planner cannot build: the gate blocks build actions outright.
  assertFileIncludes("src/lib/engine/problem-intake-gate.ts", [
    '"begin_architecture"',
    '"begin_implementation"',
    '"create_app_code_from_conversation"',
    '"create_app_build_packet_before_prior_work_check"'
  ]);
  // ai:build cannot build without a valid gate packet (fails closed).
  assertFileIncludes("scripts/smoke-codex-build-gate.js", ["fails closed without a gate packet", "hasGatePacketReference"]);
  // app_build_packet cannot exist without a passing prior_work_check.
  const noVerdict = runChild("scripts/create-app-build-packet.js", { APP_NAME: "Anything At All" });
  assertTrue(!noVerdict.ok, "app_build_packet refused with no prior_work_check verdict");
  assertFileIncludes("scripts/lib/require-prior-work.js", ['app_build_packet: "build_new"', 'vnext_packet: "extend_existing"']);
  // loop execution cannot happen without a loop_run_record.
  assertFileIncludes("src/lib/engine/loop-run-records.ts", [
    "export async function requireLoopRunForExecution",
    "No loop_run_record exists for this execution"
  ]);
});

// ---------------------------------------------------------------------------
// 6. Registry protection: one canonical memory, no competing sources of truth.
// ---------------------------------------------------------------------------
group("6. Registry protection", () => {
  // app_portfolio_registry is canonical; development_projects is read-only derivation.
  assertFileIncludes("src/lib/engine/app-portfolio-registry-store.ts", ['kind: "app_portfolio_registry" as const']);
  assertFileIncludes("src/lib/engine/development-store.ts", ["app_portfolio_registry is canonical", "legacy/read-only"]);
  // prior_work_check reads the canonical registry (+ completed loops), fail-closed.
  assertFileIncludes("scripts/lib/prior-work-check.js", ["app_portfolio_registry", "registered-apps.json", "blocked_registry_unavailable"]);

  // Executable: a completed loop is searchable by a future prior_work_check.
  clearRegistry();
  seedRegistry([
    appEntry("spark-of-hope", "Spark of Hope", {
      status: "active_product",
      problemCategories: ["testimony", "hope"],
      completedLoops: [{ runId: "exec-spark-1", goal: "Ship testimony sharing", status: "deployed" }]
    })
  ]);
  const future = pwc({ title: "share a testimony of hope", repo: "testimony hope" });
  assertEqual(future.verdict, "extend_existing", "future request finds prior completed work -> extend");
  assertTrue(future.registrySearch.completedLoopMatches.some((m) => m.runId === "exec-spark-1"), "completed loop searchable by future prior_work_check");
});

// ---------------------------------------------------------------------------
// Acceptance invariants.
// ---------------------------------------------------------------------------
group("ACCEPTANCE invariants", () => {
  // one front door: problem_intake_gate is mandatory, every intake resolves to one gate packet.
  assertFileIncludes("src/lib/engine/problem-intake-gate.ts", ['kind: "problem_intake_gate" as const']);
  // one registry: a single canonical store; legacy stores are read-only.
  assertFileIncludes("src/lib/engine/development-store.ts", ["app_portfolio_registry is canonical"]);
  // one prior-work check: a blocking gate before any packet (build or vnext).
  assertFileIncludes("scripts/lib/require-prior-work.js", ["found ${registryHits} prior-work match"]);
  // one execution record: loop_run_records canonical; duplicate runners non-canonical.
  assertFileIncludes("src/lib/engine/loop-run-records.ts", ['key: "execution-loops"']);
  assertEqual(countRunnersMarkedNonCanonical(), 5, "all duplicate trial runners marked non-canonical");
  // multiple valid solution types: software + non_build.
  assertFileIncludes("src/lib/engine/loop-run-records.ts", ["NON_BUILD_PACKET_KINDS"]);
  // no duplicate build path: both build gates fail closed.
  assertFileIncludes("scripts/smoke-build-gate.js", ["missing_passing_prior_work_check"]);
});

// Emit the latest-regression result for the read-only status dashboard. Written
// to the PROJECT root (not the isolated temp state root) so the dashboard reads it.
writeRegressionResult();

if (failures) {
  console.error(`\ncanonical-flow-regression: ${failures} check(s) FAILED`);
  process.exit(1);
}
console.log(`\ncanonical-flow-regression: all checks passed (${stateRoot})`);

function writeRegressionResult() {
  const resultPath = path.join(repoRoot, ".app-engine", "regression", "canonical-flow-latest.json");
  const payload = {
    kind: "canonical_flow_regression_result",
    suite: "canonical-flow-regression",
    generatedAt: new Date().toISOString(),
    passed: failures === 0,
    totalChecks: results.length,
    failedChecks: failures,
    checks: results
  };
  try {
    fs.mkdirSync(path.dirname(resultPath), { recursive: true });
    fs.writeFileSync(resultPath, `${JSON.stringify(payload, null, 2)}\n`);
  } catch {
    // Non-fatal: the suite's own pass/fail is the source of truth.
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function group(title, fn) {
  console.log(`\n# ${title}`);
  fn();
}

function check(label, ok, detail) {
  results.push({ label, ok: Boolean(ok) });
  if (ok) {
    console.log(`  ok - ${label}`);
  } else {
    failures += 1;
    console.error(`  not ok - ${label}${detail ? ` :: ${detail}` : ""}`);
  }
}

function assertTrue(value, label) {
  check(label, Boolean(value));
}

function assertEqual(actual, expected, label) {
  check(label, actual === expected, `expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
}

function assertFileIncludes(relativePath, expectedValues) {
  let content = "";
  try {
    content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
  } catch (caught) {
    check(`${relativePath} readable`, false, caught.message);
    return;
  }
  for (const expected of expectedValues) {
    check(`${relativePath} includes ${JSON.stringify(expected)}`, content.includes(expected));
  }
}

function pwc({ title, goal = "x", repo, selfGatePacketId }) {
  return runPriorWorkCheck({
    request: { runId: "regression", title, goal, gatePacketId: selfGatePacketId },
    selfGatePacketId,
    targetRepo: { name: repo, candidatePaths: ["loop-runs"], backupSchemaPaths: [] },
    capabilities: [{ id: "cap", description: goal, componentHints: ["ZzzNoSuchComponent"] }]
  });
}

function routing({ primary, existingAppFit }) {
  const inputPath = writeJsonTmp(`routing-${primary}.json`, {
    problemSolutionIntake: {
      kind: "problem_solution_intake",
      mode: "problem_first",
      rawRequest: "Our church is struggling to follow up with first-time visitors consistently.",
      problem: {
        summary: "First-time visitors are not followed up with consistently.",
        affectedPeople: ["first-time visitors", "follow-up team"],
        barriers: ["No consistent follow-up."],
        needAddressed: "Consistent follow-up.",
        desiredTransformation: "Every visitor followed up promptly.",
        movementTowardLife: "Visitors feel connected."
      },
      solutionShape: { primary, existingAppFit, secondary: [], rationale: "Regression fixture." },
      routing: { nextSafeAction: "owner_review_before_packet" },
      guardrails: { planningOnly: true }
    }
  });
  const outPath = path.join(stateRoot, `routing-${primary}-out.json`);
  const res = runChild("scripts/create-problem-portfolio-routing.js", {
    PROBLEM_PORTFOLIO_ROUTING_INPUT: inputPath,
    PROBLEM_PORTFOLIO_ROUTING_OUTPUT: outPath
  });
  if (!res.ok) return `(routing failed: ${res.output.slice(0, 120)})`;
  return JSON.parse(fs.readFileSync(outPath, "utf8")).candidate?.type;
}

function extendVerdict(name) {
  return {
    kind: "prior_work_check",
    passed: true,
    verdict: "extend_existing",
    sourceRequest: { runId: "x", title: name, goal: "" },
    targetRepo: { name },
    registrySearch: { available: true, registeredMatches: [{ slug: name.toLowerCase(), score: "exact" }], completedLoopMatches: [] }
  };
}

function appEntry(slug, name, { status = "active_product", completedLoops = [], problemCategories = [], gatePacketId } = {}) {
  return {
    slug,
    name,
    type: status === "active_product" ? "ministry_tool" : "app_project",
    status,
    gatePacketId,
    problemCategories,
    sourceOfTruthFiles: [],
    completedLoops: completedLoops.map((loop) => ({ completedAt: at, evidence: [], blockers: [], ...loop })),
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

function writeVerdict(obj) {
  return writeJsonTmp(`verdict-${Math.abs(hash(JSON.stringify(obj)))}.json`, obj);
}

function writeJsonTmp(name, obj) {
  const file = path.join(stateRoot, name);
  fs.writeFileSync(file, JSON.stringify(obj));
  return file;
}

function runChild(script, env) {
  try {
    const output = execFileSync(process.execPath, [path.join(repoRoot, script)], {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { ok: true, output };
  } catch (caught) {
    return { ok: false, output: `${caught.stdout || ""}${caught.stderr || ""}${caught.message || ""}` };
  }
}

function countRunnersMarkedNonCanonical() {
  const dir = path.join(repoRoot, "src/lib/engine");
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => fs.readFileSync(path.join(dir, file), "utf8").includes("CANONICAL_EXECUTION_NOTE")).length;
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}
