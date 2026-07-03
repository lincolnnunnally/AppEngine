#!/usr/bin/env node
// Smoke: the ecosystem portfolio registry carries complete, valid URL/domain
// facts for EVERY app — the contract behind the owner dashboard's URL board.
// Guards the truths that matter: every app bucketed into a real status with a
// concrete next step, every owner-confirmed domain present exactly once, and
// milstead.us vs milstead.church kept as TWO different apps (owner-corrected
// 2026-07-03 — conflating them is the drift this registry exists to end).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.join(scriptDir, "..", "source-of-truth", "ecosystem-portfolio-registry.json");

const VALID_URL_STATUSES = new Set([
  "live",
  "deployed_awaiting_domain",
  "domain_owned_not_serving",
  "awaiting_url"
]);

// Owner-provided domain facts, 2026-07-03 — each must be recorded exactly once.
const OWNER_DOMAINS = [
  "we-succeed.org",
  "churchconnect.cloud",
  "laser.engrave.market",
  "snip.show",
  "easypeazy.site",
  "spark-of-hope.com",
  "live-on-mission.org",
  "best-life.us",
  "unitedundergod.org",
  "toner.management",
  "kidsneeddad.com",
  "milstead.us",
  "milstead.church"
];

let failures = 0;
function check(condition, message) {
  if (condition) {
    console.log(`ok - ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL - ${message}`);
  }
}

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const apps = Array.isArray(registry.apps) ? registry.apps : [];

check(apps.length > 0, "registry has apps");
check(registry.summary?.totalApps === apps.length, `summary.totalApps (${registry.summary?.totalApps}) matches apps.length (${apps.length})`);

const seenSlugs = new Set();
const domainOwners = new Map(); // intendedDomain -> slug
const statusCounts = { live: 0, deployed_awaiting_domain: 0, domain_owned_not_serving: 0, awaiting_url: 0 };

for (const app of apps) {
  const label = app.slug || app.name || "(unnamed)";
  check(typeof app.slug === "string" && app.slug.length > 0, `${label}: has a slug`);
  check(!seenSlugs.has(app.slug), `${label}: slug is unique`);
  seenSlugs.add(app.slug);

  const domain = app.domain;
  check(Boolean(domain) && typeof domain === "object", `${label}: has a domain block`);
  if (!domain || typeof domain !== "object") continue;

  check(VALID_URL_STATUSES.has(domain.urlStatus), `${label}: urlStatus "${domain.urlStatus}" is one of the four allowed values`);
  check(typeof domain.intendedDomain === "string", `${label}: intendedDomain is a string ("" allowed when no domain chosen)`);
  check(
    typeof domain.nextStep === "string" && domain.nextStep.trim().length >= 10,
    `${label}: nextStep is a concrete sentence`
  );

  if (VALID_URL_STATUSES.has(domain.urlStatus)) statusCounts[domain.urlStatus] += 1;

  // A status that asserts a domain exists must actually name the domain.
  if (domain.urlStatus === "live" || domain.urlStatus === "domain_owned_not_serving") {
    check(domain.intendedDomain.trim().length > 0, `${label}: status "${domain.urlStatus}" names its domain`);
  }
  // awaiting_url means no OWNED domain — an intended-but-unconfirmed name is allowed (live-on-mission).
  if (domain.intendedDomain) {
    const priorOwner = domainOwners.get(domain.intendedDomain);
    check(
      !priorOwner,
      priorOwner
        ? `${label}: domain ${domain.intendedDomain} already claimed by "${priorOwner}"`
        : `${label}: domain ${domain.intendedDomain} claimed by one app only`
    );
    domainOwners.set(domain.intendedDomain, app.slug);
  }
}

for (const ownerDomain of OWNER_DOMAINS) {
  check(domainOwners.has(ownerDomain), `owner-confirmed domain ${ownerDomain} is recorded on exactly one app`);
}

// The two Milstead domains belong to DIFFERENT apps — never the same entry.
const milsteadUs = domainOwners.get("milstead.us");
const milsteadChurch = domainOwners.get("milstead.church");
check(
  Boolean(milsteadUs) && Boolean(milsteadChurch) && milsteadUs !== milsteadChurch,
  `milstead.us (${milsteadUs}) and milstead.church (${milsteadChurch}) are different apps`
);

// Summary rollup stays honest when present.
if (registry.summary?.byUrlStatus) {
  for (const [status, count] of Object.entries(statusCounts)) {
    const recorded = registry.summary.byUrlStatus[status] || 0;
    check(recorded === count, `summary.byUrlStatus.${status} (${recorded}) matches actual count (${count})`);
  }
}

if (failures > 0) {
  console.error(`\nsmoke:portfolio-url-status FAILED — ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nsmoke:portfolio-url-status passed");
