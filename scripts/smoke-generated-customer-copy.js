import fs from "node:fs";
import path from "node:path";

// C4 / DC-1: a generated app speaks for the customer, not for a SaaS template.
// Generates real packs the way a customer build does (local mode, no deploy) and
// reads the emitted files: the public home and workspace must list exactly the
// modules composed, in the checklist's own words, and nothing may carry the
// planner's fallback phrases or numbers/accounts nobody measured.
process.env.APP_ENGINE_LOCAL_MODE = "true";

const { createLocalPlannedProject } = await import("../src/lib/engine/development-store.ts");
const { generateProjectApp } = await import("../src/lib/engine/app-generator.ts");
const { estimateBuild } = await import("../src/lib/engine/pricing/estimate.ts");
const { SELLABLE_FEATURES } = await import("../src/lib/engine/pricing/module-pricing.ts");

const PLANNER_FALLBACKS = [
  "the first focused customer segment",
  "the most expensive repeated workflow",
  "SaaS customer portal",
  "you and people with the same goal"
];
const INVENTED = ["Acme Services", "Northstar Ops", "Atlas Field", "$8.2k", "Time saved", "Plan usage"];

let failures = 0;
function check(ok, message) {
  if (ok) console.log(`ok - ${message}`);
  else {
    failures += 1;
    console.error(`not ok - ${message}`);
  }
}

async function generate(name, idea, moduleSlugs) {
  const created = await createLocalPlannedProject(
    { idea, name, moduleSlugs },
    {
      customerEmail: "smoke@example.com",
      gateClearance: { intakeGateId: `smoke:${name}`, clarified: true, priorWork: { passed: true, verdict: "build_new" } }
    }
  );
  const id = created.project.id;
  await generateProjectApp(id);
  const root = path.join(process.cwd(), ".app-engine", "generated-apps");
  const dir = path.join(root, fs.readdirSync(root).find((entry) => entry.startsWith(id)));
  const read = (rel) => fs.readFileSync(path.join(dir, rel), "utf8");
  return { dir, read };
}

const cases = [
  { name: "Grace Chapel", idea: "I run a small church and need people to sign up for events and give online" },
  { name: "Joe's Handyman", idea: "I fix houses and need to follow up with leads and take a deposit" },
  { name: "My Week", idea: "A private tracker so I remember my bills", slugs: ["website-builder"] }
];

for (const item of cases) {
  const slugs = item.slugs || estimateBuild({ needText: item.idea }).moduleSlugs;
  const app = await generate(item.name, item.idea, slugs);
  const home = app.read("src/app/page.tsx");
  const workspace = app.read("src/app/app/page.tsx");
  const brand = app.read("src/lib/app-brand.ts");
  const data = app.read("src/lib/app-data.ts");
  const surfaces = { home, workspace, brand, data };

  for (const [label, text] of Object.entries(surfaces)) {
    const leaked = PLANNER_FALLBACKS.filter((phrase) => text.includes(phrase));
    check(!leaked.length, `${item.name}: ${label} carries no planner fallback copy${leaked.length ? ` (found: ${leaked.join(", ")})` : ""}`);
    const invented = INVENTED.filter((phrase) => text.includes(phrase));
    check(!invented.length, `${item.name}: ${label} carries no invented numbers or accounts${invented.length ? ` (found: ${invented.join(", ")})` : ""}`);
  }

  const included = JSON.parse(data.match(/export const includedFeatures = (\[[\s\S]*?\]);\n/)[1]);
  const optional = slugs.filter((slug) => slug !== "identity-auth" && slug !== "growth-telemetry");
  check(
    included.length === optional.length && optional.every((slug) => included.some((row) => row.slug === slug)),
    `${item.name}: one card per composed module (${included.length}/${optional.length})`
  );
  for (const row of included) {
    const feature = SELLABLE_FEATURES.find((f) => f.moduleSlugs.includes(row.slug));
    if (feature && row.slug !== "website-builder") {
      check(row.name === feature.label, `${item.name}: ${row.slug} card uses the quoted checklist label "${feature.label}"`);
    }
    check(row.href.startsWith("/"), `${item.name}: ${row.slug} card links into the app (${row.href})`);
  }
  check(home.includes("includedFeatures.map") && workspace.includes("includedFeatures.map"), `${item.name}: home + workspace render the included modules`);
}

if (failures) {
  console.error(`generated-customer-copy smoke failed (${failures})`);
  process.exit(1);
}
console.log("generated-customer-copy smoke ok");
