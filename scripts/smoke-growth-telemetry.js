// Smoke: the growth telemetry spine — one canonical client, copied into both
// newly generated apps (growth-telemetry module) and the pre-existing fleet
// (retrofit-telemetry.mjs), reporting to one shared ingest function.
//
// The thing most worth guarding here is DRIFT: the same client now lives in ~20
// repos, so a fix applied to a copy instead of the canonical source would look
// like it worked while most apps kept the bug.
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

runStep("canonical client exists and exports the funnel contract", () => {
  assertFileIncludes("shared-client/lpl-telemetry/telemetry.ts", [
    "export function initTelemetry",
    "export function track",
    "export function identify",
    "export const funnel",
    "signup_started",
    "signup_completed",
    "payment_completed",
    // privacy guarantees the ingest depends on
    "doNotTrackEnabled",
    "sendBeacon"
  ]);
});

runStep("the Next component avoids the case-insensitive filename collision", () => {
  assertFileExists("shared-client/lpl-telemetry/TelemetryProvider.tsx");
  assertFileMissing("shared-client/lpl-telemetry/Telemetry.tsx");
  // Importing './telemetry' from a file named 'Telemetry.tsx' resolves to itself
  // on macOS, which silently breaks every Next app in the fleet.
  assertFileIncludes("shared-client/lpl-telemetry/TelemetryProvider.tsx", [
    "'use client'",
    "from './telemetry'",
    "Suspense"
  ]);
});

runStep("generated apps are born instrumented", () => {
  assertFileIncludes("src/lib/engine/modules/growth-telemetry.ts", [
    'slug: "growth-telemetry"',
    'tier: "foundation"',
    "src/lib/TelemetryProvider.tsx"
  ]);
  assertFileIncludes("src/lib/engine/modules/registry.ts", ["growthTelemetryModule"]);
  assertFileIncludes("src/lib/engine/app-generator.ts", [
    '@/lib/TelemetryProvider',
    '<Telemetry app='
  ]);
});

runStep("the module emits the canonical client, not a fork of it", () => {
  // Reads the real file at generation time; a second inline copy is exactly the
  // drift this smoke exists to prevent.
  assertFileIncludes("src/lib/engine/modules/growth-telemetry.ts", [
    "shared-client",
    "readFileSync",
    'canonical("telemetry.ts")',
    'canonical("TelemetryProvider.tsx")'
  ]);
});

runStep("retrofitted apps still match the canonical source byte for byte", () => {
  const canonical = readFile("shared-client/lpl-telemetry/telemetry.ts");
  const workspace = path.resolve(repoRoot, "../..");

  // Only the TypeScript copies are compared directly. The two plain-JavaScript
  // CRA apps carry a transpiled copy, which cannot be byte-equal by definition.
  const tsCopies = [
    "furfriend/src/lib/telemetry.ts",
    "childfirst-solutions/src/lib/telemetry.ts",
    "toner-management-app/src/lib/telemetry.ts",
    "presence-moments/lib/telemetry.ts"
  ];

  let checked = 0;
  for (const rel of tsCopies) {
    const full = path.join(workspace, rel);
    if (!fs.existsSync(full)) continue; // repo not checked out on this machine
    if (fs.readFileSync(full, "utf8") !== canonical) {
      throw new Error(`${rel} has drifted from shared-client/lpl-telemetry/telemetry.ts — ` +
        `fix the canonical source and re-run scripts/retrofit-telemetry.mjs`);
    }
    checked += 1;
  }

  if (checked === 0) {
    console.log("  (no sibling repos checked out; drift comparison skipped)");
  }
});

runStep("the ingest function gates on registry + origin, and drops PII", () => {
  assertFileIncludes("shared-edge-functions/ecosystem-telemetry/index.ts", [
    "lpl_app_registry",
    "originAllowed",
    "unknown app",
    "origin not allowed",
    "EVENT_NAME_RE",
    "MAX_EVENTS_PER_REQUEST"
  ]);
  const source = readFile("shared-edge-functions/ecosystem-telemetry/index.ts");
  if (source.includes("x-forwarded-for") || source.includes("x-real-ip")) {
    throw new Error("the ingest function must never read a raw client IP");
  }
});

runStep("package exposes the growth scripts", () => {
  assertFileIncludes("package.json", [
    '"smoke:growth-telemetry"',
    '"growth:retrofit"',
    '"growth:seo"'
  ]);
});

console.log("growth-telemetry smoke ok");

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

function assertFileExists(relativePath) {
  if (!fs.existsSync(path.join(repoRoot, relativePath))) {
    throw new Error(`${relativePath} should exist`);
  }
}

function assertFileMissing(relativePath) {
  if (fs.existsSync(path.join(repoRoot, relativePath))) {
    throw new Error(`${relativePath} must not exist — it collides with telemetry.ts on macOS`);
  }
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}
