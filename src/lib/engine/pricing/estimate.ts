// Price + cost + profit estimate for a module-composed build.
// Customer sees price. Ops sees margin. Never sell below p90 cost + floor.

import { buildReadyModuleSlugs } from "../modules/registry";
import {
  archetypeById,
  BUSINESS_ARCHETYPES,
  featuresForArchetype,
  matchArchetype,
  type BusinessArchetype
} from "./business-archetypes";
import {
  BASE_PRICE_CENTS,
  BASE_SHELL_COST,
  CUSTOM_FLOOR_CENTS,
  CUSTOM_SURCHARGE_CENTS,
  CUSTOM_WORK_COST,
  FEATURE_PRICE_CENTS,
  featureById,
  formatUsd,
  PER_MODULE_COST,
  sellableFeaturesReady,
  SELLABLE_FEATURES,
  STANDARD_WEB_MODULE_SLUGS,
  type SellableFeature
} from "./module-pricing";

export type EstimateInput = {
  /** Selected feature ids from the checklist. */
  featureIds?: string[];
  /** Archetype id (optional default pack). */
  archetypeId?: string;
  /** Free text from chat — used to suggest archetype + features. */
  needText?: string;
  /** True if customer needs work outside the catalog. */
  customWork?: boolean;
  /** Explicit module slugs (advanced). */
  moduleSlugs?: string[];
};

export type EstimateLine = {
  kind: "base" | "feature" | "custom" | "module";
  id: string;
  label: string;
  priceCents: number;
  moduleSlugs: string[];
};

export type CostBreakdown = {
  expectedCents: number;
  p90Cents: number;
  lines: { label: string; expectedCents: number; p90Cents: number }[];
};

export type ProfitBreakdown = {
  priceCents: number;
  expectedCostCents: number;
  p90CostCents: number;
  expectedProfitCents: number;
  p90ProfitCents: number;
  expectedMarginPct: number;
  p90MarginPct: number;
  /** True if p90 profit is healthy (≥ 70% of price or ≥ $15). */
  healthy: boolean;
  warning: string | null;
};

export type BuildEstimate = {
  ok: true;
  priceCents: number;
  priceLabel: string;
  lines: EstimateLine[];
  moduleSlugs: string[];
  missingModules: string[];
  features: { id: string; label: string; selected: boolean; priceCents: number; description: string }[];
  suggestedArchetype: BusinessArchetype | null;
  cost: CostBreakdown;
  profit: ProfitBreakdown;
  /** Add-ons that fit the need but are not in the starter pack yet. */
  recommendedAddOns: { id: string; label: string; description: string; priceCents: number }[];
  /** Customer-safe summary (no cost/profit). */
  customerSummary: {
    total: string;
    base: string;
    features: { label: string; price: string }[];
    note: string;
  };
  /** Ops-only economics. */
  opsSummary: {
    expectedCost: string;
    p90Cost: string;
    expectedProfit: string;
    p90Profit: string;
    marginAtP90: string;
  };
};

export type EstimateError = { ok: false; message: string };

