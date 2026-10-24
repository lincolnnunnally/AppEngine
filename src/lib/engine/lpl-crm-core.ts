// CRM v1 core — pure functions only (no fetch, no env, no imports), so the
// smoke can run them on fixtures. The server reader (lpl-crm.ts) turns each
// app's EXISTING rows into CrmNodes; this file matches them into one card per
// org or person, applies the don't-repeat rule and the hard stops, and builds
// the daily follow-up list. Nothing here writes anywhere.

export type CrmApp = "churchconnect" | "laser" | "presence" | "business";

export const CRM_APP_LABEL: Record<CrmApp, string> = {
  churchconnect: "ChurchConnect",
  laser: "Laser",
  presence: "Presence",
  // Business prospects (op_leads): Operate, AI Website Design, EasyPeazy, Laser.
  business: "Business lead"
};

// ── Orgs the owner adds or edits from the desk ─────────────────────────────

export type OrgKind = "church" | "business";

/** The basics the desk can edit. Church → ChurchConnect church; business → op_leads row. */
export type CrmOrg = {
  kind: OrgKind;
  id: string;
  name: string;
  city: string;
  state: string;
  website: string;
  phone: string;
  email: string;
  /** Apps the owner picked (church: the church rule's ids; business: the business list). */
  offers: string[];
  /** Business: the row's updated_at, sent back on edit so a stale form can't overwrite a newer save. */
  version?: string;
};

// Church words (MAP: port of EasyPeazy is_church + a name list). Unclear = church.
const CHURCH_NAME_RE =
  /\b(church|chapel|baptist|methodist|ministry|ministries|parish|cathedral|fellowship|assembly|assemblies|tabernacle|temple|congregation|worship|catholic|lutheran|presbyterian|episcopal|pentecostal|apostolic|adventist|nazarene|mission|missions|diocese|basilica|sanctuary|gospel|christian|bible|ame|umc|cme|cogic)\b/i;

export function looksLikeChurch(name: unknown): boolean {
  return CHURCH_NAME_RE.test(String(name ?? ""));
}

/**
 * Church or business. "Not sure" (or anything unclear) is a church. Picking
 * "business" for a church-sounding name needs an explicit "yes, it's a business".
 */
export function resolveOrgKind(raw: unknown, name: unknown, confirmBusiness: boolean): { kind: OrgKind } | { error: string } {
  const pick = String(raw ?? "").trim().toLowerCase();
  if (pick !== "business") return { kind: "church" };
  if (looksLikeChurch(name) && !confirmBusiness) {
    return { error: "That name sounds like a church. Tick \"Yes, this is a business, not a church\" or pick Church." };
  }
  return { kind: "business" };
}

/** Admins see the org's name and town only; the owner also sees phone and email. */
export function orgForViewer(org: CrmOrg | null, isOwner: boolean): CrmOrg | null {
  if (!org || isOwner) return org;
  return { ...org, phone: "", email: "" };
}

export type MatchKind = "id" | "email" | "domain" | "phone";

export const MATCH_LABEL: Record<MatchKind, string> = {
  id: "linked record",
  email: "same email",
  domain: "same website",
  phone: "same phone"
};

export type TouchKind =
  | "invite"
  | "site_offer"
  | "site_page"
  | "email"
  | "call"
  | "note"
  | "sample"
  | "order"
  | "token"
  | "scan"
  | "view"
  | "event"
  | "customer"
  | "visit"
  | "drop_off";

export type Touch = {
  at: string; // ISO timestamp
  app: CrmApp;
  kind: TouchKind;
  what: string; // plain words, no contact details
  outreach: boolean; // we sent or gave something (counts for don't-repeat)
  signal?: boolean; // they did something (view, scan, order, accept)
  response?: string;
  purchase?: string;
  unpaid?: boolean;
  /** How long other apps should wait after this reach-out. Default DONT_REPEAT_DAYS (14). A drop-off rests 7. */
  restDays?: number;
  /** The record holds a calendar day, not a moment: show the date without a time. */
  dateOnly?: boolean;
  /** What was left on a visit or drop-off, in plain words (no contact details). */
  left?: string;
};

export type TokenRow = {
  label: string;
  status: string;
  printed: boolean | null; // null = retired / not counted
  /** How many tokens this line stands for (a planned batch with no coins yet). Default 1. */
  count?: number;
};

/** Tokens counted by line weight — a planned batch of 100 counts as 100. */
export function countTokens(tokens: TokenRow[], printed?: boolean | null): number {
  return tokens
    .filter((token) => (printed === undefined ? token.printed !== null : token.printed === printed))
    .reduce((sum, token) => sum + Math.max(1, Math.floor(token.count ?? 1)), 0);
}

export type EventRow = {
  title: string;
  startsAt: string | null;
  status: string;
  place: string;
};

export type LocationRow = { name: string; town: string; kind: string };

/**
 * A person at a church. "saved" contacts live in the church's own contact list
 * and can be edited from the desk; the others come from the church record
 * (pastor, secretary, main contact) and are shown read-only.
 */
export type CrmContact = {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  source: "saved" | "pastor" | "secretary" | "contact";
  /** Role tags. "Technical director" is the desk filter. The exact title stays in `title`. */
  tags?: string[];
  /** Public page this contact was taken from. Shown to the owner only. */
  sourceUrl?: string;
  /** Pipeline status on this person. Stored on the contact record. Owner only. */
  status?: CrmContactStatus | "";
  /** Outreach notes logged for this person (note + day). Owner only. Nothing is sent. */
  notes?: CrmContactNote[];
};

export const CRM_CONTACT_STATUSES = ["new", "contacted", "follow-up", "meeting", "won", "lost"] as const;
export type CrmContactStatus = (typeof CRM_CONTACT_STATUSES)[number];

export type CrmContactNote = { at: string; note: string };

const CONTACT_STATUS_LABEL: Record<CrmContactStatus, string> = {
  new: "New",
  contacted: "Contacted",
  "follow-up": "Follow-up",
  meeting: "Meeting",
  won: "Won",
  lost: "Lost"
};

export function contactStatusLabel(status: string): string {
  return CONTACT_STATUS_LABEL[status as CrmContactStatus] ?? "";
}

export function cleanContactStatus(value: unknown): CrmContactStatus | "" {
  const text = String(value ?? "").trim().toLowerCase();
  return (CRM_CONTACT_STATUSES as readonly string[]).includes(text) ? (text as CrmContactStatus) : "";
}

