// The church rule — the ONE list of what may ever be suggested to a church
// from AppEngine (the CRM desk's suggestions, slice 4 recommendations).
//
// Lincoln, Oct 17 2026: churches get exactly these, nothing else:
//   ChurchConnect (its own doors, like the Find a Church directory, count as ChurchConnect),
//   the EasyPeazy church website (through the existing ChurchConnect → EasyPeazy connection),
//   Laser church gifts,
//   Outreach, which points to Live On Mission.
// Never Operate, never toner, never any business tool. For a church this is
// never called "marketing". Unclear whether an org is a church? Treat it as one.
//
// ChurchConnect keeps the same list in backend/utils/church_offer_rule.py for
// its lead-panel pitch helper. Both sides pin this exact list in a test, so a
// change has to be made in both places on purpose. Check this list BEFORE
// asking for suggestions (only offer these) and AFTER (drop anything else).

// Every church offer reads as ChurchConnect ("churches get ChurchConnect only").
export const CHURCH_ALLOWED_OFFERS = {
  churchconnect: "ChurchConnect",
  easypeazy: "ChurchConnect: church website",
  laser: "ChurchConnect: Laser church gifts",
  outreach: "ChurchConnect: Outreach (Live on Mission)"
} as const;

export type ChurchOffer = keyof typeof CHURCH_ALLOWED_OFFERS;

export const CHURCH_OFFER_IDS = Object.keys(CHURCH_ALLOWED_OFFERS) as ChurchOffer[];

/** Door ids that belong to an allowed product. */
const DOOR_PRODUCT: Record<string, ChurchOffer> = {
  churchconnect: "churchconnect",
  directory: "churchconnect",
  easypeazy: "easypeazy",
  laser: "laser",
  outreach: "outreach"
};

export const OUTREACH_URL = "https://live-on-mission.com/outreach";

/** Named only so tests and filters can prove they never reach a church. */
export const NEVER_FOR_CHURCHES: ReadonlySet<string> = new Set([
  "operate", "toner", "neighborly", "leads", "local_leads", "awd", "ai_website_design",
  "spark", "best_life", "live_on_mission", "presence", "group_buy"
]);

const FORBIDDEN_RE = /\bmarket(ing|er|ers)?\b/i;

export function churchProductOf(doorId: unknown): ChurchOffer | "" {
  return DOOR_PRODUCT[String(doorId ?? "").trim().toLowerCase()] ?? "";
}

export function allowedForChurch(doorId: unknown): boolean {
  return churchProductOf(doorId) !== "";
}

export function hasForbiddenChurchWord(text: unknown): boolean {
  return FORBIDDEN_RE.test(String(text ?? ""));
}

/** Addresses, not words a church reads (laser.engrave.market is a domain). */
const NOT_WORDS = new Set(["id", "url", "door"]);

/** Keep only allowed offers whose words are safe for a church. */
export function filterChurchOffers<T extends { id: string } | string>(items: readonly T[]): T[] {
  return items.filter((item) => {
    const id = typeof item === "string" ? item : item.id;
    if (!allowedForChurch(id)) return false;
    if (typeof item === "string") return true;
    return !Object.entries(item).some(([key, value]) => !NOT_WORDS.has(key) && typeof value === "string" && hasForbiddenChurchWord(value));
  });
}

/** Owner-chosen apps for a church: allowed product ids only, de-duplicated, in list order. */
export function cleanChurchOfferIds(values: unknown): ChurchOffer[] {
  const chosen = new Set((Array.isArray(values) ? values : []).map(churchProductOf));
  return CHURCH_OFFER_IDS.filter((id) => chosen.has(id));
}

// ── Businesses ──────────────────────────────────────────────────────────────
// What the desk may pick for a business prospect (MAP decision: Operate, AI
// Website Design, EasyPeazy, Laser, a marketing campaign). Never shown for a
// church: the picker only offers this list once the org is a business.
export const BUSINESS_OFFERS = {
  operate: "Operate",
  awd: "AI Website Design",
  easypeazy: "EasyPeazy website",
  laser: "Laser gifts",
  marketing_campaign: "Marketing campaign"
} as const;

export type BusinessOffer = keyof typeof BUSINESS_OFFERS;

/** "Marketing campaign" stays hidden until that offer exists. Flip to true to show it. */
export const MARKETING_CAMPAIGN_LIVE = false;

const HIDDEN_BUSINESS_OFFERS: ReadonlySet<string> = new Set(MARKETING_CAMPAIGN_LIVE ? [] : ["marketing_campaign"]);

/** Business offers the desk shows and saves today. */
export const BUSINESS_OFFER_IDS = (Object.keys(BUSINESS_OFFERS) as BusinessOffer[]).filter((id) => !HIDDEN_BUSINESS_OFFERS.has(id));

/** One line under a business choice that could be confused with another. */
export const BUSINESS_OFFER_HINTS: Partial<Record<BusinessOffer, string>> = {
  awd: "We design a full business site for you.",
  easypeazy: "A simple site you build or keep yourself."
};

export function cleanBusinessOfferIds(values: unknown): BusinessOffer[] {
  const chosen = new Set((Array.isArray(values) ? values : []).map((value) => String(value ?? "").trim().toLowerCase()));
  return BUSINESS_OFFER_IDS.filter((id) => chosen.has(id));
}

/** The choices the desk shows for this kind of org. A church never sees a business choice. */
export function offerChoices(kind: "church" | "business"): Array<{ id: string; label: string; hint?: string }> {
  if (kind === "church") return CHURCH_OFFER_IDS.map((id) => ({ id, label: CHURCH_ALLOWED_OFFERS[id] }));
  return BUSINESS_OFFER_IDS.map((id) => ({ id, label: BUSINESS_OFFERS[id], hint: BUSINESS_OFFER_HINTS[id] }));
}
