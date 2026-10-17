// Suggested next step on a CRM card (CRM v2 slice 4): the pure rules, no I/O.
// The server module (crm-suggest.ts) asks the model; everything here decides
// WHETHER to ask, WHAT is sent, and WHAT survives from the answer.
//
// Rules (Lincoln, Oct 17 2026):
//  * Owner only, suggestions only. Nothing is sent to anyone; the owner can copy a
//    suggestion into the existing "Log a visit" form and save it there.
//  * Churches only ever get the church rule (church-offer-rule.ts). Unclear = church.
//    The model is told the allowed list BEFORE, and its answer is filtered AFTER.
//  * Businesses only get live business apps (Marketing campaign stays hidden).
//  * Stopped (do-not-contact / said no) or resting orgs get no outreach suggestion,
//    at most "Resting until <date>". If the do-not-contact list couldn't be read,
//    nothing is suggested.
//  * Minimal data goes to the model (see suggestInput): org type, town, apps,
//    status, recent activity types and dates, and the KIND of next step on file
//    (one word from a fixed list) with its due date. Never the next step's own
//    words, the org's name, contact names, emails, phones, or visit notes.
//  * Every word check reads normalized text (church-offer-rule.ts
//    normalizeOfferText), so look-alike letters, full-width letters and
//    spelled-out words can't slip a forbidden product past the filter.
//  * No promises: free things, discounts, prices, deals or guarantees drop the suggestion.
//  * Screens never name the vendor: the feature is "Suggested next step".

import {
  BUSINESS_OFFERS,
  BUSINESS_OFFER_IDS,
  CHURCH_ALLOWED_OFFERS,
  CHURCH_OFFER_IDS,
  churchProductOf,
  churchTextBlocked,
  hiddenBusinessTextBlocked,
  promiseTextBlocked,
  type BusinessOffer,
  type ChurchOffer
} from "./church-offer-rule";
import type { CrmCard } from "./lpl-crm-core";

export const SUGGEST_LABEL = "Suggested next step";
export const SUGGEST_UNAVAILABLE = "Suggestions aren't available right now.";
export const SUGGEST_NONE = "No suggestion for this one right now. Use your own next step.";

/** Minimal card fields the rules read (so tests can build one by hand). */
export type SuggestCard = Pick<
  CrmCard,
  "key" | "name" | "town" | "apps" | "touches" | "repeat" | "stops" | "followUpReasons" | "nextStep" | "nextActionDate" | "churchId" | "leadId" | "org"
>;

export type SuggestKind = "church" | "business";

const CHURCH_NAME_RE =
  /\b(church|chapel|baptist|methodist|ministry|ministries|parish|cathedral|fellowship|assembly|assemblies|tabernacle|temple|congregation|worship|catholic|lutheran|presbyterian|episcopal|pentecostal|apostolic|adventist|nazarene|mission|missions|diocese|basilica|sanctuary|gospel|christian|bible|ame|umc|cme|cogic)\b/i;

/** Business only when the card is clearly a business lead and nothing about it says church. Unclear = church. */
export function suggestKind(card: SuggestCard): SuggestKind {
  const businessLead = Boolean(card.leadId) && !card.churchId && card.org?.kind === "business";
  const onlyBusiness = card.apps.length > 0 && card.apps.every((app) => app === "business");
  if (businessLead && onlyBusiness && !CHURCH_NAME_RE.test(card.name)) return "business";
  return "church";
}

export type SuggestGate =
  | { kind: "ok" }
  | { kind: "stopped"; message: string }
  | { kind: "resting"; until: string; message: string }
  | { kind: "blocked"; message: string };

const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });
const isoDayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });

/** YYYY-MM-DD in Eastern time. */
export function easternDay(at: Date | string | number): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? "" : isoDayFmt.format(date);
}

function shortDay(at: Date | string | number): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? "" : dayFmt.format(date);
}

/** Decide before anything is sent: stopped and resting orgs never reach the model. */
export function suggestGate(card: SuggestCard, outreachHidden: boolean): SuggestGate {
  if (outreachHidden) return { kind: "blocked", message: "The do-not-contact list couldn't be read, so nothing is suggested right now." };
  if (card.stops.some((stop) => stop.reason === "suppressed" || stop.reason === "declined")) {
    return { kind: "stopped", message: "Do not contact. Nothing is suggested." };
  }
  const resting = card.repeat.level === "hold" || card.followUpReasons.includes("wait");
  if (resting) {
    const until = card.repeat.until ?? card.nextActionDate ?? "";
    const day = until ? shortDay(until.length === 10 ? `${until}T12:00:00Z` : until) : "";
    return { kind: "resting", until, message: day ? `Resting until ${day}. Nothing is suggested until then.` : "Resting. Nothing is suggested until the rest ends." };
  }
  return { kind: "ok" };
}

