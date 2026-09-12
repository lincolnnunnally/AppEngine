import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Prove every sellable starter pack actually composes: files resolve, typecheck,
// and do not ship fabricated people as if they were real. Run:
//   node scripts/prove-starter-packs.mjs
//
// Pack slugs match BUSINESS_ARCHETYPES + STANDARD_WEB_MODULE_SLUGS (website-builder).

const root = process.cwd();

const packs = [
  { id: "core", slugs: ["website-builder"] },
  { id: "personal-tracker", slugs: ["website-builder"] },
  { id: "personal-growth", slugs: ["website-builder", "becoming-growth-dashboard"] },
  { id: "job-search", slugs: ["website-builder", "case-management"] },
  { id: "local-service", slugs: ["website-builder", "crm-follow-up"] },
  { id: "sales-pipeline", slugs: ["website-builder", "crm-follow-up", "communication"] },
  { id: "professional-practice", slugs: ["website-builder", "crm-follow-up", "case-management"] },
  { id: "storefront", slugs: ["website-builder", "marketplace-orders", "public-profile-og-sharing"] },
  { id: "back-office-lite", slugs: ["website-builder", "finance-accounting", "crm-follow-up"] },
  { id: "church-org", slugs: ["website-builder", "directory-community", "needs-helper-matching", "crm-follow-up"] },
  { id: "creator", slugs: ["website-builder", "public-profile-og-sharing", "public-invite-loop"] },
  { id: "pantry", slugs: ["website-builder", "inventory-shelf", "donor-receipts", "waitlist-invites"] },
  { id: "civic-pulse", slugs: ["website-builder", "feedback-pulse", "public-profile-og-sharing", "crm-follow-up"] }
];

let failed = 0;
const bannedPeople = ["Ada Lovelace", "Grace Hopper", "Dana Cole", "Marta H.", "customer@example.com"];

for (const pack of packs) {
  const unique = [...new Set(pack.slugs)];
  console.log(`\n=== pack ${pack.id}: ${unique.join(", ")} ===`);
  const result = spawnSync(process.execPath, ["scripts/e2e-compose-selection.mjs", ...unique], {
    cwd: root,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    failed += 1;
    console.error(result.stdout);
    console.error(result.stderr);
    console.error(`not ok - ${pack.id} failed compose/typecheck`);
    continue;
  }
  console.log(`ok - ${pack.id} composes and typechecks`);

  const outDir = path.join(root, ".app-engine", "e2e-compose-selection");
  const hits = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        const text = fs.readFileSync(full, "utf8");
        for (const name of bannedPeople) {
          if (text.includes(name)) hits.push(`${path.relative(outDir, full)} :: ${name}`);
        }
      }
    }
  }
  walk(outDir);
  if (hits.length) {
    failed += 1;
    for (const hit of hits) console.error(`not ok - fabricated content in ${pack.id}: ${hit}`);
  } else {
    console.log(`ok - ${pack.id} has no fabricated sample people`);
  }
}

if (failed) {
  console.error(`\nnot ok - ${failed} pack(s) failed fulfillment proof`);
  process.exit(1);
}
console.log("\nprove-starter-packs ok");
