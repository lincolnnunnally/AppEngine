// CRM v1 core — pure functions only (no fetch, no env, no imports), so the
// smoke can run them on fixtures. The server reader (lpl-crm.ts) turns each
// app's EXISTING rows into CrmNodes; this file matches them into one card per
// org or person, applies the don't-repeat rule and the hard stops, and builds
// the daily follow-up list. Nothing here writes anywhere.

export type CrmApp = "churchconnect" | "laser" | "presence";

export const CRM_APP_LABEL: Record<CrmApp, string> = {
  churchconnect: "ChurchConnect",
  laser: "Laser",
  presence: "Presence"
};

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
  | "customer";

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
};

export type TokenRow = {
  label: string;
  status: string;
  printed: boolean | null; // null = retired / not counted
};

export type EventRow = {
  title: string;
  startsAt: string | null;
  status: string;
  place: string;
};

export type LocationRow = { name: string; town: string; kind: string };

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
};

export type Suppressions = { emails: Set<string>; domains: Set<string>; phones: Set<string> };

export type CrmStop = { reason: "suppressed" | "customer" | "declined"; text: string; app?: CrmApp };

export type CrmRepeat = { level: "hold" | "soon" | null; text: string; until?: string };

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
  nextAction: string;
};

export type FollowUpReason = "due" | "waiting" | "warm" | "unpaid" | "tokens" | "events";

export const FOLLOW_UP_LABEL: Record<FollowUpReason, string> = {
  due: "Due today",
  waiting: "Waiting on a reply",
  warm: "Warm, no follow-up yet",
  unpaid: "Not paid yet",
  tokens: "Tokens to print",
  events: "Upcoming events"
};

export type FollowUp = {
  reason: FollowUpReason;
  cardKey: string;
  name: string;
  town: string;
  apps: CrmApp[];
  why: string;
  step: string;
  lastTouch: { app: CrmApp; at: string; what: string } | null;
  sortAt: string;
};

export const DONT_REPEAT_DAYS = 14;
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
  "charter.net", "verizon.net", "protonmail.com", "proton.me", "gmx.com", "mail.com", "example.com", "example.org"
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

export function normPhone(value: unknown): string {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length === 10 ? digits : "";
}

function isSharedHost(host: string): boolean {
  return SHARED_HOSTS.some((shared) => host === shared || host.endsWith(`.${shared}`));
}

export function normDomain(value: unknown): string {
  let text = String(value ?? "").trim().toLowerCase();
  if (!text) return "";
  text = text.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  text = text.split(/[/?#\s]/)[0].split(":")[0];
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(text)) return "";
  if (isSharedHost(text)) return "";
  return text;
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
const APP_RANK: Record<CrmApp, number> = { churchconnect: 0, presence: 1, laser: 2 };

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
    const touches = sortTouches(members.flatMap((member) => member.touches));
    const lastOutreach = touches.find((touch) => touch.outreach) ?? null;
    const stops: CrmStop[] = [];

    const keys = members.map((member) => keyed.get(member.id)!);
    const suppressed =
      keys.some((k) => k.email.some((e) => allEmails.has(e))) ||
      keys.some((k) => k.domain.some((d) => allDomains.has(d))) ||
      keys.some((k) => k.phone.some((p) => allPhones.has(p)));
    if (suppressed) {
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
      repeat: repeatRule(touches, now),
      stops,
      possibleMatches: [],
      tokens: members.flatMap((member) => member.tokens ?? []),
      events: members.flatMap((member) => member.events ?? []).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt))),
      locations: members.flatMap((member) => member.locations ?? []),
      nextActionDate: nextDates[0]?.date ?? null,
      nextAction: nextDates[0]?.action ?? ""
    };
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

export function repeatRule(touchesNewestFirst: Touch[], now: Date): CrmRepeat {
  const outreach = touchesNewestFirst.filter((touch) => touch.outreach && !Number.isNaN(ms(touch.at)));
  const last = outreach[0];
  if (!last) return { level: null, text: "" };
  const age = daysBetween(last.at, now);
  const who = CRM_APP_LABEL[last.app];
  const agoText = age <= 0 ? "today" : age === 1 ? "yesterday" : `${age} days ago`;
  if (age < DONT_REPEAT_DAYS) {
    const until = addDaysIso(last.at, DONT_REPEAT_DAYS);
    return {
      level: "hold",
      until,
      text: `${who} reached out ${agoText}. Let it rest until ${nyDate(until)} before any app reaches out again.`
    };
  }
  const recent = outreach.filter((touch) => daysBetween(touch.at, now) <= 60);
  const replied = touchesNewestFirst.some((touch) => touch.signal && ms(touch.at) >= ms(recent[recent.length - 1]?.at));
  if (recent.length >= 2 && !replied) {
    return { level: "soon", text: `${recent.length} touches in 60 days with no reply. Go gently on a third.` };
  }
  if (age <= SOFT_REPEAT_DAYS) {
    return { level: "soon", text: `${who} reached out ${agoText}. Fine to follow up, but go gently.` };
  }
  return { level: null, text: "" };
}

