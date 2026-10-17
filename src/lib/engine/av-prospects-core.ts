import { DROP_OFF_REST_DAYS, VISIT_REST_DAYS, repeatRule, type Touch } from "@/lib/engine/lpl-crm-core";

// AV prospects (Messenger AVL kit, Oct 17 2026): which ChurchConnect churches
// might want help with sound, video, lighting or streaming, in Lincoln's
// territory order (Oct 17, 4:58 PM): central & South Georgia first, then the
// rest of Georgia, then Florida, then South Carolina; nearest Vidalia first
// inside each tier. READ ONLY and pure: the rows come from cc_churches (lpl-crm.ts reads
// them), nothing is written, nothing is sent. No new tables.
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
 */
export const CENTRAL_SOUTH_GA_MAX_LAT = 33.25;

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

/** Which tier a church is in, or null when it is outside the territory or has no location. */
export function territoryTier(state: unknown, lat: number | null): AvTierIndex | null {
  const code = territoryState(state);
  if (!code || lat === null || !Number.isFinite(lat)) return null;
  if (code === "GA") return lat < CENTRAL_SOUTH_GA_MAX_LAT ? 0 : 1;
  return code === "FL" ? 2 : 3;
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

const CHRISTIAN_WORDS = new Set([
  "church", "churches", "baptist", "ministries", "ministry", "ame", "methodist", "worship", "fellowship",
  "chapel", "tabernacle", "assembly", "cathedral", "pentecostal", "holiness", "missionary", "faith", "bethel"
]);

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
 * religion_guess is empty on most rows. A Christian word (church, baptist,
 * ministries, AME, and the rest of that list) keeps a temple, school, camp,
 * or Jehovah name. Kingdom Hall always goes. An office (diocese, foundation)
 * goes even when the name says Episcopal, Catholic, or Baptist.
 */
export function avNameExcluded(name: string): boolean {
  const raw = foldedName(name);
  if (raw.replace(/[^a-z]/g, "").includes("kingdomhall")) return true;
  const street = raw.replace(/\bmosque\s+street\b/g, " ");
  const words = nameWords(street);
  const has = (word: string) => words.includes(word);
  const christian = hasChristianWord(raw, words);
  if (["unitarian", "universalist", "diocese", "foundation", "preschool", "retreat", "distribution", "masjed", "musalla", "mormon", "sikh", "gurdwara", "mandir", "scientology", "spiritualist", "cemetery", "cemetary", "hindu", "buddhist", "buddhism", "buddha", "synagogue", "messianic", "lds", "islamic", "islam", "masjid", "muhammad", "mohammed", "muslim", "moslem"].some(has)) return true;
  if (has("mosque")) return true;
  if (/\blatter\s*-?\s*day\b/.test(raw) || raw.includes("latterday")) return true;
  if (/\bward\b/.test(street) || /\bstake\s+center\b/.test(raw) || /\bconference\s+center\b/.test(raw)) return true;
  if (/\bbeth\s+israel\b/.test(raw) || /\bchristian\s+science\b/.test(raw) || /\bbaha['’]?i\b/.test(raw)) return true;
  if (/\bcongregation\b/.test(raw) && /\bisrael\b/.test(raw)) return true;
  if (/\bfood\s+(bank|pantry)\b/.test(raw) && !christian) return true;
  if (!christian && ["temple", "school", "camp", "college", "seminary", "jehovah", "association", "academy"].some(has)) return true;
  return false;
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

const NAME_DROP = new Set(["inc", "incorporated", "llc", "corp", "corporation", "co"]);

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
export function groupMateLookups(rows: AvRow[]): { ids: string[]; nameCities: Array<{ city: string; pattern: string }> } {
  const have = new Set(rows.map((row) => s(row.id)).filter(Boolean));
  const ids = new Set<string>();
  const nameCities: Array<{ city: string; pattern: string }> = [];
  const seen = new Set<string>();
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
    for (const pattern of patterns) {
      const mark = `${city.toLowerCase()}|${pattern}`;
      if (seen.has(mark)) continue;
      seen.add(mark);
      nameCities.push({ city, pattern });
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
export function rankAvProspects(rows: AvRow[], suppressed: (row: AvRow) => boolean, options: { size?: number; now?: Date } = {}): AvProspect[] {
  const size = options.size ?? AV_LIST_SIZE;
  const now = options.now ?? new Date();
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
    if (avExcluded(row, suppressed, now) || scoreAvProspect(row, sharedHosts).streams) blocked.add(groups.find(keys[0]));
  }
  // A block discovered before a later join still has to cover the merged root.
  const blockedRoots = new Set<string>();
  for (const row of all) {
    const root = groups.find(`id:${s(row.id)}`);
    if (blocked.has(root) || avExcluded(row, suppressed, now) || scoreAvProspect(row, sharedHosts).streams) blockedRoots.add(root);
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
      town: titleCase(s(row.city)),
      miles: Math.round(miles * 10) / 10,
      score,
      reasons: reasons.map((reason) => `${label} \u00b7 ${reason}`),
      website: s(row.website)
    });
  }
  return out;
}
