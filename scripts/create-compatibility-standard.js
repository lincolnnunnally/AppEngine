import fs from "node:fs";
import path from "node:path";

const combinedOutput = process.env.COMPATIBILITY_OUTPUT || "";
const compatibilityOutput = process.env.COMPATIBILITY_PLAN_OUTPUT || "";
const followUpsOutput = process.env.COMPATIBILITY_FOLLOWUPS_OUTPUT || "";
const inputPath = process.env.COMPATIBILITY_INPUT || "";

const input = readInput(inputPath);
const appName = input.name || process.env.APP_NAME || "Example App";
const slug = input.slug || process.env.APP_SLUG || slugify(appName);
const fileUploadsUsed = booleanFrom(input.fileUploadsUsed, process.env.APP_FILE_UPLOADS_USED, false);
const paymentsUsed = booleanFrom(input.paymentsUsed, process.env.APP_PAYMENTS_USED, false);

const compatibilityPlan =
  input.compatibilityTestPlan ||
  buildCompatibilityTestPlan({
    appName,
    slug,
    fileUploadsUsed,
    paymentsUsed
  });

const followUpTasks = buildFollowUpTasks({ appName, slug, compatibilityPlan });
const output = {
  agent: "workflow_tester",
  status: "needs_follow_up",
  summary: `Created Compatibility Test Plan for ${appName}.`,
  artifacts: [
    {
      kind: "compatibility_test_plan",
      title: `${appName} Compatibility Test Plan`,
      content: compatibilityPlan
    }
  ],
  findings: [],
  followUpTasks,
  handoffTo: ["workflow_tester", "code_reviewer", "fixer"]
};

validateCompatibilityTestPlan(compatibilityPlan);

if (combinedOutput) writeJson(combinedOutput, output);
if (compatibilityOutput) writeJson(compatibilityOutput, compatibilityPlan);
if (followUpsOutput) writeJson(followUpsOutput, { followUpTasks });

console.log(`compatibility ok: ${appName} (${slug})`);
console.log(`browsers: ${compatibilityPlan.browserSupport.map((item) => item.id).join(", ")}`);