export function estimateBuild(input: EstimateInput): BuildEstimate | EstimateError {
  const ready = new Set(buildReadyModuleSlugs());
  const lines: EstimateLine[] = [];
  const moduleSet = new Set<string>();
  const selectedFeatureIds = new Set<string>(input.featureIds || []);

  // Archetype defaults (can be overridden by explicit features)
  let suggested = input.archetypeId ? archetypeById(input.archetypeId) || null : null;
  if (!suggested && input.needText) {
    suggested = matchArchetype(input.needText);
  }
  if (!input.featureIds || input.featureIds.length === 0) {
    for (const f of suggested ? featuresForArchetype(suggested) : []) {
      selectedFeatureIds.add(f.id);
    }
    // Add what their own words ask for, on top of the starter pack — or on its
    // own when no starter fits (a candle shop asked to sell online; it should not
    // be quoted a bare website). Capped so a long description can't become the
    // whole catalog.
    let extras = 0;
    for (const f of suggestFeaturesFromText(input.needText || "")) {
      if (selectedFeatureIds.has(f.id)) continue;
      selectedFeatureIds.add(f.id);
      extras += 1;
      if (extras >= 3) break;
    }
  }

  // Base always — a live website is included, never a private-only URL.
  lines.push({
    kind: "base",
    id: "core",
    label: "Core app + live website you can open and share",
    priceCents: BASE_PRICE_CENTS,
    moduleSlugs: [...STANDARD_WEB_MODULE_SLUGS]
  });
  for (const slug of STANDARD_WEB_MODULE_SLUGS) moduleSet.add(slug);

  // Features
  for (const id of selectedFeatureIds) {
    const feature = featureById(id);
    if (!feature) continue;
    lines.push({
      kind: "feature",
      id: feature.id,
      label: feature.label,
      priceCents: feature.priceCents,
      moduleSlugs: feature.moduleSlugs
    });
    for (const s of feature.moduleSlugs) moduleSet.add(s);
  }

  // Explicit modules (custom advanced)
  for (const slug of input.moduleSlugs || []) {
    if (moduleSet.has(slug)) continue;
    moduleSet.add(slug);
    lines.push({
      kind: "module",
      id: slug,
      label: `Module: ${slug}`,
      priceCents: FEATURE_PRICE_CENTS,
      moduleSlugs: [slug]
    });
  }

  const customWork = Boolean(input.customWork);
  if (customWork) {
    lines.push({
      kind: "custom",
      id: "custom",
      label: "Custom work (beyond catalog modules)",
      priceCents: CUSTOM_SURCHARGE_CENTS,
      moduleSlugs: []
    });
  }

  let priceCents = lines.reduce((s, l) => s + l.priceCents, 0);
  if (customWork && priceCents < CUSTOM_FLOOR_CENTS) {
    priceCents = CUSTOM_FLOOR_CENTS;
  }

  const missingModules = [...moduleSet].filter((s) => !ready.has(s));

  // Cost model
  const costLines: CostBreakdown["lines"] = [
    {
      label: "Base shell compose + deploy + intake",
      expectedCents: BASE_SHELL_COST.expectedCents,
      p90Cents: BASE_SHELL_COST.p90Cents
    }
  ];
  const optionalCount = moduleSet.size;
  if (optionalCount > 0) {
    costLines.push({
      label: `${optionalCount} optional module(s) emit + migrate`,
      expectedCents: PER_MODULE_COST.expectedCents * optionalCount,
      p90Cents: PER_MODULE_COST.p90Cents * optionalCount
    });
  }
  if (customWork) {
    costLines.push({
      label: "Custom generation (bounded)",
      expectedCents: CUSTOM_WORK_COST.expectedCents,
      p90Cents: CUSTOM_WORK_COST.p90Cents
    });
  }

  const expectedCostCents = costLines.reduce((s, l) => s + l.expectedCents, 0);
  const p90CostCents = costLines.reduce((s, l) => s + l.p90Cents, 0);
  const expectedProfitCents = priceCents - expectedCostCents;
  const p90ProfitCents = priceCents - p90CostCents;
  const expectedMarginPct = priceCents > 0 ? Math.round((expectedProfitCents / priceCents) * 100) : 0;
  const p90MarginPct = priceCents > 0 ? Math.round((p90ProfitCents / priceCents) * 100) : 0;

  let warning: string | null = null;
  if (missingModules.length) {
    warning = `Some modules are not build-ready: ${missingModules.join(", ")}`;
  } else if (p90ProfitCents < 1500 || p90MarginPct < 70) {
    warning = "Margin thinner than target at p90 cost — raise price or reduce custom work.";
  }

  const healthy = p90ProfitCents >= 1500 && p90MarginPct >= 70 && missingModules.length === 0;

  const checklist = SELLABLE_FEATURES.map((f) => ({
    id: f.id,
    label: f.label,
    selected: selectedFeatureIds.has(f.id),
    priceCents: f.priceCents,
    description: f.description
  }));

  const recommendedAddOns = suggestFeaturesFromText(input.needText || "")
    .filter((f) => !selectedFeatureIds.has(f.id))
    .slice(0, 6)
    .map((f) => ({
      id: f.id,
      label: f.label,
      description: f.description,
      priceCents: f.priceCents
    }));

  return {
    ok: true,
    priceCents,
    priceLabel: formatUsd(priceCents),
    lines,
    moduleSlugs: [...moduleSet],
    missingModules,
    features: checklist,
    recommendedAddOns,
    suggestedArchetype: suggested,
    cost: { expectedCents: expectedCostCents, p90Cents: p90CostCents, lines: costLines },
    profit: {
      priceCents,
      expectedCostCents,
      p90CostCents,
      expectedProfitCents,
      p90ProfitCents,
      expectedMarginPct,
      p90MarginPct,
      healthy,
      warning
    },
    customerSummary: {
      total: formatUsd(priceCents),
      base: formatUsd(BASE_PRICE_CENTS),
      features: lines
        .filter((l) => l.kind === "feature" || l.kind === "custom" || l.kind === "module")
        .map((l) => ({ label: l.label, price: formatUsd(l.priceCents) })),
      note: customWork
        ? "Includes custom work beyond standard modules. Catalog features are cheaper and faster. Every app includes a live website."
        : "Built from existing modules — not a from-scratch rebuild. Every app includes a live website you can open and share."
    },
    opsSummary: {
      expectedCost: formatUsd(expectedCostCents),
      p90Cost: formatUsd(p90CostCents),
      expectedProfit: formatUsd(expectedProfitCents),
      p90Profit: formatUsd(p90ProfitCents),
      marginAtP90: `${p90MarginPct}%`
    }
  };
}

