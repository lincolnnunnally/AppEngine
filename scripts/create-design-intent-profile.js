import fs from "node:fs";
import path from "node:path";

const inputPath = process.env.DESIGN_INTENT_INPUT || "";
const artifactOutput = process.env.DESIGN_INTENT_OUTPUT || "";
const markdownOutput = process.env.DESIGN_INTENT_MARKDOWN_OUTPUT || "";
const followUpsOutput = process.env.DESIGN_INTENT_FOLLOWUPS_OUTPUT || "";

const input = readInput(inputPath);
const profile = buildDesignIntentProfile(input.designIntentProfile || input.design_intent_profile || input);
validateDesignIntentProfile(profile);

if (artifactOutput) writeJson(artifactOutput, profile);
if (markdownOutput) writeText(markdownOutput, renderDesignIntentMarkdown(profile));
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks: buildFollowUpTasks(profile) });

console.log(`design-intent-profile ok: ${profile.app.slug} -> ${profile.visualStylePreference}`);

function buildDesignIntentProfile(input = {}) {
  const styleProfile = normalizeStyleProfile(input.visualStylePreference || input.styleProfile || defaultAppEngineProfile().visualStylePreference);
  const defaults = defaultProfileFor(styleProfile);
  const app = input.app || {};

  const profile = {
    kind: "design_intent_profile",
    schemaVersion: 1,
    app: {
      name: app.name || input.appName || defaultAppEngineProfile().app.name,
      slug: app.slug || input.appSlug || slugify(app.name || input.appName || defaultAppEngineProfile().app.name),
      context: app.context || input.appContext || defaultAppEngineProfile().app.context
    },
    targetAudience: normalizeArray(input.targetAudience || defaults.targetAudience),
    userSophisticationLevel: normalizeSophistication(input.userSophisticationLevel || defaults.userSophisticationLevel),
    desiredEmotionalExperience: normalizeArray(input.desiredEmotionalExperience || defaults.desiredEmotionalExperience),
    brandPersonality: normalizeArray(input.brandPersonality || defaults.brandPersonality),
    trustNeeds: normalizeArray(input.trustNeeds || defaults.trustNeeds),
    accessibilityNeeds: normalizeArray(input.accessibilityNeeds || defaults.accessibilityNeeds),
    visualStylePreference: styleProfile,
    examplesOrReferences: normalizeArray(input.examplesOrReferences || []),
    thingsToAvoid: normalizeArray(input.thingsToAvoid || defaults.thingsToAvoid),
    outputGuidance: normalizeOutputGuidance(input.outputGuidance || {}, defaults.outputGuidance),
    ownerReadableSummary:
      input.ownerReadableSummary ||
      `${app.name || input.appName || defaultAppEngineProfile().app.name} should feel ${normalizeArray(
        input.desiredEmotionalExperience || defaults.desiredEmotionalExperience
      )
        .slice(0, 5)
        .join(", ")} while staying useful, trustworthy, and audience-specific.`,
    guardrails: requiredGuardrails()
  };

  return profile;
}

function validateDesignIntentProfile(profile) {
  const missing = [];

  for (const [label, value] of [
    ["kind", profile.kind],
    ["schemaVersion", profile.schemaVersion],
    ["app.name", profile.app?.name],
    ["app.slug", profile.app?.slug],
    ["userSophisticationLevel", profile.userSophisticationLevel],
    ["visualStylePreference", profile.visualStylePreference],
    ["ownerReadableSummary", profile.ownerReadableSummary]
  ]) {
    if (!isPresent(value)) missing.push(label);
  }

  for (const [label, value] of [
    ["targetAudience", profile.targetAudience],
    ["desiredEmotionalExperience", profile.desiredEmotionalExperience],
    ["brandPersonality", profile.brandPersonality],
    ["trustNeeds", profile.trustNeeds],
    ["accessibilityNeeds", profile.accessibilityNeeds],
    ["thingsToAvoid", profile.thingsToAvoid]
  ]) {
    if (!Array.isArray(value) || value.length === 0) missing.push(label);
  }

  for (const key of outputGuidanceKeys()) {
    if (!isPresent(profile.outputGuidance?.[key])) missing.push(`outputGuidance.${key}`);
  }

  if (profile.kind !== "design_intent_profile") missing.push("kind.design_intent_profile");
  if (!allowedSophisticationLevels().includes(profile.userSophisticationLevel)) missing.push("userSophisticationLevel.allowed");
  if (!styleProfiles().includes(profile.visualStylePreference)) missing.push("visualStylePreference.allowed");

  for (const [label, value] of Object.entries(requiredGuardrails())) {
    if (profile.guardrails?.[label] !== value) missing.push(`guardrails.${label}`);
  }

  if (missing.length) {
    throw new Error(`Design intent profile missing required fields: ${unique(missing).join(", ")}`);
  }
}

