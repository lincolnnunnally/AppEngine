import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const smokeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "appengine-design-intent-"));

runStep("standard is discoverable", () => {
  assertFileIncludes("source-of-truth/design-intent-engine.md", [
    "design_intent_profile",
    "warm_approachable",
    "professional_clean",
    "premium_modern",
    "playful_friendly",
    "ministry_community",
    "operations_dashboard"
  ]);

  assertFileIncludes("agents/manifest.yaml", ["source-of-truth/design-intent-engine.md", "design_intent_profile"]);
  assertFileIncludes("agents/context/output-contracts.md", ["design_intent_profile"]);
  assertFileIncludes("source-of-truth/context-checklist.md", ["Design Intent Engine"]);
  assertFileIncludes("src/lib/engine/agent-artifacts.ts", ["design_intent_profile"]);
});

runStep("default AppEngine profile works", () => {
  const profile = runDesignIntent("default-appengine.json", {});

  assertEqual(profile.kind, "design_intent_profile", "artifact kind");
  assertEqual(profile.app.slug, "appengine", "default app slug");
  assertEqual(profile.visualStylePreference, "warm_approachable", "default style profile");
  assertArrayIncludes(profile.desiredEmotionalExperience, "hopeful", "default feeling");
  assertArrayIncludes(profile.thingsToAvoid, "generic", "default avoid list");
  assertEqual(profile.guardrails.noAutomaticCodexBuild, true, "no automatic build guardrail");
});

runStep("custom operations dashboard profile works", () => {
  const profile = runDesignIntent("operations-dashboard.json", {
    app: {
      name: "Toner Management",
      slug: "toner-management",
      context: "printer supply stewardship and operations"
    },
    targetAudience: ["office managers", "service technicians"],
    userSophisticationLevel: "operator",
    desiredEmotionalExperience: ["in control", "clear", "efficient"],
    brandPersonality: ["practical", "precise", "trustworthy"],
    trustNeeds: ["accurate stock state", "clear next reorder action"],
    accessibilityNeeds: ["mobile inventory checks", "readable status colors"],
    visualStylePreference: "operations_dashboard",
    examplesOrReferences: ["clean inventory dashboards"],
    thingsToAvoid: ["marketing hero layouts", "decorative clutter"],
    outputGuidance: {
      colors: "Neutral operational palette with clear stock status colors.",
      typography: "Compact readable type for repeated scanning.",
      spacing: "Dense but not cramped.",
      cards: "Use cards for inventory exceptions and repeated account items.",
      forms: "Fast entry, clear validation, mobile-friendly numeric inputs.",
      dashboards: "Prioritize stock state, reorder urgency, owner, and recent activity.",
      navigation: "Short operational labels.",
      buttons: "Primary action should be reorder or resolve.",
      emptyStates: "Say what inventory data is missing.",
      mobileLayout: "Technicians can check status on phones without horizontal scrolling."
    }
  });

  assertEqual(profile.app.slug, "toner-management", "custom app slug");
  assertEqual(profile.userSophisticationLevel, "operator", "custom sophistication");
  assertEqual(profile.visualStylePreference, "operations_dashboard", "custom style profile");
  assertIncludes(profile.outputGuidance.dashboards, "stock state", "dashboard guidance");
});

runStep("missing required fields fail honestly", () => {
  const inputPath = path.join(smokeRoot, "missing-fields.json");
  const outputPath = path.join(smokeRoot, "missing-fields-output.json");

  writeJson(inputPath, {
    app: {
      name: "Missing Design Intent",
      slug: "missing-design-intent"
    },
    targetAudience: [],
    desiredEmotionalExperience: [],
    brandPersonality: [],
    trustNeeds: [],
    accessibilityNeeds: [],
    thingsToAvoid: [],
    visualStylePreference: "warm_approachable",
    outputGuidance: {}
  });

  assertThrows(() => {
    execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-design-intent-profile.js")], {
      cwd: repoRoot,
      env: {
        ...process.env,
        DESIGN_INTENT_INPUT: inputPath,
        DESIGN_INTENT_OUTPUT: outputPath
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  }, "targetAudience");
});

console.log(`design-intent-profile smoke ok (${smokeRoot})`);

function runStep(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (caught) {
    console.error(`not ok - ${name}`);
    throw caught;
  }
}

function runDesignIntent(name, input) {
  const inputPath = path.join(smokeRoot, name);
  const outputPath = path.join(smokeRoot, name.replace(".json", "-profile.json"));
  const markdownPath = path.join(smokeRoot, name.replace(".json", "-profile.md"));
  const followUpsPath = path.join(smokeRoot, name.replace(".json", "-followups.json"));

  writeJson(inputPath, input);

  execFileSync(process.execPath, [path.join(repoRoot, "scripts/create-design-intent-profile.js")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      DESIGN_INTENT_INPUT: inputPath,
      DESIGN_INTENT_OUTPUT: outputPath,
      DESIGN_INTENT_MARKDOWN_OUTPUT: markdownPath,
      DESIGN_INTENT_FOLLOWUPS_OUTPUT: followUpsPath
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  const profile = readJson(outputPath);
  const markdown = fs.readFileSync(markdownPath, "utf8");
  const followUps = readJson(followUpsPath);

  assertIncludes(markdown, "Design Intent Profile", "markdown title");
  assertIncludes(markdown, "No UI redesign is authorized", "markdown guardrail");
  assertEqual(followUps.followUpTasks.length, 1, "follow-up count");
  assertIncludes(followUps.followUpTasks[0].body, "source-of-truth/design-intent-engine.md", "follow-up source file");

  return profile;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(value, expected, message) {
  if (!String(value).includes(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(value)} to include ${JSON.stringify(expected)}`);
  }
}

function assertArrayIncludes(values, expected, message) {
  if (!Array.isArray(values) || !values.includes(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(values)} to include ${JSON.stringify(expected)}`);
  }
}

function assertFileIncludes(relativePath, expectedValues) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

  for (const expected of expectedValues) {
    assertIncludes(content, expected, `${relativePath} includes ${expected}`);
  }
}

function assertThrows(fn, expectedMessage) {
  try {
    fn();
  } catch (caught) {
    const message = caught.stderr ? String(caught.stderr) : caught.message;
    assertIncludes(message, expectedMessage, "expected thrown message");
    return;
  }

  throw new Error(`expected function to throw ${expectedMessage}`);
}
