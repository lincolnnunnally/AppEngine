import fs from "node:fs";
import path from "node:path";

const packetOutput = process.env.APP_BUILD_PACKET_OUTPUT || "";
const followUpsOutput = process.env.APP_BUILD_PACKET_FOLLOWUPS_OUTPUT || "";
const inputPath = process.env.APP_BUILD_PACKET_INPUT || "";

const input = readInput(inputPath);
const appName = input.name || process.env.APP_NAME || "Example App";
const slug = input.slug || process.env.APP_SLUG || slugify(appName);
const charterPath = input.charterPath || process.env.APP_CHARTER_PATH || `source-of-truth/charters/${slug}.md`;
const purpose = input.purpose || process.env.APP_PURPOSE || "Describe why this app exists.";
const audience = input.audience || listFromEnv("APP_AUDIENCE", ["Primary users"]);
const helped = input.helped || listFromEnv("APP_HELPED", ["People or organizations helped by this app"]);
const boundaries = input.boundaries || listFromEnv("APP_BOUNDARIES", ["Do not absorb unrelated app goals or audiences."]);
const successDefinition = input.successDefinition || process.env.APP_SUCCESS_DEFINITION || "Define the measurable outcome that proves the app is useful.";
const deploymentTarget = input.deploymentTarget || process.env.APP_DEPLOYMENT_TARGET || "Vercel preview first; production only after human approval.";
const dataPrivacyNotes = input.dataPrivacyNotes || process.env.APP_DATA_PRIVACY_NOTES || "Document ownership, retention, access, and privacy expectations before launch.";
const mvpStages = input.mvpStages || defaultMvpStages(appName);
const superAdminRequirements =
  input.superAdminRequirements ||
  listFromEnv("APP_SUPER_ADMIN_REQUIREMENTS", [
    "management",
    "monitoring",
    "health",
    "logs",
    "users",
    "billing/status if needed",
    "admin actions",
    "deployment/environment status"
  ]);

const packet = {
  kind: "app_build_packet",
  schemaVersion: 1,
  app: {
    name: appName,
    slug,
    charterPath,
    purpose,
    audience,
    helped,
    boundaries,
    successDefinition,
    deploymentTarget,
    dataPrivacyNotes,
    mvpStages,
    superAdminIntegration: {
      required: true,
      dashboard: "AppEngine Super Admin",
      requirements: superAdminRequirements
    }
  },
  guardrails: {
    noGiantCodexTask: true,
    preventGoalBleed: true,
    requireContextGate: true,
    requirePhaseFollowUps: true,
    noProductionDeployWithoutApproval: true,
    notes: [
      "Keep this app inside its charter.",
      "Create phased follow-up issues instead of one giant Codex task.",
      "Register management, monitoring, health, logs, users, billing/status if needed, and admin actions with Super Admin."
    ]
  },
  phases: buildPhases(slug),
  followUpTasks: []
};

packet.followUpTasks = packet.phases.map((phase) => toFollowUpTask(packet, phase));

validatePacket(packet);

if (packetOutput) {
  writeJson(packetOutput, packet);
}

if (followUpsOutput) {
  writeJson(followUpsOutput, { followUpTasks: packet.followUpTasks });
}

console.log(`app-build-packet ok: ${packet.app.name} (${packet.app.slug})`);
console.log(`phases: ${packet.phases.map((phase) => phase.id).join(", ")}`);

