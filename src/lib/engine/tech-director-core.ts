// Technical director on a church contact. Pure helpers, safe for the desk.
// Contacts stay on the church's staff_contacts JSON (CRM v2). The exact title
// stays in `role`. The role tag lives in `tags`. Nothing here sends anything.

import { normEmail } from "./lpl-crm-core.ts";

export const TECHNICAL_DIRECTOR_TAG = "Technical director";

/** Church signal from a staff row. The person contact is still saved separately. */
export const SIGNAL_STAFF = "Technical/media staff";
/** Church signal from a campaign or renovation row. No person is created. */
export const SIGNAL_BUILDING = "Building investment";

export const SIGNAL_TYPES = ["staff", "campaign", "renovation"] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export type ChurchSignal = {
  id: string;
  tag: string;
  evidenceQuote: string;
  sourceUrl: string;
  signalDate: string;
  score: number;
};

const STATE_BY_NAME: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT",
  delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL",
  indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA",
  michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY"
};

/** Two-letter state code. "Georgia" and "ga." both become GA. Unknown text is blank. */
export function stateCode(value: unknown): string {
  const text = String(value ?? "").trim().toLowerCase().replace(/\./g, "");
  if (!text) return "";
  if (/^[a-z]{2}$/.test(text)) return text.toUpperCase();
  return STATE_BY_NAME[text] ?? "";
}

export function parseSignalTypes(value: unknown): { ok: true; types: SignalType[] } | { ok: false; message: string } {
  const parts = String(value ?? "")
    .split("|")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length) return { ok: false, message: "The signal type is missing." };
  const types: SignalType[] = [];
  for (const part of parts) {
    if (!SIGNAL_TYPES.includes(part as SignalType)) {
      return { ok: false, message: "The signal type must be staff, campaign, or renovation." };
    }
    const typed = part as SignalType;
    if (!types.includes(typed)) types.push(typed);
  }
  return { ok: true, types };
}

/** staff → Technical/media staff. campaign or renovation → Building investment. */
export function signalTagsForTypes(types: readonly SignalType[]): string[] {
  const tags: string[] = [];
  if (types.includes("staff")) tags.push(SIGNAL_STAFF);
  if (types.includes("campaign") || types.includes("renovation")) tags.push(SIGNAL_BUILDING);
  return tags;
}

export function parseSignalScore(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw || !/^-?\d+(\.\d+)?$/.test(raw)) return null;
  const score = Number(raw);
  return Number.isFinite(score) ? score : null;
}

export function churchSignalScore(signals: readonly { tag?: string; score?: number | null }[], tag?: string): number | null {
  const list = tag ? signals.filter((signal) => signal.tag === tag) : signals;
  const scores = list.map((signal) => signal.score).filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  return scores.length ? Math.max(...scores) : null;
}

function normQuote(value: unknown): string {
  return text(value, 500).toLowerCase();
}

/** Same church signal: tag, quote, and source page. */
export function churchSignalKey(signal: { tag?: string; evidenceQuote?: string; evidence_quote?: string; sourceUrl?: string; source_url?: string }): string {
  const quote = signal.evidenceQuote ?? signal.evidence_quote ?? "";
  const source = signal.sourceUrl ?? signal.source_url ?? "";
  return `${text(signal.tag, 80).toLowerCase()}|${normQuote(quote)}|${httpUrl(source)}`;
}

export function readChurchSignals(value: unknown): ChurchSignal[] {
  if (!Array.isArray(value)) return [];
  const out: ChurchSignal[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const tag = text(row.tag, 80);
    if (tag !== SIGNAL_STAFF && tag !== SIGNAL_BUILDING) continue;
    const score = typeof row.score === "number" ? row.score : parseSignalScore(row.score);
    if (score === null) continue;
    const signal: ChurchSignal = {
      id: text(row.id, 40) || churchSignalKey({ tag, evidenceQuote: text(row.evidence_quote ?? row.evidenceQuote, 500), sourceUrl: text(row.source_url ?? row.sourceUrl, 400) }),
      tag,
      evidenceQuote: text(row.evidence_quote ?? row.evidenceQuote, 500),
      sourceUrl: httpUrl(row.source_url ?? row.sourceUrl),
      signalDate: text(row.signal_date ?? row.signalDate, 40),
      score
    };
    const key = churchSignalKey(signal);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(signal);
  }
  return out;
}

