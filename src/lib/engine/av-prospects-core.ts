import { DROP_OFF_REST_DAYS, VISIT_REST_DAYS, friendlyDate, friendlyDay, repeatRule, suppressionDomain, type Touch } from "@/lib/engine/lpl-crm-core";
import { topHasChurchWord, topNameExcluded } from "@/lib/engine/top-prospects-name";

// AV prospects, and Top prospects as a second mode of the same rules (Oct 17 2026).
// Territory order: central & South Georgia first, then the rest of Georgia, then
// Florida, then South Carolina. READ ONLY and pure: the rows come from cc_churches
// (lpl-crm.ts reads them), nothing is written, nothing is sent. No new tables.
//
// Scored only on what cc_churches really holds today (checked Oct 17 2026):
//   * lat/lng → miles from Vidalia (almost every row has them);
//   * website / facebook_url / live_stream_url / livestream_url / youtube_url /
//     subsplash_url → "no livestream or YouTube link on file" (a link on file
//     means they already stream);
//   * the website address itself → a giving page, a directory listing or a
//     free-builder address instead of the church's own site;
//   * website_live / website_http_status / website_trouble → "wasn't loading";
//   * avg_attendance (rare) and named staff (pastor, contact, ministry
//     assistant, secretary) → a size hint.
// No column says "new building" or "growing", so those are NOT scored. Every
// reason says "on file", because a missing link only means we don't have it.

export const VIDALIA = { lat: 32.2177, lng: -82.4135 } as const;

/** How many prospects the desk shows. */
export const AV_LIST_SIZE = 30;

/**
 * Central & South Georgia = a Georgia church south of 33.25° N. One simple,
 * documented line: Columbus (32.46), Macon (32.84) and Milledgeville (33.08)
 * are in; Augusta (33.47), Atlanta (33.75) and Athens (33.96) are out.
 * Top prospects does not use this line; that list is ZIP3 only.
 */
export const CENTRAL_SOUTH_GA_MAX_LAT = 33.25;

/** ZIP3 prefixes for Top prospects. 311 (Atlanta) is not on this list. Eatonton 310 is in; LaGrange 302 is not. */
export const CENTRAL_SOUTH_GA_ZIP3 = ["304", "310", "312", "313", "314", "315", "316", "317", "318", "319", "398"] as const;

/** How many churches the Top prospects list shows. */
export const TOP_LIST_SIZE = 25;

/**
 * Documentation only: the published ChurchConnect census on main 8aa17b18
 * (blob 92bd0886). 14,611 kept of 15,476 in scope. The golden fixture is 161
 * rows and does not recompute these counts. Rest of Georgia stays 0 until
 * those churches are scored.
 */
export const TOP_PROSPECT_KEPT_CENSUS = {
  centralSouthGa: 9609,
  restOfGa: 0,
  florida: 3190,
  southCarolina: 1812,
  total: 14611,
  inScope: 15476
} as const;

/** Tiers this list will rank. Rest of Georgia (1) and any other value are refused with 422. */
export function resolveTopProspectTier(raw: string | null): { ok: true; tier: 0 | 2 | 3 } | { ok: false; status: 422; detail: string } {
  const detail = "That area is not on this list.";
  if (raw === null || raw === "") return { ok: true, tier: 0 };
  if (!/^\d+$/.test(raw)) return { ok: false, status: 422, detail };
  const tier = Number(raw);
  if (tier === 0 || tier === 2 || tier === 3) return { ok: true, tier };
  return { ok: false, status: 422, detail };
}

/** Territory tiers, in order. Every reason line starts with the tier label. */
export const AV_TIERS = [
  { id: "central_south_ga", label: "Central/South GA" },
  { id: "rest_of_ga", label: "Rest of GA" },
  { id: "fl", label: "Florida" },
  { id: "sc", label: "South Carolina" }
] as const;

export type AvTierIndex = 0 | 1 | 2 | 3;

const STATE_ALIASES: Record<string, "GA" | "FL" | "SC"> = { ga: "GA", georgia: "GA", fl: "FL", florida: "FL", sc: "SC", "south carolina": "SC" };

/** GA / FL / SC from the state on file (codes or full names), else "". */
export function territoryState(value: unknown): "GA" | "FL" | "SC" | "" {
  return STATE_ALIASES[String(value ?? "").trim().toLowerCase()] ?? "";
}

/** First three digits of a ZIP, or "" when there is no ZIP. */
export function zip3Of(zip: unknown): string {
  const digits = String(zip ?? "").replace(/\D/g, "");
  return digits.length >= 3 ? digits.slice(0, 3) : "";
}

/** Which tier a church is in, or null when it is outside the territory or has no location. */
export function territoryTier(state: unknown, lat: number | null): AvTierIndex | null {
  const code = territoryState(state);
  if (!code || lat === null || !Number.isFinite(lat)) return null;
  if (code === "GA") return lat < CENTRAL_SOUTH_GA_MAX_LAT ? 0 : 1;
  return code === "FL" ? 2 : 3;
}

/**
 * Top prospects territory. ZIP3 only: there is no latitude cut. A Georgia
 * church with no ZIP, or a ZIP outside the central/south list, is rest of Georgia.
 */
export function topTerritoryTier(state: unknown, zip: unknown): AvTierIndex | null {
  const code = territoryState(state);
  if (code === "GA") return (CENTRAL_SOUTH_GA_ZIP3 as readonly string[]).includes(zip3Of(zip)) ? 0 : 1;
  if (code === "FL") return 2;
  if (code === "SC") return 3;
  return null;
}

/**
 * PostgREST filters for Top prospects: rows that already have av_signals, in
 * one tier. Georgia tier 0 is the ZIP3 list. A missing ZIP is rest of Georgia.
 */
export function topTierFilter(tier: AvTierIndex): string {
  const signals = "doc->av_signals=not.is.null";
  if (tier === 2) return `doc->>state=in.(FL,Florida)&${signals}`;
  if (tier === 3) return `doc->>state=in.(SC,"South Carolina")&${signals}`;
  const likes = CENTRAL_SOUTH_GA_ZIP3.map((zip) => `doc->>zip_code.like.${zip}*`).join(",");
  const missingZip = "or(doc->>zip_code.is.null,doc->>zip_code.eq.)";
  if (tier === 0) return `doc->>state=in.(GA,Georgia)&${signals}&or=(${likes})`;
  const outside = CENTRAL_SOUTH_GA_ZIP3.map((zip) => `doc->>zip_code.not.like.${zip}*`).join(",");
  return `doc->>state=in.(GA,Georgia)&${signals}&or=(and(${outside}),${missingZip})`;
}

/**
 * How the loader reads: per tier, growing rings around Vidalia (miles). Inside
 * a tier the list is nearest-first, so once the tiers before plus this tier's
 * churches inside the ring reach the cap, the top of the list is final and
 * nothing further out is read. 700 miles covers the whole territory.
 */
export const AV_RINGS_MILES = [40, 80, 160, 320, 700] as const;

/** A lat/lng box that contains the whole circle of this radius around Vidalia. */
export function ringBox(radius: number): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const dLat = radius / 69;
  const farLat = Math.min(89, Math.abs(VIDALIA.lat) + dLat);
  const dLng = Math.min(180, radius / (69 * Math.cos((farLat * Math.PI) / 180)));
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return { minLat: r(VIDALIA.lat - dLat), maxLat: r(VIDALIA.lat + dLat), minLng: r(VIDALIA.lng - dLng), maxLng: r(VIDALIA.lng + dLng) };
}

/** PostgREST filters for one tier inside one ring (lat/lng are JSON numbers in cc_churches.doc). */
export function tierRingFilters(tier: AvTierIndex, radius: number): string {
  const box = ringBox(radius);
  const parts = [
    tier <= 1 ? "doc->>state=in.(GA,Georgia)" : tier === 2 ? "doc->>state=in.(FL,Florida)" : `doc->>state=in.(SC,"South Carolina")`,
    `doc->lng=gte.${box.minLng}`,
    `doc->lng=lte.${box.maxLng}`
  ];
  let minLat = box.minLat;
  let maxLat = box.maxLat;
  if (tier === 0) maxLat = Math.min(maxLat, CENTRAL_SOUTH_GA_MAX_LAT);
  if (tier === 1) minLat = Math.max(minLat, CENTRAL_SOUTH_GA_MAX_LAT);
  parts.push(`doc->lat=gte.${minLat}`, tier === 0 && maxLat === CENTRAL_SOUTH_GA_MAX_LAT ? `doc->lat=lt.${maxLat}` : `doc->lat=lte.${maxLat}`);
  return parts.join("&");
}

