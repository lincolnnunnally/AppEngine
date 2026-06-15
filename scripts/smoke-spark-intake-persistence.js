import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spark-intake-persistence-"));
const moduleUrl = pathToFileURL(path.join(repoRoot, "src/lib/spark-of-hope-intake-lite/intake.ts")).href;
const intake = await import(moduleUrl);

const validPayload = {
  preferredName: "Preview Tester",
  email: "preview@example.invalid",
  storyTitle: "A careful preview",
  storyBody:
    "This is a synthetic preview story with enough length to validate the controlled persistence path safely.",
  mayReview: true,
  mayContact: true,
  mayPrepareEncouragement: true
};

await runStep("mock mode remains default and stores nothing", async () => {
  const result = await intake.submitStoryIntake(validPayload, {
    env: {},
    reference: "SOH-LITE-PREVIEW-TEST"
  });

  assertEqual(result.status, 200, "mock result status");
  assertEqual(result.body.mode, "preview_mock", "mock result mode");
  assertEqual(result.body.stored, false, "mock result does not persist");
  assertEqual(result.body.reference, "SOH-LITE-PREVIEW-TEST", "mock result reference");
});

await runStep("controlled preview mode fails safe without database config", async () => {
  const result = await intake.submitStoryIntake(validPayload, {
    env: {
      SOH_LITE_PERSISTENCE_MODE: "preview",
      SOH_LITE_PRIVACY_COPY_VERSION: "spark-lite-preview-v1"
    },
    reference: "SOH-LITE-PREVIEW-NODB"
  });

  assertEqual(result.status, 503, "missing database status");
  assertEqual(result.body.mode, "preview_controlled_persistence", "missing database mode");
  assertEqual(result.body.stored, false, "missing database stores nothing");
  assertEqual(result.body.code, "preview_database_not_configured", "missing database code");
});

await runStep("controlled preview writes separated private-safe records when injected sql succeeds", async () => {
  const captured = [];
  const fakeSql = async (strings, ...values) => {
    captured.push({ strings: Array.from(strings), values });
    return [
      {
        reference: "SOH-LITE-PREVIEW-STORED",
        reviewStatus: "new",
        privacyStatus: "private"
      }
    ];
  };

  const result = await intake.submitStoryIntake(validPayload, {
    env: {
      DATABASE_URL: "postgres://preview.invalid/db",
      SOH_LITE_PERSISTENCE_MODE: "preview",
      SOH_LITE_PRIVACY_COPY_VERSION: "spark-lite-preview-v1"
    },
    reference: "SOH-LITE-PREVIEW-STORED",
    sql: fakeSql
  });

  assertEqual(result.status, 200, "controlled preview status");
  assertEqual(result.body.mode, "preview_controlled_persistence", "controlled preview mode");
  assertEqual(result.body.stored, true, "controlled preview stores");
  assertEqual(result.body.reviewStatus, "new", "controlled preview review status");
  assertEqual(captured.length, 1, "controlled preview uses one atomic sql statement");

  const sqlSource = captured[0].strings.join(" ");
  assertIncludes(sqlSource, "soh_lite_story_submissions", "writes story submissions");
  assertIncludes(sqlSource, "soh_lite_story_contacts", "writes contact table separately");
  assertIncludes(sqlSource, "soh_lite_story_consents", "writes consent table separately");
  assertIncludes(sqlSource, "soh_lite_status_events", "writes status event");
  assertIncludes(sqlSource, "soh_lite_audit_events", "writes audit event");

  const metadata = captured[0].values
    .filter((value) => typeof value === "string" && value.includes('"mode":"preview_controlled_persistence"'))
    .map((value) => JSON.parse(value));

  assertEqual(metadata.length, 1, "one private-safe audit metadata payload");
  assertEqual(metadata[0].privacyCopyVersion, "spark-lite-preview-v1", "privacy copy version is recorded");
  assertEqual(metadata[0].contactProvided, true, "metadata records contact presence without contact value");
  assertDoesNotInclude(JSON.stringify(metadata[0]), validPayload.storyBody, "audit metadata should not include story body");
  assertDoesNotInclude(JSON.stringify(metadata[0]), validPayload.email, "audit metadata should not include contact email");
});

await runStep("generated app schemas remain inert", () => {
  execFileSync(process.execPath, [path.join(repoRoot, "scripts/check-generated-app-migration-guard.js")], {
    cwd: repoRoot,
    env: process.env,
    stdio: "pipe",
    encoding: "utf8"
  });
});

console.log(`spark intake persistence smoke ok (${smokeRoot})`);

async function runStep(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(value, expected, message) {
  if (!String(value).includes(expected)) {
    throw new Error(`${message}: expected value to include ${JSON.stringify(expected)}`);
  }
}

function assertDoesNotInclude(value, expected, message) {
  if (String(value).includes(expected)) {
    throw new Error(`${message}: did not expect value to include ${JSON.stringify(expected)}`);
  }
}