// EA r2: the output scrub reads normalized text first: NFKC (full-width digits
// and the full-width at sign become ASCII), then every Unicode dash (U+2010-2015,
// U+2212, U+FE58, U+FE63, U+FF0D) becomes "-", so a phone written with a
// non-breaking hyphen or an en dash is caught like "912-555-0101".
const DASHES_RE = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;
// Dates are not phones (EA r3): 2026-10-20, 2026/10/20, 10/20/2026, 10-20-2026, 20261020.
// EA r4: a real month (1-12) and day (1-31), and never running into more digits
// ("2026-10-20-0101", "05-55-0101" and "5-55-0101" are not dates; the phone scrub takes them).
const MONTH = "(?:0?[1-9]|1[0-2])";
const DAY = "(?:0?[1-9]|[12]\\d|3[01])";
const NOT_BEFORE = "(?<![\\d/-])";
const NOT_AFTER = "(?![\\d]|[-/]\\d)";
const DATE_RES = [
  new RegExp(`${NOT_BEFORE}\\d{4}([-/])${MONTH}\\1${DAY}${NOT_AFTER}`, "g"),
  new RegExp(`${NOT_BEFORE}${MONTH}([-/])${DAY}\\1(?:\\d{4}|\\d{2})${NOT_AFTER}`, "g"),
  new RegExp(`${NOT_BEFORE}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])${NOT_AFTER}`, "g")
];
// Emails, including "x at y dot org" and "x(at)y.org" / "x [at] y [dot] org".
const EMAIL_RES = [
  /[^\s@()]+\s*@\s*[^\s@]+\.[^\s@]+/g,
  /[\w.+-]+\s*[([]\s*at\s*[)\]]\s*[\w-]+(?:\s*(?:\.|[([]\s*dot\s*[)\]]|\s+dot\s+)\s*[\w-]+)+/gi,
  /[\w.+-]+\s+at\s+[\w-]+(?:\s+dot\s+[\w-]+)+/gi
];
// Any run of 7+ digits with the usual separators, parentheses included
// (+1 404.555.0143, (912) 555 0101, 404 555 0143 x12, 4045550143…).
const PHONE_RE = /\+?\(?\d[\d\s().\-/]{5,}\d\)?(?:\s*(?:x|ext\.?)\s*\d+)?/gi;

/** The model's answer only: remove anything that looks like an email or phone, collapse spaces, cap length. Dates stay. */
export function scrub(text: unknown, max = 160): string {
  let out = String(text ?? "").normalize("NFKC").replace(DASHES_RE, "-");
  // Keep dates out of the phone match, then put them back.
  const dates: string[] = [];
  for (const re of DATE_RES) out = out.replace(re, (date) => `\u0000${dates.push(date) - 1}\u0000`);
  for (const re of EMAIL_RES) out = out.replace(re, "");
  out = out.replace(PHONE_RE, (run) => ((run.match(/\d/g) || []).length >= 7 ? "" : run));
  out = out.replace(/\(\s*\)/g, "").replace(/\u0000(\d+)\u0000/g, (_m, index) => dates[Number(index)] ?? "");
  return out.replace(/\s+([,.;:!?])/g, "$1").replace(/\s+/g, " ").trim().slice(0, max);
}

