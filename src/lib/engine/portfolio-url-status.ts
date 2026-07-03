// URL status board — where every ecosystem app stands on its own web address,
// so Lincoln never has to reconstruct "is this live, parked, or nameless?" from
// registrar dashboards. The FACTS live in source-of-truth/
// ecosystem-portfolio-registry.json (each app's `domain` block, owner-provided);
// this module only reads, validates, and sorts them for display. An app with no
// recorded facts is reported honestly as "unknown" — never silently bucketed.

import registryJson from "../../../source-of-truth/ecosystem-portfolio-registry.json";

// The four situations Lincoln asked to see at a glance (plus the honest fifth
// for apps whose facts were never recorded). Keep in sync with the allowed
// values documented in source-of-truth/app-portfolio-registry.md.
export type PortfolioUrlStatus =
  | "live"
  | "deployed_awaiting_domain"
  | "domain_owned_not_serving"
  | "awaiting_url"
  | "unknown";

export type PortfolioUrlStatusEntry = {
  slug: string;
  appName: string;
  status: PortfolioUrlStatus;
  intendedDomain: string; // "" when no domain has been chosen yet
  servingUrl: string; // the https URL that answers today, when there is one
  nextStep: string; // the concrete owner action, in plain language
  note: string; // caveats that change what the owner should do ("" when none)
};

export type PortfolioUrlStatusBoard = {
  factsAsOf: string; // the registry's generatedAt — when these facts were true
  counts: Record<PortfolioUrlStatus, number>;
  entries: PortfolioUrlStatusEntry[]; // sorted most-actionable first
};

export const URL_STATUS_LABEL: Record<PortfolioUrlStatus, string> = {
  live: "Live",
  deployed_awaiting_domain: "Deployed — awaiting domain",
  domain_owned_not_serving: "Domain owned — nothing serving",
  awaiting_url: "Awaiting URL",
  unknown: "URL facts not recorded"
};

const VALID_STATUSES: ReadonlySet<string> = new Set([
  "live",
  "deployed_awaiting_domain",
  "domain_owned_not_serving",
  "awaiting_url"
]);

// Sort order: data gaps first (fixing the record IS the action), then the
// domains sitting idle, then temp-hosted deploys, then naming decisions, then
// the healthy live set — the same act-first instinct as the attention queue.
const STATUS_RANK: Record<PortfolioUrlStatus, number> = {
  unknown: 0,
  domain_owned_not_serving: 1,
  deployed_awaiting_domain: 2,
  awaiting_url: 3,
  live: 4
};

type RegistryAppRecord = {
  name?: unknown;
  slug?: unknown;
  productionUrl?: unknown;
  reviewUrl?: unknown;
  domain?: {
    intendedDomain?: unknown;
    urlStatus?: unknown;
    nextStep?: unknown;
    note?: unknown;
  };
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function httpsOrEmpty(value: unknown): string {
  const url = asString(value);
  return url.startsWith("https://") ? url : "";
}

function toEntry(app: RegistryAppRecord): PortfolioUrlStatusEntry {
  const domain = app.domain;
  const rawStatus = asString(domain?.urlStatus);
  const recorded = Boolean(domain) && VALID_STATUSES.has(rawStatus);
  const status: PortfolioUrlStatus = recorded ? (rawStatus as PortfolioUrlStatus) : "unknown";
  const intendedDomain = asString(domain?.intendedDomain);
  return {
    slug: asString(app.slug),
    appName: asString(app.name) || asString(app.slug) || "(unnamed app)",
    status,
    intendedDomain,
    // A live domain is openable even when the registry's app URLs are
    // placeholders (kidsneeddad.com serves while the app build is blocked).
    servingUrl:
      httpsOrEmpty(app.productionUrl) ||
      httpsOrEmpty(app.reviewUrl) ||
      (status === "live" && intendedDomain ? `https://${intendedDomain}` : ""),
    nextStep: recorded
      ? asString(domain?.nextStep) || "Next step not recorded — add one to this app's domain block."
      : "Record this app's domain facts (domain block) in source-of-truth/ecosystem-portfolio-registry.json.",
    note: asString(domain?.note)
  };
}

export function getPortfolioUrlStatusBoard(): PortfolioUrlStatusBoard {
  const registry = registryJson as { generatedAt?: unknown; apps?: unknown };
  const apps = Array.isArray(registry.apps) ? (registry.apps as RegistryAppRecord[]) : [];
  const entries = apps.map(toEntry).sort((a, b) => {
    return STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.appName.localeCompare(b.appName);
  });
  const counts: Record<PortfolioUrlStatus, number> = {
    live: 0,
    deployed_awaiting_domain: 0,
    domain_owned_not_serving: 0,
    awaiting_url: 0,
    unknown: 0
  };
  for (const entry of entries) counts[entry.status] += 1;
  return { factsAsOf: asString(registry.generatedAt), counts, entries };
}
