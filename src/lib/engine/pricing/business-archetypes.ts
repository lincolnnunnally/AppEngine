// Most businesses share the same core operating system. Archetypes are
// pre-selected feature packs — not infinite bespoke apps. Specialization is
// copy, labels, and which optional modules are on.
//
// Listen → clarify → map to archetype + toggles → confirm price → compose.

import { BASE_PRICE_CENTS, FEATURE_PRICE_CENTS, type SellableFeature, SELLABLE_FEATURES } from "./module-pricing";

export type BusinessArchetype = {
  id: string;
  name: string;
  /** Who this is for (plain language). */
  forWho: string;
  /** The core job the base $25 shell solves. */
  coreJob: string;
  /** Default feature ids (from SELLABLE_FEATURES). */
  defaultFeatureIds: string[];
  /** Keywords for chat/matcher. */
  triggers: string[];
  /** personal | local_service | sales | product | care | org */
  family: "personal" | "local_service" | "sales" | "product" | "care" | "org" | "creator";
};

export const BUSINESS_ARCHETYPES: BusinessArchetype[] = [
  {
    id: "personal-tracker",
    name: "Personal tracker",
    forWho: "Anyone who needs one private tool for one recurring mess",
    coreJob: "Hold the list, dates, or steps so nothing drops",
    defaultFeatureIds: [],
    triggers: ["personal", "tracker", "todo", "bills", "habit", "remember", "private"],
    family: "personal"
  },
  {
    id: "personal-growth",
    name: "Personal growth companion",
    forWho: "Someone building habits, goals, or a better week",
    coreJob: "Goals, check-ins, and a simple scoreboard",
    defaultFeatureIds: ["growth"],
    triggers: ["goals", "habits", "journal", "growth", "streak", "becoming"],
    family: "personal"
  },
  {
    id: "job-search",
    name: "Job search kit",
    forWho: "People looking for work",
    coreJob: "Applications, follow-ups, and a weekly plan in one place",
    defaultFeatureIds: ["cases"],
    triggers: ["job", "resume", "applications", "interview", "hire", "unemployed"],
    family: "personal"
  },
  {
    id: "local-service",
    name: "Local service business",
    forWho: "Mechanics, cleaners, lawn care, tutors, trades — sell work you do with your hands",
    coreJob: "Who needs me, what I promised, what I charged",
    defaultFeatureIds: ["crm"],
    triggers: ["mechanic", "cleaner", "lawn", "plumber", "hvac", "tutor", "handyman", "salon", "barber", "service business"],
    family: "local_service"
  },
  {
    id: "sales-pipeline",
    name: "Sales pipeline",
    forWho: "Closers and salespeople who win deals but lose track of the middle",
    coreJob: "Leads → stages → next action so nothing goes cold",
    defaultFeatureIds: ["crm", "notify"],
    triggers: ["sales", "closer", "pipeline", "leads", "prospect", "quota"],
    family: "sales"
  },
  {
    id: "professional-practice",
    name: "Professional practice",
    forWho: "Consultants, coaches, counselors, freelancers with clients",
    coreJob: "Clients, sessions/cases, and follow-up",
    defaultFeatureIds: ["crm", "cases"],
    triggers: ["consultant", "coach", "counselor", "freelancer", "practice", "clients"],
    family: "care"
  },
  {
    id: "storefront",
    name: "Small storefront",
    forWho: "Selling products or simple packages online",
    coreJob: "What I sell and who ordered",
    defaultFeatureIds: ["orders", "public-page"],
    triggers: ["shop", "store", "products", "ecommerce", "orders", "sell online"],
    family: "product"
  },
  {
    id: "back-office-lite",
    name: "Back office lite",
    forWho: "Owners drowning in the non-craft parts of the business",
    coreJob: "Money picture + who we serve + what is overdue",
    defaultFeatureIds: ["finance", "crm"],
    triggers: ["back office", "expenses", "margin", "profit", "invoicing", "overhead", "books"],
    family: "org"
  },
  {
    id: "church-org",
    name: "Church / nonprofit ops",
    forWho: "Congregations and nonprofits coordinating people",
    coreJob: "Directory, care/needs, and basic follow-up",
    defaultFeatureIds: ["directory", "needs-match", "crm"],
    triggers: ["church", "nonprofit", "ministry", "congregation", "volunteers", "benevolence"],
    family: "org"
  },
  {
    id: "creator",
    name: "Creator / expert brand",
    forWho: "Teachers, creators, specialists sharing work publicly",
    coreJob: "Public face + invites + simple content home",
    defaultFeatureIds: ["public-page", "invites"],
    triggers: ["creator", "youtube", "podcast", "teacher", "brand", "audience"],
    family: "creator"
  }
];

export function archetypeById(id: string): BusinessArchetype | undefined {
  return BUSINESS_ARCHETYPES.find((a) => a.id === id);
}

/** Keyword score — first useful match for chat synthesis. */
export function matchArchetype(text: string): BusinessArchetype | null {
  const t = text.toLowerCase();
  let best: { arch: BusinessArchetype; score: number } | null = null;
  for (const arch of BUSINESS_ARCHETYPES) {
    let score = 0;
    for (const trigger of arch.triggers) {
      if (t.includes(trigger.toLowerCase())) score += trigger.split(" ").length;
    }
    if (score > 0 && (!best || score > best.score)) best = { arch, score };
  }
  return best?.arch ?? null;
}

export function featuresForArchetype(arch: BusinessArchetype): SellableFeature[] {
  return arch.defaultFeatureIds
    .map((id) => SELLABLE_FEATURES.find((f) => f.id === id))
    .filter(Boolean) as SellableFeature[];
}

export function archetypeStartingPriceCents(arch: BusinessArchetype): number {
  const features = featuresForArchetype(arch);
  return BASE_PRICE_CENTS + features.reduce((s, f) => s + f.priceCents, 0);
}

/** One-line help for estimators / docs. */
export function archetypePriceHint(arch: BusinessArchetype): string {
  const cents = archetypeStartingPriceCents(arch);
  const extra = arch.defaultFeatureIds.length
    ? ` (base $${BASE_PRICE_CENTS / 100} + ${arch.defaultFeatureIds.length} included feature${arch.defaultFeatureIds.length === 1 ? "" : "s"})`
    : ` (base only — add features at $${FEATURE_PRICE_CENTS / 100} each)`;
  return `$${cents / 100}${extra}`;
}