export type AvRow = Record<string, unknown>;

export type AvProspect = {
  churchId: string;
  tier: AvTierIndex;
  tierLabel: string;
  name: string;
  /** The name the row leads with. */
  lead: string;
  /** Muted line under the lead. "" when it would repeat the lead. */
  legalLine: string;
  town: string;
  miles: number;
  score: number;
  reasons: string[];
  website: string;
};

/**
 * Stored reasons keep the tier prefix ("Central/South GA · …") so the data
 * still says which area a line belongs to. The row shows that tier once, in
 * the subline, so the bullet on screen is the reason only.
 */
export function avReasonText(reason: string, tierLabel: string): string {
  const prefix = `${tierLabel} \u00b7 `;
  return reason.startsWith(prefix) ? reason.slice(prefix.length) : reason;
}

const s = (value: unknown): string => (value === null || value === undefined ? "" : String(value).trim());
/** Desk and directory flags are not only the boolean true. "yes" and 1 count too. */
const yes = (value: unknown): boolean => {
  if (value === true || value === 1) return true;
  const text = s(value).toLowerCase();
  return text === "true" || text === "yes" || text === "y" || text === "1";
};

export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

export function milesFromVidalia(row: AvRow): number | null {
  const lat = Number(s(row.lat) || s(row.latitude));
  const lng = Number(s(row.lng) || s(row.longitude));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0) || !s(row.lat || row.latitude)) return null;
  return milesBetween(VIDALIA, { lat, lng });
}