function renderDesignIntentMarkdown(profile) {
  return [
    "# Design Intent Profile",
    "",
    `App: ${profile.app.name} (${profile.app.slug})`,
    `Style profile: ${profile.visualStylePreference}`,
    `Audience: ${profile.targetAudience.join(", ")}`,
    `User sophistication: ${profile.userSophisticationLevel}`,
    "",
    "## Intended Feeling",
    profile.desiredEmotionalExperience.map((item) => `- ${item}`).join("\n"),
    "",
    "## Brand Personality",
    profile.brandPersonality.map((item) => `- ${item}`).join("\n"),
    "",
    "## Trust Needs",
    profile.trustNeeds.map((item) => `- ${item}`).join("\n"),
    "",
    "## Accessibility Needs",
    profile.accessibilityNeeds.map((item) => `- ${item}`).join("\n"),
    "",
    "## Things To Avoid",
    profile.thingsToAvoid.map((item) => `- ${item}`).join("\n"),
    "",
    "## Output Guidance",
    outputGuidanceKeys().map((key) => `- ${labelize(key)}: ${profile.outputGuidance[key]}`).join("\n"),
    "",
    "## Owner Summary",
    profile.ownerReadableSummary,
    "",
    "## Guardrails",
    "- Foundation/design intent only.",
    "- No UI redesign is authorized by this artifact.",
    "- No production deploy, paid resources, migrations, secrets/env changes, repository visibility changes, or automatic Codex build work."
  ].join("\n");
}

function buildFollowUpTasks(profile) {
  return [
    {
      title: `[${profile.app.slug}] Apply Design Intent Before UI Work`,
      body: [
        `Use the design_intent_profile for ${profile.app.name} before generating or polishing UI.`,
        "",
        "## Required Source Of Truth To Load",
        "- source-of-truth/00-why-we-build.md",
        "- source-of-truth/01-ecosystem-philosophy.md",
        "- source-of-truth/02-global-principles.md",
        "- source-of-truth/03-life-produces-life.md",
        "- source-of-truth/04-app-purpose-rules.md",
        "- source-of-truth/05-ecosystem-design-gates.md",
        "- source-of-truth/design-intent-engine.md",
        "- source-of-truth/design-quality-gate.md",
        "- source-of-truth/ux-review-standard.md",
        "",
        "## Design Intent",
        `- Audience: ${profile.targetAudience.join(", ")}`,
        `- Style profile: ${profile.visualStylePreference}`,
        `- Intended feeling: ${profile.desiredEmotionalExperience.join(", ")}`,
        `- Avoid: ${profile.thingsToAvoid.join(", ")}`,
        "",
        "## Guardrails",
        "- Do not redesign existing UI unless a later task explicitly approves it.",
        "- Do not deploy production.",
        "- Do not create paid resources.",
        "- Do not apply migrations.",
        "- Do not add secrets or env vars.",
        "- Do not trigger Codex build work automatically."
      ].join("\n"),
      recommendedLabel: "ai:plan"
    }
  ];
}

function defaultAppEngineProfile() {
  return {
    app: {
      name: "AppEngine",
      slug: "appengine",
      context: "owner operating system for autonomous app building"
    },
    visualStylePreference: "warm_approachable"
  };
}