// EA r2/r3: the model must not make up people. One or more titles ("Pastor",
// "Rev. Dr.") followed by up to 3 capitalized name words ("Sister Mary Lou
// Hart", "Rev. Dr. Mary-Ann O'Brien", "Dr. Okafor's") are replaced with a
// generic phrase for the first title ("the pastor", "the member", "the contact"…).
// Replacing keeps a useful step and is as safe as dropping: no name survives.
const TITLE_PHRASE: Record<string, string> = {
  pastor: "the pastor", rev: "the pastor", reverend: "the pastor",
  brother: "the member", sister: "the member",
  mr: "the contact", mrs: "the contact", ms: "the contact", dr: "the contact",
  elder: "the elder", deacon: "the deacon", father: "the priest", bishop: "the bishop"
};
const TITLES = "(?:Pastor|Reverend|Rev|Brother|Sister|Mrs|Mr|Ms|Dr|Elder|Deacon|Father|Bishop)";
// Capitalized words after a title that are not a name ("Deacon Board", "Sister Church", "Pastor Easter Sunday"),
// joining words and common verbs in Title Case ("Pastor Jim Will Visit"), and the app names
// ("Pastor ChurchConnect demo", "Show Pastor Outreach"). The name capture stops at any of them.
const NOT_NAME_WORDS = [
  // church words and days
  "Appreciation", "Anniversary", "Day", "Days", "Week", "Month", "Weekend", "Night", "Morning", "Evening",
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Today", "Tomorrow", "Tonight",
  "Board", "Boards", "Church", "Churches", "Ministries", "Ministry", "Committee", "Committees", "Council", "Team", "Teams",
  "Office", "Offices", "Service", "Services", "Meeting", "Meetings", "Fellowship", "Choir", "School", "Study", "Group",
  "Retreat", "Conference", "Breakfast", "Lunch", "Dinner", "Supper", "Program", "Class", "Training", "Installation",
  "Easter", "Christmas", "Thanksgiving", "Advent", "Lent", "Revival", "Homecoming", "Search", "Welcome",
  // joining words
  "And", "Or", "But", "Nor", "So", "Yet", "If", "When", "While", "Then", "Than", "Because", "Since", "Until", "Unless",
  "For", "The", "A", "An", "To", "At", "About", "With", "Without", "From", "Of", "On", "In", "Into", "By", "After",
  "Before", "During", "Over", "Under", "Up", "Out", "Off", "Again", "Back", "Next", "Soon", "Also", "Only", "Just",
  "Not", "No", "Yes", "Please", "Here", "There", "Now", "Who", "What", "Which", "Where", "Why", "How", "That", "This",
  "These", "Those", "He", "She", "They", "We", "You", "I", "It", "His", "Her", "Hers", "Their", "Our", "Your", "My",
  "Its", "Him", "Them", "Us", "Me",
  // common verbs
  "Will", "Would", "Can", "Could", "Should", "Shall", "Might", "Must", "Is", "Are", "Was", "Were", "Be", "Been",
  "Has", "Have", "Had", "Do", "Does", "Did", "Wants", "Want", "Wanted", "Needs", "Need", "Needed", "Said", "Says",
  "Asked", "Asks", "Ask", "Likes", "Like", "Liked", "Loves", "Love", "Visit", "Visits", "Visited", "Call", "Calls",
  "Called", "Come", "Comes", "Came", "Go", "Goes", "Went", "Get", "Gets", "Got", "Know", "Knows", "Knew", "Think",
  "Thinks", "Thought", "Mentioned", "Mention", "Give", "Gives", "Gave", "Take", "Takes", "Took", "Thank", "Thanks",
  "Meet", "Met", "See", "Saw", "Seen", "Say", "Tell", "Told", "Hope", "Hopes", "Agreed", "Leads", "Runs", "Run",
  // app names (church-offer-rule.ts and the rest of the portfolio)
  "ChurchConnect", "EasyPeazy", "Laser", "Outreach", "Operate", "Neighborly", "Neighbourly", "Presence", "Spark",
  "Toner", "Toners", "AWD", "AI", "Live", "Best", "Local", "Directory", "Find"
];
const NOT_A_NAME = `(?!(?:${NOT_NAME_WORDS.join("|")})(?![\\p{L}]))`;
const NAME_WORD = `(?:[A-Z]\\.\\s*)?${NOT_A_NAME}[A-Z][\\p{L}]*(?:-[\\p{L}]+|['\u2019][A-Z][\\p{L}]*)*`;
// "Pastor Jim and Sue": the second name goes too (as "another person"), unless it has its own title.
const AND_NAME = `(\\s+(?:and|And|&)\\s+(?!${TITLES}\\b)${NAME_WORD}(?:\\s+${NAME_WORD}){0,2})?`;
const TITLED_NAME_RE = new RegExp(`\\b(?:(the|a|an)\\s+)?((?:${TITLES}\\.?\\s+)+)${NAME_WORD}(?:\\s+${NAME_WORD}){0,2}${AND_NAME}`, "gu");