// --- daily follow-up list ----------------------------------------------------

function lastTouchOf(card: CrmCard): FollowUp["lastTouch"] {
  const touch = card.lastOutreach ?? card.lastTouch;
  return touch ? { app: touch.app, at: touch.at, what: touch.what } : null;
}

export function buildFollowUps(cards: CrmCard[], now: Date): FollowUp[] {
  const today = nyDate(now);
  const out: FollowUp[] = [];
  const push = (card: CrmCard, reason: FollowUpReason, why: string, step: string, sortAt: string) =>
    out.push({ reason, cardKey: card.key, name: card.name, town: card.town, apps: card.apps, why, step, lastTouch: lastTouchOf(card), sortAt });

  for (const card of cards) {
    const suppressed = card.stops.some((stop) => stop.reason === "suppressed");
    const declined = card.stops.some((stop) => stop.reason === "declined");
    const outreachBlocked = suppressed || declined;
    const recentOutreach = card.lastOutreach ? daysBetween(card.lastOutreach.at, now) : Number.POSITIVE_INFINITY;

    // Due today — the app's own next-action date.
    if (card.nextActionDate && !declined && !suppressed) {
      const due = card.nextActionDate.slice(0, 10);
      if (due <= today) {
        push(card, "due", due < today ? `Next step was due ${due}.` : "Next step is due today.", card.nextAction || "Do the next step on file.", card.nextActionDate);
      }
    }

    // Waiting on a reply — reached out 3–14 days ago and heard nothing since.
    if (card.lastOutreach && !outreachBlocked) {
      const age = recentOutreach;
      const since = ms(card.lastOutreach.at);
      const heard = card.touches.some((touch) => touch.signal && ms(touch.at) >= since);
      if (age >= WAITING_MIN_DAYS && age <= DONT_REPEAT_DAYS && !heard) {
        push(
          card,
          "waiting",
          `${CRM_APP_LABEL[card.lastOutreach.app]}: ${card.lastOutreach.what} — ${age} days, no reply yet.`,
          age < DONT_REPEAT_DAYS ? "Check in with the same app that reached out. No second app yet." : "A gentle check-in is fine now.",
          card.lastOutreach.at
        );
      }
    }

    // Warm — they did something in the last 7 days and nobody followed up.
    const signal = card.touches.find((touch) => touch.signal && !touch.outreach);
    if (signal && !outreachBlocked && daysBetween(signal.at, now) <= WARM_DAYS) {
      const followed = card.touches.some((touch) => touch.outreach && ms(touch.at) > ms(signal.at));
      if (!followed && recentOutreach >= WAITING_MIN_DAYS) {
        push(card, "warm", `${CRM_APP_LABEL[signal.app]}: ${signal.what}.`, "Follow up while it is fresh.", signal.at);
      }
    }

    // Not paid yet.
    for (const touch of card.touches) {
      if (touch.unpaid && daysBetween(touch.at, now) >= UNPAID_AFTER_DAYS) {
        push(card, "unpaid", `${CRM_APP_LABEL[touch.app]}: ${touch.what}${touch.purchase ? ` (${touch.purchase})` : ""}, placed ${nyDate(touch.at)}.`, "Confirm the order and how they will pay.", touch.at);
      }
    }

    // Tokens to print.
    const unprinted = card.tokens.filter((token) => token.printed === false);
    if (unprinted.length) {
      push(
        card,
        "tokens",
        `${unprinted.length} token${unprinted.length === 1 ? "" : "s"} not printed yet.`,
        "Send them to the engraver, then mark them engraved in Presence.",
        now.toISOString()
      );
    }

    // Upcoming events.
    for (const event of card.events) {
      const starts = ms(event.startsAt);
      if (Number.isNaN(starts) || event.status !== "open") continue;
      const inDays = (starts - now.getTime()) / DAY;
      if (inDays >= 0 && inDays <= UPCOMING_EVENT_DAYS) {
        push(card, "events", `${event.title} on ${nyDate(event.startsAt!)}${event.place ? ` at ${event.place}` : ""}.`, "Make sure the place knows and tokens are ready.", event.startsAt!);
      }
    }
  }

  const order: FollowUpReason[] = ["due", "warm", "waiting", "unpaid", "events", "tokens"];
  return out.sort(
    (a, b) => order.indexOf(a.reason) - order.indexOf(b.reason) || String(a.sortAt).localeCompare(String(b.sortAt))
  );
}
