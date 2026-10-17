// CRM reader — ChurchConnect, Laser, and Presence, read from the tables
// those apps ALREADY write in the shared database. No new tables, no writes,
// nothing sent. Same pattern as lpl-ops-stats.ts: SERVER ONLY, the service key
// never leaves this module, and nothing here logs a row. Contact details are
// used to match records; church contacts are passed to the page, which strips
// their email and phone for anyone but the owner. Saving lives in
// lpl-crm-write.ts (through ChurchConnect's own CRM routes).
import crypto from "node:crypto";
import {
  DONT_REPEAT_DAYS,
  DROP_OFF_REST_DAYS,
  VISIT_REST_DAYS,
  buildCards,
  buildFollowUps,
  countTokens,
  normDomain,
  normEmail,
  normPhone,
  scrubContact,
  shortPersonName,
  type CrmApp,
  type CrmCard,
  type CrmContact,
  type CrmNode,
  type CrmOrg,
  type FollowUp,
  type Suppressions,
  type TokenRow,
  type Touch
} from "@/lib/engine/lpl-crm-core";
import { BUSINESS_OFFER_IDS, cleanChurchOfferIds } from "@/lib/engine/church-offer-rule";
import { AV_LIST_SIZE, AV_RINGS_MILES, groupMateLookups, rankAvProspects, tierRingFilters, wideNameLookupBlock, type AvProspect, type AvRow, type AvTierIndex } from "@/lib/engine/av-prospects-core";
import { getPortfolioUrlStatusBoard } from "@/lib/engine/portfolio-url-status";
import { resolveAdminDoor } from "@/lib/engine/app-ops-catalog";

type LplConfig = { url: string; serviceKey: string };

function getLplConfig(): LplConfig | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}

export function lplCrmConfigured(): boolean {
  return getLplConfig() !== null;
}

type Row = Record<string, unknown>;

export type CrmSourceStatus = { id: string; label: string; app: CrmApp | "shared"; ok: boolean; rows: number };

// GET only. A failed read is reported as "could not read", never as zero.
async function readRows(
  config: LplConfig,
  table: string,
  query: string,
  sources: CrmSourceStatus[],
  meta: { label: string; app: CrmApp | "shared" }
): Promise<Row[]> {
  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
      method: "GET",
      headers: {
        apikey: config.serviceKey,
        authorization: `Bearer ${config.serviceKey}`,
        "accept-profile": "public"
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      sources.push({ id: table, label: meta.label, app: meta.app, ok: false, rows: 0 });
      return [];
    }
    const data = (await response.json()) as unknown;
    const rows = Array.isArray(data) ? (data as Row[]) : [];
    const existing = sources.find((source) => source.id === table);
    if (existing) existing.rows += rows.length;
    else sources.push({ id: table, label: meta.label, app: meta.app, ok: true, rows: rows.length });
    return rows;
  } catch {
    sources.push({ id: table, label: meta.label, app: meta.app, ok: false, rows: 0 });
    return [];
  }
}

const s = (value: unknown): string => (value === null || value === undefined ? "" : String(value).trim());
const truthy = (value: unknown): boolean => value === true || s(value).toLowerCase() === "true";
const money = (value: unknown): string => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : "";
};
const quoteList = (values: string[]): string =>
  values.map((value) => `"${value.replace(/["\\]/g, "")}"`).join(",");
const isoDaysAgo = (days: number, now: Date): string => new Date(now.getTime() - days * 86_400_000).toISOString();

// Mirrors Laser's own test-order rule (LaserEngraving src/lib/adminPeople.ts).
const TEST_EMAIL = /(^|[+._-])(test|qa)([+._@-]|$)|@(example\.(com|org|net)|test\.com|mailinator\.com)$/i;
const TEST_TEXT = /\b(test|qa)\b/i;
function isTestOrder(row: Row): boolean {
  if (TEST_EMAIL.test(s(row.customer_email))) return true;
  if (TEST_TEXT.test(s(row.customer_name))) return true;
  if (TEST_TEXT.test(s(row.order_number))) return true;
  return /\[(test|qa)\]|^\s*(test|qa)\b/i.test(s(row.notes));
}

// cc_* tables store each record in a jsonb `doc`. Select only what CRM needs.
const CHURCH_FIELDS = [
  "name", "church_name", "city", "state", "slug", "site_slug", "email", "primary_email", "pastor_email",
  "office_email", "secretary_email", "customer_email", "phone", "phone_office", "phone_cell", "website", "domain",
  "crm_status", "crm_next_action", "crm_next_action_date", "invite_status", "last_invited_at", "invite_campaign",
  "website_offer_status", "is_customer", "signed_up", "converted_at", "merged_into", "duplicate_of", "deleted_at",
  "active", "updated_at", "pastor_name", "pastor_phone", "secretary_name", "secretary_title", "secretary_phone",
  "contact_name", "contact_role", "do_not_contact", "do_not_contact_source", "do_not_contact_desk_claim"
];
const CHURCH_SELECT = `select=id,${CHURCH_FIELDS.map((field) => `${field}:doc->>${field}`).join(",")},staff_contacts:doc->staff_contacts,crm_offers:doc->crm_offers`;
const CHURCH_TOUCHED = [
  "doc->>crm_status.not.is.null",
  "doc->>crm_next_action_date.not.is.null",
  "doc->>last_invited_at.not.is.null",
  "doc->>invite_status.in.(sent,accepted,failed)",
  "doc->>site_slug.not.is.null",
  "doc->>website_offer_status.not.is.null",
  "doc->>is_customer.eq.true",
  "doc->>signed_up.eq.true"
].join(",");

