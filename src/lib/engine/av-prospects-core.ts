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

const s = (value: unknown): string => (value === null || value === undefined ? "" : String(value).trim());
const yes = (value: unknown): boolean => value === true || s(value).toLowerCase() === "true";

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
// A denomination's national site on a single church's record: not their own site.
const DENOMINATION_HOSTS = ["nationalbaptist.com", "sbc.net", "umc.org", "cogic.org", "ag.org", "gabaptist.org", "namb.net", "elca.org", "pcusa.org", "ame-church.com", "thecme.church"];
const FREE_BUILDER_HOSTS = ["wix.com", "wixsite.com", "weebly.com", "blogspot.com", "sites.google.com", "godaddysites.com", "square.site", "webs.com", "tripod.com", "angelfire.com", "wordpress.com"];

const onHost = (host: string, list: string[]) => list.some((item) => host === item || host.endsWith(`.${item}`));

/** What the website address on file says about the site, or "" when it looks like the church's own site. */
export function websiteWeakness(url: string): "" | "giving" | "directory" | "denomination" | "free_builder" {
  if (!url.trim()) return "";
  const { host } = hostOf(url);
  if (!host) return "";
  if (onHost(host, GIVING_HOSTS) || /^give\./.test(host)) return "giving";
  if (onHost(host, DIRECTORY_HOSTS)) return "directory";
  if (onHost(host, DENOMINATION_HOSTS)) return "denomination";
  if (onHost(host, FREE_BUILDER_HOSTS)) return "free_builder";
  return "";
}

const WEAKNESS_REASON: Record<"giving" | "directory" | "denomination" | "free_builder", string> = {
  giving: "The website on file is only a giving page",
  directory: "The website on file is a directory listing, not their own site",
  denomination: "The website on file is a denomination's site, not their own",
  free_builder: "The website on file is on a free site builder"
};

/**
 * Georgia churches Messenger AVL lists as its own work on messengeravl.com
 * (read Oct 17 2026), within reach of this list: not prospects. A church
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

/** Never on the list: stopped, lost, merged, deleted, not a church, or already Messenger AVL's own work. */
export function avExcluded(row: AvRow, suppressed: (row: AvRow) => boolean): boolean {
  if (yes(row.do_not_contact)) return true;
  if (s(row.crm_status).toLowerCase() === "lost") return true;
  if (s(row.merged_into) || s(row.deleted_at) || s(row.duplicate_of)) return true;
  if (s(row.religion_guess).toLowerCase() === "other") return true;
  // Associations (e.g. Baptist associations from the GA roster) are not one church.
  if (s(row.prospect_kind).toLowerCase() === "association") return true;
  if (s(row.source) === "qa_crm_v2") return true;
  if (shownWork(row)) return true;
  return suppressed(row);
}

/** Score and plain reasons for one church, from real columns only. */
export function scoreAvProspect(row: AvRow): { score: number; reasons: string[]; streams: boolean } {
  const reasons: string[] = [];
  let score = 0;
  const website = s(row.website);
  const facebook = s(row.facebook_url);
  const streams = Boolean(s(row.live_stream_url) || s(row.livestream_url) || s(row.youtube_url) || s(row.subsplash_url));
  if (streams) {
    reasons.push("Already streams (a stream link is on file)");
    score -= 2;
  } else if (website) {
    reasons.push("Has a website, but no livestream or YouTube link on file");
    score += 2;
  } else if (facebook) {
    reasons.push("Facebook page on file, but no website or stream link");
    score += 1;
  }
  const weak = websiteWeakness(website);
  if (weak) {
    reasons.push(WEAKNESS_REASON[weak]);
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

/**
 * The ranked list: in the territory, at least one real need signal; tier
 * first (central & South GA, rest of GA, FL, SC), then nearest Vidalia.
 * Every reason line starts with the tier label ("Central/South GA · …").
 */
export function rankAvProspects(rows: AvRow[], suppressed: (row: AvRow) => boolean, options: { size?: number } = {}): AvProspect[] {
  const size = options.size ?? AV_LIST_SIZE;
  const candidates: Array<{ row: AvRow; tier: AvTierIndex; miles: number }> = [];
  const ids = new Set<string>();
  for (const row of rows) {
    const id = s(row.id);
    if (!id || ids.has(id)) continue;
    ids.add(id);
    const lat = Number(s(row.lat) || s(row.latitude));
    const tier = territoryTier(row.state, s(row.lat) || s(row.latitude) ? lat : null);
    if (tier === null) continue;
    const miles = milesFromVidalia(row);
    if (miles === null) continue;
    candidates.push({ row, tier, miles });
  }
  // Nearest first, so when one church has two records the nearer one is kept.
  candidates.sort((a, b) => a.tier - b.tier || a.miles - b.miles || s(a.row.name).localeCompare(s(b.row.name)) || s(a.row.id).localeCompare(s(b.row.id)));
  // Group records of the same church: one marked as the same (possible_same_as),
  // one website, or one name in one town. If ANY record of a church is stopped,
  // lost, merged, on the do-not-contact list or already streams, the whole church
  // is left out — a second copy of a stopped church must never slip through.
  const groupOf = new Map<string, number>();
  const groups: Array<{ members: Array<{ row: AvRow; tier: AvTierIndex; miles: number }>; blocked: boolean }> = [];
  const keysOf = (row: AvRow): string[] => {
    const site = hostOf(s(row.website)).host + hostOf(s(row.website)).path.replace(/\/$/, "");
    const sameAs = (Array.isArray(row.possible_same_as) ? row.possible_same_as : []).map((value) => `id:${s(value)}`);
    const name = s(row.name).toLowerCase().replace(/[^a-z]+/g, " ").split(" ").filter(Boolean).sort().join(" ");
    return [`id:${s(row.id)}`, ...sameAs, site ? `site:${site}` : "", name ? `name:${name}|${s(row.city).toLowerCase()}` : ""].filter(Boolean);
  };
  for (const candidate of candidates) {
    const keys = keysOf(candidate.row);
    const found = keys.map((key) => groupOf.get(key)).find((value) => value !== undefined);
    const index = found ?? groups.push({ members: [], blocked: false }) - 1;
    for (const key of keys) if (!groupOf.has(key)) groupOf.set(key, index);
    const group = groups[index];
    group.members.push(candidate);
    if (avExcluded(candidate.row, suppressed) || scoreAvProspect(candidate.row).streams) group.blocked = true;
  }
  const out: AvProspect[] = [];
  const listed = new Set<number>();
  for (const candidate of candidates) {
    if (out.length >= size) break;
    const index = groupOf.get(`id:${s(candidate.row.id)}`) as number;
    if (listed.has(index) || groups[index].blocked) continue;
    const { row, tier, miles } = candidate;
    const { score, reasons } = scoreAvProspect(row);
    if (score < 1) continue;
    listed.add(index);
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
