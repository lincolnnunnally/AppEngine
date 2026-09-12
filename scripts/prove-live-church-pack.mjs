import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Internal proof: generate the church starter pack the same way a customer
// build does, then deploy it as a preview and fetch the public home.
// Does not enable billing. Run from production-app with .env.local present:
//   APP_ENGINE_LOCAL_MODE=true node --import ./scripts/ts-esm-register.mjs scripts/prove-live-church-pack.mjs

function loadEnv() {
  const text = readFileSync(".env.local", "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();
process.env.APP_ENGINE_LOCAL_MODE = "true";

const { createLocalPlannedProject } = await import("../src/lib/engine/development-store.ts");
const { generateProjectApp } = await import("../src/lib/engine/app-generator.ts");
const { deployGeneratedAppToVercel } = await import("../src/lib/engine/vercel-deploy.ts");

const idea = "A church visitor follow-up and directory so people who visit actually get a next step.";
const created = await createLocalPlannedProject(
  {
    idea,
    name: "Proof Church Pack",
    moduleSlugs: ["website-builder", "directory-community", "needs-helper-matching", "crm-follow-up"]
  },
  {
    customerEmail: "proof-internal@unitedundergod.org",
    gateClearance: {
      intakeGateId: "proof:church-pack",
      clarified: true,
      priorWork: { passed: true, verdict: "build_new" }
    }
  }
);
const projectId = created.project.id;
console.log("ok - planned project", projectId);

const generated = await generateProjectApp(projectId);
console.log("ok - generated", generated.export?.uri || generated.storage);

const root = join(process.cwd(), ".app-engine", "generated-apps");
const dirs = readdirSync(root);
const dir = dirs.find((entry) => entry.startsWith(projectId));
if (!dir) {
  console.error("not ok - generated app folder missing");
  process.exit(1);
}
const files = [];
function walk(rel) {
  const full = join(root, dir, rel);
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(child);
    } else if (!entry.name.startsWith("app-engine-")) {
      files.push({ path: child, content: readFileSync(join(root, dir, child), "utf8") });
    }
  }
}
walk("");
console.log("ok - bundle files", files.length);
if (!files.some((f) => f.path === "package.json")) {
  console.error("not ok - generated app has no package.json");
  process.exit(1);
}

const deploy = await deployGeneratedAppToVercel("proof-church-pack", files, {
  AUTH_SECRET: "proof-only-not-for-customers",
  APP_ENGINE_OWNER_EMAIL: "proof-internal@unitedundergod.org"
}, { target: "preview" });

if (!deploy.ok) {
  console.error("not ok - deploy", deploy.message);
  process.exit(1);
}
console.log("ok - deploy started", deploy.url, deploy.deploymentId);

const url = deploy.url?.startsWith("http") ? deploy.url : `https://${deploy.url}`;
for (let i = 0; i < 24; i++) {
  await new Promise((r) => setTimeout(r, 8000));
  try {
    const res = await fetch(url, { redirect: "follow" });
    const text = await res.text();
    if (res.ok && !text.includes("Deployment Protection") && text.length > 200) {
      const fake = ["Ada Lovelace", "Dana Cole", "Marta H."].filter((n) => text.includes(n));
      if (fake.length) {
        console.error("not ok - live app shows fabricated people", fake.join(", "));
        process.exit(1);
      }
      console.log("ok - live home fetched", res.status, url);
      console.log("prove-live-church-pack ok");
      process.exit(0);
    }
    console.log("waiting", i + 1, res.status);
  } catch (error) {
    console.log("waiting", i + 1, error instanceof Error ? error.message : "fetch failed");
  }
}
console.error("not ok - live URL never served the app", url);
process.exit(1);