/** Replace "Title Name" spans with the generic phrase for that title. */
export function withoutMadeUpNames(text: string): string {
  return text
    .replace(TITLED_NAME_RE, (_span, _article: string | undefined, titles: string, andName: string | undefined) => {
      const phrase = TITLE_PHRASE[(titles.match(/[A-Za-z]+/)?.[0] ?? "").toLowerCase()] ?? "them";
      return andName ? `${phrase} and another person` : phrase;
    })
    .replace(/(^|[.!?]\s+)the (pastor|member|contact|elder|deacon|priest|bishop)/g, (_m, lead: string, who: string) => `${lead}The ${who}`)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Which offers the card shows this org already buys, from the signals the CRM
 * snapshot has today:
 *  - ChurchConnect: a "customer" stop for churchconnect (is_customer / signed_up /
 *    accepted invite / converted_at in ChurchConnect).
 *  - Laser: a "customer" stop for laser (a paid Laser order).
 *  - EasyPeazy / church website, Outreach, Operate, AI Website Design: NO signal
 *    on the card yet (noted in the registry). They're matched by id here so a
 *    customer stop for them is honored the day the snapshot starts carrying one.
 * A "customer" touch (e.g. "Became a ChurchConnect customer") counts for its app too.
 */
const BOUGHT_SIGNAL: Record<string, string[]> = {
  churchconnect: ["churchconnect"],
  laser: ["laser"],
  easypeazy: ["easypeazy"],
  outreach: ["outreach"],
  operate: ["operate"],
  awd: ["awd"]
};

export function alreadyBuys(card: SuggestCard): Set<string> {
  const apps = new Set<string>();
  for (const stop of card.stops) if (stop.reason === "customer" && stop.app) apps.add(String(stop.app));
  for (const touch of card.touches) if (touch.kind === "customer") apps.add(String(touch.app));
  const bought = new Set<string>();
  for (const app of apps) for (const id of BOUGHT_SIGNAL[app] ?? []) bought.add(id);
  return bought;
}

/** Offers the model may pick for this org: the church rule, or live business apps, minus what they already buy. */
export function allowedOffers(kind: SuggestKind, card: SuggestCard): Array<{ id: string; label: string }> {
  const bought = alreadyBuys(card);
  if (kind === "church") return CHURCH_OFFER_IDS.filter((id) => !bought.has(id)).map((id) => ({ id, label: CHURCH_ALLOWED_OFFERS[id] }));
  return BUSINESS_OFFER_IDS.filter((id) => !bought.has(id)).map((id) => ({ id, label: BUSINESS_OFFERS[id] }));
}

/** The status in a few words (no free text from the record). */
function statusOf(card: SuggestCard): string {
  const parts: string[] = [];
  if (card.followUpReasons.includes("due")) parts.push("follow-up due");
  if (card.followUpReasons.includes("warm")) parts.push("warm, no follow-up yet");
  if (card.followUpReasons.includes("unpaid")) parts.push("ordered, not paid yet");
  if (card.repeat.level === "replied") parts.push("they replied after our last reach-out");
  if (card.repeat.level === "soon") parts.push("reached out recently; go gently");
  if (card.stops.some((stop) => stop.reason === "customer")) parts.push("already a customer of some apps");
  if (!card.touches.some((touch) => touch.outreach)) parts.push("not reached out yet");
  return parts.join("; ") || "no open follow-up";
}

/** The fixed list of next-step kinds the model may see (never the next step's own words). */
export const NEXT_STEP_TYPES = ["visit", "call", "email", "drop_off", "follow_up", "other", "none"] as const;
export type NextStepType = (typeof NEXT_STEP_TYPES)[number];

/** Keyword match on the server; the text itself never leaves. First match wins. */
export function nextStepType(text: unknown): NextStepType {
  const words = String(text ?? "").toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!words) return "none";
  if (/\b(drop(ped|ping)?\s+(it\s+|them\s+|something\s+)?off|drop off|leave|leaving|deliver\w*|bring\w*|sample|gift|flyer|brochure)\b/.test(words)) return "drop_off";
  if (/\b(e ?mail\w*|send (a |an )?(note|message)|write)\b/.test(words)) return "email";
  if (/\b(call\w*|phone|ring|text|voicemail)\b/.test(words)) return "call";
  if (/\b(visit\w*|stop (by|in)|drop (by|in)|swing by|go by|come by|meet\w*|see (the|them|him|her)|in person|sunday|service)\b/.test(words)) return "visit";
  if (/\b(follow\w*|check (in|back)|circle back|reach out|touch base|wait|remind\w*)\b/.test(words)) return "follow_up";
  return "other";
}

export type SuggestInput = {
  org_type: SuggestKind;
  town: string;
  apps_on_record: string[];
  apps_picked: string[];
  status: string;
  recent_activity: Array<{ type: string; date: string; by_us: boolean; they_responded: boolean }>;
  next_step_type: NextStepType;
  next_step_due: string;
  allowed_apps: Array<{ id: string; label: string }>;
  today: string;
};