export type TechDirectorPerson = {
  name: string;
  title: string;
  email: string;
  phone: string;
  sourceUrl: string;
};

export type TechDirectorRow = {
  churchId: string;
  name: string;
  town: string;
  website: string;
  people: TechDirectorPerson[];
};

const text = (value: unknown, limit: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);

/** Keep only the Technical director tag, in its display spelling. */
export function cleanRoleTags(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
  const tags: string[] = [];
  for (const item of list) {
    if (text(item, 80).toLowerCase() !== TECHNICAL_DIRECTOR_TAG.toLowerCase()) continue;
    if (!tags.includes(TECHNICAL_DIRECTOR_TAG)) tags.push(TECHNICAL_DIRECTOR_TAG);
  }
  return tags;
}

/** Tags already stored on a contact. A single string is accepted. */
export function readRoleTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => text(item, 80)).filter(Boolean).slice(0, 8);
  const one = text(value, 80);
  return one ? [one] : [];
}

/** http(s) only. A bare host gets https://. Anything else is dropped. */
export function httpUrl(value: unknown): string {
  const raw = text(value, 400);
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : /^[a-z0-9.-]+\.[a-z]{2,}([/?#]|$)/i.test(raw) ? `https://${raw}` : "";
  if (!withScheme) return "";
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href.slice(0, 400);
  } catch {
    return "";
  }
}

/**
 * The role tag, or a title that is exactly "Technical director".
 * A longer title such as "Director of Media" does not count until it is tagged.
 */
export function isTechnicalDirector(contact: { tags?: readonly string[] | null; title?: string | null }): boolean {
  if ((contact.tags ?? []).some((tag) => tag.trim().toLowerCase() === TECHNICAL_DIRECTOR_TAG.toLowerCase())) return true;
  return (contact.title ?? "").trim().toLowerCase() === TECHNICAL_DIRECTOR_TAG.toLowerCase();
}

/** Evidence that belongs on this contact: the same source page, or the staff signal for a technical director. */
export function signalsForContact<T extends { tag: string; sourceUrl?: string }>(
  contact: { sourceUrl?: string; tags?: readonly string[] | null; title?: string | null },
  signals: readonly T[]
): T[] {
  const source = httpUrl(contact.sourceUrl);
  const director = isTechnicalDirector(contact);
  return signals.filter((signal) => (source && httpUrl(signal.sourceUrl) === source) || (director && signal.tag === SIGNAL_STAFF));
}

export function churchHasTechnicalDirector(contacts: ReadonlyArray<{ tags?: readonly string[] | null; title?: string | null }>): boolean {
  return contacts.some((contact) => isTechnicalDirector(contact));
}

/** The published email and phone from one contact cell. */
export function parsePublishedContact(value: unknown): { email: string; phone: string } {
  const raw = String(value ?? "").trim();
  let email = "";
  let phone = "";
  const chunks = raw.split(/[\n;|]+/).flatMap((part) => part.split(/\s+\/\s+/));
  for (const chunk of chunks) {
    const token = chunk.trim();
    if (!token) continue;
    const mail = normEmail(token);
    if (mail && !email) {
      email = mail;
      continue;
    }
    const digits = token.replace(/\D/g, "");
    if (digits.length >= 7 && !phone) phone = text(token, 40);
  }
  if (!email) {
    const found = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (found) email = normEmail(found[0]);
  }
  if (!phone) {
    const found = raw.match(/(\+?1[\s.-]*)?\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}/);
    if (found) phone = text(found[0], 40);
  }
  return { email, phone };
}

type StaffItem = Record<string, unknown>;

function asStaff(staff: unknown): StaffItem[] {
  if (!Array.isArray(staff)) return [];
  return staff.filter((item): item is StaffItem => Boolean(item) && typeof item === "object");
}