function defaultProfileFor(styleProfile) {
  const base = {
    targetAudience: ["Lincoln", "future app owners", "reviewers"],
    userSophisticationLevel: "mixed",
    desiredEmotionalExperience: ["warm", "approachable", "clean", "hopeful", "practical", "trustworthy"],
    brandPersonality: ["approachable", "practical", "trustworthy"],
    trustNeeds: ["clear state", "visible guardrails", "honest blockers", "next safe action"],
    accessibilityNeeds: ["mobile-first", "readable contrast", "large touch targets", "plain language"],
    thingsToAvoid: ["cold", "generic", "over-complicated", "decorative clutter"],
    outputGuidance: {
      colors: "Warm neutrals with grounded teal, blue, green, or amber status accents.",
      typography: "Readable interface type with clear hierarchy and no oversized dashboard headings.",
      spacing: "Breathable mobile-first spacing with compact dashboard density where needed.",
      cards: "Use cards for repeated items and framed tools; avoid nesting cards.",
      forms: "Plain-English labels, supportive validation, and visible safety notes.",
      dashboards: "Show state, blockers, next safe action, evidence, owner review URL, and version clearly.",
      navigation: "Short route labels and obvious owner paths.",
      buttons: "One clear primary action per section with restrained secondary actions.",
      emptyStates: "Say what is missing and what the next safe action is.",
      mobileLayout: "No horizontal overflow, touch-friendly controls, readable copy, Safari-safe forms."
    }
  };

  const overrides = {
    professional_clean: {
      desiredEmotionalExperience: ["clear", "competent", "credible", "efficient"],
      brandPersonality: ["professional", "clean", "confident"],
      thingsToAvoid: ["cute", "ornamental", "unclear hierarchy", "busy dashboards"]
    },
    premium_modern: {
      desiredEmotionalExperience: ["polished", "confident", "refined", "calm"],
      brandPersonality: ["premium", "modern", "discerning"],
      thingsToAvoid: ["cheap", "loud", "generic gradients", "crowded layouts"]
    },
    playful_friendly: {
      desiredEmotionalExperience: ["encouraging", "easy", "light", "friendly"],
      brandPersonality: ["playful", "kind", "accessible"],
      thingsToAvoid: ["intimidating", "overly formal", "dense", "cold"]
    },
    ministry_community: {
      desiredEmotionalExperience: ["safe", "hopeful", "welcoming", "human"],
      brandPersonality: ["sincere", "relational", "grounded"],
      trustNeeds: ["privacy clarity", "care boundaries", "human follow-up", "plain language"],
      thingsToAvoid: ["manipulative", "performative", "institutional coldness", "purpose bleed"]
    },
    operations_dashboard: {
      desiredEmotionalExperience: ["oriented", "in control", "clear", "capable"],
      brandPersonality: ["practical", "efficient", "trustworthy"],
      trustNeeds: ["current state", "blockers", "evidence links", "auditability"],
      thingsToAvoid: ["marketing hero layouts", "decorative clutter", "hidden state", "unclear next action"]
    }
  };

  return {
    ...base,
    ...(overrides[styleProfile] || {})
  };
}

function normalizeOutputGuidance(input, defaults) {
  return Object.fromEntries(outputGuidanceKeys().map((key) => [key, input[key] || defaults[key]]));
}

function normalizeStyleProfile(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return styleProfiles().includes(normalized) ? normalized : "warm_approachable";
}

function normalizeSophistication(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return allowedSophisticationLevels().includes(normalized) ? normalized : "mixed";
}

function styleProfiles() {
  return ["warm_approachable", "professional_clean", "premium_modern", "playful_friendly", "ministry_community", "operations_dashboard"];
}

function allowedSophisticationLevels() {
  return ["beginner", "mixed", "advanced", "operator"];
}

function outputGuidanceKeys() {
  return ["colors", "typography", "spacing", "cards", "forms", "dashboards", "navigation", "buttons", "emptyStates", "mobileLayout"];
}

function requiredGuardrails() {
  return {
    foundationOnly: true,
    noUiRedesign: true,
    noProductionDeploy: true,
    noPaidResources: true,
    noMigrations: true,
    noSecretsOrEnvChanges: true,
    repositoryVisibilityUnchanged: true,
    noAutomaticCodexBuild: true
  };
}

function readInput(filePath) {
  if (!filePath) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${value}\n`);
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function isPresent(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function unique(values) {
  return [...new Set(values)];
}

function slugify(value) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug || "app";
}

function labelize(value) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}