function readInput(filePath) {
  if (!filePath) return {};
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return {};
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function booleanFrom(inputValue, envValue, fallback) {
  if (typeof inputValue === "boolean") return inputValue;
  const value = String(envValue || "").trim().toLowerCase();
  if (!value) return fallback;
  return value === "true" || value === "1" || value === "yes";
}

function buildCompatibilityTestPlan({ appName, slug, fileUploadsUsed, paymentsUsed }) {
  return {
    kind: "compatibility_test_plan",
    schemaVersion: 1,
    app: {
      name: appName,
      slug
    },
    browserSupport: [
      browserTarget("iphone_safari", "Safari", "iPhone", "390x844", true),
      browserTarget("ipad_safari", "Safari", "iPad", "768x1024", true),
      browserTarget("desktop_safari", "Safari", "macOS desktop", "1440x900", true),
      browserTarget("chrome_mobile", "Chrome", "Android or iOS mobile", "390x844", true),
      browserTarget("chrome_desktop", "Chrome", "desktop", "1440x900", true),
      browserTarget("edge_desktop", "Edge", "desktop", "1280x720", false),
      browserTarget("firefox_desktop", "Firefox", "desktop", "1280x720", false)
    ],
    viewports: ["360x640", "390x844", "430x932", "768x1024", "1024x768", "1280x720", "1440x900"],
    checks: [
      compatibilityCheck("mobile_first_layout", "Does the main workflow work cleanly at mobile widths?"),
      compatibilityCheck("responsive_navigation", "Does navigation remain usable across phone, tablet, and desktop?"),
      compatibilityCheck("touch_targets", "Can the primary workflow be completed comfortably with touch?"),
      compatibilityCheck("forms_validation", "Can required forms be completed and corrected on mobile and desktop browsers?"),
      compatibilityCheck("auth_flows", "Do sign-in, sign-out, protected routes, and redirects work across Safari and common browsers?"),
      compatibilityCheck("file_uploads_if_used", "If the app uses uploads, do uploads work on mobile Safari and desktop browsers?"),
      compatibilityCheck("payments_if_used", "If the app uses payments, do payment flows work on mobile Safari and common browsers?"),
      compatibilityCheck("admin_screens", "Can admins use required screens on tablet and desktop without layout or control issues?"),
      compatibilityCheck("super_admin_status", "Is Super Admin status readable and actionable across common viewports?"),
      compatibilityCheck("browser_api_fallbacks", "Are browser-specific APIs guarded with practical fallbacks?")
    ],
    conditionalChecks: {
      fileUploadsIfUsed: true,
      fileUploadsUsed,
      paymentsIfUsed: true,
      paymentsUsed
    },
    workflowTestChecks: ["iPhone Safari", "iPad Safari", "desktop Safari", "Chrome mobile", "Chrome desktop", "Edge desktop", "Firefox desktop", "touch targets", "forms", "auth flows", "admin screens"],
    guardrails: {
      blocksReleaseGateApproval: true,
      safariMobileRequired: true,
      commonBrowsersRequired: true,
      touchTargetsRequired: true,
      formsRequired: true,
      authFlowsRequired: true,
      adminScreensRequired: true,
      unresolvedCompatibilityIssuesBlockRelease: true
    }
  };
}

function browserTarget(id, browser, platform, viewport, required) {
  return {
    id,
    browser,
    platform,
    viewport,
    required,
    status: "required"
  };
}

function compatibilityCheck(id, question) {
  return {
    id,
    status: "required",
    question
  };
}

function buildFollowUpTasks({ appName, slug, compatibilityPlan }) {
  return [
    {
      title: `[${slug}] Compatibility Test Plan`,
      recommendedLabel: "ai:review",
      body: [
        `Create or run the Compatibility Test Plan for ${appName}.`,
        "",
        "## Compatibility",
        `- Browsers/platforms: ${compatibilityPlan.browserSupport.map((item) => `${item.platform} ${item.browser}`).join(", ")}`,
        `- Viewports: ${compatibilityPlan.viewports.join(", ")}`,
        `- Checks: ${compatibilityPlan.checks.map((check) => check.id).join(", ")}`,
        "",
        "## Guardrails",
        "- Block Release Gate approval if Safari, mobile, forms, auth, admin, upload, payment, or common browser issues remain unresolved.",
        "- Create ai:fix follow-up work for release-blocking compatibility issues."
      ].join("\n")
    },
    {
      title: `[${slug}] Safari and mobile compatibility checks`,
      recommendedLabel: "ai:review",
      body: [
        `Test Safari and mobile compatibility for ${appName}.`,
        "",
        "## Required Targets",
        "- iPhone Safari",
        "- iPad Safari",
        "- Desktop Safari",
        "- Chrome mobile",
        "",
        "## Required Checks",
        "- Mobile-first layout",
        "- Navigation and primary actions",
        "- Touch targets",
        "- Forms and validation",
        "- Auth flows and redirects",
        "- File uploads if used",
        "- Payments if used"
      ].join("\n")
    },
    {
      title: `[${slug}] Common browser workflow checks`,
      recommendedLabel: "ai:review",
      body: [
        `Test common browser workflows for ${appName}.`,
        "",
        "## Required Targets",
        "- Chrome desktop",
        "- Edge desktop",
        "- Firefox desktop",
        "",
        "## Required Checks",
        "- Main user workflow",
        "- Forms and auth",
        "- Admin screens",
        "- Super Admin status",
        "- Browser API fallbacks",
        "",
        "## Guardrails",
        "- Do not mark release ready when common browser issues break required user, auth, payment, upload, or admin paths."
      ].join("\n")
    }
  ];
}

function validateCompatibilityTestPlan(plan) {
  const missing = [];

  for (const [label, value] of [
    ["kind", plan.kind],
    ["app.name", plan.app?.name],
    ["app.slug", plan.app?.slug]
  ]) {
    if (!value) missing.push(label);
  }

  for (const [label, value] of [
    ["browserSupport", plan.browserSupport],
    ["viewports", plan.viewports],
    ["checks", plan.checks],
    ["workflowTestChecks", plan.workflowTestChecks]
  ]) {
    if (!Array.isArray(value) || value.length === 0) missing.push(label);
  }

  for (const id of ["iphone_safari", "ipad_safari", "desktop_safari", "chrome_mobile", "chrome_desktop"]) {
    if (!plan.browserSupport?.some((item) => item.id === id)) missing.push(`browserSupport.${id}`);
  }

  for (const id of ["touch_targets", "forms_validation", "auth_flows", "admin_screens"]) {
    if (!plan.checks?.some((check) => check.id === id)) missing.push(`checks.${id}`);
  }

  if (
    !plan.guardrails?.blocksReleaseGateApproval ||
    !plan.guardrails?.safariMobileRequired ||
    !plan.guardrails?.commonBrowsersRequired ||
    !plan.guardrails?.unresolvedCompatibilityIssuesBlockRelease
  ) {
    missing.push("guardrails");
  }

  if (missing.length) throw new Error(`Compatibility test plan is missing required fields: ${missing.join(", ")}`);
}

function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "app";
}