const OUTREACH_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A logged outreach: a note, the day, and one of the contact statuses. Logging only. */
export function cleanContactOutreach(input: {
  note?: unknown;
  day?: unknown;
  status?: unknown;
  contactId?: unknown;
  name?: unknown;
}): { note: string; day: string; status: CrmContactStatus; contactId: string; name: string } | string {
  const note = String(input.note ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!note) return "Write what you did. Nothing was saved.";
  const day = String(input.day ?? "").trim().slice(0, 10);
  if (!OUTREACH_DAY.test(day)) return "Pick the day. Nothing was saved.";
  const parsed = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return "Pick a real day. Nothing was saved.";
  const status = cleanContactStatus(input.status);
  if (!status) return "Pick a status. Nothing was saved.";
  const contactId = String(input.contactId ?? "").trim();
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(contactId)) return "That contact can't be updated. Reload the page and try again.";
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!name) return "That contact needs a name. Nothing was saved.";
  return { note, day, status, contactId, name };
}

/**
 * Owner search. Matches the church name, a person's name or title, the city
 * or state, and a signal tag (Technical/media staff, Building investment, or
 * a card that has both). Blank query matches everything.
 */
export function cardMatchesCrmSearch(
  card: {
    name: string;
    town: string;
    state?: string;
    contacts?: Array<{ name?: string; title?: string; tags?: string[] }>;
    signals?: Array<{ tag?: string }>;
  },
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const parts = [
    card.name,
    card.town,
    card.state ?? "",
    ...(card.contacts ?? []).flatMap((contact) => [contact.name ?? "", contact.title ?? "", ...(contact.tags ?? [])]),
    ...(card.signals ?? []).map((signal) => signal.tag ?? "")
  ];
  return parts.join("\n").toLowerCase().includes(q);
}

export type CrmNode = {
  id: string;
  app: CrmApp;
  kind: "org" | "person" | "place" | "batch" | "event";
  name: string;
  town: string;
  emails: string[];
  domains: string[];
  phones: string[];
  links: string[]; // explicit ids of nodes that are the same org/person
  touches: Touch[];
  customerOf?: CrmApp[];
  declined?: string; // why, in plain words
  nextActionDate?: string | null; // YYYY-MM-DD or ISO
  nextAction?: string;
  tokens?: TokenRow[];
  events?: EventRow[];
  locations?: LocationRow[];
  // true = pulled in only to look for matches (directory row). Dropped when
  // it connects to nothing.
  contextOnly?: boolean;
  /** Where the owning app opens this record: "/path#hash" from the app origin, or "#hash" on its admin URL. */
  recordPath?: string;
  /** ChurchConnect church id the desk may log visits and save contacts on (UUID churches only). */
  churchId?: string;
  /** Business lead id (op_leads) the desk may log visits and save contacts on. */
  leadId?: string;
  contacts?: CrmContact[];
  /** A visit logged from the desk marked this church or business do-not-contact (the desk may undo it). */
  deskDoNotContact?: boolean;
  /** Basics the owner can edit from the desk (ChurchConnect church or business lead). */
  org?: CrmOrg;
  /** Church state, used by the owner signal filter. */
  state?: string;
  /** Church signals (technical/media staff, building investment). Owner only on the page. */
  signals?: CrmChurchSignal[];
  /** Unmatched church-signal row stored as an op_leads lead. */
  leadQueue?: boolean;
};

export type CrmChurchSignal = {
  id: string;
  tag: string;
  evidenceQuote: string;
  sourceUrl: string;
  signalDate: string;
  score: number;
};

export type Suppressions = { emails: Set<string>; domains: Set<string>; phones: Set<string> };

/** Declined lines that already mean "on the do-not-contact list". */
export const DNC_DECLINED_RE = /^(Asked not to be contacted|Opted out|Email bounced|On the do-not-contact list)\b/;

export type CrmStop = { reason: "suppressed" | "customer" | "declined"; text: string; app?: CrmApp };

// hold    = resting: an app reached out < 14 days ago and nobody replied since.
// replied = they answered after our last reach-out, so the rest is lifted.
// soon    = fine to follow up, but go gently.
export type CrmRepeat = { level: "hold" | "replied" | "soon" | null; text: string; until?: string };

export type CrmPossibleMatch = { key: string | null; name: string; town: string; apps: CrmApp[] };

export type CrmCard = {
  key: string;
  name: string;
  town: string;
  kinds: CrmNode["kind"][];
  apps: CrmApp[];
  matchedBy: MatchKind[];
  recordCount: number; // how many app records make up this card
  touches: Touch[];
  lastOutreach: Touch | null;
  lastTouch: Touch | null;
  repeat: CrmRepeat;
  stops: CrmStop[];
  possibleMatches: CrmPossibleMatch[];
  tokens: TokenRow[];
  events: EventRow[];
  locations: LocationRow[];
  nextActionDate: string | null;
  /** Set when the app's own due date fell inside a rest; nextActionDate was moved to the rest end. */
  nextActionMovedFrom: string | null;
  nextAction: string;
  /** Single source for "Next step" on both the card and the list. Set by buildFollowUps. */
  nextStep: string;
  /** Reasons this card is on the follow-up list (empty = not on it). */
  followUpReasons: FollowUpReason[];
  /** Per-app path inside that app's admin that opens this exact record (only where the app supports it). */
  recordPaths: Partial<Record<CrmApp, string>>;
  /** The ChurchConnect church this card can log visits and save contacts on, if any. */
  churchId: string | null;
  /** The business lead this card saves to when it has no church (one lead only). */
  leadId: string | null;
  /** People at this org (church or business contacts). Contact details are removed for viewers who are not the owner. */
  contacts: CrmContact[];
  /** A visit logged from the desk set do-not-contact on this church; the owner can undo it. */
  deskDoNotContact: boolean;
  /** The org's editable basics (church first). Phone and email are removed for viewers who are not the owner. */
  org: CrmOrg | null;
  /** Church state code or the stored state text. */
  state?: string;
  /** Owner only. Evidence for technical/media staff or building investment. */
  signals?: CrmChurchSignal[];
  /** This card is an unmatched church-signal lead (op_leads). */
  leadQueue?: boolean;
};

// "wait" = an outreach step for a resting card. It is held until the rest
// ends and never counts as today's work. Events and token prep are not
// outreach, so they stay on today's list.
export type FollowUpReason = "due" | "warm" | "unpaid" | "events" | "tokens" | "wait";