function inviteWhat(row: Row): string {
  const campaign = s(row.invite_campaign);
  return campaign ? `Invite sent (${campaign.replace(/[-_]+/g, " ")})` : "Invite sent";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTACT_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

const contactText = (value: unknown, limit: number) => s(value).replace(/\s+/g, " ").trim().slice(0, limit);

/**
 * Same id ChurchConnect gives an older saved contact that has none
 * (backend/utils/crm_staff_contacts.py stable_contact_id), so an edit from the
 * desk lands on the same person.
 */
export function stableContactId(contact: Row): string {
  const basis = ["name", "email", "phone", "role"].map((key) => contactText(contact[key], 200).toLowerCase()).join("|");
  return `sc-${crypto.createHash("sha1").update(basis, "utf8").digest("hex").slice(0, 12)}`;
}

function churchContacts(row: Row, churchId: string): CrmContact[] {
  const out: CrmContact[] = [];
  const saved = Array.isArray(row.staff_contacts) ? (row.staff_contacts as Row[]) : [];
  for (const item of saved) {
    if (!item || typeof item !== "object") continue;
    const name = contactText(item.name, 120);
    if (!name) continue;
    const id = CONTACT_ID_RE.test(s(item.id)) ? s(item.id) : stableContactId(item);
    out.push({ id, name, title: contactText(item.role ?? item.title, 80), email: normEmail(item.email), phone: contactText(item.phone, 40), source: "saved" });
  }
  const builtIn: Array<[CrmContact["source"], unknown, string, unknown, unknown]> = [
    ["pastor", row.pastor_name, "Pastor", row.pastor_email, row.pastor_phone],
    ["secretary", row.secretary_name, s(row.secretary_title) || "Secretary", row.secretary_email, row.secretary_phone],
    ["contact", row.contact_name, s(row.contact_role), "", ""]
  ];
  for (const [source, rawName, title, email, phone] of builtIn) {
    const name = contactText(rawName, 120);
    if (!name || out.some((contact) => contact.name.toLowerCase() === name.toLowerCase())) continue;
    out.push({ id: `cc-${source}-${churchId}`.slice(0, 64), name, title: contactText(title, 80), email: normEmail(email), phone: contactText(phone, 40), source });
  }
  return out;
}

function churchNode(row: Row, contextOnly: boolean): CrmNode | null {
  if (s(row.merged_into) || s(row.deleted_at) || s(row.active) === "false") return null;
  const id = s(row.id);
  const status = s(row.crm_status).toLowerCase();
  const touches: Touch[] = [];
  const invitedAt = s(row.last_invited_at);
  const inviteStatus = s(row.invite_status);
  if (invitedAt) {
    touches.push({
      at: invitedAt,
      app: "churchconnect",
      kind: "invite",
      what: inviteStatus === "failed" ? "Invite did not send" : inviteWhat(row),
      outreach: inviteStatus !== "failed",
      response: inviteStatus === "accepted" ? "Accepted the invite" : undefined
    });
  }
  const converted = s(row.converted_at);
  if (converted) {
    touches.push({ at: converted, app: "churchconnect", kind: "customer", what: "Became a ChurchConnect customer", outreach: false, signal: true, purchase: "Customer" });
  }
  const customer = truthy(row.is_customer) || truthy(row.signed_up) || inviteStatus === "accepted";
  const open = status !== "won" && status !== "lost";
  return {
    id: `cc:church:${id}`,
    app: "churchconnect",
    // ChurchConnect opens one church's lead panel at /super-admin#crm/lead/<church id>:
    // SuperAdminDashboard (route /super-admin) reads the hash section "crm" and mounts
    // SalesCRMDashboard, whose syncLeadFromHash selects the lead (GET /api/church-crm/leads/{id}).
    // Its /admin route is a different portal (AdminPortal) that ignores the hash.
    recordPath: UUID_RE.test(id) ? `/super-admin#crm/lead/${id}` : undefined,
    kind: "org",
    name: s(row.name) || s(row.church_name) || "Church",
    town: [s(row.city), s(row.state)].filter(Boolean).join(", "),
    emails: [row.email, row.primary_email, row.pastor_email, row.office_email, row.secretary_email, row.customer_email].map(s),
    domains: [row.website, row.domain].map(s),
    phones: [row.phone, row.phone_office, row.phone_cell].map(s),
    links: [],
    touches,
    customerOf: customer ? ["churchconnect"] : [],
    declined: truthy(row.do_not_contact)
      ? s(row.do_not_contact_source) === "email_unsubscribe"
        ? "Opted out. Do not reach out from any app."
        : "Asked not to be contacted. Do not reach out from any app."
      : status === "lost"
        ? "Marked lost in the ChurchConnect pipeline. Do not pitch again."
        : undefined,
    nextActionDate: open ? s(row.crm_next_action_date) || null : null,
    nextAction: scrubContact(row.crm_next_action, 120),
    contextOnly,
    churchId: UUID_RE.test(id) ? id : undefined,
    contacts: churchContacts(row, id),
    // The desk's own claim (it may sit next to a real reason such as an email unsubscribe).
    deskDoNotContact: UUID_RE.test(id) && (truthy(row.do_not_contact_desk_claim) || (truthy(row.do_not_contact) && s(row.do_not_contact_source) === "crm_visit")),
    org: UUID_RE.test(id) ? churchOrg(row, id) : undefined
  };
}

function churchOrg(row: Row, id: string): CrmOrg {
  return {
    kind: "church",
    id,
    name: s(row.name) || s(row.church_name),
    city: s(row.city),
    state: s(row.state),
    website: s(row.website),
    phone: contactText(row.phone, 40),
    email: normEmail(row.email),
    offers: cleanChurchOfferIds(row.crm_offers)
  };
}

export const OP_LEAD_SELECT = "select=id,slug,business_name,category,city,state,phone,email,website_url,status,signals,services,contacts,created_at,updated_at";
export const OP_LEAD_ACTIVITY_SELECT = "select=id,lead_id,type,occurred_at,contact,left_item,outcome_code,outcome,next_step,next_action_date,created_at";

/** op_leads.contacts (same shape as ChurchConnect staff_contacts); every one is editable from the desk. */
function leadContactList(value: unknown): CrmContact[] {
  const out: CrmContact[] = [];
  for (const item of Array.isArray(value) ? (value as Row[]) : []) {
    if (!item || typeof item !== "object") continue;
    const name = contactText(item.name, 120);
    if (!name) continue;
    const id = CONTACT_ID_RE.test(s(item.id)) ? s(item.id) : stableContactId(item);
    out.push({ id, name, title: contactText(item.role ?? item.title, 80), email: normEmail(item.email), phone: contactText(item.phone, 40), source: "saved" });
  }
  return out;
}

/** A business prospect (op_leads). The desk is its only writer today. */
function reasonsFor(row: Row, index?: SuppressionReasonIndex): string[] {
  if (!index) return [];
  return [
    ...(index.emails.get(normEmail(row.email)) ?? []),
    ...(index.domains.get(normDomain(row.website_url)) ?? []),
    ...(index.phones.get(normPhone(row.phone)) ?? [])
  ];
}

/** Why a suppressed business is stopped, by the list rows that match it. */
export type SuppressionReasonIndex = { emails: Map<string, string[]>; domains: Map<string, string[]>; phones: Map<string, string[]> };

export function suppressionReasonIndex(rows: Row[]): SuppressionReasonIndex {
  const index: SuppressionReasonIndex = { emails: new Map(), domains: new Map(), phones: new Map() };
  const put = (map: Map<string, string[]>, key: string, reason: string) => {
    if (key) map.set(key, [...(map.get(key) ?? []), reason]);
  };
  for (const row of rows) {
    const reason = s(row.reason).toLowerCase();
    put(index.emails, normEmail(row.email), reason);
    put(index.domains, normDomain(row.domain), reason);
    put(index.phones, normPhone(row.phone), reason);
  }
  return index;
}

/** The stop line for a suppressed business, worded by why: asked, opted out, or bounced. */
export function businessStopText(signals: Row, reasons: string[]): string {
  const set = new Set(reasons);
  if (s(signals.dnc_source) === "crm_visit" || set.has("do_not_contact") || set.has("manual")) {
    return "Asked not to be contacted. Do not reach out from any app.";
  }
  if (set.has("opt_out") || set.has("complaint")) return "Opted out. Do not reach out from any app.";
  if (set.has("bounce")) return "Email bounced. Do not reach out from any app until the address is fixed.";
  return "On the do-not-contact list. Do not reach out from any app.";
}

export function businessNode(row: Row, reasons?: SuppressionReasonIndex): CrmNode | null {
  const id = s(row.id);
  if (!UUID_RE.test(id)) return null;
  const status = s(row.status).toLowerCase();
  const signals = row.signals && typeof row.signals === "object" ? (row.signals as Row) : {};
  // The services column (slice 3) wins; older rows only have signals.services.
  const column = Array.isArray(row.services) ? row.services.map((value) => s(value)) : [];
  const services = column.length ? column : Array.isArray(signals.services) ? signals.services.map((value) => s(value)) : [];
  const created = s(row.created_at);
  return {
    id: `op:lead:${id}`,
    app: "business",
    kind: "org",
    name: s(row.business_name) || "Business",
    town: [s(row.city), s(row.state)].filter(Boolean).join(", "),
    emails: [s(row.email)],
    domains: [s(row.website_url)],
    phones: [s(row.phone)],
    links: [],
    touches: created ? [{ at: created, app: "business", kind: "note", what: "Added as a business lead", outreach: false }] : [],
    customerOf: [],
    declined:
      status === "suppressed"
        ? businessStopText(signals, reasonsFor(row, reasons))
        : status === "declined"
          ? "Said no as a business lead. Do not pitch again."
          : undefined,
    leadId: id,
    contacts: leadContactList(row.contacts),
    deskDoNotContact: status === "suppressed" && s(signals.dnc_source) === "crm_visit",
    org: {
      kind: "business",
      id,
      name: s(row.business_name),
      city: s(row.city),
      state: s(row.state),
      website: s(row.website_url),
      phone: contactText(row.phone, 40),
      email: normEmail(row.email),
      offers: BUSINESS_OFFER_IDS.filter((offer) => services.includes(offer)),
      version: s(row.updated_at)
    }
  };
}

const OUTCOME_LABEL: Record<string, string> = {
  interested: "Interested",
  follow_up: "Follow up",
  not_now: "Not right now",
  do_not_contact: "Asked not to be contacted"
};

/** A visit or drop-off logged on a church (lead panel or this desk). */
function visitTouch(row: Row, type: "visit" | "drop_off", app: CrmApp = "churchconnect"): Touch | null {
  const occurred = s(row.occurred_at);
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(occurred);
  // A typed day counts from noon Eastern so the rest ends on the right calendar day.
  const at = dayOnly ? `${occurred}T16:00:00.000Z` : occurred || s(row.at) || s(row.created_at);
  if (!at || Number.isNaN(Date.parse(at))) return null;
  const contact = row.contact && typeof row.contact === "object" ? (row.contact as Row) : null;
  const met = contact ? shortPersonName(contact.name) : "";
  const title = contact ? scrubContact(contact.title, 40) : "";
  const parts = [
    type === "visit" ? "Visit" : "Drop-off",
    met ? `met ${met}${title ? ` (${title})` : ""}` : "",
    s(row.left_item) ? `left ${scrubContact(row.left_item, 60)}` : "",
    s(row.next_step) ? `next: ${scrubContact(row.next_step, 60)}` : ""
  ].filter(Boolean);
  const outcome = [OUTCOME_LABEL[s(row.outcome_code)] || "", scrubContact(row.outcome, 60)].filter(Boolean).join(" — ");
  return {
    at,
    app,
    kind: type,
    what: scrubContact(parts.join(", "), 160),
    outreach: true,
    response: outcome || undefined,
    restDays: type === "drop_off" ? DROP_OFF_REST_DAYS : VISIT_REST_DAYS,
    dateOnly: dayOnly || undefined,
    left: s(row.left_item) ? scrubContact(row.left_item, 60) : undefined
  };
}

const LEAD_DAY_RE = /^(\d{4}-\d{2}-\d{2})T16:00:00(?:\.0+)?(?:Z|\+00:00|\+00)$/;

/**
 * Business visit log (op_lead_activities) onto its lead's node: visits and
 * drop-offs start the same rest as a church (14 / 7 days); the newest entry
 * that set a next step is the lead's next step (as a church's next action).
 */
export function leadActivityNodes(rows: Row[], nodes: Map<string, CrmNode>): CrmNode[] {
  const touched: CrmNode[] = [];
  const newest = new Map<string, Row>();
  for (const row of rows) {
    const node = nodes.get(`op:lead:${s(row.lead_id)}`);
    if (!node) continue;
    // The desk stores a typed day as noon Eastern; show it as that calendar day.
    const occurred = s(row.occurred_at);
    const day = LEAD_DAY_RE.exec(occurred)?.[1];
    const entry = day ? { ...row, occurred_at: day } : row;
    const type = s(row.type).toLowerCase();
    if (type === "visit" || type === "drop_off") {
      const touch = visitTouch(entry, type, "business");
      if (touch) node.touches.push(touch);
    } else {
      const at = occurred || s(row.created_at);
      if (at) {
        node.touches.push({
          at,
          app: "business",
          kind: type === "email" ? "email" : type === "call" ? "call" : "note",
          what: scrubContact([type === "note" ? "Note" : type, s(row.outcome)].filter(Boolean).join(": "), 120),
          outreach: ["call", "email", "meeting"].includes(type)
        });
      }
    }
    // Like a church's next action: the newest entry that set a next step keeps it until a later one replaces it.
    const key = s(row.lead_id);
    const seen = newest.get(key);
    if (s(row.next_action_date) && (!seen || (s(row.created_at) || s(row.occurred_at)) > (s(seen.created_at) || s(seen.occurred_at)))) newest.set(key, row);
    touched.push(node);
  }
  for (const [leadId, row] of newest) {
    const node = nodes.get(`op:lead:${leadId}`);
    if (!node || node.declined) continue;
    const due = s(row.next_action_date);
    node.nextActionDate = /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null;
    node.nextAction = node.nextActionDate ? scrubContact(row.next_step, 120) : "";
  }
  return touched;
}

export type CrmSnapshot = {
  configured: boolean;
  generatedAt: string;
  cards: CrmCard[];
  followUps: FollowUp[];
  sources: CrmSourceStatus[];
  adminUrls: Partial<Record<CrmApp, string>>;
  presence: { tokens: number; printed: number; notPrinted: number; events: number; places: number };
  /** true = the do-not-contact list could not be read, so outreach suggestions are hidden. */
  outreachHidden: boolean;
};

function adminUrls(): Partial<Record<CrmApp, string>> {
  const board = getPortfolioUrlStatusBoard();
  const out: Partial<Record<CrmApp, string>> = {};
  const pairs: Array<[CrmApp, string]> = [
    ["churchconnect", "churchconnect"],
    ["laser", "laser-engrave-market"],
    ["presence", "presence"]
  ];
  for (const [app, slug] of pairs) {
    const entry = board.entries.find((item) => item.slug === slug);
    const door = resolveAdminDoor(slug, entry?.servingUrl || null);
    if (door?.url) out[app] = door.url;
  }
  return out;
}

function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

// Presence: tokens count as "printed" once the coin reaches engraved (or was
// released / found after that). This is Presence's own status column — the
// app has no separate "printed" field.
const PRINTED_STATUSES = new Set(["engraved", "released", "found"]);
const NOT_PRINTED_STATUSES = new Set(["drafted", "approved"]);

function tokenPrinted(status: string): boolean | null {
  if (PRINTED_STATUSES.has(status)) return true;
  if (NOT_PRINTED_STATUSES.has(status)) return false;
  return null;
}

export async function loadCrmSnapshot(now = new Date()): Promise<CrmSnapshot> {
  const config = getLplConfig();
  const empty: CrmSnapshot = {
    configured: false,
    generatedAt: now.toISOString(),
    cards: [],
    followUps: [],
    sources: [],
    adminUrls: adminUrls(),
    presence: { tokens: 0, printed: 0, notPrinted: 0, events: 0, places: 0 },
    outreachHidden: false
  };
  if (!config) return empty;

  const sources: CrmSourceStatus[] = [];
  const read = (table: string, query: string, label: string, app: CrmApp | "shared") =>
    readRows(config, table, query, sources, { label, app });

  const [
    churches,
    siteInvites,
    activities,
    invites,
    emailLog,
    forViews,
    places,
    samples,
    orders,
    customers,
    pPlaces,
    pBatches,
    pCoins,
    pMoments,
    pScans,
    suppressionRows,
    opLeads,
    leadActivities
  ] = await Promise.all([
    read("cc_churches", `${CHURCH_SELECT}&or=(${CHURCH_TOUCHED})&limit=1500`, "Churches in the pipeline", "churchconnect"),
    read("cc_site_invites", "select=id,church_id:doc->>church_id,slug:doc->>slug,updated_at:doc->>updated_at,created_at&limit=1000", "Website preview pages", "churchconnect"),
    read(
      "cc_church_crm_activities",
      "select=id,church_id:doc->>church_id,lead_id:doc->>lead_id,type:doc->>type,activity_type:doc->>activity_type,description:doc->>description,at:doc->>created_at,occurred_at:doc->>occurred_at,contact:doc->contact,left_item:doc->>left_item,outcome:doc->>outcome,outcome_code:doc->>outcome_code,next_step:doc->>next_step,created_at&order=created_at.desc&limit=1000",
      "Church activity log",
      "churchconnect"
    ),
    read(
      "cc_invites",
      "select=id,target_type:doc->>target_type,target_name:doc->>target_name,target_email:doc->>target_email,target_phone:doc->>target_phone,campaign:doc->>campaign,status:doc->>status,channel:doc->>channel,sent_at:doc->>sent_at,accepted_at:doc->>accepted_at,created_at&order=created_at.desc&limit=1000",
      "Invites",
      "churchconnect"
    ),
    read(
      "cc_email_log",
      `select=id,church_id:doc->>church_id,subject:doc->>subject,status:doc->>status,created_at&doc->>church_id=not.is.null&created_at=gte.${isoDaysAgo(120, now)}&order=created_at.desc&limit=1000`,
      "Emails to churches",
      "churchconnect"
    ),
    read(
      "lpl_events",
      `select=path,created_at&app_slug=eq.churchconnect&path=like./for/*&created_at=gte.${isoDaysAgo(30, now)}&order=created_at.desc&limit=2000`,
      "Website preview page visits",
      "churchconnect"
    ),
    read("drop_places", "select=id,slug,name,display_name,kind,town,website_url,claimed_email,churchconnect_url,status&limit=1000", "Catalog places", "laser"),
    read("drop_samples", "select=id,place_id,sku,landing,status,received_by,dropped_at,left_at,created_at&limit=2000", "Samples left with people", "laser"),
    read(
      "orders",
      "select=id,order_number,customer_id,customer_email,customer_name,customer_phone,total_amount,status,paid_at,payment_method,sample_code,notes,created_at&order=created_at.desc&limit=1000",
      "Orders",
      "laser"
    ),
    read("customers", "select=id,email,name,phone,created_at&limit=2000", "Customers", "laser"),
    read("presence_places", "select=id,name,kind,city,state,phone,website,contact_email,status&status=neq.retired&limit=1000", "Places", "presence"),
    read("presence_coin_batches", "select=id,name,city,state,quantity,status,created_at&limit=1000", "Token batches", "presence"),
    read("presence_coins", "select=id,batch_id,serial,code,kind,place_id,moment_id,status,released_where,released_at,found_at,created_at&limit=5000", "Tokens", "presence"),
    read("presence_moments", "select=id,title,activity,kind,starts_at,place,city,state,place_id,coin_batch_id,status,created_at&limit=1000", "Events", "presence"),
    read("presence_coin_scans", "select=coin_id,kind,created_at&order=created_at.desc&limit=5000", "Token scans", "presence"),
    read("outreach_suppressions", "select=email,domain,phone,reason&limit=5000", "Do-not-contact list", "shared"),
    read("op_leads", `${OP_LEAD_SELECT}&order=created_at.desc&limit=1000`, "Business leads", "business"),
    read("op_lead_activities", `${OP_LEAD_ACTIVITY_SELECT}&order=occurred_at.desc&limit=2000`, "Business visit log", "business")
  ]);

  const nodes = new Map<string, CrmNode>();
  const add = (node: CrmNode | null) => {
    if (!node) return;
    const existing = nodes.get(node.id);
    if (!existing) {
      nodes.set(node.id, node);
      return;
    }
    // Same record from two rows (e.g. a Laser customer and their order):
    // keep every identity key so matching and the do-not-contact check see them all.
    existing.contextOnly = existing.contextOnly && node.contextOnly;
    existing.touches.push(...node.touches);
    for (const key of ["emails", "domains", "phones", "links"] as const) {
      existing[key] = [...new Set([...existing[key], ...node[key]])];
    }
    if (node.customerOf?.length) existing.customerOf = [...new Set([...(existing.customerOf ?? []), ...node.customerOf])];
    existing.declined = existing.declined || node.declined;
    if (node.nextActionDate && (!existing.nextActionDate || node.nextActionDate < existing.nextActionDate)) {
      existing.nextActionDate = node.nextActionDate;
      existing.nextAction = node.nextAction;
    }
    if (node.tokens?.length) existing.tokens = [...(existing.tokens ?? []), ...node.tokens];
    if (node.events?.length) existing.events = [...(existing.events ?? []), ...node.events];
    if (node.locations?.length) existing.locations = [...(existing.locations ?? []), ...node.locations];
    existing.recordPath = existing.recordPath || node.recordPath;
    if (!existing.town && node.town) existing.town = node.town;
  };

  // --- ChurchConnect ---------------------------------------------------------
  for (const row of churches) add(churchNode(row, false));

  // --- Business leads (op_leads) ---------------------------------------------
  const reasonIndex = suppressionReasonIndex(suppressionRows);
  for (const row of opLeads) add(businessNode(row, reasonIndex));
  leadActivityNodes(leadActivities, nodes);

  // Churches the logs point at that the pipeline query did not return.
  const wanted = new Set<string>();
  for (const row of [...siteInvites, ...activities, ...emailLog]) {
    const id = s(row.church_id) || s(row.lead_id);
    if (id && !nodes.has(`cc:church:${id}`)) wanted.add(id);
  }
  for (const ids of chunk([...wanted], 80)) {
    const rows = await read("cc_churches", `${CHURCH_SELECT}&id=in.(${quoteList(ids)})`, "Churches in the pipeline", "churchconnect");
    for (const row of rows) add(churchNode(row, false));
  }

  const churchBySlug = new Map<string, string>();
  for (const row of churches) {
    const id = `cc:church:${s(row.id)}`;
    for (const slug of [s(row.site_slug), s(row.slug)]) if (slug) churchBySlug.set(slug.toLowerCase(), id);
  }

  const church = (id: string): CrmNode | undefined => (id ? nodes.get(`cc:church:${id}`) : undefined);

  for (const row of siteInvites) {
    const node = church(s(row.church_id));
    const slug = s(row.slug);
    if (slug) churchBySlug.set(slug.toLowerCase(), `cc:church:${s(row.church_id)}`);
    if (!node) continue;
    const at = s(row.updated_at) || s(row.created_at);
    if (at) {
      node.touches.push({ at, app: "churchconnect", kind: "site_page", what: `Made a website preview page (/for/${slug})`, outreach: false });
    }
  }
  // An offer marked "sent" counts as reaching out, dated by its preview page.
  for (const row of churches) {
    if (s(row.website_offer_status) !== "sent") continue;
    const node = church(s(row.id));
    const page = siteInvites.find((invite) => s(invite.church_id) === s(row.id));
    const at = s(page?.updated_at) || s(row.updated_at);
    if (node && at) node.touches.push({ at, app: "churchconnect", kind: "site_offer", what: "Website offer sent", outreach: true });
  }

  const OUTREACH_ACTIVITY = new Set(["invite", "email", "call", "sms", "visit", "drop_off", "meeting", "text"]);
  for (const row of activities) {
    const node = church(s(row.church_id) || s(row.lead_id));
    const type = s(row.type).toLowerCase() || s(row.activity_type).toLowerCase();
    if (node && (type === "visit" || type === "drop_off")) {
      const touch = visitTouch(row, type);
      if (touch) {
        node.touches.push(touch);
        continue;
      }
    }
    const at = s(row.at) || s(row.created_at);
    if (!node || !at) continue;
    const outreach = OUTREACH_ACTIVITY.has(type) && !/FAILED|did not send/i.test(s(row.description));
    if (type === "invite" && node.touches.some((touch) => touch.kind === "invite" && touch.at.slice(0, 16) === at.slice(0, 16))) continue;
    const label = type === "status_change" ? "Pipeline step changed" : type === "created" ? "Added to the pipeline" : type === "merge" ? "Duplicate merged" : type === "note" ? "Note" : type || "Activity";
    node.touches.push({
      at,
      app: "churchconnect",
      kind: type === "email" ? "email" : type === "call" ? "call" : type === "invite" ? "invite" : "note",
      what: scrubContact(s(row.description) ? `${label}: ${s(row.description)}` : label, 120),
      outreach
    });
  }

  for (const row of emailLog) {
    const node = church(s(row.church_id));
    const at = s(row.created_at);
    if (!node || !at) continue;
    const status = s(row.status);
    if (status === "queued") continue;
    node.touches.push({
      at,
      app: "churchconnect",
      kind: "email",
      what: status === "failed" ? "Email did not send" : `Email: ${scrubContact(row.subject, 80) || "(no subject)"}`,
      outreach: status === "sent"
    });
  }

  for (const row of invites) {
    const email = normEmail(row.target_email);
    const phone = normPhone(row.target_phone);
    if (!email && !phone) continue;
    const type = s(row.target_type);
    const status = s(row.status);
    const accepted = s(row.accepted_at);
    const at = s(row.sent_at) || s(row.created_at);
    const touches: Touch[] = [];
    if (at) {
      touches.push({
        at,
        app: "churchconnect",
        kind: "invite",
        what: `${status === "failed" ? "Invite did not send" : "Invite sent"}${s(row.channel) ? ` by ${s(row.channel) === "sms" ? "text" : s(row.channel)}` : ""}${s(row.campaign) ? ` (${s(row.campaign).replace(/[-_]+/g, " ")})` : ""}`,
        outreach: status !== "failed"
      });
    }
    if (accepted) touches.push({ at: accepted, app: "churchconnect", kind: "invite", what: "Accepted the invite", outreach: false, signal: true });
    add({
      id: `cc:invite:${s(row.id)}`,
      app: "churchconnect",
      kind: type === "individual" ? "person" : "org",
      name: type === "individual" ? shortPersonName(row.target_name) || "Someone invited" : s(row.target_name) || "Invited church",
      town: "",
      emails: [email],
      domains: [],
      phones: [phone],
      links: [],
      touches,
      customerOf: accepted ? ["churchconnect"] : []
    });
  }

  // Website preview page visits → warm signal on that church, one per day.
  const viewsByChurchDay = new Map<string, { id: string; day: string; at: string; count: number; slug: string }>();
  for (const row of forViews) {
    const slug = s(row.path).split("/")[2]?.toLowerCase() || "";
    const id = churchBySlug.get(slug);
    const at = s(row.created_at);
    if (!id || !at) continue;
    const day = at.slice(0, 10);
    const key = `${id}|${day}`;
    const entry = viewsByChurchDay.get(key) ?? { id, day, at, count: 0, slug };
    entry.count += 1;
    if (at > entry.at) entry.at = at;
    viewsByChurchDay.set(key, entry);
  }
  for (const entry of viewsByChurchDay.values()) {
    const node = nodes.get(entry.id);
    if (!node) continue;
    node.touches.push({
      at: entry.at,
      app: "churchconnect",
      kind: "view",
      what: `Website preview page opened${entry.count > 1 ? ` (${entry.count} visits)` : ""}`,
      outreach: false,
      signal: true
    });
  }

  // --- Laser -------------------------------------------------------------------
  const placeById = new Map(places.map((row) => [s(row.id), row]));
  const sampleById = new Map(samples.map((row) => [s(row.id).toLowerCase(), row]));
  for (const row of places) {
    const link = s(row.churchconnect_url);
    // Explicit link only when the URL names a ChurchConnect page we know.
    const forSlug = /\/for\/([a-z0-9-]+)/i.exec(link)?.[1]?.toLowerCase() || "";
    const churchLink = forSlug ? churchBySlug.get(forSlug) : undefined;
    add({
      id: `laser:place:${s(row.id)}`,
      app: "laser",
      kind: "place",
      name: s(row.display_name) || s(row.name) || "Catalog place",
      town: s(row.town),
      emails: [s(row.claimed_email)],
      domains: [s(row.website_url)],
      phones: [],
      links: churchLink ? [churchLink] : [],
      touches: []
    });
  }
  for (const row of samples) {
    const node = nodes.get(`laser:place:${s(row.place_id)}`);
    const at = s(row.dropped_at) || (s(row.status) === "dropped" ? s(row.created_at) : "");
    if (!node || !at) continue;
    const who = shortPersonName(row.received_by);
    const what = `Left a sample (${s(row.sku) || s(row.landing) || "item"})${who ? ` with ${who}` : ""}${s(row.left_at) ? ` at ${scrubContact(row.left_at, 40)}` : ""}`;
    // A sample left with someone is a drop-off: it rests 7 days, not 14.
    node.touches.push({ at, app: "laser", kind: "sample", what, outreach: true, restDays: DROP_OFF_REST_DAYS });
  }

  const personIdFor = (email: string, fallback: string) => `laser:person:${email || fallback}`;
  for (const row of customers) {
    const email = normEmail(row.email);
    if (!email) continue;
    add({
      id: personIdFor(email, s(row.id)),
      app: "laser",
      kind: "person",
      name: shortPersonName(row.name) || "Laser customer",
      town: "",
      emails: [email],
      domains: [],
      phones: [s(row.phone)],
      links: [],
      touches: []
    });
  }
  for (const row of orders) {
    if (isTestOrder(row)) continue;
    const email = normEmail(row.customer_email);
    const at = s(row.created_at);
    if (!at) continue;
    const status = s(row.status);
    const paid = Boolean(s(row.paid_at));
    const cancelled = status === "cancelled";
    const amount = money(row.total_amount);
    const sample = sampleById.get(s(row.sample_code).toLowerCase());
    const place = sample ? placeById.get(s(sample.place_id)) : undefined;
    const number = s(row.order_number);
    const orderWhat = `Order${number ? ` ${number}` : ""}${place ? ` from the sample at ${s(place.display_name) || s(place.name)}` : ""}`;
    const id = personIdFor(email, `order-${s(row.id)}`);
    add({
      id,
      app: "laser",
      kind: "person",
      name: shortPersonName(row.customer_name) || "Laser customer",
      town: "",
      emails: [email],
      domains: [],
      phones: [s(row.customer_phone)],
      links: [],
      touches: [
        {
          at,
          app: "laser",
          kind: "order",
          what: orderWhat,
          outreach: false,
          signal: true,
          response: cancelled ? "Cancelled" : status.replace(/_/g, " "),
          purchase: amount ? `${amount}${paid ? " paid" : " not paid"}` : undefined,
          unpaid: !paid && !cancelled
        }
      ],
      customerOf: paid ? ["laser"] : []
    });
    const node = nodes.get(id);
    if (node && paid && !node.customerOf?.includes("laser")) node.customerOf = [...(node.customerOf ?? []), "laser"];
    // The sample's place hears about the order as a warm signal (no money line —
    // the person's own card carries the purchase).
    if (place) {
      nodes.get(`laser:place:${s(place.id)}`)?.touches.push({
        at,
        app: "laser",
        kind: "order",
        what: `Someone ordered from the sample QR${number ? ` (${number})` : ""}`,
        outreach: false,
        signal: true
      });
    }
  }

  // --- Presence ------------------------------------------------------------------
  const coinsByPlace = new Map<string, Row[]>();
  const coinsByBatch = new Map<string, Row[]>();
  const coinById = new Map<string, Row>();
  for (const coin of pCoins) {
    coinById.set(s(coin.id), coin);
    const placeId = s(coin.place_id);
    const map = placeId ? coinsByPlace : coinsByBatch;
    const key = placeId || s(coin.batch_id) || "loose";
    map.set(key, [...(map.get(key) ?? []), coin]);
  }
  const batchById = new Map(pBatches.map((row) => [s(row.id), row]));
  const tokenRow = (coin: Row): TokenRow => {
    const status = s(coin.status);
    const batch = batchById.get(s(coin.batch_id));
    return {
      label: `${batch ? s(batch.name) || "Batch" : "Token"} #${s(coin.serial) || "?"}${s(coin.kind) ? ` · ${s(coin.kind)}` : ""}`,
      status,
      printed: tokenPrinted(status)
    };
  };
  const coinTouches = (coin: Row): Touch[] => {
    const touches: Touch[] = [];
    const released = s(coin.released_at);
    if (released) {
      touches.push({
        at: released,
        app: "presence",
        kind: "token",
        what: `Token left${s(coin.released_where) ? ` at ${scrubContact(coin.released_where, 50)}` : ""}`,
        outreach: true
      });
    }
    const found = s(coin.found_at);
    if (found) touches.push({ at: found, app: "presence", kind: "scan", what: "Token was found", outreach: false, signal: true });
    return touches;
  };
  const scanTouches = new Map<string, Touch[]>();
  for (const scan of pScans) {
    const coin = coinById.get(s(scan.coin_id));
    const at = s(scan.created_at);
    if (!coin || !at) continue;
    const kind = s(scan.kind);
    const what = kind === "coming" ? "Someone said they are coming" : kind === "found" ? "Someone found a token" : "Token scanned";
    const key = s(coin.place_id) || `batch:${s(coin.batch_id)}`;
    scanTouches.set(key, [...(scanTouches.get(key) ?? []), { at, app: "presence", kind: "scan", what, outreach: false, signal: kind !== "view" }]);
  }

  const eventRow = (moment: Row) => ({
    title: scrubContact(s(moment.title) || s(moment.activity) || "Event", 70),
    startsAt: s(moment.starts_at) || null,
    status: s(moment.status),
    place: scrubContact(s(moment.place), 50)
  });
  const momentsByPlace = new Map<string, Row[]>();
  const looseMoments: Row[] = [];
  for (const moment of pMoments) {
    const placeId = s(moment.place_id);
    if (placeId) momentsByPlace.set(placeId, [...(momentsByPlace.get(placeId) ?? []), moment]);
    else looseMoments.push(moment);
  }

  for (const row of pPlaces) {
    const id = s(row.id);
    const coins = coinsByPlace.get(id) ?? [];
    const moments = momentsByPlace.get(id) ?? [];
    const town = [s(row.city), s(row.state)].filter(Boolean).join(", ");
    const hasActivity = coins.length > 0 || moments.length > 0;
    add({
      id: `presence:place:${id}`,
      app: "presence",
      kind: "place",
      name: s(row.name) || "Place",
      town,
      emails: [s(row.contact_email)],
      domains: [s(row.website)],
      phones: [s(row.phone)],
      links: [],
      touches: [
        ...coins.flatMap(coinTouches),
        ...(scanTouches.get(id) ?? []),
        ...moments
          .filter((moment) => s(moment.created_at))
          .map((moment) => ({ at: s(moment.created_at), app: "presence" as const, kind: "event" as const, what: `Event planned: ${eventRow(moment).title}`, outreach: false }))
      ],
      tokens: coins.map(tokenRow),
      events: moments.map(eventRow),
      locations: [{ name: s(row.name), town, kind: s(row.kind) }],
      // An approved place with no tokens or events is directory context only.
      contextOnly: !hasActivity
    });
  }

  for (const [batchId, coins] of coinsByBatch) {
    const batch = batchById.get(batchId);
    const moments = pMoments.filter((moment) => s(moment.coin_batch_id) === batchId && !s(moment.place_id));
    add({
      id: `presence:batch:${batchId}`,
      app: "presence",
      kind: "batch",
      name: `Token batch: ${s(batch?.name) || "unnamed"}`,
      town: [s(batch?.city), s(batch?.state)].filter(Boolean).join(", "),
      emails: [],
      domains: [],
      phones: [],
      links: [],
      touches: [...coins.flatMap(coinTouches), ...(scanTouches.get(`batch:${batchId}`) ?? [])],
      tokens: coins.map(tokenRow),
      events: moments.map(eventRow),
      locations: []
    });
  }

  // Batches with no coin rows yet: show the batch status as one token line.
  for (const batch of pBatches) {
    const id = s(batch.id);
    if (coinsByBatch.has(id) || pCoins.some((coin) => s(coin.batch_id) === id)) continue;
    const status = s(batch.status);
    const printed = status === "draft" || status === "ready" ? false : status === "closed" ? null : true;
    add({
      id: `presence:batch:${id}`,
      app: "presence",
      kind: "batch",
      name: `Token batch: ${s(batch.name) || "unnamed"}`,
      town: [s(batch.city), s(batch.state)].filter(Boolean).join(", "),
      emails: [],
      domains: [],
      phones: [],
      links: [],
      touches: [],
      tokens: [
        {
          label: `${s(batch.quantity) || "?"} tokens planned (no tokens made yet)`,
          status,
          printed,
          count: Math.max(1, Number.parseInt(s(batch.quantity), 10) || 1)
        }
      ],
      // Events tied to this batch (no place yet) stay with it.
      events: looseMoments.filter((moment) => s(moment.coin_batch_id) === id).map(eventRow)
    });
  }

  for (const moment of looseMoments) {
    if (s(moment.coin_batch_id) && nodes.has(`presence:batch:${s(moment.coin_batch_id)}`)) continue;
    const town = [s(moment.city), s(moment.state)].filter(Boolean).join(", ");
    const event = eventRow(moment);
    add({
      id: `presence:event:${s(moment.id)}`,
      app: "presence",
      kind: "event",
      name: event.place || event.title,
      town,
      emails: [],
      domains: [],
      phones: [],
      links: [],
      touches: s(moment.created_at)
        ? [{ at: s(moment.created_at), app: "presence", kind: "event", what: `Event planned: ${event.title}`, outreach: false }]
        : [],
      events: [event],
      locations: event.place ? [{ name: event.place, town, kind: "event place" }] : []
    });
  }

  // --- Context lookups: directory churches that share a key with Laser or
  // Presence records. They join a card only when they actually match.
  const outside = [...nodes.values()].filter((node) => node.app !== "churchconnect");
  const lookupEmails = [...new Set(outside.flatMap((node) => node.emails.map(normEmail)).filter(Boolean))].slice(0, 120);
  const lookupDomains = [...new Set(outside.flatMap((node) => node.domains.map(normDomain)).filter(Boolean))].slice(0, 40);
  const lookupNames = [
    ...new Set(outside.filter((node) => node.kind !== "person" && node.kind !== "batch").map((node) => node.name).filter((name) => name.length >= 4))
  ].slice(0, 40);
  const lookups: Promise<Row[]>[] = [];
  if (lookupEmails.length) {
    const list = quoteList(lookupEmails);
    lookups.push(
      read(
        "cc_churches",
        `${CHURCH_SELECT}&or=(doc->>email.in.(${list}),doc->>primary_email.in.(${list}),doc->>pastor_email.in.(${list}),doc->>office_email.in.(${list}),doc->>customer_email.in.(${list}))&limit=200`,
        "Church directory (matches only)",
        "churchconnect"
      )
    );
  }
  for (const domain of lookupDomains) {
    const like = `*${encodeURIComponent(domain)}*`;
    lookups.push(read("cc_churches", `${CHURCH_SELECT}&or=(doc->>website.ilike.${like},doc->>domain.ilike.${like})&limit=5`, "Church directory (matches only)", "churchconnect"));
  }
  for (const name of lookupNames) {
    lookups.push(read("cc_churches", `${CHURCH_SELECT}&doc->>name=ilike.${encodeURIComponent(name.replace(/[*,()]/g, " "))}&limit=5`, "Church directory (matches only)", "churchconnect"));
  }
  for (const rows of await Promise.all(lookups)) {
    for (const row of rows) {
      if (!nodes.has(`cc:church:${s(row.id)}`)) add(churchNode(row, true));
    }
  }

  const suppressions: Suppressions = { emails: new Set(), domains: new Set(), phones: new Set() };
  for (const row of suppressionRows) {
    const email = normEmail(row.email);
    const domain = normDomain(row.domain);
    const phone = normPhone(row.phone);
    if (email) suppressions.emails.add(email);
    if (domain) suppressions.domains.add(domain);
    if (phone) suppressions.phones.add(phone);
  }

  // Fail closed: if the do-not-contact list could not be read, suggest no outreach.
  const suppressionsUnreadable = sources.some((source) => source.id === "outreach_suppressions" && !source.ok);
  const cards = buildCards([...nodes.values()], suppressions, now);
  const followUps = buildFollowUps(cards, now, { outreachHidden: suppressionsUnreadable });
  const allTokens = cards.flatMap((card) => card.tokens);
  return {
    configured: true,
    generatedAt: now.toISOString(),
    cards,
    followUps,
    outreachHidden: suppressionsUnreadable,
    sources: sources.reduce<CrmSourceStatus[]>((acc, source) => {
      const existing = acc.find((item) => item.label === source.label);
      if (existing) {
        existing.rows += source.rows;
        existing.ok = existing.ok && source.ok;
      } else acc.push({ ...source });
      return acc;
    }, []),
    adminUrls: adminUrls(),
    presence: {
      tokens: countTokens(allTokens),
      printed: countTokens(allTokens, true),
      notPrinted: countTokens(allTokens, false),
      events: pMoments.length,
      places: pPlaces.length
    }
  };
}

// Owner-deck glance: how many orgs are on today's follow-up list. Null = not
// wired or not ready yet. The deck never waits on the full CRM read: it uses a
// count from the last 5 minutes, or waits at most 2.5s, then shows "—" and the
// read finishes in the background for the next visit.
const DECK_COUNT_TTL_MS = 5 * 60_000;
const DECK_COUNT_BUDGET_MS = 2_500;
let deckCount: { at: number; value: number } | null = null;
let deckCountInFlight: Promise<number | null> | null = null;

function todayCount(snapshot: CrmSnapshot): number {
  // Resting ("wait") rows do not count as today.
  return snapshot.followUps.filter((row) => row.today).length;
}

export async function crmFollowUpCount(): Promise<number | null> {
  if (!lplCrmConfigured()) return null;
  if (deckCount && Date.now() - deckCount.at < DECK_COUNT_TTL_MS) return deckCount.value;
  deckCountInFlight ??= loadCrmSnapshot()
    .then((snapshot) => {
      const value = todayCount(snapshot);
      deckCount = { at: Date.now(), value };
      return value;
    })
    .catch(() => null)
    .finally(() => {
      deckCountInFlight = null;
    });
  const budget = new Promise<null>((resolve) => setTimeout(() => resolve(null), DECK_COUNT_BUDGET_MS));
  const value = await Promise.race([deckCountInFlight, budget]);
  return value ?? deckCount?.value ?? null;
}

/** The /crm page already did the full read — share its count with the deck. */
export function rememberCrmFollowUpCount(snapshot: CrmSnapshot): void {
  if (snapshot.configured) deckCount = { at: Date.now(), value: todayCount(snapshot) };
}

// --- AV prospects (Messenger AVL kit) -----------------------------------------
// Read only, on tap from the desk (never on page load). Churches with a website
// or Facebook page on file, in Lincoln's territory order (av-prospects-core.ts):
// central & South GA, rest of GA, FL, SC — nearest Vidalia first in each tier.
// Reads tier by tier in growing rings and stops as soon as the top of the list
// is settled, so it never pulls the whole table. Anyone on the do-not-contact
// list (email, website domain or phone) is left out; if that list can't be
// read, nothing is listed.
const AV_FIELDS = [
  "name", "city", "state", "lat", "lng", "latitude", "longitude", "website", "facebook_url", "live_stream_url",
  "livestream_url", "youtube_url", "subsplash_url", "website_live", "website_http_status", "website_trouble",
  "avg_attendance", "pastor_name", "contact_name", "ministry_assist_name", "secretary_name", "do_not_contact",
  "do_not_contact_desk_claim", "crm_status", "merged_into", "deleted_at", "duplicate_of", "religion_guess", "prospect_kind",
  "source", "email", "phone", "active", "is_public", "invite_status", "last_invited_at"
];
const AV_SELECT = `select=id,${AV_FIELDS.map((field) => `${field}:doc->>${field}`).join(",")},possible_same_as:doc->possible_same_as`;
const AV_PAGE = 1000;
const AV_MAX_PAGES = 15;
const DNC_PAGE = 1000;
const DNC_MAX_PAGES = 50;

export type AvProspectList = { ok: boolean; prospects: AvProspect[]; read: number; message: string };

export async function loadAvProspects(): Promise<AvProspectList> {
  const config = getLplConfig();
  if (!config) return { ok: false, prospects: [], read: 0, message: "This deploy cannot read the shared database yet." };
  const sources: CrmSourceStatus[] = [];
  const unreadable = () => sources.some((source) => !source.ok);
  const suppressionRows: Row[] = [];
  for (let page = 0; page < DNC_MAX_PAGES; page += 1) {
    const batch = await readRows(
      config,
      "outreach_suppressions",
      `select=email,domain,phone&order=email.asc.nullslast,domain.asc.nullslast,phone.asc.nullslast&limit=${DNC_PAGE}&offset=${page * DNC_PAGE}`,
      sources,
      { label: "Do-not-contact list", app: "shared" }
    );
    if (unreadable()) {
      return { ok: false, prospects: [], read: 0, message: "The do-not-contact list couldn't be read, so no prospects are listed right now." };
    }
    suppressionRows.push(...batch);
    if (batch.length < DNC_PAGE) break;
    if (page === DNC_MAX_PAGES - 1) {
      return { ok: false, prospects: [], read: 0, message: "The do-not-contact list couldn't be read, so no prospects are listed right now." };
    }
  }
  const emails = new Set<string>();
  const domains = new Set<string>();
  const phones = new Set<string>();
  for (const row of suppressionRows) {
    const email = normEmail(row.email);
    const domain = normDomain(row.domain);
    const phone = normPhone(row.phone);
    if (email) emails.add(email);
    if (domain) domains.add(domain);
    if (phone) phones.add(phone);
  }
  const suppressed = (row: AvRow): boolean => {
    const email = normEmail(row.email);
    if (email && (emails.has(email) || domains.has(email.split("@")[1] ?? ""))) return true;
    const domain = normDomain(row.website);
    if (domain && domains.has(domain)) return true;
    const phone = normPhone(row.phone);
    return Boolean(phone && phones.has(phone));
  };
  const readRing = async (tier: AvTierIndex, radius: number): Promise<Row[]> => {
    const rows: Row[] = [];
    for (let page = 0; page < AV_MAX_PAGES; page += 1) {
      const batch = await readRows(
        config,
        "cc_churches",
        `${AV_SELECT}&${tierRingFilters(tier, radius)}&or=(doc->>website.not.is.null,doc->>facebook_url.not.is.null)&order=id&limit=${AV_PAGE}&offset=${page * AV_PAGE}`,
        sources,
        { label: "Churches for AV prospects", app: "churchconnect" }
      );
      rows.push(...batch);
      if (batch.length < AV_PAGE) break;
    }
    return rows;
  };
  const kept: Row[] = [];
  let read = 0;
  let prospects: AvProspect[] = [];
  const fetchedMate = new Set<string>();
  const wideNames = new Set<string>();
  // A name lookup of 40 or more rows cannot prove the church is not a stopped copy. Those churches stay off the list.
  const nameLookupBlocked = new Set<string>();
  // Visits rest 14 days and drop-offs rest 7, the same rule as the desk. If that log can't be read, list nothing.
  const readRests = async (rows: Row[]): Promise<boolean> => {
    const ids = [...new Set(rows.map((row) => s(row.id)).filter((id) => id && !fetchedMate.has(`rest:${id}`)))];
    if (!ids.length) return true;
    const since = isoDaysAgo(DONT_REPEAT_DAYS, new Date());
    const byId = new Map(rows.map((row) => [s(row.id), row]));
    for (let index = 0; index < ids.length; index += 30) {
      const chunk = ids.slice(index, index + 30);
      for (const id of chunk) fetchedMate.add(`rest:${id}`);
      const or = chunk.map((id) => `doc->>church_id.eq.${encodeURIComponent(id)}`).join(",");
      const batch = await readRows(
        config,
        "cc_church_crm_activities",
        `select=church_id:doc->>church_id,type:doc->>type,activity_type:doc->>activity_type,description:doc->>description,at:doc->>created_at,occurred_at:doc->>occurred_at&or=(${or})&created_at=gte.${since}&order=created_at.desc&limit=${AV_PAGE}`,
        sources,
        { label: "Church activity log", app: "churchconnect" }
      );
      if (unreadable() || batch.length >= AV_PAGE) return false;
      for (const activity of batch) {
        const row = byId.get(s(activity.church_id));
        if (!row) continue;
        const type = s(activity.type).toLowerCase() || s(activity.activity_type).toLowerCase();
        const at = s(activity.occurred_at) || s(activity.at);
        if (!at) continue;
        const outreach = ["invite", "email", "call", "sms", "visit", "drop_off", "meeting", "text"].includes(type) && !/FAILED|did not send/i.test(s(activity.description));
        const list = Array.isArray(row.desk_touches) ? [...(row.desk_touches as unknown[])] : [];
        list.push({
          at,
          kind: type,
          outreach,
          restDays: type === "drop_off" ? DROP_OFF_REST_DAYS : type === "visit" ? VISIT_REST_DAYS : undefined
        });
        row.desk_touches = list;
      }
    }
    return true;
  };
  // Copies with no website, and copies outside the ring, still count. A do-not-contact
  // or stopped member keeps the whole group off the list.
  const readGroupMates = async (focus: Row[]): Promise<Row[] | null> => {
    const lookups = groupMateLookups(focus);
    const mates: Row[] = [];
    const ids = lookups.ids.filter((id) => !fetchedMate.has(`id:${id}`));
    for (let index = 0; index < ids.length; index += 40) {
      const chunk = ids.slice(index, index + 40);
      for (const id of chunk) fetchedMate.add(`id:${id}`);
      const batch = await readRows(
        config,
        "cc_churches",
        `${AV_SELECT}&id=in.(${chunk.map((id) => encodeURIComponent(id)).join(",")})&limit=${AV_PAGE}`,
        sources,
        { label: "Churches for AV prospects", app: "churchconnect" }
      );
      if (unreadable()) return null;
      mates.push(...batch);
    }
    const pointed = [...new Set(focus.map((row) => s(row.id)).filter(Boolean))].filter((id) => !fetchedMate.has(`cs:${id}`));
    for (let index = 0; index < pointed.length; index += 12) {
      const chunk = pointed.slice(index, index + 12);
      for (const id of chunk) fetchedMate.add(`cs:${id}`);
      const or = chunk.map((id) => `doc->possible_same_as.cs.${encodeURIComponent(JSON.stringify([id]))}`).join(",");
      const batch = await readRows(config, "cc_churches", `${AV_SELECT}&or=(${or})&limit=${AV_PAGE}`, sources, { label: "Churches for AV prospects", app: "churchconnect" });
      if (unreadable() || batch.length >= AV_PAGE) return null;
      mates.push(...batch);
    }
    for (const item of lookups.nameCities) {
      const mark = `${item.city.toLowerCase()}|${item.pattern}`;
      if (fetchedMate.has(mark)) {
        if (wideNames.has(mark)) for (const id of item.churchIds) nameLookupBlocked.add(id);
        continue;
      }
      fetchedMate.add(mark);
      const pattern = `*${item.pattern.split(" ").join("*")}*`;
      const batch = await readRows(
        config,
        "cc_churches",
        `${AV_SELECT}&doc->>city=ilike.${encodeURIComponent(item.city)}&doc->>name=ilike.${encodeURIComponent(pattern)}&limit=40`,
        sources,
        { label: "Churches for AV prospects", app: "churchconnect" }
      );
      if (unreadable()) return null;
      // A name lookup that returns 40 or more rows is too wide for this one church. Leave it off the list.
      const wideBlock = wideNameLookupBlock(batch.length, item.churchIds);
      if (wideBlock.length) {
        wideNames.add(mark);
        for (const id of wideBlock) nameLookupBlocked.add(id);
        continue;
      }
      mates.push(...batch);
    }
    return mates;
  };
  for (const tier of [0, 1, 2, 3] as AvTierIndex[]) {
    let tierRows: Row[] = [];
    for (const radius of AV_RINGS_MILES) {
      tierRows = await readRing(tier, radius);
      if (unreadable()) {
        return { ok: false, prospects: [], read, message: "Churches couldn't be read just now. Try again in a minute." };
      }
      let pool = [...kept, ...tierRows];
      if (!(await readRests(pool))) {
        return { ok: false, prospects: [], read, message: "Recent visits and drop-offs couldn't be read, so no prospects are listed right now." };
      }
      for (let pass = 0; pass < 3; pass += 1) {
        const preview = rankAvProspects(pool, suppressed, { blockedIds: nameLookupBlocked });
        const focus = pool.filter((row) => preview.some((item) => item.churchId === s(row.id)));
        const mates = await readGroupMates(focus);
        if (!mates) return { ok: false, prospects: [], read, message: "Churches couldn't be read just now. Try again in a minute." };
        if (!(await readRests(mates))) {
          return { ok: false, prospects: [], read, message: "Recent visits and drop-offs couldn't be read, so no prospects are listed right now." };
        }
        pool = [...pool, ...mates];
        prospects = rankAvProspects(pool, suppressed, { blockedIds: nameLookupBlocked });
        if (mates.length === 0) break;
      }
      // Settled: earlier tiers plus this tier's churches inside the ring already fill the list.
      const settled = prospects.filter((item) => item.tier < tier || (item.tier === tier && item.miles <= radius)).length;
      if (settled >= AV_LIST_SIZE) break;
    }
    read += tierRows.length;
    kept.push(...tierRows);
    if (prospects.length >= AV_LIST_SIZE && prospects.every((item) => item.tier <= tier)) break;
  }
  return { ok: true, prospects, read, message: "" };
}
