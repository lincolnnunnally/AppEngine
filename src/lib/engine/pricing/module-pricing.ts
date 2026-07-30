// Sellable catalog for module composition.
//
// PRINCIPLE: we sell *configurations of existing modules*, not open-ended agent
// coding. Cost to us is mostly compose + deploy + light AI intake — not a full
// rebuild. Prices are flat; internal cost is estimated for margin control.
//
// Profit = priceCents - p90CostCents. We price so p90 cost stays well under price
// (target margin ≥ 70% on standard packs).

import { buildReadyModuleSlugs } from "../modules/registry";

export const BASE_PRICE_CENTS = 2500; // $25 — core private app/tool
export const FEATURE_PRICE_CENTS = 1000; // $10 per optional feature/module
export const CUSTOM_SURCHARGE_CENTS = 2500; // +$25 when custom (non-catalog) work is required
export const CUSTOM_FLOOR_CENTS = 5000; // custom-only builds never below $50

/** Expected / p90 cost to *us* (API + ops share), not customer price. */
export type CostBand = {
  expectedCents: number;
  p90Cents: number;
  notes: string;
};

/**
 * Base shell cost: generator compose + Neon/Vercel + short intake chat.
 * Modules emit deterministic code — no per-line AI rewrite.
 */
export const BASE_SHELL_COST: CostBand = {
  expectedCents: 40, // $0.40
  p90Cents: 200, // $2.00 if intake is long / retry deploy
  notes: "Compose base + foundation modules + deploy. Intake chat only."
};

/**
 * Marginal cost of adding one optional module from the installable library.
 * Code is already written; we select slug + emit + light branding copy.
 */
export const PER_MODULE_COST: CostBand = {
  expectedCents: 15, // $0.15
  p90Cents: 75, // $0.75
  notes: "Select slug, emit files, migrate tables, smoke. Not a rebuild."
};

/** Custom generation (new logic not in catalog) — bill higher. */
export const CUSTOM_WORK_COST: CostBand = {
  expectedCents: 300, // $3
  p90Cents: 1200, // $12 if multi-pass
  notes: "Bounded AI generation for gaps. Cap loops or refuse."
};

export type SellableFeature = {
  id: string;
  label: string;
  description: string;
  /** Module slugs composed when this feature is on (must be build-ready). */
  moduleSlugs: string[];
  priceCents: number;
  /** personal | business | both */
  audience: "personal" | "business" | "both";
  category: "access" | "public" | "ops" | "money" | "growth" | "care" | "content";
};

/**
 * Customer-facing checklist. Each row maps to 1+ installable modules.
 * Price is usually FEATURE_PRICE_CENTS; heavier bundles can be 2×.
 */
// Note: identity-auth + growth-telemetry are foundation (included in $25 core).
// Do not sell them again as $10 add-ons.

export const SELLABLE_FEATURES: SellableFeature[] = [
  {
    id: "public-page",
    label: "Public page / profile",
    description: "A page anyone can open — shareable link, not private-only.",
    moduleSlugs: ["public-profile-og-sharing"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "both",
    category: "public"
  },
  {
    id: "website",
    label: "Simple website front door",
    description: "Multi-section site for what you offer.",
    moduleSlugs: ["website-builder"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "business",
    category: "public"
  },
  {
    id: "invites",
    label: "Invite & share loop",
    description: "Invite codes and share messages so others can join.",
    moduleSlugs: ["public-invite-loop"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "both",
    category: "growth"
  },
  {
    id: "notify",
    label: "Email / SMS notifications",
    description: "Get notified when something important happens (uses your keys).",
    moduleSlugs: ["communication"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "both",
    category: "ops"
  },
  {
    id: "crm",
    label: "CRM / follow-up pipeline",
    description: "Leads or customers, stages, next actions — nothing falls through.",
    moduleSlugs: ["crm-follow-up"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "business",
    category: "ops"
  },
  {
    id: "scheduling",
    label: "Events & scheduling",
    description: "Bookings, events, RSVP-style scheduling.",
    moduleSlugs: ["events-scheduling"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "both",
    category: "ops"
  },
  {
    id: "payments",
    label: "Payments / checkout",
    description: "Take money via your own Stripe account.",
    moduleSlugs: ["payments-billing"],
    priceCents: FEATURE_PRICE_CENTS * 2, // $20 — higher trust surface
    audience: "business",
    category: "money"
  },
  {
    id: "finance",
    label: "Finance snapshot",
    description: "Simple picture of money in/out and margins to watch.",
    moduleSlugs: ["finance-accounting"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "business",
    category: "money"
  },
  {
    id: "orders",
    label: "Orders / marketplace",
    description: "Catalog, orders, fulfillment tracking.",
    moduleSlugs: ["marketplace-orders"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "business",
    category: "money"
  },
  {
    id: "admin",
    label: "Admin console",
    description: "Manage users, settings, and operations.",
    moduleSlugs: ["admin-ops-moderation"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "business",
    category: "ops"
  },
  {
    id: "cases",
    label: "Case / paperwork tracker",
    description: "Track open cases, documents, and status.",
    moduleSlugs: ["case-management"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "both",
    category: "ops"
  },
  {
    id: "directory",
    label: "Directory",
    description: "Searchable list of people, members, or resources.",
    moduleSlugs: ["directory-community"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "both",
    category: "ops"
  },
  {
    id: "growth",
    label: "Goals & check-ins",
    description: "Personal growth dashboard, goals, streaks.",
    moduleSlugs: ["becoming-growth-dashboard"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "personal",
    category: "growth"
  },
  {
    id: "knowledge",
    label: "Knowledge base / how-to",
    description: "Your playbooks and troubleshooting in one place.",
    moduleSlugs: ["knowledge-base"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "both",
    category: "content"
  },
  {
    id: "branding",
    label: "Branding kit",
    description: "Name, colors, simple brand assets for the tool.",
    moduleSlugs: ["branding-design"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "both",
    category: "content"
  },
  {
    id: "ai-helper",
    label: "In-app AI helper",
    description: "Guided assistance inside the app (uses API keys; runtime usage separate).",
    moduleSlugs: ["ai-assist"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "both",
    category: "content"
  },
  {
    id: "needs-match",
    label: "Needs ↔ helpers matching",
    description: "Match requests with people who can help.",
    moduleSlugs: ["needs-helper-matching"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "business",
    category: "care"
  },
  {
    id: "proof",
    label: "Proof / approval artifacts",
    description: "Approvals and signed-off work products.",
    moduleSlugs: ["proof-approval-artifact"],
    priceCents: FEATURE_PRICE_CENTS,
    audience: "business",
    category: "ops"
  }
];

export function featureById(id: string): SellableFeature | undefined {
  return SELLABLE_FEATURES.find((f) => f.id === id);
}

/** Only features whose every module slug is in the installable registry. */
export function sellableFeaturesReady(): SellableFeature[] {
  const ready = new Set(buildReadyModuleSlugs());
  return SELLABLE_FEATURES.filter((f) => f.moduleSlugs.every((s) => ready.has(s)));
}

export function formatUsd(cents: number): string {
  const neg = cents < 0;
  const n = Math.abs(cents);
  const s = `$${(n / 100).toFixed(n % 100 === 0 ? 0 : 2)}`;
  return neg ? `−${s}` : s;
}