export const FOLLOW_UP_LABEL: Record<FollowUpReason, string> = {
  due: "Due today",
  warm: "Warm, no follow-up yet",
  unpaid: "Not paid yet",
  events: "Upcoming events",
  tokens: "Tokens to print",
  wait: "Resting, wait"
};

/** Reasons that mean contacting them. A rest holds these. */
export const OUTREACH_REASONS: FollowUpReason[] = ["due", "warm", "unpaid"];

export type FollowUpItem = { reason: FollowUpReason; why: string; step: string };

/** One row per org or person, with every reason stacked. */
export type FollowUp = {
  cardKey: string;
  name: string;
  town: string;
  apps: CrmApp[];
  reasons: FollowUpReason[];
  items: FollowUpItem[];
  /** The one next step — the card shows this same text. */
  nextStep: string;
  /** true = on today's list; false = only held ("wait") items. */
  today: boolean;
  restingUntil: string | null;
  lastTouch: { app: CrmApp; at: string; what: string } | null;
  sortAt: string;
};

export const DONT_REPEAT_DAYS = 14;
/** A visit rests 14 days; something dropped off (a sample, a flyer) rests 7. */
export const VISIT_REST_DAYS = 14;
export const DROP_OFF_REST_DAYS = 7;
export const SOFT_REPEAT_DAYS = 30;
export const WAITING_MIN_DAYS = 3;
export const WARM_DAYS = 7;
export const UNPAID_AFTER_DAYS = 3;
export const UPCOMING_EVENT_DAYS = 14;
// A key shared by more records than this is too generic to prove "same org".
const AMBIGUOUS_KEY_LIMIT = 4;

const DAY = 86_400_000;

// --- normalizers -----------------------------------------------------------

const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com", "outlook.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "comcast.net", "att.net", "bellsouth.net", "windstream.net",
  "charter.net", "verizon.net", "protonmail.com", "proton.me", "gmx.com", "mail.com", "example.com", "example.org",
  "sbcglobal.net", "cox.net", "earthlink.net", "frontier.com", "rr.com", "juno.com", "embarqmail.com", "centurylink.net",
  "aim.com"
]);

// Hosts many unrelated orgs share — never proof of "same org".
const SHARED_HOSTS = [
  "facebook.com", "fb.com", "m.facebook.com", "instagram.com", "youtube.com", "youtu.be", "tiktok.com", "x.com",
  "twitter.com", "linktr.ee", "google.com", "goo.gl", "sites.google.com", "wixsite.com", "wix.com", "weebly.com",
  "squarespace.com", "wordpress.com", "blogspot.com", "godaddysites.com", "churchcenter.com", "subsplash.com",
  "tithe.ly", "vercel.app", "netlify.app", "unitedundergod.org", "churchconnect.cloud", "easypeazy.site",
  "engrave.market", "yelp.com", "maps.app.goo.gl", "linkedin.com"
];

export function normEmail(value: unknown): string {
  const text = String(value ?? "").trim().toLowerCase();
  return /^[^@\s,;]+@[^@\s,;]+\.[a-z]{2,}$/.test(text) ? text : "";
}