/** People on a church's staff_contacts who are technical directors. */
export function technicalDirectorsFromStaff(staff: unknown): TechDirectorPerson[] {
  const out: TechDirectorPerson[] = [];
  const seen = new Set<string>();
  for (const item of asStaff(staff)) {
    const name = text(item.name, 120);
    if (!name) continue;
    const title = text(item.role ?? item.title, 80);
    const tags = readRoleTags(item.tags ?? item.role_tag);
    if (!isTechnicalDirector({ tags, title })) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const published = parsePublishedContact(`${text(item.email, 200)} ${text(item.phone, 40)}`.trim());
    out.push({
      name,
      title,
      email: normEmail(item.email) || published.email,
      phone: text(item.phone, 40) || published.phone,
      sourceUrl: httpUrl(item.source_url ?? item.sourceUrl)
    });
  }
  return out;
}

export const LEAD_CLASSES = ["campaign_planning", "under_construction", "staff_only", "other_services"] as const;
export type LeadClass = (typeof LEAD_CLASSES)[number];

export const AVL_TIERS = ["top", "second", "other_services", "staff_only"] as const;
export type AvlTier = (typeof AVL_TIERS)[number];

/** Owner desk labels. These do not name a vendor and are not church-facing copy. */
export const AVL_TIER_LABEL: Record<AvlTier, string> = {
  top: "Top AVL tier",
  second: "AVL second tier, lower confidence",
  other_services: "Other services",
  staff_only: "Staff only"
};

/** Other services may be offered these. Never Operate, and not church sound, video, and lighting. */
export const OTHER_SERVICES_OFFERS = ["churchconnect", "easypeazy", "laser"] as const;

export const JEV_PROJECT_STAGES = ["planning-campaign", "under-construction", "recently-completed", "unclear", "none"] as const;
export type JevProjectStage = (typeof JEV_PROJECT_STAGES)[number];

const LEAD_RANK: Record<LeadClass, number> = {
  campaign_planning: 4,
  under_construction: 3,
  staff_only: 2,
  other_services: 1
};

export function parseLeadClass(value: unknown): { ok: true; leadClass: LeadClass | "" } | { ok: false; message: string } {
  const text = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!text) return { ok: true, leadClass: "" };
  if ((LEAD_CLASSES as readonly string[]).includes(text)) return { ok: true, leadClass: text as LeadClass };
  return { ok: false, message: "lead_class must be campaign_planning, under_construction, staff_only, or other_services." };
}

/** campaign_planning is the top AVL tier. under_construction is second, with lower confidence. other_services is not an AVL lead. staff_only is the normal list. */
export function avlTierForLeadClass(leadClass: unknown): AvlTier | "" {
  const parsed = parseLeadClass(leadClass);
  if (!parsed.ok || !parsed.leadClass) return "";
  if (parsed.leadClass === "campaign_planning") return "top";
  if (parsed.leadClass === "under_construction") return "second";
  if (parsed.leadClass === "other_services") return "other_services";
  return "staff_only";
}

export function leadClassRank(leadClass: LeadClass | ""): number {
  return leadClass ? LEAD_RANK[leadClass] : 0;
}

/** Fractional fit from 0 through 4. Blank is absent. Anything else is invalid. */
export function parseJevAvlFit(value: unknown): { ok: true; fit: number | null } | { ok: false; message: string } {
  const raw = String(value ?? "").trim();
  if (!raw) return { ok: true, fit: null };
  if (!/^\d+(\.\d+)?$/.test(raw)) return { ok: false, message: "jev_avl_fit must be a number from 0 to 4." };
  const fit = Number(raw);
  if (!Number.isFinite(fit) || fit < 0 || fit > 4) return { ok: false, message: "jev_avl_fit must be a number from 0 to 4." };
  return { ok: true, fit };
}

export function parseJevProjectStage(value: unknown): { ok: true; stage: JevProjectStage | "" } | { ok: false; message: string } {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return { ok: true, stage: "" };
  if ((JEV_PROJECT_STAGES as readonly string[]).includes(text)) return { ok: true, stage: text as JevProjectStage };
  return { ok: false, message: "jev_project_stage must be planning-campaign, under-construction, recently-completed, unclear, or none." };
}

export function existingColumnYes(value: unknown): boolean {
  const text = String(value ?? "").trim().toLowerCase();
  return text === "yes" || text === "y" || text === "true";
}