function readInput(filePath) {
  if (!filePath) return {};
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return {};
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function listFromEnv(name, fallback) {
  const raw = process.env[name] || "";
  if (!raw.trim()) return fallback;
  return raw
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultMvpStages(name) {
  return [
    {
      id: "chartered-intake",
      name: "Chartered Intake",
      goal: `Confirm ${name}'s audience, boundaries, success definition, and first useful workflow.`
    },
    {
      id: "working-mvp",
      name: "Working MVP",
      goal: "Build the smallest end-to-end workflow that helps the primary audience."
    },
    {
      id: "managed-preview",
      name: "Managed Preview",
      goal: "Connect preview deployment, Super Admin status, monitoring, and review gates."
    }
  ];
}

function buildPhases(slug) {
  return [
    phase("discovery", "Discovery", "discovery", "ai:plan", "Clarify the problem, audience, alternatives, and opportunity.", [
      "Problem and primary audience are named.",
      "Alternatives and underserved gaps are documented."
    ]),
    phase("charter", "Charter", "planner", "ai:plan", "Create the app charter, boundaries, success definition, and MVP stages.", [
      `Charter exists at source-of-truth/charters/${slug}.md or a specific planned path.`,
      "Boundaries state what this app must not become."
    ]),
    phase("architecture", "Architecture", "systems", "ai:plan", "Define stack, routes, permissions, integrations, and Super Admin registration plan.", [
      "Architecture identifies generated-app services and central AppEngine touchpoints.",
      "No production deploy path is enabled without approval."
    ]),
    phase("data_model", "Data Model", "builder", "ai:build", "Define database schema, ownership, privacy, seed data, and migrations.", [
      "Data ownership and privacy notes are explicit.",
      "Generated schema can be applied safely to a preview database."
    ]),
    phase("ui_design", "UI Design", "designer", "ai:build", "Define user flows, screens, copy, accessibility, and design direction.", [
      "Primary workflow is visible and testable.",
      "Design supports the app audience and charter."
    ]),
    phase("mvp_build", "MVP Build", "builder", "ai:build", "Build the first useful scope without absorbing later phases.", [
      "MVP implements the chartered workflow only.",
      "Build remains reviewable in a focused pull request."
    ]),
    phase("testing", "Testing", "workflow_tester", "ai:review", "Verify workflows, acceptance criteria, permissions, and edge cases.", [
      "Full user journey is tested.",
      "Failures create ai:fix follow-up tasks."
    ]),
    phase("review", "Review", "code_reviewer", "ai:review", "Review code, security, maintainability, scope, and app-boundary risks.", [
      "Security and maintainability risks are recorded.",
      "App-goal bleeding is checked before merge."
    ]),
    phase("deployment", "Deployment", "workflow_tester", "ai:review", "Prepare preview deployment gates and production approval notes.", [
      "Preview deployment target is documented.",
      "Production deploy remains approval-gated."
    ]),
    phase("monitoring", "Monitoring", "monitor", "ai:monitor", "Define health checks, logs, incidents, alerts, and monitor follow-ups.", [
      "Health and logs are visible from Super Admin or linked from it.",
      "Incident follow-up path is documented."
    ]),
    phase("super_admin_registration", "Super Admin Registration", "builder", "ai:build", "Register management, monitoring, health, logs, users, billing/status if needed, and admin actions.", [
      "App appears or is planned in AppEngine Super Admin.",
      "Admin actions and status links are defined."
    ])
  ];
}

function phase(id, name, agent, label, goal, acceptanceCriteria) {
  return {
    id,
    name,
    agent,
    label,
    goal,
    deliverables: [
      `${name} notes`,
      `${name} acceptance criteria`,
      `${name} handoff summary`
    ],
    acceptanceCriteria
  };
}

function toFollowUpTask(packet, phase) {
  const app = packet.app;
  return {
    title: `[${app.slug}] Phase: ${phase.name}`,
    recommendedLabel: phase.label,
    body: [
      `Run the ${phase.name} phase from the App Build Packet for ${app.name}.`,
      "",
      "## App Build Packet",
      `- App: ${app.name}`,
      `- Slug: ${app.slug}`,
      `- Charter: ${app.charterPath}`,
      `- Purpose: ${app.purpose}`,
      `- Audience: ${app.audience.join(", ")}`,
      `- Success: ${app.successDefinition}`,
      `- Deployment target: ${app.deploymentTarget}`,
      "",
      "## Phase",
      `- Phase id: ${phase.id}`,
      `- Agent: ${phase.agent}`,
      `- Goal: ${phase.goal}`,
      `- Deliverables: ${phase.deliverables.join("; ")}`,
      `- Acceptance criteria: ${phase.acceptanceCriteria.join("; ")}`,
      "",
      "## Super Admin",
      `- Required: ${app.superAdminIntegration.required}`,
      `- Dashboard: ${app.superAdminIntegration.dashboard}`,
      `- Requirements: ${app.superAdminIntegration.requirements.join(", ")}`,
      "",
      "## Guardrails",
      "- Do not turn this phase into a full-app build.",
      "- Do not import unrelated app goals, audiences, data, or features.",
      "- Keep production deployment approval-gated.",
      "- Create follow-up issues for later phases instead of expanding this task."
    ].join("\n")
  };
}

function validatePacket(packet) {
  const requiredPhaseIds = [
    "discovery",
    "charter",
    "architecture",
    "data_model",
    "ui_design",
    "mvp_build",
    "testing",
    "review",
    "deployment",
    "monitoring",
    "super_admin_registration"
  ];

  const missingFields = [];
  for (const [label, value] of [
    ["app.name", packet.app.name],
    ["app.slug", packet.app.slug],
    ["app.charterPath", packet.app.charterPath],
    ["app.purpose", packet.app.purpose],
    ["app.successDefinition", packet.app.successDefinition],
    ["app.deploymentTarget", packet.app.deploymentTarget]
  ]) {
    if (!value) missingFields.push(label);
  }

  for (const [label, value] of [
    ["app.audience", packet.app.audience],
    ["app.boundaries", packet.app.boundaries],
    ["app.mvpStages", packet.app.mvpStages],
    ["app.superAdminIntegration.requirements", packet.app.superAdminIntegration.requirements]
  ]) {
    if (!Array.isArray(value) || value.length === 0) missingFields.push(label);
  }

  if (missingFields.length) {
    throw new Error(`App Build Packet is missing required fields: ${missingFields.join(", ")}`);
  }

  for (const id of requiredPhaseIds) {
    if (!packet.phases.some((phase) => phase.id === id)) {
      throw new Error(`App Build Packet is missing required phase: ${id}`);
    }
  }

  if (!packet.guardrails.noGiantCodexTask || !packet.guardrails.preventGoalBleed) {
    throw new Error("App Build Packet guardrails must prevent giant tasks and app-goal bleeding.");
  }

  if (!packet.app.superAdminIntegration.required) {
    throw new Error("App Build Packet must require Super Admin integration.");
  }
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