function stripPhoneExtension(value: unknown): string {
  // An extension (x12, ext. 12, #12) is not part of the number.
  return String(value ?? "").replace(/\s*(?:extension|ext\.?|x|#)\s*\d+\s*$/i, "");
}

export function normPhone(value: unknown): string {
  let digits = stripPhoneExtension(value).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length === 10 ? digits : "";
}

/**
 * AV prospects phone key, the #416 rule. Digits only: an extension stays in the
 * digit string, so "404-555-0143 x12" is not a 10-digit match. Seven digits are empty.
 */
export function avNormPhone(value: unknown): string {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length === 10 ? digits : "";
}

/** Ten digits, or seven for a local number. A 7-digit suppression matches only a 7-digit number. */
export function suppressionPhone(value: unknown): string {
  let digits = stripPhoneExtension(value).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length === 10 || digits.length === 7 ? digits : "";
}

export function phonesMatch(church: string, listed: string): boolean {
  if (!church || !listed || church !== listed) return false;
  if (listed.length === 7) return church.length === 7;
  return true;
}

function isSharedHost(host: string): boolean {
  return SHARED_HOSTS.some((shared) => host === shared || host.endsWith(`.${shared}`));
}

function bareHost(value: unknown): string {
  let text = String(value ?? "").trim().toLowerCase();
  if (!text) return "";
  text = text.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  text = text.split(/[/?#\s]/)[0].split(":")[0];
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(text)) return "";
  return text;
}

function hostIn(host: string, list: readonly string[]): boolean {
  return list.some((item) => host === item || host.endsWith(`.${item}`));
}

// ChurchConnect backend/utils/outreach_domains.py. A suppression on one of these
// matches only the exact email, never every church on that host.
const OUTREACH_FREE_MAIL = [
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "rocketmail.com",
  "outlook.com", "outlook.co.uk", "hotmail.com", "hotmail.co.uk", "live.com", "msn.com",
  "aol.com", "icloud.com", "me.com", "mac.com", "comcast.net", "att.net", "sbcglobal.net",
  "bellsouth.net", "protonmail.com", "proton.me", "pm.me", "gmx.com", "gmx.net", "mail.com"
];
const OUTREACH_SHARED_HOSTS = [
  "facebook.com", "fb.com", "instagram.com", "youtube.com", "youtu.be", "tiktok.com",
  "linktr.ee", "google.com", "goo.gl", "wix.com", "wixsite.com", "weebly.com",
  "wordpress.com", "squarespace.com", "sites.google.com", "godaddysites.com",
  "tithe.ly", "pushpay.com", "givelify.com", "subsplash.com", "churchfinder.com", "twitter.com", "paypal.com",
  "pmt.org", "windstream.net", "embarqmail.com", "charter.net", "verizon.net", "centurylink.net",
  "earthlink.net", "comporium.net", "juno.com", "ftc-i.net", "rr.com", "nc.rr.com", "frontier.com",
  "churchofgod.cc", "churchofgod.org", "umc.org", "church-of-christ.org", "ag.org", "sbc.net",
  "iphc.org", "cogop.org", "watchtower.org", "jw.org",
  "churchofjesuschrist.org", "local.churchofjesuschrist.org", "ame-church.com", "nazarene.org",
  "charlestondiocese.org", "pcusa.org", "churchangel.com", "chamberofcommerce.com", "inallthingspray.org",
  "giv.li", "yellowpages.com", "bizapedia.com", "netministries.org", "dandb.com", "knology.net",
  "ngumc.org", "sgaumc.org", "flumc.org", "umcsc.org", "nccumc.org", "wnccumc.org", "vaumc.org", "umcna.org", "awfumc.org"
];

export function normDomain(value: unknown): string {
  const text = bareHost(value);
  if (!text || isSharedHost(text)) return "";
  return text;
}

/** Domain key for the do-not-contact list. Blank for a shared, free-mail, or conference host. */
export function suppressionDomain(value: unknown): string {
  const host = bareHost(value);
  if (!host || isSharedHost(host) || hostIn(host, [...FREEMAIL]) || hostIn(host, OUTREACH_FREE_MAIL) || hostIn(host, OUTREACH_SHARED_HOSTS)) return "";
  return host;
}

export function suppressionKeys(row: { email?: unknown; domain?: unknown; phone?: unknown; brand?: unknown }): { emails: string[]; domains: string[]; phones: string[] } {
  const emails: string[] = [];
  const domains: string[] = [];
  const phones: string[] = [];
  const email = normEmail(row.email);
  if (email) emails.push(email);
  const domain = suppressionDomain(row.domain);
  if (domain) domains.push(domain);
  const phone = suppressionPhone(row.phone);
  if (phone) phones.push(phone);
  const brand = String(row.brand ?? "").trim().toLowerCase();
  if (brand && brand !== "all") {
    if (brand.includes("@")) {
      const branded = normEmail(brand);
      if (branded) emails.push(branded);
    } else {
      const brandedDomain = suppressionDomain(brand);
      if (brandedDomain) domains.push(brandedDomain);
    }
  }
  return { emails, domains, phones };
}

/** Exact email, own-site domain, or phone. A generic domain, or one shared by more than three churches, never matches by itself. */
export function rowMatchesSuppression(
  row: { email?: unknown; website?: unknown; phone?: unknown },
  index: { emails: ReadonlySet<string>; domains: ReadonlySet<string>; phones: ReadonlySet<string> },
  sharedDomains?: { has(value: string): boolean }
): boolean {
  const email = normEmail(row.email);
  if (email && index.emails.has(email)) return true;
  const mailHost = email.includes("@") ? suppressionDomain(email.slice(email.indexOf("@") + 1)) : "";
  if (mailHost && !sharedDomains?.has(mailHost) && index.domains.has(mailHost)) return true;
  const site = suppressionDomain(row.website);
  if (site && !sharedDomains?.has(site) && index.domains.has(site)) return true;
  const phone = suppressionPhone(row.phone);
  if (!phone) return false;
  for (const listed of index.phones) if (phonesMatch(phone, listed)) return true;
  return false;
}

/**
 * AV prospects do-not-contact match, the #416 rule. Exact email, the email's
 * host, the website host (normDomain, so umc.org, sgaumc.org, and bellsouth.net
 * still match), or a 10-digit phone. Brand is ignored. A 7-digit number and an
 * extension do not match. Top prospects uses suppressionKeys and rowMatchesSuppression.
 */
export function avSuppressionMatcher(rows: Array<{ email?: unknown; domain?: unknown; phone?: unknown }>): (row: { email?: unknown; website?: unknown; phone?: unknown }) => boolean {
  const emails = new Set<string>();
  const domains = new Set<string>();
  const phones = new Set<string>();
  for (const row of rows) {
    const email = normEmail(row.email);
    const domain = normDomain(row.domain);
    const phone = avNormPhone(row.phone);
    if (email) emails.add(email);
    if (domain) domains.add(domain);
    if (phone) phones.add(phone);
  }
  return (row) => {
    const email = normEmail(row.email);
    if (email && (emails.has(email) || domains.has(email.split("@")[1] ?? ""))) return true;
    const domain = normDomain(row.website);
    if (domain && domains.has(domain)) return true;
    const phone = avNormPhone(row.phone);
    return Boolean(phone && phones.has(phone));
  };
}

export function domainFromEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  const host = email.slice(at + 1);
  if (FREEMAIL.has(host)) return "";
  return normDomain(host);
}

export function normName(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^the /, "");
}

export function nameTownKey(name: string, town: string): string {
  const n = normName(name);
  const t = normName(String(town ?? "").split(",")[0]);
  return n && t ? `${n}|${t}` : "";
}

// "Mary Ellen Smith" → "Mary S." People are shown by first name + initial only.
export function shortPersonName(value: unknown): string {
  const text = String(value ?? "").replace(/[^\p{L}\p{N}' -]+/gu, " ").trim();
  if (!text) return "";
  const parts = text.split(/\s+/);
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

// Free text from app rows can carry contact details. Strip them before display.
export function scrubContact(value: unknown, max = 140): string {
  const text = String(value ?? "")
    .replace(/[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/gi, "(email)")
    .replace(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "(phone)")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** A calendar day in Eastern time: "YYYY-MM-DD" stays as is; a timestamp is converted. */
export function dayOf(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : nyDate(value);
}

/** "Oct 22" for a calendar day (YYYY-MM-DD) — no time zone shift. */
export function friendlyDay(ymd: string): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? ymd : new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(d);
}

/** "Oct 22" in Eastern time — for sentences people read. */
export function friendlyDate(at: Date | string | number): string {
  const d = at instanceof Date ? at : new Date(at);
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(d);
}

export function nyDate(at: Date | string | number): string {
  const date = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function ms(at: string | null | undefined): number {
  if (!at) return Number.NaN;
  const value = Date.parse(at);
  return Number.isNaN(value) ? Number.NaN : value;
}

export function daysBetween(earlier: string, now: Date): number {
  const t = ms(earlier);
  if (Number.isNaN(t)) return Number.NaN;
  return Math.floor((now.getTime() - t) / DAY);
}

export function addDaysIso(at: string, days: number): string {
  return new Date(ms(at) + days * DAY).toISOString();
}

// --- matching --------------------------------------------------------------

// FNV-1a — a short, stable, non-reversible-enough card key for anchors/URLs.
export function hashKey(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

class Union {
  private parent = new Map<string, string>();
  find(id: string): string {
    let root = this.parent.get(id) ?? id;
    if (root !== id) {
      root = this.find(root);
      this.parent.set(id, root);
    }
    return root;
  }
  join(a: string, b: string): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    this.parent.set(rb, ra);
    return true;
  }
}

const KIND_RANK: Record<CrmNode["kind"], number> = { org: 0, place: 1, batch: 2, event: 3, person: 4 };
const APP_RANK: Record<CrmApp, number> = { churchconnect: 0, presence: 1, laser: 2, business: 3 };

function nodeKeys(node: CrmNode): { email: string[]; domain: string[]; phone: string[] } {
  const emails = [...new Set(node.emails.map(normEmail).filter(Boolean))];
  const domains = new Set(node.domains.map(normDomain).filter(Boolean));
  for (const email of emails) {
    const fromEmail = domainFromEmail(email);
    if (fromEmail && node.kind !== "person") domains.add(fromEmail);
  }
  const phones = [...new Set(node.phones.map(normPhone).filter(Boolean))];
  return { email: emails, domain: [...domains], phone: phones };
}

function sortTouches(touches: Touch[]): Touch[] {
  return [...touches].sort((a, b) => (ms(b.at) || 0) - (ms(a.at) || 0));
}

const SAME_SEND_MS = 10 * 60_000;

/**
 * One send recorded by two sources (e.g. a church's last_invited_at and its
 * invite row) is one touch: same app, same kind, same direction, within 10 min.
 */
export function dedupeTouches(touchesNewestFirst: Touch[]): Touch[] {
  const kept: Touch[] = [];
  for (const touch of touchesNewestFirst) {
    const twin = kept.find(
      (other) =>
        other.app === touch.app &&
        other.kind === touch.kind &&
        other.outreach === touch.outreach &&
        Math.abs((ms(other.at) || 0) - (ms(touch.at) || 0)) <= SAME_SEND_MS
    );
    if (!twin) kept.push(touch);
    else {
      twin.response = twin.response ?? touch.response;
      twin.purchase = twin.purchase ?? touch.purchase;
    }
  }
  return kept;
}

const SAFE_RECORD_PATH = /^[#/A-Za-z0-9_.\-]+$/;

/** First record path per app (non-context records first). Never carries contact details. */
function recordPathsOf(members: CrmNode[]): Partial<Record<CrmApp, string>> {
  const out: Partial<Record<CrmApp, string>> = {};
  const ordered = [...members].sort((a, b) => Number(Boolean(a.contextOnly)) - Number(Boolean(b.contextOnly)));
  for (const member of ordered) {
    const path = member.recordPath;
    if (path && !out[member.app] && SAFE_RECORD_PATH.test(path) && !path.includes("@")) out[member.app] = path;
  }
  return out;
}

/** The one church the desk may write to: only when exactly one non-context church record is on the card. */
/** The org the desk edits: the ChurchConnect church if there is one, else the business lead. */
function orgOf(members: CrmNode[]): CrmOrg | null {
  const orgs = members.filter((member) => member.org && !member.contextOnly).map((member) => member.org as CrmOrg);
  return orgs.find((org) => org.kind === "church") ?? orgs[0] ?? null;
}

function churchIdOf(members: CrmNode[]): string | null {
  const ids = [...new Set(members.filter((member) => member.churchId && !member.contextOnly).map((member) => member.churchId as string))];
  return ids.length === 1 ? ids[0] : null;
}

/** A card saves to a business lead only when it has no church and exactly one lead. */
function leadIdOf(members: CrmNode[], churchId: string | null): string | null {
  if (churchId) return null;
  const ids = [...new Set(members.filter((member) => member.leadId && !member.contextOnly).map((member) => member.leadId as string))];
  return ids.length === 1 ? ids[0] : null;
}

/** The members whose people and do-not-contact state the card's save target owns. */
function targetMembers(members: CrmNode[], churchId: string | null, leadId: string | null): CrmNode[] {
  if (churchId) return members.filter((member) => member.churchId === churchId || !member.leadId);
  if (leadId) return members.filter((member) => member.leadId === leadId || !member.churchId);
  return members;
}

function contactsOf(members: CrmNode[]): CrmContact[] {
  const out: CrmContact[] = [];
  const seen = new Set<string>();
  for (const member of members) {
    for (const contact of member.contacts ?? []) {
      const key = `${normName(contact.name)}|${normEmail(contact.email)}|${normPhone(contact.phone)}`;
      if (!contact.name || seen.has(contact.id) || seen.has(key)) continue;
      seen.add(contact.id);
      seen.add(key);
      out.push(contact);
    }
  }
  // Saved contacts first (they can be edited), then the record's own names.
  return out.sort((a, b) => Number(a.source !== "saved") - Number(b.source !== "saved"));
}

/** Owner view keeps everything; anyone else sees names and titles only. */
export function contactsForViewer(contacts: CrmContact[], isOwner: boolean): CrmContact[] {
  return isOwner ? contacts : contacts.map((contact) => ({ ...contact, email: "", phone: "", sourceUrl: "", status: "", notes: [] }));
}

function signalsOf(members: CrmNode[]): CrmChurchSignal[] {
  const out: CrmChurchSignal[] = [];
  const seen = new Set<string>();
  for (const member of members) {
    for (const signal of member.signals ?? []) {
      const key = `${signal.tag}|${signal.evidenceQuote}|${signal.sourceUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(signal);
    }
  }
  return out.sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag));
}

export function buildCards(nodes: CrmNode[], suppressions: Suppressions, now: Date): CrmCard[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const union = new Union();
  const edges: Array<{ a: string; b: string; kind: MatchKind }> = [];

  // 1. Explicit ids first.
  for (const node of nodes) {
    for (const link of node.links) {
      if (byId.has(link)) {
        union.join(node.id, link);
        edges.push({ a: node.id, b: link, kind: "id" });
      }
    }
  }

  // 2. Then email, then domain, then phone.
  const keyed = new Map(nodes.map((node) => [node.id, nodeKeys(node)]));
  for (const kind of ["email", "domain", "phone"] as const) {
    const index = new Map<string, string[]>();
    for (const node of nodes) {
      for (const value of keyed.get(node.id)![kind]) {
        const list = index.get(value) ?? [];
        list.push(node.id);
        index.set(value, list);
      }
    }
    for (const ids of index.values()) {
      const unique = [...new Set(ids)];
      if (unique.length < 2) continue;
      // Count distinct already-merged groups so one org's many rows don't look generic.
      const groups = new Set(unique.map((id) => union.find(id)));
      if (groups.size > AMBIGUOUS_KEY_LIMIT) continue;
      for (const id of unique.slice(1)) {
        if (union.join(unique[0], id)) edges.push({ a: unique[0], b: id, kind });
      }
    }
  }

  const groups = new Map<string, CrmNode[]>();
  for (const node of nodes) {
    const root = union.find(node.id);
    const list = groups.get(root) ?? [];
    list.push(node);
    groups.set(root, list);
  }

  const allEmails = suppressions.emails;
  const allDomains = suppressions.domains;
  const allPhones = suppressions.phones;

  type Draft = { card: CrmCard; nameKeys: Set<string>; contextOnly: boolean; memberApps: CrmApp[] };
  const drafts: Draft[] = [];

  for (const [root, members] of groups) {
    const lead = [...members].sort(
      (a, b) =>
        Number(Boolean(a.contextOnly)) - Number(Boolean(b.contextOnly)) ||
        KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
        APP_RANK[a.app] - APP_RANK[b.app]
    )[0];
    const ids = new Set(members.map((member) => member.id));
    const matchedBy = [
      ...new Set(edges.filter((edge) => ids.has(edge.a) && ids.has(edge.b)).map((edge) => edge.kind))
    ] as MatchKind[];
    const touches = dedupeTouches(sortTouches(members.flatMap((member) => member.touches)));
    const lastOutreach = touches.find((touch) => touch.outreach) ?? null;
    const stops: CrmStop[] = [];

    const keys = members.map((member) => keyed.get(member.id)!);
    const suppressed =
      keys.some((k) => k.email.some((e) => allEmails.has(e))) ||
      keys.some((k) => k.domain.some((d) => allDomains.has(d))) ||
      keys.some((k) => k.phone.some((p) => allPhones.has(p)));
    // A member's own do-not-contact line ("Asked not to be contacted", "Opted out", "Email bounced")
    // already says it; don't stack a second, generic stop under it.
    const askedNot = members.some((member) => DNC_DECLINED_RE.test(member.declined ?? ""));
    if (suppressed && !askedNot) {
      stops.push({ reason: "suppressed", text: "On the do-not-contact list. Do not reach out from any app." });
    }
    const customerApps = [...new Set(members.flatMap((member) => member.customerOf ?? []))];
    for (const app of customerApps) {
      stops.push({
        reason: "customer",
        app,
        text: `Already a ${CRM_APP_LABEL[app]} customer. Do not pitch ${CRM_APP_LABEL[app]} again.`
      });
    }
    for (const member of members) {
      if (member.declined) stops.push({ reason: "declined", app: member.app, text: member.declined });
    }

    const nextDates = members
      .map((member) => ({ date: member.nextActionDate ?? null, action: member.nextAction ?? "" }))
      .filter((item) => item.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const saveChurch = churchIdOf(members);
    const saveLead = leadIdOf(members, saveChurch);
    const card: CrmCard = {
      // Hashed so an id that contains contact details never reaches the page.
      key: `c${hashKey(root)}`,
      name: lead.name || "Unnamed",
      town: lead.town || members.find((member) => member.town)?.town || "",
      kinds: [...new Set(members.map((member) => member.kind))],
      apps: [...new Set(members.filter((member) => !member.contextOnly || members.length > 1).map((member) => member.app))].sort(
        (a, b) => APP_RANK[a] - APP_RANK[b]
      ),
      matchedBy,
      recordCount: members.length,
      touches,
      lastOutreach,
      lastTouch: touches[0] ?? null,
      repeat: { level: null, text: "" },
      stops,
      possibleMatches: [],
      tokens: members.flatMap((member) => member.tokens ?? []),
      events: members.flatMap((member) => member.events ?? []).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt))),
      locations: members.flatMap((member) => member.locations ?? []),
      nextActionDate: nextDates[0]?.date ?? null,
      nextActionMovedFrom: null,
      nextAction: nextDates[0]?.action ?? "",
      nextStep: nextDates[0]?.action ?? "",
      followUpReasons: [],
      recordPaths: recordPathsOf(members),
      churchId: saveChurch,
      leadId: saveLead,
      contacts: contactsOf(targetMembers(members, saveChurch, saveLead)),
      deskDoNotContact: targetMembers(members, saveChurch, saveLead).some((member) => member.deskDoNotContact && !member.contextOnly),
      org: orgOf(members),
      state: members.map((member) => member.state).find(Boolean) || "",
      signals: signalsOf(members),
      leadQueue: members.some((member) => member.leadQueue)
    };
    applyRestRule(card, now);
    const nameKeys = new Set(members.map((member) => nameTownKey(member.name, member.town)).filter(Boolean));
    drafts.push({ card, nameKeys, contextOnly: members.every((member) => member.contextOnly), memberApps: [...new Set(members.map((member) => member.app))] });
  }

  // 3. Name + town is never a merge — only a "possible match" note.
  const byNameKey = new Map<string, Draft[]>();
  for (const draft of drafts) {
    for (const key of draft.nameKeys) {
      const list = byNameKey.get(key) ?? [];
      list.push(draft);
      byNameKey.set(key, list);
    }
  }
  for (const list of byNameKey.values()) {
    if (list.length < 2 || list.length > AMBIGUOUS_KEY_LIMIT) continue;
    for (const draft of list) {
      for (const other of list) {
        if (other === draft) continue;
        if (draft.card.possibleMatches.some((match) => match.name === other.card.name && match.town === other.card.town)) continue;
        const otherApps = other.memberApps;
        draft.card.possibleMatches.push({
          key: other.contextOnly ? null : other.card.key,
          name: other.card.name,
          town: other.card.town,
          apps: otherApps
        });
      }
    }
  }

  return drafts
    .filter((draft) => !draft.contextOnly)
    .map((draft) => draft.card)
    .sort(
      (a, b) =>
        (ms(b.lastTouch?.at) || 0) - (ms(a.lastTouch?.at) || 0) || a.name.localeCompare(b.name)
    );
}

// --- don't repeat ----------------------------------------------------------

/**
 * One answer per card — never "resting" and "due today" at once.
 * 1. A hard stop (do-not-contact or said no) wins over everything: no rest
 *    banner, no due date in the follow-up list.
 * 2. They replied after our last reach-out → the rest is lifted
 *    ("They replied Oct 15 — OK to follow up"); a due task stays due.
 * 3. Still resting → a due date inside the rest moves to the rest end.
 */
export function applyRestRule(card: CrmCard, now: Date): void {
  const blocked = card.stops.some((stop) => stop.reason === "suppressed" || stop.reason === "declined");
  if (blocked) {
    card.repeat = { level: null, text: "" };
    return;
  }
  card.repeat = repeatRule(card.touches, now);
  if (card.repeat.level === "hold" && card.repeat.until && card.nextActionDate) {
    const restEnd = nyDate(card.repeat.until);
    const due = dayOf(card.nextActionDate);
    if (due < restEnd) {
      card.nextActionMovedFrom = due;
      card.nextActionDate = restEnd;
    }
  }
}

export function restDaysOf(touch: Pick<Touch, "restDays">): number {
  const days = Number(touch.restDays);
  return Number.isFinite(days) && days > 0 ? days : DONT_REPEAT_DAYS;
}

export function repeatRule(touchesNewestFirst: Touch[], now: Date): CrmRepeat {
  const outreach = touchesNewestFirst.filter((touch) => touch.outreach && !Number.isNaN(ms(touch.at)));
  const last = outreach[0];
  if (!last) return { level: null, text: "" };
  const age = daysBetween(last.at, now);
  const reply = touchesNewestFirst.find((touch) => touch.signal && !touch.outreach && ms(touch.at) > ms(last.at));
  if (reply && age <= SOFT_REPEAT_DAYS) {
    return { level: "replied", text: `They replied ${friendlyDate(reply.at)} — OK to follow up.` };
  }
  // Each reach-out has its own rest (a visit 14 days, a drop-off 7). The rest
  // runs until the latest end among them.
  let holder: Touch | null = null;
  let holdEnd = Number.NEGATIVE_INFINITY;
  for (const touch of outreach) {
    const rest = restDaysOf(touch);
    const end = ms(touch.at) + rest * DAY;
    if (now.getTime() < end && end > holdEnd) {
      holder = touch;
      holdEnd = end;
    }
  }
  if (holder) {
    const until = new Date(holdEnd).toISOString();
    // A typed day ("I went on Oct 14") counts in calendar days, not hours.
    const agoOf = (touch: Touch) => {
      const days = touch.dateOnly
        ? Math.round((Date.parse(`${nyDate(now.toISOString())}T12:00:00Z`) - Date.parse(`${dayOf(touch.at)}T12:00:00Z`)) / DAY)
        : daysBetween(touch.at, now);
      return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
    };
    const heldAgo = agoOf(holder);
    // The longest rest still wins (the "until" date), but when the newest time you were
    // there was a drop-off after a visit, don't say "You visited" for that day.
    const newest = outreach[0];
    const lastThere = newest !== holder && newest.kind === "drop_off" && holder.kind === "visit";
    // In person it was you, so say so; anything an app sent is named by the app.
    const lead = lastThere
      ? `You were last there ${agoOf(newest)}.`
      : holder.kind === "visit"
        ? `You visited ${heldAgo}.`
        : holder.kind === "drop_off"
          ? `You dropped off ${holder.left || "something"} ${heldAgo}.`
          : `${CRM_APP_LABEL[holder.app]} reached out ${heldAgo}.`;
    return {
      level: "hold",
      until,
      text: `${lead} Let it rest until ${friendlyDate(until)} before any app reaches out again.`
    };
  }
  const who = CRM_APP_LABEL[last.app];
  const agoText = age <= 0 ? "today" : age === 1 ? "yesterday" : `${age} days ago`;
  const recent = outreach.filter((touch) => daysBetween(touch.at, now) <= 60);
  const replied = touchesNewestFirst.some((touch) => touch.signal && ms(touch.at) >= ms(recent[recent.length - 1]?.at));
  if (recent.length >= 2 && !replied) {
    return { level: "soon", text: `${recent.length} touches in 60 days with no reply. Go gently on a third.` };
  }
  if (age <= SOFT_REPEAT_DAYS) {
    // In person it was you ("You visited" / "You dropped something off"); anything an app sent is named by the app.
    const lead =
      last.kind === "visit"
        ? `You visited ${agoText}.`
        : last.kind === "drop_off"
          ? `You dropped something off ${agoText}.`
          : `${who} reached out ${agoText}.`;
    return { level: "soon", text: `${lead} Fine to follow up, but go gently.` };
  }
  return { level: null, text: "" };
}

// --- daily follow-up list ----------------------------------------------------

function lastTouchOf(card: CrmCard): FollowUp["lastTouch"] {
  // Only an actual reach-out — the list says "Last reached out", never a view or note.
  const touch = card.lastOutreach;
  return touch ? { app: touch.app, at: touch.at, what: touch.what } : null;
}

/**
 * Drop a line that only repeats the start of a longer one on the same row,
 * e.g. "Laser: Order placed." next to "Laser: Order placed ($38.00 not paid), …".
 * The reason tag stays; only the repeated sentence goes.
 */
export function dedupeLines(items: FollowUpItem[]): FollowUpItem[] {
  const stem = (why: string) => why.trim().replace(/[.\s]+$/, "").toLowerCase();
  return items.filter((item, index) => {
    const mine = stem(item.why);
    return !items.some((other, otherIndex) => {
      if (otherIndex === index) return false;
      const theirs = stem(other.why);
      if (theirs === mine) return otherIndex < index; // exact repeat: keep the first
      return theirs.length > mine.length && theirs.startsWith(mine);
    });
  });
}

/** "Follow up through ChurchConnect only, so Laser doesn't also reach out." */
export function followThroughStep(card: CrmCard): string {
  const app = card.lastOutreach?.app;
  if (!app) return "Follow up through one app only.";
  const others = card.apps.filter((other) => other !== app).map((other) => CRM_APP_LABEL[other]);
  const tail = others.length ? `, so ${others.join(" or ")} ${others.length === 1 ? "doesn't" : "don't"} also reach out` : "";
  return `Follow up through ${CRM_APP_LABEL[app]} only${tail}.`;
}

const STEP_ORDER: FollowUpReason[] = ["due", "unpaid", "warm", "events", "tokens", "wait"];

export type FollowUpOptions = {
  /**
   * Fail closed: when the do-not-contact list could not be read, nothing that
   * means contacting someone is suggested (no due, warm, unpaid or wait rows,
   * no next step). Only prep that touches nobody stays: events and tokens.
   */
  outreachHidden?: boolean;
};

export function buildFollowUps(cards: CrmCard[], now: Date, options: FollowUpOptions = {}): FollowUp[] {
  const today = nyDate(now);
  const out: FollowUp[] = [];

  for (const card of cards) {
    const items: FollowUpItem[] = [];
    let sortAt = "";
    const add = (reason: FollowUpReason, why: string, step: string, at: string) => {
      items.push({ reason, why, step });
      if (!sortAt || String(at).localeCompare(sortAt) < 0) sortAt = at;
    };
    // Hard stops win over everything: nothing for this card on the list.
    const blocked = card.stops.some((stop) => stop.reason === "suppressed" || stop.reason === "declined");
    card.followUpReasons = [];
    card.nextStep = card.nextAction;
    if (blocked || options.outreachHidden) {
      card.nextStep = "";
      if (blocked) continue;
    }
    const recentOutreach = card.lastOutreach ? daysBetween(card.lastOutreach.at, now) : Number.POSITIVE_INFINITY;
    const resting = card.repeat.level === "hold";
    const restingUntil = resting && card.repeat.until ? card.repeat.until : null;

    // Due — the app's own next-action date (already moved past any rest).
    if (card.nextActionDate && !options.outreachHidden) {
      const due = dayOf(card.nextActionDate);
      if (due <= today) {
        add("due", due < today ? `Next step was due ${friendlyDay(due)}.` : "Next step is due today.", card.nextAction || "Do the next step on file.", card.nextActionDate);
      }
    }

    // Warm — they did something in the last 7 days and nobody followed up.
    const signal = card.touches.find((touch) => touch.signal && !touch.outreach);
    if (signal && !options.outreachHidden && daysBetween(signal.at, now) <= WARM_DAYS) {
      const followed = card.touches.some((touch) => touch.outreach && ms(touch.at) > ms(signal.at));
      if (!followed && recentOutreach >= WAITING_MIN_DAYS) {
        add("warm", `${CRM_APP_LABEL[signal.app]}: ${signal.what}.`, card.lastOutreach ? `Follow up while it is fresh. ${followThroughStep(card)}` : "Follow up while it is fresh.", signal.at);
      }
    }

    // Not paid yet.
    for (const touch of card.touches) {
      if (touch.unpaid && !options.outreachHidden && daysBetween(touch.at, now) >= UNPAID_AFTER_DAYS) {
        add("unpaid", `${CRM_APP_LABEL[touch.app]}: ${touch.what}${touch.purchase ? ` (${touch.purchase})` : ""}, placed ${friendlyDate(touch.at)}.`, "Confirm the order and how they will pay.", touch.at);
      }
    }

    // Resting: every outreach item is held — one "wait" line instead.
    if (resting && restingUntil && !options.outreachHidden) {
      const held = items.filter((item) => OUTREACH_REASONS.includes(item.reason));
      for (const item of held) items.splice(items.indexOf(item), 1);
      const last = card.lastOutreach!;
      if (held.length || recentOutreach >= WAITING_MIN_DAYS) {
        const ago = recentOutreach <= 0 ? "today" : recentOutreach === 1 ? "yesterday" : `${recentOutreach} days ago`;
        const heldText = held.length ? ` Held: ${held.map((item) => FOLLOW_UP_LABEL[item.reason].toLowerCase()).join(", ")}.` : "";
        add(
          "wait",
          `Resting until ${friendlyDate(restingUntil)}. ${CRM_APP_LABEL[last.app]}: ${last.what}, ${ago}, no reply yet.${heldText}`,
          `Wait until ${friendlyDate(restingUntil)}. Then ${followThroughStep(card).replace(/^F/, "f")}`,
          restingUntil
        );
      }
    }

    // Tokens to print — prep, not outreach.
    const unprinted = countTokens(card.tokens, false);
    if (unprinted) {
      add("tokens", `${unprinted} token${unprinted === 1 ? "" : "s"} not printed yet.`, "Send them to the engraver, then mark them engraved in Presence.", now.toISOString());
    }

    // Upcoming events — prep, not outreach.
    for (const event of card.events) {
      const starts = ms(event.startsAt);
      if (Number.isNaN(starts) || event.status !== "open") continue;
      const inDays = (starts - now.getTime()) / DAY;
      if (inDays >= 0 && inDays <= UPCOMING_EVENT_DAYS) {
        add("events", `${event.title} on ${friendlyDate(event.startsAt!)}${event.place ? ` at ${event.place}` : ""}.`, "Make sure the place knows and tokens are ready.", event.startsAt!);
      }
    }

    if (!items.length) continue;
    items.sort((a, b) => STEP_ORDER.indexOf(a.reason) - STEP_ORDER.indexOf(b.reason));
    const reasons = [...new Set(items.map((item) => item.reason))];
    const nextStep = options.outreachHidden ? "" : items[0].step;
    const lines = dedupeLines(items);
    card.followUpReasons = reasons;
    card.nextStep = nextStep;
    out.push({
      cardKey: card.key,
      name: card.name,
      town: card.town,
      apps: card.apps,
      reasons,
      items: lines,
      nextStep,
      today: reasons.some((reason) => reason !== "wait"),
      restingUntil,
      lastTouch: lastTouchOf(card),
      sortAt
    });
  }

  return out.sort(
    (a, b) =>
      Number(b.today) - Number(a.today) ||
      STEP_ORDER.indexOf(a.reasons[0]) - STEP_ORDER.indexOf(b.reasons[0]) ||
      String(a.sortAt).localeCompare(String(b.sortAt))
  );
}

// --- links and times (shared by the page and the smoke test) -------------

/** Why an "admin" button opens the admin home instead of the record. */
export function adminHomeNote(app: CrmApp): string {
  // ChurchConnect does have a page per church; this card just has no church id.
  if (app === "churchconnect") return "Not linked to a ChurchConnect church yet, so this opens the admin home.";
  return `${CRM_APP_LABEL[app]} has no page for a single record yet, so this opens the admin home.`;
}

/** Exact record when the app supports it; otherwise the app's admin home. */
export function recordLink(app: CrmApp, card: Pick<CrmCard, "recordPaths">, adminUrls: Partial<Record<CrmApp, string>>): { href: string; exact: boolean } | null {
  const base = adminUrls[app];
  if (!base) return null;
  const path = card.recordPaths[app];
  if (!path) return { href: base, exact: false };
  if (path.startsWith("/")) {
    // Path from the app's own origin (e.g. ChurchConnect "/super-admin#crm/lead/<id>").
    // A relative admin door (handoff route on this desk) has no origin to join, so open the door.
    if (!/^https?:\/\//.test(base)) return { href: base, exact: false };
    return { href: `${new URL(base).origin}${path}`, exact: true };
  }
  return { href: `${base.replace(/#.*$/, "").replace(/\/$/, "")}${path}`, exact: true };
}

/** Real time when the record has one; date only when it was stored as a plain day. */
export function hasClockTime(at: string): boolean {
  if (/^\d{4}-\d{2}-\d{2}$/.test(at)) return false;
  // A bare midnight-UTC stamp is a date someone typed, not a moment.
  return !/T00:00(:00(\.0+)?)?(Z|\+00(:?00)?)$/.test(at);
}

