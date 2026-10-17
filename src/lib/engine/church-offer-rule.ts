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

// ── Normalizing text before any word check (EA r1: the filter is also the
// main prompt-injection defense, so tricks must not slip past it) ──────────
// Cyrillic and Greek letters that look like Latin ones (both cases, mapped
// before lower-casing so Greek "Μ" reads as "m", not "μ" → "u").
const CONFUSABLES: Record<string, string> = {
  // Cyrillic
  "А": "a", "а": "a", "В": "b", "в": "b", "Е": "e", "е": "e", "Ё": "e", "ё": "e", "К": "k", "к": "k",
  "М": "m", "м": "m", "Н": "h", "н": "h", "О": "o", "о": "o", "Р": "p", "р": "p", "С": "c", "с": "c",
  "Т": "t", "т": "t", "У": "y", "у": "y", "Х": "x", "х": "x", "Ѕ": "s", "ѕ": "s", "І": "i", "і": "i",
  "Ї": "i", "ї": "i", "Ј": "j", "ј": "j", "Ԁ": "d", "ԁ": "d", "Һ": "h", "һ": "h", "Ԛ": "q", "ԛ": "q",
  "Ԝ": "w", "ԝ": "w", "Ӏ": "l", "ӏ": "l", "Ь": "b", "ь": "b", "Г": "r", "г": "r", "П": "n", "п": "n",
  // Greek
  "Α": "a", "α": "a", "Β": "b", "β": "b", "Γ": "r", "γ": "y", "Ε": "e", "ε": "e", "Ζ": "z", "Η": "h",
  "η": "n", "Ι": "i", "ι": "i", "Κ": "k", "κ": "k", "Μ": "m", "μ": "u", "Ν": "n", "ν": "v", "Ο": "o",
  "ο": "o", "Ρ": "p", "ρ": "p", "Τ": "t", "τ": "t", "Υ": "y", "υ": "u", "Χ": "x", "χ": "x", "ω": "w",
  "ϲ": "c", "Ϲ": "c", "ϳ": "j"
};
const CONFUSABLE_RE = new RegExp(`[${Object.keys(CONFUSABLES).join("")}]`, "gu");

/**
 * The one way text is read before any church or business word check:
 * NFKC (full-width letters → plain ones), drop zero-width/soft-hyphen characters and
 * accents, fold Cyrillic/Greek look-alikes to Latin, lower-case, join letters
 * spelled out one by one ("O-p-e-r-a-t-e", "S E O" → "operate", "seo"),
 * and turn hyphens, dots, slashes and underscores between words into spaces.
 */
export function normalizeOfferText(text: unknown): string {
  let out = String(text ?? "").normalize("NFKC");
  out = out.replace(/[\u00AD\u200B-\u200F\u2060\uFEFF]/g, "");
  out = out.replace(CONFUSABLE_RE, (ch) => CONFUSABLES[ch] ?? ch);
  out = out.normalize("NFKD").replace(/\p{M}+/gu, "").normalize("NFKC");
  out = out.toLowerCase();
  // Single letters or digits separated by - . _ * · • / or spaces: join them.
  out = out.replace(/(?<![\p{L}\p{N}])[\p{L}\p{N}](?:[\s.\-_*·•/]+[\p{L}\p{N}](?![\p{L}\p{N}])){2,}/gu, (run) => run.replace(/[\s.\-_*·•/]+/g, ""));
  out = out.replace(/[\-_./·•*]+/g, " ").replace(/\s+/g, " ").trim();
  return out;
}

/**
 * Everyday phrases that contain a filtered word but are not an offer or a
 * promise (EA r2). They are cut out of the normalized text before the checks,
 * so the rest of the sentence is still checked: "Free Will Baptist" passes,
 * "Free Will Baptist, free gift" does not.
 */
const STREET = "(street|st|road|rd|avenue|ave|square|sq|place|pl|lane|ln|drive|dr|boulevard|blvd|way|plaza)";
const SAFE_PHRASES_RE = new RegExp(
  [
    "\\bfree\\s+will\\b", // Free Will Baptist
    "\\bfree\\s+methodists?\\b",
    "\\bfree\\s+parking\\b",
    "\\bfree\\s*standing\\b", // "free-standing" reads as "free standing"
    "\\ba\\s+(great|good)\\s+deal\\s+of\\b",
    "\\bad\\s+hoc\\b",
    `\\bmarket\\s+${STREET}\\b`,
    "\\bfarmers?'?\\s+markets?\\b",
    `\\bcampaign\\s+${STREET}\\b`,
    "\\bpromoted\\s+to\\s+(senior\\s+|associate\\s+|youth\\s+|lead\\s+|executive\\s+)?(pastor|minister|deacon|elder|bishop)\\b"
  ].join("|"),
  "g"
);

/** Normalized, with the safe everyday phrases cut out. Every word check below reads this. */
function checkText(text: unknown): string {
  return normalizeOfferText(text).replace(SAFE_PHRASES_RE, " ").replace(/\s+/g, " ").trim();
}

