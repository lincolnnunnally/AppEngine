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
//    status, recent activity types and dates, and the next step. Never the org's
//    name, contact names, emails, phones, or visit notes.
//  * Screens never name the vendor: the feature is "Suggested next step".

import {
  BUSINESS_OFFERS,
  BUSINESS_OFFER_IDS,
  CHURCH_ALLOWED_OFFERS,
  CHURCH_OFFER_IDS,
  NEVER_FOR_CHURCHES,
  churchProductOf,
  hasForbiddenChurchWord,
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
> & { contacts?: Array<{ name: string }> };

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

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

/** Remove anything that looks like an email or phone, collapse spaces, cap length. */
export function scrub(text: unknown, max = 160): string {
  return String(text ?? "")
    .replace(EMAIL_RE, "")
    .replace(PHONE_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Offers the model may pick for this org: the church rule, or live business apps, minus what they already buy. */
export function allowedOffers(kind: SuggestKind, card: SuggestCard): Array<{ id: string; label: string }> {
  const customerOf = new Set(card.stops.filter((stop) => stop.reason === "customer").map((stop) => String(stop.app ?? "")));
  if (kind === "church") {
    return CHURCH_OFFER_IDS.filter((id) => !(customerOf.has("churchconnect") && id === "churchconnect") && !(customerOf.has("laser") && id === "laser")).map((id) => ({
      id,
      label: CHURCH_ALLOWED_OFFERS[id]
    }));
  }
  return BUSINESS_OFFER_IDS.filter((id) => !(customerOf.has("laser") && id === "laser")).map((id) => ({ id, label: BUSINESS_OFFERS[id] }));
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

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The next step on file without the org's name or any saved person's name (they stay on the card, not in the request). */
export function withoutNames(text: string, card: SuggestCard, kind: SuggestKind): string {
  let out = text;
  const orgName = String(card.name ?? "").trim();
  if (orgName.length >= 3) out = out.replace(new RegExp(escapeRe(orgName), "gi"), kind === "church" ? "the church" : "the business");
  const words = new Set<string>();
  for (const contact of card.contacts ?? []) {
    for (const word of String(contact.name ?? "").split(/\s+/)) if (word.replace(/\W/g, "").length >= 2) words.add(word.replace(/[^\p{L}\p{N}'-]/gu, ""));
  }
  for (const word of words) if (word) out = out.replace(new RegExp(`\\b${escapeRe(word)}\\b`, "gi"), "them");
  return out.replace(/\b(them)(\s+them)+\b/gi, "them").replace(/\s+(at|or|and)(\s+(at|or|and))*\s*$/i, "").replace(/\s+/g, " ").trim();
}

export type SuggestInput = {
  org_type: SuggestKind;
  town: string;
  apps_on_record: string[];
  apps_picked: string[];
  status: string;
  recent_activity: Array<{ type: string; date: string; by_us: boolean; they_responded: boolean }>;
  next_step: string;
  next_step_due: string;
  allowed_apps: Array<{ id: string; label: string }>;
  today: string;
};

/**
 * EXACTLY what is sent to the model. No org name, no contact names, emails or
 * phones, no visit notes or "what was said". The next step on file is scrubbed
 * of anything that looks like an email or phone, the org's name, and the names
 * of the people saved on the card.
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
    next_step: withoutNames(scrub(card.nextStep, 160), card, kind).slice(0, 120),
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

/** Product names that must never reach a church, as words a model might write. */
const CHURCH_NEVER_WORDS_RE = new RegExp(
  `\\b(${[
    // "live_on_mission" is how Outreach is named for a church, and "leads" is an everyday word: both stay allowed as text.
    ...[...NEVER_FOR_CHURCHES].filter((id) => id !== "live_on_mission" && id !== "leads"),
    "operate",
    "toner",
    "ai website design",
    "neighborly",
    "presence",
    "group buy",
    "spark",
    "best life",
    "local leads",
    "business tool",
    "business tools"
  ]
    .map((word) => word.replace(/_/g, "[ _]").replace(/\s+/g, "\\s+"))
    .join("|")})\\b`,
  "i"
);

const HIDDEN_BUSINESS_RE = /\bmarketing\s+campaigns?\b/i;

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Filter the model's answer through the same rules. Returns null when nothing
 * safe is left (the screen then says SUGGEST_NONE).
 *  - church: the app must be on the church rule; any text naming a product that
 *    is never for churches, or the word "marketing", drops the whole suggestion.
 *  - business: the app must be a live business app; text about a hidden offer drops it.
 *  - emails and phones are removed from every line.
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
  const nextStep = scrub(data.next_step, 120);
  const why = scrub(data.why, 160);
  if (!nextStep) return null;
  const allowed = new Map(allowedOffers(kind, card).map((offer) => [offer.id, offer.label]));
  const rawApp = String(data.app ?? "").trim().toLowerCase();
  let appId = "";
  if (kind === "church") {
    const product = churchProductOf(rawApp);
    appId = product && allowed.has(product) ? product : "";
    const words = `${nextStep} ${why}`;
    if (CHURCH_NEVER_WORDS_RE.test(words) || hasForbiddenChurchWord(words)) return null;
    // An app outside the rule means the model went off the list: drop the whole thing, not just the app.
    if (rawApp && !appId) return null;
  } else {
    appId = allowed.has(rawApp) ? rawApp : "";
    if (HIDDEN_BUSINESS_RE.test(`${nextStep} ${why}`) && !allowed.has("marketing_campaign")) return null;
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