/** Suggest features from free text (keyword overlap with feature labels/descriptions). */
// What the customer's own words ask for. Each rule is a phrase someone uses
// when they need that piece, matched as whole words: a word that merely appears
// in a feature's description (\"your\", \"track\", \"need\") is not a request
// for it — scoring on those padded nearly every quote with pieces nobody asked
// for. Guarded by scripts/smoke-recommendations.js (real requests → packs).
const FEATURE_SIGNALS: Array<{ id: string; weight: number; pattern: RegExp }> = [
  { id: "payments", weight: 5, pattern: /\b(pay|payments?|paid|checkout|stripe|charge|tuition|dues|deposits?|donations?|donate|give online|giving|tithes?|sell|selling|buy online)\b/ },
  { id: "finance", weight: 5, pattern: /\b(invoices?|invoicing|budgets?|expenses?|bookkeeping|books|profit|margins?|overhead|money in|cash flow)\b/ },
  { id: "crm", weight: 5, pattern: /\b(leads?|crm|follow[- ]?ups?|pipeline|prospects?|quotes?|estimates?|customers?|clients?)\b/ },
  { id: "scheduling", weight: 5, pattern: /\b(schedul\w*|book(ing)?s?|appointments?|calendar|rsvps?|events?|sessions?|shifts?|classes|games|practices|reservations?|sign up for)\b/ },
  { id: "notify", weight: 4, pattern: /\b(notif\w*|announc\w*|newsletters?|remind\w*|text (me|them|people)|email (everyone|members|people)|updates to)\b/ },
  { id: "directory", weight: 5, pattern: /\b(director(y|ies)|members?( list)?|rosters?|teams?|parents|families|residents|neighbors|congregation|people list)\b/ },
  { id: "needs-match", weight: 5, pattern: /\b(in need|meals? (train|for)|bring meals|help each other|share tools|lend|borrow|helpers?|benevolence|match(es|ing)? (people|families|volunteers|helpers|neighbors))\b/ },
  { id: "growth", weight: 5, pattern: /\b(goals?|habits?|streaks?|journal\w*|daily check[- ]?ins?)\b/ },
  { id: "cases", weight: 5, pattern: /\b(job search|looking for (a )?(job|work)|resumes?|job applications?|applications|case (files?|work|tracking)|caseload|paperwork)\b/ },
  { id: "orders", weight: 5, pattern: /\b(shop|store|orders?|products?|sell|selling|merch|online store|catalog)\b/ },
  { id: "invites", weight: 4, pattern: /\b(invite (friends|people|others)|referrals?|bring a friend)\b/ },
  { id: "public-page", weight: 4, pattern: /\b(public (page|profile)|profile page|share (my|our) (page|profile)|portfolio)\b/ },
  { id: "admin", weight: 3, pattern: /\b(moderat\w*|admin console|staff console|approve (members|users))\b/ },
  { id: "knowledge", weight: 4, pattern: /\b(knowledge base|how[- ]to guides?|faqs?|playbooks?|troubleshoot\w*)\b/ },
  { id: "branding", weight: 3, pattern: /\b(brand(ing)?|logo|colors|look and feel)\b/ },
  { id: "ai-helper", weight: 3, pattern: /\b(ai|assistant|chat ?bot|write (it|posts|copy) for me)\b/ },
  { id: "intake", weight: 4, pattern: /\b(intake( forms?)?|questionnaires?|application forms?|sign[- ]?up forms?|fill out (a |an )?forms?)\b/ },
  { id: "shelf", weight: 5, pattern: /\b(pantry|shelf|shelves|inventory|stock|food bank|use[- ]by|tool (library|shed))\b/ },
  { id: "receipts", weight: 5, pattern: /\b(donors?|tax receipts?|receipts? for (gifts|donations)|in[- ]kind|write[- ]?offs?)\b/ },
  { id: "waitlist", weight: 4, pattern: /\b(wait ?list|waiting list)\b/ },
  { id: "pulse", weight: 5, pattern: /\b(feel unheard|issue board|community (feedback|concerns)|town hall)\b/ },
  { id: "group-buy", weight: 5, pattern: /\b(group buy|buy (in bulk )?together|bulk order)\b/ },
  { id: "proof", weight: 4, pattern: /\b(proofs?|sign[- ]?off|approve (designs?|drafts?|mockups?))\b/ },
  { id: "navigator", weight: 3, pattern: /\b(next steps?|navigat\w*|where (they|people) are)\b/ }
];