/** Ads, campaigns and posts: never sold to a church, and hidden for businesses while the campaign offer is off. */
const AD_WORDS = [
  "\\bads?\\b",
  "\\badvert\\w*",
  "\\bcampaigns?\\b",
  "\\bsocial\\s*media\\b",
  "\\bseo\\b",
  "\\bpromot(e|es|ed|ing|ion|ions|ional)\\b",
  "\\bgrow\\s+(your|their|the|an?)\\s+(\\w+\\s+)?audiences?\\b",
  "\\baudience\\s+growth\\b",
  "\\b(facebook|instagram|tiktok|twitter|social|youtube)\\s+(posts?|ads?|reels?|page\\s+posts?)\\b",
  "\\bboost(s|ed|ing)?\\s+(your|their|the|its|a)\\s+(google|online|search|listing|reach|visibility|ranking|page|posts?)\\w*",
  "\\bgoogle\\s+(listing|ranking|business\\s+profile|maps\\s+listing)s?\\b"
];

/** Words that never reach a church, matched on checkText output. */
const CHURCH_NEVER_RE = new RegExp(
  [
    "\\bmarket(ing|er|ers|s)?\\b",
    "\\boperate\\b",
    "\\boperations?\\s+(app|tool|software)\\b",
    "\\bops\\b",
    "\\btoners?\\b",
    "\\bgroup\\s*buy(s|ing)?\\b",
    "\\bneighbou?r\\s*ly\\b", // also "neighbor-ly" / "neighbor ly"
    "\\bweb(site)?\\s*design(s|er|ers|ing)?\\b",
    "\\bawd\\b",
    "\\bpresence\\b",
    "\\bspark\\b",
    "\\bbest\\s*life\\b",
    "\\blocal\\s*leads?\\b",
    "\\bbusiness\\s+tools?\\b",
    ...AD_WORDS
  ].join("|"),
  "i"
);

/** While "Marketing campaign" is hidden, a business suggestion may not offer one by any name. */
const HIDDEN_BUSINESS_WORDS_RE = new RegExp(["\\bmarketing\\b", "\\bmarketing\\s*campaigns?\\b", ...AD_WORDS].join("|"), "i");

/** Promises a suggestion must never make: free things, discounts, prices, guarantees, deals, offers. */
const PROMISE_RE = new RegExp(
  [
    "\\bfree\\b",
    "\\bfor\\s+nothing\\b",
    "\\bno\\s+(cost|charge|obligation)\\b",
    "\\bdiscount\\w*",
    "\\d+\\s*%\\s*off\\b",
    "%\\s*off\\b",
    "\\bpercent\\s+off\\b",
    "\\bhalf\\s+(price|off)\\b",
    "\\bguarante\\w*",
    // "deal" only as a promise: "a deal", "special deal", "great deal on" (not "a great deal of", cut above).
    "\\b(a|special|great|good|better|best|big|sweet|exclusive|package|holiday)\\s+deals?\\b",
    "\\bdeals?\\s+(on|for)\\b",
    "\\$\\s*\\d",
    "\\d\\s*\\$",
    "\\b\\d+\\s*(dollars|bucks|usd)\\b",
    "\\bcoupons?\\b",
    "\\bpromo\\s*codes?\\b",
    "\\bcomplimentary\\b",
    "\\bon\\s+us\\b",
    "\\bwaiv(e|ed|es|er|ing)\\b",
    "\\b(2|two)\\s*for\\s*(1|one)\\b",
    "\\bbuy\\s+one\\s+get\\s+one\\b",
    "\\bbogo\\b",
    "\\bgratis\\b",
    "\\btrials?\\b", // covers "free trial"
    "\\bspecial\\s+offers?\\b",
    "\\blimited\\s+time\\b",
    "\\brebates?\\b",
    "\\bsave\\s+(\\w+\\s+){0,3}money\\b",
    "\\bcheap(er|est|ly)?\\b"
  ].join("|"),
  "i"
);

/** Church text check (after normalizing): any never-for-churches word or "marketing". */
export function churchTextBlocked(text: unknown): boolean {
  return CHURCH_NEVER_RE.test(checkText(text));
}

/** Business text check while the campaign offer is hidden. */
export function hiddenBusinessTextBlocked(text: unknown): boolean {
  return !MARKETING_CAMPAIGN_LIVE && HIDDEN_BUSINESS_WORDS_RE.test(checkText(text));
}

/** Any promise of free things, discounts, prices, guarantees, deals or special offers. */
export function promiseTextBlocked(text: unknown): boolean {
  return PROMISE_RE.test(checkText(text));
}

export function churchProductOf(doorId: unknown): ChurchOffer | "" {
  return DOOR_PRODUCT[String(doorId ?? "").trim().toLowerCase()] ?? "";
}

export function allowedForChurch(doorId: unknown): boolean {
  return churchProductOf(doorId) !== "";
}

export function hasForbiddenChurchWord(text: unknown): boolean {
  return FORBIDDEN_RE.test(checkText(text));
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