/**
 * EXACTLY what is sent to the model. No org name, no contact names, emails or
 * phones, no visit notes or "what was said", and none of the next step's own
 * words: only its kind (NEXT_STEP_TYPES, matched on the server) and due date.
 */
export function suggestInput(card: SuggestCard, kind: SuggestKind, now: Date): SuggestInput {
  const picked = (card.org?.offers ?? [])
    .map((id) => (kind === "church" ? CHURCH_ALLOWED_OFFERS[churchProductOf(id) as ChurchOffer] : BUSINESS_OFFERS[id as BusinessOffer]))
    .filter((label): label is NonNullable<typeof label> => Boolean(label));
  const recent = [...card.touches]
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 6)
    .map((touch) => ({ type: touch.kind, date: easternDay(touch.at), by_us: touch.outreach, they_responded: Boolean(touch.signal) }));
  return {
    org_type: kind,
    town: scrub(card.town, 80),
    apps_on_record: [...new Set(card.apps.map((app) => (app === "business" ? "business lead" : app)))],
    apps_picked: picked,
    status: statusOf(card),
    recent_activity: recent,
    next_step_type: nextStepType(card.nextStep),
    next_step_due: card.nextActionDate ? easternDay(card.nextActionDate.length === 10 ? `${card.nextActionDate}T12:00:00Z` : card.nextActionDate) : "",
    allowed_apps: allowedOffers(kind, card),
    today: easternDay(now)
  };
}

export type Suggestion = {
  nextStep: string;
  appId: string;
  appLabel: string;
  /** YYYY-MM-DD, today or later. */
  when: string;
  why: string;
};

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Filter the model's answer through the same rules. Returns null when nothing
 * safe is left (the screen then says SUGGEST_NONE).
 *  - All text is normalized first (look-alike letters, full-width, spelled-out words).
 *  - church: the app must be on the church rule; any text naming a product that
 *    is never for churches, ads/campaign words, or "marketing" drops the whole suggestion.
 *  - business: the app must be a live business app; text about a hidden offer
 *    (a marketing campaign, ads) drops it while MARKETING_CAMPAIGN_LIVE is false.
 *  - both: a promise (free, discount, % off, guarantee, deal, a $ amount) drops it.
 *  - emails and phones are removed from every line (ISO dates stay), and a made-up
 *    "Title Name" becomes a generic phrase ("Pastor James" → "the pastor").
 */
export function cleanSuggestion(kind: SuggestKind, raw: unknown, card: SuggestCard, today: string): Suggestion | null {
  let data: Record<string, unknown> | null = null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
      data = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      data = null;
    }
  } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    data = raw as Record<string, unknown>;
  }
  if (!data) return null;
  const nextStep = withoutMadeUpNames(scrub(data.next_step, 120));
  const why = withoutMadeUpNames(scrub(data.why, 160));
  if (!nextStep) return null;
  // Checked on the model's raw words too, so a phone-like run can't hide a word from the filter.
  const said = `${String(data.next_step ?? "")} ${String(data.why ?? "")} ${nextStep} ${why}`;
  if (promiseTextBlocked(said)) return null;
  const allowed = new Map(allowedOffers(kind, card).map((offer) => [offer.id, offer.label]));
  const rawApp = String(data.app ?? "").trim().toLowerCase();
  let appId = "";
  if (kind === "church") {
    const product = churchProductOf(rawApp);
    appId = product && allowed.has(product) ? product : "";
    if (churchTextBlocked(said)) return null;
    // An app outside the rule means the model went off the list: drop the whole thing, not just the app.
    if (rawApp && !appId) return null;
  } else {
    appId = allowed.has(rawApp) ? rawApp : "";
    if (!allowed.has("marketing_campaign") && hiddenBusinessTextBlocked(said)) return null;
    if (rawApp && !appId) return null;
  }
  const days = Math.max(0, Math.min(30, Math.round(Number(data.when_days) || 0)));
  return { nextStep, appId, appLabel: appId ? allowed.get(appId) ?? "" : "", when: addDays(today, days), why };
}

/** Cache key: one answer per org per Eastern day (a changed card asks again). */
export function suggestCacheKey(cardKey: string, input: SuggestInput): string {
  const text = JSON.stringify(input);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (Math.imul(31, hash) + text.charCodeAt(index)) | 0;
  return `${cardKey}|${input.today}|${(hash >>> 0).toString(36)}`;
}