export function suggestFeaturesFromText(text: string): SellableFeature[] {
  const t = text.toLowerCase();
  return FEATURE_SIGNALS.filter((signal) => signal.pattern.test(t))
    .sort((a, b) => b.weight - a.weight)
    .map((signal) => featureById(signal.id))
    .filter((feature): feature is SellableFeature => Boolean(feature))
    .slice(0, 8);
}

export function listArchetypesForUi() {
  return BUSINESS_ARCHETYPES.map((a) => ({
    id: a.id,
    name: a.name,
    forWho: a.forWho,
    coreJob: a.coreJob,
    family: a.family,
    defaultFeatureIds: a.defaultFeatureIds,
    startingPriceCents: BASE_PRICE_CENTS + featuresForArchetype(a).reduce((s, f) => s + f.priceCents, 0)
  }));
}

export function listFeaturesForUi() {
  return sellableFeaturesReady().map((f) => ({
    id: f.id,
    label: f.label,
    description: f.description,
    priceCents: f.priceCents,
    audience: f.audience,
    category: f.category,
    moduleSlugs: f.moduleSlugs
  }));
}

/** Fixed reference table for owner docs. */
export function profitReferenceTable() {
  const examples = [
    { name: "Core only", featureIds: [] as string[], custom: false },
    { name: "Core + CRM", featureIds: ["crm"], custom: false },
    { name: "Core + CRM + notify", featureIds: ["crm", "notify"], custom: false },
    { name: "Local service pack", featureIds: ["crm", "public-page", "payments"], custom: false },
    { name: "Back office lite", featureIds: ["finance", "crm"], custom: false },
    { name: "Core + custom", featureIds: [], custom: true }
  ];
  return examples.map((ex) => {
    const est = estimateBuild({ featureIds: ex.featureIds, customWork: ex.custom });
    if (!est.ok) return { name: ex.name, error: est.message };
    return {
      name: ex.name,
      price: est.priceLabel,
      expectedCost: est.opsSummary.expectedCost,
      p90Cost: est.opsSummary.p90Cost,
      expectedProfit: est.opsSummary.expectedProfit,
      p90Profit: est.opsSummary.p90Profit,
      marginAtP90: est.opsSummary.marginAtP90,
      healthy: est.profit.healthy
    };
  });
}