function hostOf(url: string): { host: string; path: string } {
  const text = url.trim().toLowerCase().replace(/^[a-z]+:\/\//, "");
  const cut = text.search(/[/?#]/);
  const host = (cut === -1 ? text : text.slice(0, cut)).replace(/^www\./, "");
  return { host, path: cut === -1 ? "" : text.slice(cut) };
}

const GIVING_HOSTS = ["tithe.ly", "give.tithe.ly", "pushpay.com", "onrealm.org", "givelify.com", "secure.myvanco.com", "vancopayments.com"];
const DIRECTORY_HOSTS = ["churchangel.com", "placestars.com", "churchfinder.com", "faithstreet.com", "yellowpages.com", "yelp.com", "manta.com", "mapquest.com", "inallthingspray.org"];
// A denomination or platform root on a single church's record: not their own site, and not a key that proves two rows are the same church.
const DENOMINATION_HOSTS = [
  "nationalbaptist.com", "sbc.net", "umc.org", "cogic.org", "ag.org", "gabaptist.org", "namb.net", "elca.org", "pcusa.org",
  "ame-church.com", "thecme.church", "watchtower.org", "jw.org", "upci.org", "church-of-christ.org", "churchofjesuschrist.org", "lds.org",
  "churchofgod.cc", "churchofgod.org", "sgaumc.org", "nazarene.org"
];
const FREE_BUILDER_HOSTS = [
  "wix.com", "wixsite.com", "weebly.com", "blogspot.com", "sites.google.com", "godaddysites.com", "square.site", "webs.com",
  "tripod.com", "angelfire.com", "wordpress.com", "faithlife.com", "squarespace.com", "business.site"
];
const PLATFORM_HOSTS = [
  "facebook.com", "fb.com", "instagram.com", "youtube.com", "youtu.be", "tiktok.com", "linktr.ee",
  "subsplash.com", "google.com", "goo.gl", "ourchurch.com", "ministrybrands.com",
  "chamberofcommerce.com", "bizapedia.com", "giv.li", "netministries.org", "paypal.com", "cash.app"
];

const onHost = (host: string, list: string[]) => list.some((item) => host === item || host.endsWith(`.${item}`));

/** What the website address on file says about the site, or "" when it looks like the church's own site. */
export function websiteWeakness(url: string): "" | "giving" | "directory" | "denomination" | "free_builder" | "platform" {
  if (!url.trim()) return "";
  const { host } = hostOf(url);
  if (!host) return "";
  if (onHost(host, GIVING_HOSTS) || /^give\./.test(host)) return "giving";
  if (onHost(host, DIRECTORY_HOSTS)) return "directory";
  if (onHost(host, DENOMINATION_HOSTS)) return "denomination";
  if (onHost(host, FREE_BUILDER_HOSTS)) return "free_builder";
  if (onHost(host, PLATFORM_HOSTS)) return "platform";
  return "";
}

const WEAKNESS_REASON: Record<"giving" | "directory" | "denomination" | "free_builder" | "platform", string> = {
  giving: "The website on file is only a giving page",
  directory: "The website on file is a directory listing, not their own site",
  denomination: "The website on file is a denomination's site, not their own",
  free_builder: "The website on file is on a free site builder",
  platform: "The website on file is a shared platform, not their own site"
};

// A host that names some other city or state is probably the wrong church's site.
const PLACE_TOKENS = [
  "savannah", "augusta", "atlanta", "macon", "valdosta", "columbus", "athens", "brunswick", "albany", "milledgeville",
  "dublin", "statesboro", "waycross", "tifton", "americus", "jacksonville", "tallahassee", "orlando", "tampa", "miami",
  "charleston", "columbia", "greenville", "florida", "alabama", "tennessee", "carolina",
  "dallas", "nashville", "houston", "austin", "charlotte", "birmingham", "mobile", "memphis", "texas"
];

/** A town that sits in a larger city's area, so that city's name in a host is still theirs. */
const METRO: Record<string, string[]> = {
  savannah: ["pooler", "garden city", "port wentworth", "richmond hill", "rincon"],
  augusta: ["martinez", "evans", "grovetown"],
  jacksonville: ["orange park", "jacksonville beach"],
  atlanta: ["marietta", "decatur", "smyrna"]
};

/** True when the website host names a different city or state than this church. */
export function websitePlaceMismatch(url: string, city: string, state: string, name = ""): boolean {
  const host = hostOf(url).host.replace(/\.(com|org|net|church|us|info)$/g, "");
  const flat = host.replace(/[^a-z0-9]/g, "");
  if (flat.length < 5 || websiteWeakness(url)) return false;
  const cityFlat = s(city).toLowerCase().replace(/[^a-z]/g, "");
  const nameFlat = s(name).toLowerCase().replace(/[^a-z]/g, "");
  const stateFlat = s(state).toLowerCase();
  const ownState = stateFlat === "fl" || stateFlat === "florida" ? "florida" : stateFlat === "sc" || stateFlat === "south carolina" ? "carolina" : stateFlat === "al" || stateFlat === "alabama" ? "alabama" : stateFlat === "ga" || stateFlat === "georgia" ? "georgia" : stateFlat === "tx" || stateFlat === "texas" ? "texas" : stateFlat === "tn" || stateFlat === "tennessee" ? "tennessee" : "";
  for (const place of PLACE_TOKENS) {
    if (!flat.includes(place)) continue;
    if (cityFlat && (cityFlat.includes(place) || place.includes(cityFlat))) continue;
    if (nameFlat.includes(place)) continue;
    if ((METRO[place] ?? []).some((town) => cityFlat === town.replace(/[^a-z]/g, ""))) continue;
    if (ownState && place === ownState) continue;
    return true;
  }
  return false;
}

/**
 * Georgia churches the AV partner lists as its own work (read Oct 17 2026),
 * within reach of this list: not prospects. A church
 * matches when every word is in its name and the town is the same.
 */
export const MESSENGER_AVL_SHOWN_WORK: ReadonlyArray<{ words: string[]; town: string }> = [
  { words: ["new", "life"], town: "vidalia" },
  { words: ["compassion"], town: "savannah" },
  { words: ["warren", "baptist"], town: "augusta" },
  { words: ["first", "baptist"], town: "brunswick" },
  { words: ["byne", "memorial"], town: "albany" },
  { words: ["lake", "point"], town: "eatonton" }
];

function shownWork(row: AvRow): boolean {
  const words = new Set(s(row.name).toLowerCase().replace(/[^a-z ]+/g, " ").split(" ").filter(Boolean));
  const town = s(row.city).toLowerCase().trim();
  return MESSENGER_AVL_SHOWN_WORK.some((item) => town === item.town && item.words.every((word) => words.has(word)));
}

const STOPPED_STATUS = new Set(["lost", "won", "declined", "not_interested", "said_no", "suppressed", "do_not_contact", "closed"]);

function nameWords(name: string): string[] {
  return s(name).toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
}

/** M.B.C. and C.M.E. are the same words as MBC and CME. */
function collapseInitials(raw: string): string {
  return raw.replace(/\b(?:[a-z]\.){2,}[a-z]\.?/g, (match) => match.replace(/\./g, ""));
}

const CHRISTIAN_WORDS = new Set([
  "church", "churches", "baptist", "ministries", "ministry", "ame", "methodist", "worship", "fellowship",
  "chapel", "tabernacle", "assembly", "cathedral", "pentecostal", "holiness", "missionary", "faith", "bethel",
  "christ", "gospel", "apostolic", "deliverance", "praise", "holy", "cog", "cogic", "cogiu", "cme", "mbc", "umc",
  "upc", "upci"
]);
/** School, academy, and campus drop only when none of these are in the name. UPC is the United Pentecostal Church. */
const CHURCH_OR_BAPTIST = new Set(["church", "churches", "baptist", "upc", "upci"]);
const NAME_DROP = new Set(["inc", "incorporated", "llc", "corp", "corporation", "co"]);

function foldedName(name: string): string {
  return s(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasChristianWord(raw: string, words: string[]): boolean {
  if (words.some((word) => CHRISTIAN_WORDS.has(word))) return true;
  return /\ba\s*\.?\s*m\s*\.?\s*e\b/.test(raw);
}

/**
 * Places that are not a Christian church, matched on the name because
 * religion_guess is empty on most rows. Kingdom Hall and Kingdom Kids always
 * go. Association goes unless the name ends in Church. A trailing MBA or BA,
 * college ministry, Church of Christ Scientist, Community Center, and a
 * conference council go even when the name says Baptist. Preschool goes
 * anywhere in the name unless the name also says Church. School, academy, and
 * campus go only when the name has no church or baptist word. "Christian
 * Academy" and "Christian School" still go when Baptist is present, unless the
 * name also says Church. "Old school" is the Primitive Baptist phrase, not a
 * school. A bare temple stays. Hebrew, Chabad, B'nai, and Temple with Israel
 * go. A district and a children's home go. A bare center stays: dropping it
 * would also remove Christian Center churches.
 */
export function avNameExcluded(name: string): boolean {
  const raw = collapseInitials(foldedName(name));
  const compact = raw.replace(/[^a-z]/g, "");
  if (compact.includes("kingdomhall")) return true;
  // Media-production companies. "CENTERINC" has no space before the suffix.
  // A church, chapel, or ministry keeps the name. Inc, LLC, Properties, Conference, Holdings, and Corp are not drop words on their own.
  const churchBody = /\b(churches|church|chapels|chapel|ministries|ministry)\b/.test(raw);
  if (!churchBody && (compact.includes("mediaproduction") || compact.includes("productioncenter") || compact.includes("productions"))) return true;
  if (/\bkingdom\s+kids\b/.test(raw)) return true;
  const street = raw.replace(/\bmosque\s+street\b/g, " ").replace(/\bold\s+school\b/g, " ");
  const words = nameWords(street);
  const has = (word: string) => words.includes(word);
  const christian = hasChristianWord(raw, nameWords(raw)) || /\bold\s+school\b/.test(raw);
  const churchOrBaptist = words.some((word) => CHURCH_OR_BAPTIST.has(word));
  const hasChurch = has("church") || has("churches");
  const significant = words.filter((word) => !NAME_DROP.has(word));
  const endsWithChurch = significant[significant.length - 1] === "church";
  const tail = (phrase: string[]) => phrase.length <= significant.length && phrase.every((word, index) => significant[significant.length - phrase.length + index] === word);
  if (["unitarian", "universalist", "diocese", "retreat", "distribution", "masjed", "musalla", "mormon", "sikh", "gurdwara", "mandir", "swaminarayan", "shrine", "scientology", "spiritualist", "cemetery", "cemetary", "hindu", "buddhist", "buddhism", "buddha", "synagogue", "messianic", "lds", "islamic", "islam", "masjid", "muhammad", "mohammed", "muslim", "moslem", "hebrew", "chabad", "district"].some(has)) return true;
  if (has("mosque")) return true;
  if (/\bb['’]?nai\b/.test(raw)) return true;
  if (/\blatter\s*-?\s*day\b/.test(raw) || raw.includes("latterday")) return true;
  // "1st Ward" is an LDS ward. A bare "ward" is too, unless the name is a church (Ward Grove Baptist, Ward Memorial UMC).
  if (/\b\d+(st|nd|rd|th)\s+ward\b/.test(street) || (has("ward") && !christian)) return true;
  if (/\bstake\s+center\b/.test(raw) || /\bconference\s+center\b/.test(raw) || /\bconference\s+council\b/.test(raw)) return true;
  if (/\bbeth\s+israel\b/.test(raw) || /\btemple\s+beth\b/.test(raw) || /\bchristian\s+science\b/.test(raw) || /\bbaha['’]?i\b/.test(raw)) return true;
  if ((/\bcongregation\b/.test(raw) && /\bisrael\b/.test(raw)) || (has("temple") && has("israel"))) return true;
  if (/\bchurch\s+of\s+christ,?\s+scientist\b/.test(raw)) return true;
  if (/\bchildrens?\s+homes?\b/.test(raw.replace(/['’]/g, ""))) return true;
  if (has("association") && !endsWithChurch) return true;
  if (/\bchristian\s+(academy|schools?)\b/.test(street) && !hasChurch) return true;
  if ((has("academy") || has("school") || has("schools") || has("campus")) && !churchOrBaptist) return true;
  if (/\bcollege\s+ministr(?:y|ies)\b/.test(raw)) return true;
  const last = significant[significant.length - 1];
  if (last === "mba" || last === "ba") return true;
  if (tail(["community", "center"])) return true;
  if (has("preschool") && !hasChurch) return true;
  if (/\bfood\s+(bank|pantry)\b/.test(raw) && !christian) return true;
  if (has("foundation") && !christian) return true;
  if (!christian && ["camp", "college", "seminary", "jehovah"].some(has)) return true;
  return false;
}

/**
 * A name lookup of 40 or more rows is too wide to trust, whether or not a
 * church id was recorded. Under 40, nothing is blocked.
 */
export function decideWideNameLookup(batchLength: number, churchIds: readonly string[]): { blocked: boolean; churchIds: string[] } {
  if (batchLength < 40) return { blocked: false, churchIds: [] };
  return { blocked: true, churchIds: [...new Set(churchIds.map((id) => s(id)).filter(Boolean))] };
}

/** Church ids to block for a wide lookup. Empty when the lookup is narrow, or when it is wide but no id was recorded. */
export function wideNameLookupBlock(batchLength: number, churchIds: readonly string[]): string[] {
  return decideWideNameLookup(batchLength, churchIds).churchIds;
}

/**
 * The loader's choice for one name lookup. "fail" means 40 or more rows and
 * no church id, so the whole list stops. "block" keeps those churches off.
 * "use" means the rows are safe to group.
 */
export function consumeWideNameLookup(batchLength: number, churchIds: readonly string[], blocked: Set<string>): "use" | "block" | "fail" {
  const decision = decideWideNameLookup(batchLength, churchIds);
  if (!decision.blocked) return "use";
  if (!decision.churchIds.length) return "fail";
  for (const id of decision.churchIds) blocked.add(id);
  return "block";
}

/** Touches the desk would rest on: the invite on the church, plus visits and drop-offs the loader attached. */
export function avDeskTouches(row: AvRow): Touch[] {
  const touches: Touch[] = [];
  const invitedAt = s(row.last_invited_at);
  const invite = s(row.invite_status).toLowerCase();
  if (invitedAt && invite !== "failed") {
    touches.push({ at: invitedAt, app: "churchconnect", kind: "invite", what: "Invite", outreach: true });
  }
  const extra = Array.isArray(row.desk_touches) ? row.desk_touches : [];
  for (const item of extra) {
    if (!item || typeof item !== "object") continue;
    const touch = item as Record<string, unknown>;
    const at = s(touch.at);
    if (!at || Number.isNaN(Date.parse(at))) continue;
    const kind = s(touch.kind).toLowerCase();
    const outreachKind = kind === "visit" || kind === "drop_off" || kind === "invite" || kind === "email" || kind === "call" || kind === "sms" || kind === "meeting" || kind === "text";
    touches.push({
      at,
      app: "churchconnect",
      kind: kind === "drop_off" ? "drop_off" : kind === "visit" ? "visit" : kind === "invite" ? "invite" : kind === "email" ? "email" : kind === "call" ? "call" : "note",
      what: s(touch.what) || kind || "Activity",
      outreach: touch.outreach === false ? false : outreachKind || touch.outreach === true,
      restDays: kind === "drop_off" ? DROP_OFF_REST_DAYS : kind === "visit" ? VISIT_REST_DAYS : undefined,
      signal: touch.signal === true
    });
  }
  return touches.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** The desk would not offer outreach: stopped, invited, or inside a visit, drop-off, or other outreach rest. */
export function avDeskBlocked(row: AvRow, now = new Date()): boolean {
  const status = s(row.crm_status).toLowerCase().replace(/[\s-]+/g, "_");
  if (STOPPED_STATUS.has(status)) return true;
  const invite = s(row.invite_status).toLowerCase();
  if (invite === "sent" || invite === "accepted") return true;
  return repeatRule(avDeskTouches(row), now).level === "hold";
}

function rowHidden(row: AvRow): boolean {
  return yes(row.hidden) || yes(row.is_hidden) || s(row.is_public).toLowerCase() === "false" || row.is_public === false;
}

function rowInactive(row: AvRow): boolean {
  return s(row.active).toLowerCase() === "false" || row.active === false;
}

/** Top prospects: religion_guess "other" drops a row only when the name has no church word. */
function religionOtherExcluded(row: AvRow): boolean {
  return s(row.religion_guess).toLowerCase() === "other" && !topHasChurchWord(s(row.name));
}

/** Never on the list: stopped, lost, inactive, not a church, or already the partner's own work. */
export function avExcluded(row: AvRow, suppressed: (row: AvRow) => boolean, now = new Date()): boolean {
  if (yes(row.do_not_contact) || yes(row.do_not_contact_desk_claim)) return true;
  if (avDeskBlocked(row, now)) return true;
  if (s(row.merged_into) || s(row.deleted_at) || s(row.duplicate_of)) return true;
  if (s(row.active).toLowerCase() === "false" || row.active === false) return true;
  if (s(row.is_public).toLowerCase() === "false" || row.is_public === false) return true;
  if (s(row.religion_guess).toLowerCase() === "other") return true;
  if (s(row.prospect_kind).toLowerCase() === "association") return true;
  if (avNameExcluded(s(row.name))) return true;
  if (s(row.source) === "qa_crm_v2") return true;
  if (shownWork(row)) return true;
  return suppressed(row);
}

/** Score and plain reasons for one church, from real columns only. A generic or shared host is not also "has a website". */
export function scoreAvProspect(row: AvRow, sharedHosts: ReadonlySet<string> = new Set()): { score: number; reasons: string[]; streams: boolean } {
  const reasons: string[] = [];
  let score = 0;
  const website = s(row.website);
  const facebook = s(row.facebook_url);
  const host = hostOf(website).host;
  const shared = Boolean(host && sharedHosts.has(host));
  const weak = websiteWeakness(website) || (shared ? "platform" : "");
  const mismatch = !weak && websitePlaceMismatch(website, s(row.city), s(row.state), s(row.name));
  const ownSite = Boolean(website) && !weak && !mismatch;
  const streams = Boolean(s(row.live_stream_url) || s(row.livestream_url) || s(row.youtube_url) || s(row.subsplash_url));
  if (streams) {
    reasons.push("Already streams (a stream link is on file)");
    score -= 2;
  } else if (weak) {
    reasons.push(WEAKNESS_REASON[weak]);
    score += 1;
  } else if (ownSite) {
    reasons.push("Has a website, but no livestream or YouTube link on file");
    score += 2;
  } else if (facebook) {
    reasons.push("Facebook page, but no livestream link on file");
    score += 1;
  }
  if (mismatch) {
    reasons.push("The website on file may be wrong");
    score += 1;
  }
  const status = Number(s(row.website_http_status));
  if (website && (s(row.website_live).toLowerCase() === "false" || (Number.isFinite(status) && status >= 400) || s(row.website_trouble))) {
    reasons.push("Their website wasn't loading at our last check");
    score += 1;
  }
  const attendance = Number(s(row.avg_attendance).replace(/[^\d.]/g, ""));
  if (Number.isFinite(attendance) && attendance >= 150) {
    reasons.push(`About ${Math.round(attendance)} attend (on file)`);
    score += 2;
  }
  const staff = [row.pastor_name, row.contact_name, row.ministry_assist_name, row.secretary_name].filter((value) => s(value)).length;
  if (staff >= 2) {
    reasons.push("Several staff names on file");
    score += 1;
  }
  return { score, reasons, streams };
}

// Short church words that stay in capitals when an ALL-CAPS name is tidied.
const KEEP_CAPS = new Set(["AME", "AMEZ", "CME", "UMC", "COGIC", "FBC", "II", "III", "IV", "USA", "QA"]);

const COMMON_NAME_KEYS = ["church_name", "common_name"] as const;
const CRAWL_TITLE_KEYS = ["crawl_title", "website_title", "page_title", "site_name", "site_title"] as const;
const CORPORATE_SUFFIXES = [
  "properties incorporated",
  "properties inc",
  "limited liability company",
  "incorporated",
  "corporation",
  "l.l.c",
  "llc",
  "inc",
  "corp",
  "ltd",
  "limited",
  "company",
  "co"
];
const HOST_TLDS = new Set(["com", "org", "net", "church", "us", "info", "edu", "gov", "example", "co", "io"]);

function textList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => s(item)).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => s(item)).filter(Boolean);
    } catch {
      return value.split(/[|;]/).map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function nameKey(value: string): string {
  return foldedName(value).replace(/[^a-z0-9]+/g, "");
}

function sameName(a: string, b: string): boolean {
  return nameKey(a) === nameKey(b);
}

/** Drop Inc/LLC and the other corporate tails, plus a leading "Trustees of". */
export function stripCorporateSuffix(name: string): string {
  let text = s(name).replace(/\s+/g, " ").trim().replace(/^trustees of\s+/i, "");
  for (let guard = 0; guard < 6; guard += 1) {
    text = text.replace(/[.,]+$/g, "").trim();
    const lower = foldedName(text);
    const suffix = CORPORATE_SUFFIXES.find((item) => new RegExp(`\\s+${item.replace(/\./g, "\\.")}$`).test(lower));
    if (!suffix) break;
    text = text.replace(new RegExp(`\\s+${suffix.replace(/\./g, "\\.")}\\.?$`, "i"), "").trim();
  }
  return text.replace(/[.,]+$/g, "").trim();
}

function congregationWord(raw: string): boolean {
  return /\b(churches|church|chapels|chapel|ministries|ministry)\b/.test(raw);
}

/** A conference, diocese, or association that is not itself the congregation. */
export function isParentBody(name: string): boolean {
  const raw = foldedName(stripCorporateSuffix(name));
  if (/\bconferences?\b/.test(raw)) return true;
  const congregation = congregationWord(raw);
  if (/\barchdioceses?\b/.test(raw) || /\bdioceses?\b/.test(raw)) return !congregation;
  if (/\bassociations?\b/.test(raw)) return !congregation;
  return false;
}

function readsLikeChurch(name: string): boolean {
  if (!s(name) || isParentBody(name)) return false;
  const raw = foldedName(name);
  return hasChristianWord(raw, nameWords(raw)) || congregationWord(raw);
}

const HOST_SPLIT_WORDS = [...new Set([...PLACE_TOKENS, ...CHRISTIAN_WORDS, "family", "saint", "mount", "grace", "first", "community", "united", "catholic"])].sort(
  (a, b) => b.length - a.length
);

function segmentHost(token: string): string[] | null {
  const out: string[] = [];
  let index = 0;
  while (index < token.length) {
    const word = HOST_SPLIT_WORDS.find((item) => token.startsWith(item, index));
    if (!word) return null;
    out.push(word);
    index += word.length;
  }
  return out.length ? out : null;
}

function capToken(word: string): string {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

/** Own-site host as a title: no www, no TLD. Hyphens and dots split. A run that will not split is title-cased whole. */
export function hostLeadName(host: string): string {
  let labels = host.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  if (labels.length > 1 && HOST_TLDS.has(labels[labels.length - 1])) labels = labels.slice(0, -1);
  const words = labels
    .join("-")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .flatMap((chunk) => (segmentHost(chunk) ?? [chunk]).map(capToken));
  return words.join(" ");
}

function commonLabels(row: AvRow, mates: readonly AvRow[]): string[] {
  const labels: string[] = [];
  const push = (value: unknown) => {
    const text = s(value);
    if (text) labels.push(text);
  };
  for (const source of [row, ...mates]) {
    for (const key of COMMON_NAME_KEYS) push(source[key]);
  }
  for (const source of [row, ...mates]) {
    for (const key of CRAWL_TITLE_KEYS) push(source[key]);
    const sig = signalBag(source);
    if (!sig) continue;
    for (const key of CRAWL_TITLE_KEYS) push(sig[key]);
  }
  for (const source of [row, ...mates]) for (const alias of textList(source.alias_names)) push(alias);
  for (const mate of mates) push(mate.name);
  return labels;
}

export type ProspectNameParts = { lead: string; legalLine: string };

/**
 * Lead name: a common or DBA name, otherwise the legal name when it reads as a
 * church, otherwise the church's own site as a title. The muted line is the
 * full legal name when it differs, or "Filed under …" for a parent body.
 */
export function prospectNameParts(row: AvRow, mates: readonly AvRow[] = []): ProspectNameParts {
  const legalRaw = s(row.name);
  const legalDisplay = titleCase(legalRaw) || "Unnamed church";
  const legalStripped = stripCorporateSuffix(legalRaw);
  const legalLead = titleCase(legalStripped) || legalDisplay;
  let lead = "";
  for (const label of commonLabels(row, mates)) {
    const stripped = stripCorporateSuffix(label);
    if (!stripped || sameName(stripped, legalStripped)) continue;
    lead = titleCase(stripped);
    break;
  }
  if (!lead && readsLikeChurch(legalStripped)) lead = legalLead;
  if (!lead) {
    for (const source of [row, ...mates]) {
      const url = s(source.website);
      if (!url || websiteWeakness(url)) continue;
      const titled = hostLeadName(hostOf(url).host);
      if (titled) {
        lead = titled;
        break;
      }
    }
  }
  if (!lead) lead = legalDisplay;
  const legalLine = sameName(lead, legalDisplay) ? "" : isParentBody(legalRaw) ? `Filed under ${legalDisplay}` : legalDisplay;
  return { lead, legalLine };
}

function titleCase(text: string): string {
  if (text !== text.toUpperCase()) return text;
  return text
    .split(/(\s+)/)
    .map((word, index) => {
      if (KEEP_CAPS.has(word.replace(/[^A-Z]/g, "")) && word.replace(/[^A-Z]/g, "").length === word.replace(/[^A-Za-z]/g, "").length) return word;
      const lower = word.toLowerCase();
      if (index > 0 && ["of", "the", "and", "in", "at", "for"].includes(lower)) return lower;
      return lower.replace(/(^|[-'(])([a-z])/g, (_m, lead: string, ch: string) => `${lead}${ch.toUpperCase()}`);
    })
    .join("");
}

/**
 * Same church name, in the same town. Drops Inc/LLC and a trailing "church",
 * reads St as Saint and Mt as Mount, folds A.M.E. to AME, drops a leading
 * "The" and a trailing "of <town>", and strips punctuation. Word order stays.
 */
export function churchNameKey(name: string, city = ""): string {
  const words = foldedName(name)
    .replace(/\ba\s*\.\s*m\s*\.\s*e\.?\b/g, " ame ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => (word === "st" ? "saint" : word === "mt" ? "mount" : word))
    .filter((word) => !NAME_DROP.has(word));
  for (let index = 0; index < words.length - 2; index += 1) {
    if (words[index] === "a" && words[index + 1] === "m" && words[index + 2] === "e") words.splice(index, 3, "ame");
  }
  while (words[0] === "the") words.shift();
  const town = foldedName(city).replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
  if (town.length && words.length > town.length + 1) {
    const tail = words.slice(-(town.length + 1));
    if (tail[0] === "of" && tail.slice(1).join(" ") === town.join(" ")) words.splice(-(town.length + 1));
  }
  while (words[words.length - 1] === "church" || words[words.length - 1] === "churches") words.pop();
  return words.join(" ");
}

/** Host plus town. www, the path, and a trailing slash do not make a second church. Generic hosts are not a key. */
export function websiteGroupKey(url: string, city = "", state = "", name = ""): string {
  const host = hostOf(url).host;
  if (!host || websiteWeakness(url) || websitePlaceMismatch(url, city, state, name)) return "";
  const town = foldedName(city).replace(/[^a-z0-9]+/g, " ").trim();
  return town ? `${host}|${town}` : host;
}

/** A host used by more than one distinct name in a town is not that church's site and is not a group key. */
export function sharedWebsiteHosts(rows: AvRow[]): Set<string> {
  const places = new Map<string, Set<string>>();
  for (const row of rows) {
    const host = hostOf(s(row.website)).host;
    if (!host || websiteWeakness(s(row.website))) continue;
    const place = `${churchNameKey(s(row.name), s(row.city))}|${foldedName(s(row.city)).replace(/[^a-z0-9]+/g, " ").trim()}`;
    const set = places.get(host) ?? new Set<string>();
    set.add(place);
    places.set(host, set);
  }
  const shared = new Set<string>();
  for (const [host, set] of places) if (set.size > 1) shared.add(host);
  return shared;
}

function groupKeys(row: AvRow, sharedHosts: ReadonlySet<string>): string[] {
  const id = s(row.id);
  const host = hostOf(s(row.website)).host;
  const site = host && sharedHosts.has(host) ? "" : websiteGroupKey(s(row.website), s(row.city), s(row.state), s(row.name));
  const name = churchNameKey(s(row.name), s(row.city));
  const city = foldedName(s(row.city)).replace(/[^a-z0-9]+/g, " ").trim();
  const sameAs = (Array.isArray(row.possible_same_as) ? row.possible_same_as : []).map((value) => `id:${s(value)}`).filter((value) => value !== "id:");
  return [`id:${id}`, ...sameAs, site ? `site:${site}` : "", name && city ? `name:${name}|${city}` : ""].filter(Boolean);
}

/** What the loader should read next so a do-not-contact copy outside the ring still blocks the group. */
export function groupMateLookups(rows: AvRow[]): { ids: string[]; nameCities: Array<{ city: string; pattern: string; churchIds: string[] }> } {
  const have = new Set(rows.map((row) => s(row.id)).filter(Boolean));
  const ids = new Set<string>();
  const nameCities: Array<{ city: string; pattern: string; churchIds: string[] }> = [];
  const seen = new Map<string, { city: string; pattern: string; churchIds: string[] }>();
  for (const row of rows) {
    for (const value of Array.isArray(row.possible_same_as) ? row.possible_same_as : []) {
      const id = s(value);
      if (id && !have.has(id)) ids.add(id);
    }
    const city = s(row.city);
    const key = churchNameKey(s(row.name), city);
    if (!city || !key) continue;
    const patterns = [key];
    if (key.includes("saint")) patterns.push(key.replace(/\bsaint\b/g, "st"));
    if (key.includes("mount")) patterns.push(key.replace(/\bmount\b/g, "mt"));
    const churchId = s(row.id);
    for (const pattern of patterns) {
      const mark = `${city.toLowerCase()}|${pattern}`;
      let entry = seen.get(mark);
      if (!entry) {
        entry = { city, pattern, churchIds: [] };
        seen.set(mark, entry);
        nameCities.push(entry);
      }
      if (churchId && !entry.churchIds.includes(churchId)) entry.churchIds.push(churchId);
    }
  }
  return { ids: [...ids], nameCities };
}

class UnionFind {
  private parent = new Map<string, string>();
  find(id: string): string {
    let root = this.parent.get(id) ?? id;
    if (root !== id) {
      root = this.find(root);
      this.parent.set(id, root);
    }
    return root;
  }
  join(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

/**
 * The ranked list: in the territory, at least one real need signal; tier
 * first (central & South GA, rest of GA, FL, SC), then nearest Vidalia.
 * Every reason line starts with the tier label ("Central/South GA · …").
 * Copies of one church are one group (union-find). A stopped copy, even one
 * with no website or outside the ring, keeps the whole group off the list.
 */
export function rankAvProspects(rows: AvRow[], suppressed: (row: AvRow) => boolean, options: { size?: number; now?: Date; blockedIds?: Iterable<string> } = {}): AvProspect[] {
  const size = options.size ?? AV_LIST_SIZE;
  const now = options.now ?? new Date();
  const forced = new Set(Array.from(options.blockedIds ?? [], (id) => s(id)).filter(Boolean));
  const seen = new Set<string>();
  const all: AvRow[] = [];
  for (const row of rows) {
    const id = s(row.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    all.push(row);
  }
  const sharedHosts = sharedWebsiteHosts(all);
  const groups = new UnionFind();
  const blocked = new Set<string>();
  for (const row of all) {
    const keys = groupKeys(row, sharedHosts);
    for (let i = 1; i < keys.length; i += 1) groups.join(keys[0], keys[i]);
    if (forced.has(s(row.id)) || avExcluded(row, suppressed, now) || scoreAvProspect(row, sharedHosts).streams) blocked.add(groups.find(keys[0]));
  }
  // A block discovered before a later join still has to cover the merged root.
  const blockedRoots = new Set<string>();
  for (const row of all) {
    const root = groups.find(`id:${s(row.id)}`);
    if (blocked.has(root) || forced.has(s(row.id)) || avExcluded(row, suppressed, now) || scoreAvProspect(row, sharedHosts).streams) blockedRoots.add(root);
  }
  const members = new Map<string, AvRow[]>();
  for (const row of all) {
    const root = groups.find(`id:${s(row.id)}`);
    const list = members.get(root) ?? [];
    list.push(row);
    members.set(root, list);
  }
  const candidates: Array<{ row: AvRow; tier: AvTierIndex; miles: number }> = [];
  for (const row of all) {
    const lat = Number(s(row.lat) || s(row.latitude));
    const tier = territoryTier(row.state, s(row.lat) || s(row.latitude) ? lat : null);
    const miles = milesFromVidalia(row);
    if (tier === null || miles === null) continue;
    candidates.push({ row, tier, miles });
  }
  candidates.sort((a, b) => a.tier - b.tier || a.miles - b.miles || s(a.row.name).localeCompare(s(b.row.name)) || s(a.row.id).localeCompare(s(b.row.id)));
  const out: AvProspect[] = [];
  const listed = new Set<string>();
  for (const candidate of candidates) {
    if (out.length >= size) break;
    const root = groups.find(`id:${s(candidate.row.id)}`);
    if (listed.has(root) || blockedRoots.has(root)) continue;
    const { row, tier, miles } = candidate;
    const { score, reasons } = scoreAvProspect(row, sharedHosts);
    if (score < 1) continue;
    listed.add(root);
    const label = AV_TIERS[tier].label;
    out.push({
      churchId: s(row.id),
      tier,
      tierLabel: label,
      name: titleCase(s(row.name)) || "Unnamed church",
      ...prospectNameParts(row, (members.get(root) ?? []).filter((mate) => mate !== row)),
      town: titleCase(s(row.city)),
      miles: Math.round(miles * 10) / 10,
      score,
      reasons: reasons.map((reason) => `${label} \u00b7 ${reason}`),
      website: s(row.website)
    });
  }
  return out;
}

// --- Top prospects (second mode of this core) --------------------------------
// Score = av_signals.av_score + a fit weight. Churches that already stream stay.
// A customer (or a paid tier, a won status, a sign-up, an accepted invite) leaves
// the open list for the Won strip, and the next church fills in. Resting churches
// stay, with a tag. Nothing here is stored.

/** Fit weights approved Oct 17 2026. An unknown fit adds nothing. */
export const FIT_POINTS: Record<string, number> = {
  high: 30,
  "high (no website, Facebook page on record)": 30,
  "high-no-website-fb": 30,
  medium: 20,
  "medium (no website)": 20,
  "possible (website unreachable)": 15,
  "possible-unreachable": 15,
  "possible (website on record looks wrong)": 10,
  "possible-wrong": 10,
  low: 0
};

const FIT_PHRASE: Record<string, string> = {
  high: "Has a website",
  "high (no website, Facebook page on record)": "No website yet",
  "high-no-website-fb": "No website yet",
  medium: "Worth a first visit",
  "medium (no website)": "No website yet",
  "possible (website unreachable)": "Website looks broken",
  "possible-unreachable": "Website looks broken",
  "possible (website on record looks wrong)": "Website on record looks wrong",
  "possible-wrong": "Website on record looks wrong",
  low: "Has a website"
};

const PAID_TIERS = new Set(["pro", "ministry_pro", "paid", "complimentary"]);

const TOUCH_KIND_LABEL: Record<string, string> = {
  visit: "Visit",
  drop_off: "Drop-off",
  invite: "Invite",
  email: "Email",
  call: "Call",
  sms: "Text",
  text: "Text",
  meeting: "Meeting",
  note: "Note",
  sample: "Sample",
  order: "Order",
  customer: "Became a customer"
};

export type TopProspectStatus = "Open" | "Resting" | "Claimed";

export type TopProspect = {
  churchId: string;
  tier: AvTierIndex;
  tierLabel: string;
  rank: number;
  name: string;
  /** The name the row leads with. */
  lead: string;
  /** Muted line under the lead. "" when it would repeat the lead. */
  legalLine: string;
  town: string;
  /** Whole miles from Vidalia, or null when the row has no coordinates. */
  miles: number | null;
  score: number;
  reason: string;
  lastTouch: string;
  nextStep: string;
  status: TopProspectStatus;
  restLabel: string;
  claimed: boolean;
  /** Friendly date the church was won, or "" on the open list. */
  wonAt: string;
  /** Date string from the record (converted_at, status change, or updated_at). "" on the open list. */
  wonDate: string;
};

export type TopProspectCounts = { ranked: number; open: number; won: number; excluded: number };

function signalBag(row: AvRow): Record<string, unknown> | null {
  let raw: unknown = row.av_signals;
  if (typeof raw === "string" && raw.trim()) {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function knownFit(fit: unknown): string {
  const key = s(fit).replace(/\s+/g, " ").toLowerCase();
  const found = Object.keys(FIT_POINTS).find((item) => item.toLowerCase() === key);
  return found ?? "";
}

/** Fit lives on the church row in the shared fixture, and inside av_signals on live rows. */
function fitOf(row: AvRow): unknown {
  const sig = signalBag(row);
  return s(row.churchconnect_fit) || (sig ? s(sig.churchconnect_fit) || s(sig.fit) : "");
}

function hasUsableSignals(row: AvRow): boolean {
  const sig = signalBag(row);
  return Boolean(sig && Object.keys(sig).length > 0);
}

export function fitPointsOf(fit: unknown): number {
  const key = knownFit(fit);
  return key ? FIT_POINTS[key] : 0;
}

/** The saved research is about a different church. Live rows say "rejected"; the spec also says "mismatch". */
export function topProspectMismatch(row: AvRow): boolean {
  const match = s(signalBag(row)?.website_match).toLowerCase();
  return match === "mismatch" || match === "rejected";
}

export function topProspectScore(row: AvRow): number {
  const sig = signalBag(row);
  if (!sig || Object.keys(sig).length === 0) return 0;
  const av = Number(sig.av_score);
  return (Number.isFinite(av) ? av : 0) + fitPointsOf(fitOf(row));
}

/** A church that already joined. `at` is the best date we have for the Won strip. */
export function topProspectWon(row: AvRow): { won: boolean; at: string } {
  const tier = s(row.subscription_tier).toLowerCase();
  const won =
    yes(row.is_customer) ||
    PAID_TIERS.has(tier) ||
    s(row.crm_status).toLowerCase().replace(/[\s-]+/g, "_") === "won" ||
    yes(row.signed_up) ||
    s(row.invite_status).toLowerCase() === "accepted";
  return { won, at: s(row.converted_at) || s(row.crm_status_changed_at) || s(row.updated_at) };
}

function reasonLines(sig: Record<string, unknown> | null): string[] {
  if (!sig || !Array.isArray(sig.av_reasons)) return [];
  return sig.av_reasons
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const rec = item as AvRow;
        return s(rec.text) || s(rec.reason);
      }
      return "";
    })
    .map((item) => s(item))
    .filter(Boolean);
}

/** Fit phrase plus the top two saved reasons, in plain words, at most 90 characters. */
export function topProspectReason(row: AvRow, tierLabel = ""): string {
  const sig = signalBag(row);
  const phrase = FIT_PHRASE[knownFit(fitOf(row))] ?? "";
  let reasons = reasonLines(sig).map((reason) => avReasonText(reason, tierLabel)).filter(Boolean).slice(0, 2);
  const extra = row._scored_on_duplicate === true ? "also listed under another record" : "";
  let bits = [phrase, ...reasons, extra].filter(Boolean);
  while (bits.join(" · ").length > 90 && reasons.length) {
    reasons = reasons.slice(0, -1);
    bits = [phrase, ...reasons, extra].filter(Boolean);
  }
  const text = bits.join(" · ");
  return text.length > 90 ? text.slice(0, 90).trimEnd() : text;
}

function rowZip(row: AvRow): unknown {
  return row.zip_code ?? row.zip ?? row.postal_code;
}

function emailHost(value: unknown): string {
  const text = s(value).toLowerCase();
  const at = text.lastIndexOf("@");
  if (at < 0) return "";
  return hostOf(text.slice(at + 1)).host;
}

const CROWDED_EMAIL_KEYS = ["email", "pastor_email", "contact_email", "office_email", "customer_email"] as const;

type SharedDomainSet = { has(value: string): boolean };

/** Every domain matches the exact email only. Used when the count fails. */
const EXACT_EMAIL_ONLY: SharedDomainSet = { has: () => true };

function countSharedDomains(rows: readonly AvRow[], limit: number): Set<string> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (topTerritoryTier(row.state, rowZip(row)) === null) continue;
    const seen = new Set<string>();
    for (const key of CROWDED_EMAIL_KEYS) {
      const host = emailHost(row[key]);
      const own = host ? suppressionDomain(host) : "";
      if (own) seen.add(own);
    }
    const site = hostOf(s(row.website)).host;
    const ownSite = site ? suppressionDomain(site) : "";
    if (ownSite) seen.add(ownSite);
    for (const host of seen) counts.set(host, (counts.get(host) ?? 0) + 1);
  }
  const shared = new Set<string>();
  for (const [host, count] of counts) if (count > limit) shared.add(host);
  return shared;
}

let sharedDomainCounter: (rows: readonly AvRow[], limit: number) => Set<string> = countSharedDomains;

/** Test seam. Pass null to restore the real counter. */
export function setSharedDomainCounterForTest(next: ((rows: readonly AvRow[], limit: number) => Set<string>) | null): void {
  sharedDomainCounter = next ?? countSharedDomains;
}

/**
 * Email and website domains used by more than three in-scope churches.
 * Four or more campuses on their own domain fall back to exact-email-only on purpose.
 * The set is counted and logged once per call, not cached on the row list.
 * If the count fails, every domain matches the exact email only.
 */
export function domainsSharedByTooMany(rows: readonly AvRow[], limit = 3): SharedDomainSet {
  try {
    const counted = sharedDomainCounter(rows, limit);
    if (counted.size > 0) {
      console.warn(
        `Suppression matches the exact email only for ${counted.size} domains shared by more than ${limit} in-scope churches: ${[...counted].sort().join(", ")}`
      );
    }
    return counted;
  } catch {
    console.warn("Could not count shared church domains; suppression matches the exact email only");
    return EXACT_EMAIL_ONLY;
  }
}

function suppressionStopsGroup(row: AvRow, suppressed: (row: AvRow) => boolean, crowded: SharedDomainSet): boolean {
  if (!suppressed(row)) return false;
  const site = hostOf(s(row.website)).host;
  const mail = emailHost(row.email);
  const siteCrowded = Boolean(site && crowded.has(site));
  const mailCrowded = Boolean(mail && crowded.has(mail));
  if (!siteCrowded && !mailCrowded) return true;
  const stripped: AvRow = { ...row };
  if (siteCrowded) stripped.website = "";
  if (mailCrowded) stripped.email = "";
  if (suppressed(stripped)) return true;
  if (!mailCrowded || !s(row.email)) return false;
  // A probe on the same domain tells a website-or-exact matcher from one that blocks every address.
  if (suppressed({ ...stripped, website: "", email: `not-a-real-mailbox@${mail}` })) return false;
  return suppressed({ ...stripped, website: "", email: s(row.email) });
}

function rowLat(row: AvRow): number | null {
  const latText = s(row.lat) || s(row.latitude);
  const latNum = Number(latText);
  return latText && Number.isFinite(latNum) ? latNum : null;
}

function rowTier(row: AvRow): AvTierIndex | null {
  return topTerritoryTier(row.state, rowZip(row));
}

function rowMiles(row: AvRow): number | null {
  const miles = milesFromVidalia(row);
  return miles === null ? null : Math.round(miles);
}

function hasScore(row: AvRow): boolean {
  return hasUsableSignals(row);
}

/** A hidden duplicate that was scored lends that score to the visible church. */
function withTwinSignals(rows: AvRow[]): AvRow[] {
  return rows.map((row) => {
    const id = s(row.id);
    if (!id || rowHidden(row) || hasUsableSignals(row)) return row;
    const listed = new Set((Array.isArray(row.possible_same_as) ? row.possible_same_as : []).map((value) => s(value)).filter(Boolean));
    let best: AvRow | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const mate of rows) {
      const mateId = s(mate.id);
      if (!mateId || mateId === id || rowInactive(mate) || s(mate.merged_into) || s(mate.deleted_at) || s(mate.duplicate_of)) continue;
      if (!rowHidden(mate) || !hasUsableSignals(mate)) continue;
      const mateListsUs = (Array.isArray(mate.possible_same_as) ? mate.possible_same_as : []).some((value) => s(value) === id);
      if (!listed.has(mateId) && !mateListsUs) continue;
      const score = topProspectScore(mate);
      if (score > bestScore) {
        best = mate;
        bestScore = score;
      }
    }
    if (!best) return row;
    const sig = signalBag(best);
    const fit = s(row.churchconnect_fit) || s(best.churchconnect_fit);
    return { ...row, av_signals: sig ? { ...sig } : row.av_signals, churchconnect_fit: fit, _scored_on_duplicate: true };
  });
}

function topBlocksGroup(row: AvRow, suppressed: (row: AvRow) => boolean): boolean {
  if (yes(row.do_not_contact) || yes(row.do_not_contact_desk_claim)) return true;
  if (suppressed(row)) return true;
  if (religionOtherExcluded(row)) return true;
  if (s(row.prospect_kind).toLowerCase() === "association") return true;
  if (topNameExcluded(s(row.name), row)) return true;
  if (s(row.source) === "qa_crm_v2") return true;
  if (shownWork(row)) return true;
  const status = s(row.crm_status).toLowerCase().replace(/[\s-]+/g, "_");
  if (status && status !== "won" && STOPPED_STATUS.has(status)) return true;
  if (s(row.invite_status).toLowerCase() === "sent" && !topProspectWon(row).won) return true;
  return false;
}

function topListable(row: AvRow): boolean {
  if (rowInactive(row) || rowHidden(row)) return false;
  if (s(row.merged_into) || s(row.deleted_at) || s(row.duplicate_of)) return false;
  if (topProspectMismatch(row) || topBlocksGroup(row, () => false)) return false;
  return hasScore(row);
}

function topGroupKeys(row: AvRow): string[] {
  const id = s(row.id);
  const site = websiteGroupKey(s(row.website), s(row.city), s(row.state), s(row.name));
  const sameAs = (Array.isArray(row.possible_same_as) ? row.possible_same_as : []).map((value) => `id:${s(value)}`).filter((value) => value !== "id:");
  return [`id:${id}`, ...sameAs, site ? `site:${site}` : ""].filter(Boolean);
}

function compareTopRows(a: AvRow, b: AvRow): number {
  const tierA = rowTier(a) ?? 9;
  const tierB = rowTier(b) ?? 9;
  const milesA = rowMiles(a) ?? Number.POSITIVE_INFINITY;
  const milesB = rowMiles(b) ?? Number.POSITIVE_INFINITY;
  return tierA - tierB || topProspectScore(b) - topProspectScore(a) || milesA - milesB || titleCase(s(a.name)).localeCompare(titleCase(s(b.name))) || s(a.id).localeCompare(s(b.id));
}

function rowClaimed(row: AvRow): boolean {
  const claim = s(row.claim_status).toLowerCase();
  return yes(row.claimed) || yes(row.verified) || yes(row.is_verified) || claim === "claimed" || claim === "verified";
}

function touchKindLabel(kind: string): string {
  if (TOUCH_KIND_LABEL[kind]) return TOUCH_KIND_LABEL[kind];
  if (!kind) return "Touch";
  return kind.replace(/[_-]+/g, " ").replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function lastTouchLine(row: AvRow): string {
  const extra = Array.isArray(row.card_touches) ? (row.card_touches as AvRow[]) : [];
  const touches = [...extra, ...avDeskTouches(row)].filter((touch) => {
    const at = s(touch.at);
    return Boolean(at) && !Number.isNaN(Date.parse(at));
  });
  touches.sort((a, b) => Date.parse(s(b.at)) - Date.parse(s(a.at)));
  const top = touches[0];
  if (!top) return "";
  return `${touchKindLabel(s(top.kind).toLowerCase())} · ${friendlyDate(s(top.at))}`;
}

export function topProspectNextStep(row: AvRow): string {
  const action = s(row.crm_next_action);
  const when = s(row.crm_next_action_date);
  if (action) {
    const day = /^\d{4}-\d{2}-\d{2}/.test(when) ? friendlyDay(when.slice(0, 10)) : "";
    return day ? `${action} · ${day}` : action;
  }
  return s(row.follow_up_step) || "First visit";
}

function restLine(row: AvRow, now: Date): string {
  const rule = repeatRule(avDeskTouches(row), now);
  if (rule.level === "hold" && rule.until) return `Resting until ${friendlyDate(rule.until)}`;
  const until = s(row.rest_until);
  if (until && !Number.isNaN(Date.parse(until))) return `Resting until ${friendlyDate(until)}`;
  return "";
}

function toTopProspect(row: AvRow, tier: AvTierIndex, now: Date, rank: number): TopProspect {
  const rest = restLine(row, now);
  const claimed = rowClaimed(row);
  const won = topProspectWon(row);
  const wonAt = won.won && won.at && !Number.isNaN(Date.parse(won.at)) ? friendlyDate(won.at) : "";
  return {
    churchId: s(row.id),
    tier,
    tierLabel: AV_TIERS[tier].label,
    rank,
    name: titleCase(s(row.name)) || "Unnamed church",
    lead: titleCase(s(row.name)) || "Unnamed church",
    legalLine: "",
    town: titleCase(s(row.city)),
    miles: rowMiles(row),
    score: topProspectScore(row),
    reason: topProspectReason(row, AV_TIERS[tier].label),
    lastTouch: lastTouchLine(row),
    nextStep: topProspectNextStep(row),
    status: rest ? "Resting" : claimed ? "Claimed" : "Open",
    restLabel: rest,
    claimed,
    wonAt,
    wonDate: won.won ? won.at : ""
  };
}

/**
 * Open list (25) and Won strip for one tier. Duplicates (possible_same_as or the
 * same website in the same town) keep the best score. Sort: tier, score, miles, name.
 */
export function rankTopProspects(
  rows: AvRow[],
  suppressed: (row: AvRow) => boolean,
  options: { tier?: AvTierIndex; now?: Date; size?: number } = {}
): { open: TopProspect[]; won: TopProspect[]; counts: TopProspectCounts } {
  const now = options.now ?? new Date();
  const size = options.size ?? TOP_LIST_SIZE;
  const wantTier = options.tier;
  const seen = new Set<string>();
  const unique: AvRow[] = [];
  for (const row of rows) {
    const id = s(row.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(row);
  }
  const prepared = withTwinSignals(unique);
  const crowded = domainsSharedByTooMany(rows);
  const stops = (row: AvRow) => suppressionStopsGroup(row, suppressed, crowded);
  const groups = new UnionFind();
  for (const row of prepared) {
    const keys = topGroupKeys(row);
    for (let index = 1; index < keys.length; index += 1) groups.join(keys[0], keys[index]);
  }
  const byRoot = new Map<string, AvRow[]>();
  for (const row of prepared) {
    const root = groups.find(`id:${s(row.id)}`);
    const list = byRoot.get(root) ?? [];
    list.push(row);
    byRoot.set(root, list);
  }
  const openRows: AvRow[] = [];
  const wonRows: Array<{ row: AvRow; at: string }> = [];
  let excluded = 0;
  const inTier = (row: AvRow) => {
    const tier = rowTier(row);
    return tier !== null && (wantTier === undefined || tier === wantTier);
  };
  for (const members of byRoot.values()) {
    const faced = members.filter(inTier);
    if (!faced.length) continue;
    if (members.some((row) => topBlocksGroup(row, stops))) {
      excluded += 1;
      continue;
    }
    const wonSource = members.find((row) => topProspectWon(row).won && hasScore(row) && !topProspectMismatch(row));
    if (wonSource) {
      const faces = faced.filter((row) => topListable(row));
      const face = (faces.length ? [...faces].sort(compareTopRows)[0] : null) ?? (inTier(wonSource) && !topProspectMismatch(wonSource) ? wonSource : null);
      if (!face || rowHidden(face) || topProspectMismatch(face)) {
        excluded += 1;
        continue;
      }
      const shown = hasScore(face) ? face : { ...face, av_signals: signalBag(wonSource) ? { ...signalBag(wonSource)! } : face.av_signals, _scored_on_duplicate: true };
      wonRows.push({ row: shown, at: topProspectWon(wonSource).at || topProspectWon(shown).at });
      continue;
    }
    const openFaces = faced.filter((row) => topListable(row) && !topProspectWon(row).won);
    if (!openFaces.length) {
      excluded += 1;
      continue;
    }
    openRows.push([...openFaces].sort(compareTopRows)[0]);
  }
  openRows.sort(compareTopRows);
  const ranked = openRows.length;
  const withCommon = (row: AvRow, tier: AvTierIndex, rank: number) => {
    const mates = (byRoot.get(groups.find(`id:${s(row.id)}`)) ?? []).filter((mate) => mate !== row);
    return { ...toTopProspect(row, tier, now, rank), ...prospectNameParts(row, mates) };
  };
  const open = openRows.slice(0, size).map((row, index) => withCommon(row, rowTier(row) as AvTierIndex, index + 1));
  wonRows.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0) || titleCase(s(a.row.name)).localeCompare(titleCase(s(b.row.name))));
  const won = wonRows.map(({ row, at }) => {
    const item = withCommon(row, rowTier(row) as AvTierIndex, 0);
    const wonAt = at && !Number.isNaN(Date.parse(at)) ? friendlyDate(at) : "";
    return { ...item, wonAt, wonDate: at };
  });
  return { open, won, counts: { ranked, open: open.length, won: won.length, excluded } };
}
