// CRM saving — SERVER ONLY. The owner logs a church visit or drop-off and
// saves church contacts from the desk. Every save goes through ChurchConnect's
// own CRM routes, so ChurchConnect stays the one writer of its records:
//   POST   /api/church-crm/leads                      (add a church, hidden until real)
//   PATCH  /api/church-crm/leads/{church}             (edit its basics and apps)
//   POST   /api/church-crm/leads/{church}/activities
//   PUT    /api/church-crm/leads/{church}/contacts/{contact}
// Each call carries a pass that lives at most 2 minutes and is bound to that
// one method and exact path. The only direct writes here are the shared
// do-not-contact list (a visit that ends with "asked not to be contacted") and
// business leads (op_leads, its contacts, and its visit log op_lead_activities),
// which no app owns yet.
// Nothing here logs a body, a contact detail, or the pass. Nothing is sent to
// anyone.
import { mintHs256Jwt } from "@/lib/engine/admin-door-handoff";
import { resolveCrmSecret } from "@/lib/engine/crm-pass-secret";
import { BUSINESS_OFFER_IDS, cleanBusinessOfferIds, cleanChurchOfferIds } from "@/lib/engine/church-offer-rule";
import { domainFromEmail, normDomain, normEmail, normName, normPhone, resolveOrgKind, type OrgKind } from "@/lib/engine/lpl-crm-core";

export const CRM_PASS_ISSUER = "appengine-owner-desk";
export const CRM_PASS_AUDIENCE = "churchconnect-crm";
export const CRM_PASS_TTL_SECONDS = 90;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTACT_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const REF_RE = /^[A-Za-z0-9_-]{8,64}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const VISIT_KINDS = ["visit", "drop_off"] as const;
export type VisitKind = (typeof VISIT_KINDS)[number];
export const OUTCOME_CODES = ["interested", "follow_up", "not_now", "do_not_contact"] as const;
export type OutcomeCode = (typeof OUTCOME_CODES)[number];

export type SaveResult = { ok: true; message: string; duplicate?: boolean; contactId?: string; /** Saved, but the result needs a warning, not a success line. */ warn?: boolean } | { ok: false; message: string };

export type ContactInput = { id: string; name: string; title: string; email: string; phone: string };

export type VisitInput = {
  churchId: string;
  /** A business lead (op_leads) instead of a church. Exactly one of churchId / leadId is used. */
  leadId?: string;
  kind: VisitKind;
  day: string;
  contact: { id: string; name: string; title: string } | null;
  leftItem: string;
  outcomeCode: OutcomeCode | "";
  outcomeNote: string;
  nextStep: string;
  nextDate: string;
  clientRef: string;
  /** "Yes, never contact this church" was ticked (required for do_not_contact). */
  confirmDnc?: boolean;
};

type CcConfig = { base: string; secret: string };
type CcMethod = "POST" | "PUT" | "PATCH" | "DELETE";

/** Where to save and how to sign. The secret: env var if set, else the shared database row (cached). */
async function ccConfig(env: Record<string, string | undefined> = process.env): Promise<CcConfig | null> {
  const base = (env.CHURCHCONNECT_API_URL || "https://www.churchconnect.cloud").trim().replace(/\/$/, "");
  if (!/^https:\/\//.test(base)) return null;
  const secret = await resolveCrmSecret(env);
  if (!secret) return null;
  return { base, secret };
}

export async function crmSavingConfigured(env: Record<string, string | undefined> = process.env): Promise<boolean> {
  return (await ccConfig(env)) !== null;
}

/** Owner-only wording for a deploy that can't save. */
export function savingOffMessage(env: Record<string, string | undefined> = process.env): string {
  return env.VERCEL_ENV === "production" ? "Saving isn't switched on yet." : "Saving isn't available on this preview.";
}

/** A pass for exactly one call: this method, this path, this owner, under 2 minutes. */
export function mintCrmPass(secret: string, method: CcMethod, path: string, ownerEmail: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  return mintHs256Jwt(
    {
      iss: CRM_PASS_ISSUER,
      aud: CRM_PASS_AUDIENCE,
      sub: ownerEmail,
      htm: method,
      htu: path,
      iat: nowSeconds,
      exp: nowSeconds + CRM_PASS_TTL_SECONDS
    },
    secret
  );
}

const text = (value: unknown, limit: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, limit);

export function validDay(value: string): boolean {
  if (!DAY_RE.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function cleanContactInput(input: Partial<ContactInput>): ContactInput | string {
  const id = text(input.id, 64);
  if (!CONTACT_ID_RE.test(id)) return "That contact can't be saved. Reload the page and try again.";
  const name = text(input.name, 120);
  if (!name) return "Add the person's name.";
  const rawEmail = text(input.email, 200);
  const email = normEmail(rawEmail);
  if (rawEmail && !email) return "That email doesn't look right.";
  const phone = text(input.phone, 40);
  if (phone && phone.replace(/\D/g, "").length < 7) return "That phone number looks too short.";
  return { id, name, title: text(input.title, 80), email, phone };
}

export function cleanVisitInput(input: Partial<VisitInput>): VisitInput | string {
  const leadId = text(input.leadId, 64);
  const churchId = leadId ? "" : text(input.churchId, 64);
  if (leadId ? !UUID_RE.test(leadId) : !UUID_RE.test(churchId)) return "Visits can only be logged on a church or business lead on this desk.";
  const who = leadId ? "business" : "church";
  const kind = VISIT_KINDS.includes(input.kind as VisitKind) ? (input.kind as VisitKind) : null;
  if (!kind) return "Pick visit or drop-off.";
  const day = text(input.day, 10);
  if (!validDay(day)) return "Pick the day you went.";
  const clientRef = text(input.clientRef, 64);
  if (!REF_RE.test(clientRef)) return "Reload the page and try again.";
  const outcomeCode = OUTCOME_CODES.includes(input.outcomeCode as OutcomeCode) ? (input.outcomeCode as OutcomeCode) : "";
  if (outcomeCode === "do_not_contact" && input.confirmDnc !== true) return `Tick "Yes, never contact this ${who}" to save this.`;
  const nextStep = outcomeCode === "do_not_contact" ? "" : text(input.nextStep, 200);
  const nextDate = outcomeCode === "do_not_contact" ? "" : text(input.nextDate, 10);
  if (nextDate && !validDay(nextDate)) return "Pick a real day for the next step.";
  if (nextDate && !nextStep) return "Say what the next step is.";
  const contact = input.contact && text(input.contact.name, 120)
    ? { id: text(input.contact.id, 64), name: text(input.contact.name, 120), title: text(input.contact.title, 80) }
    : null;
  return {
    churchId,
    ...(leadId ? { leadId } : {}),
    kind,
    day,
    contact,
    leftItem: text(input.leftItem, 200),
    outcomeCode,
    outcomeNote: text(input.outcomeNote, 300),
    nextStep,
    nextDate,
    clientRef,
    confirmDnc: outcomeCode === "do_not_contact"
  };
}

/**
 * Previews only: ChurchConnect previews sit behind Vercel login, so server
 * calls carry the sanctioned automation bypass when one is set. Never sent
 * from production.
 */
export function previewBypassHeader(env: Record<string, string | undefined> = process.env): Record<string, string> {
  if (env.VERCEL_ENV === "production") return {};
  const token = (env.CHURCHCONNECT_PREVIEW_BYPASS || "").trim();
  return token ? { "x-vercel-protection-bypass": token } : {};
}

async function callChurchConnect(config: CcConfig, method: CcMethod, path: string, ownerEmail: string, body?: unknown): Promise<{ ok: boolean; status: number; json: Record<string, unknown> | null }> {
  try {
    const response = await fetch(`${config.base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Engine-Pass": mintCrmPass(config.secret, method, path, ownerEmail),
        ...previewBypassHeader()
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    });
    const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: response.ok, status: response.status, json };
  } catch {
    return { ok: false, status: 0, json: null };
  }
}

function failure(status: number, json: Record<string, unknown> | null): string {
  if (status === 0) return "ChurchConnect didn't answer. Nothing was saved — try again in a minute.";
  if (status === 401 || status === 403) return "ChurchConnect refused the save. Nothing was saved.";
  if (status === 404) return "That church isn't in ChurchConnect any more.";
  const detail = typeof json?.detail === "string" ? json.detail.slice(0, 160) : "";
  if (status === 400 && detail) return detail;
  return "ChurchConnect couldn't save that. Nothing was saved — try again.";
}

export async function saveChurchContact(ownerEmail: string, churchId: string, raw: Partial<ContactInput>): Promise<SaveResult> {
  const config = await ccConfig();
  if (!config) return { ok: false, message: savingOffMessage() };
  if (!UUID_RE.test(churchId)) return { ok: false, message: "Contacts can only be saved on a ChurchConnect church." };
  const contact = cleanContactInput(raw);
  if (typeof contact === "string") return { ok: false, message: contact };
  const path = `/api/church-crm/leads/${churchId}/contacts/${contact.id}`;
  const result = await callChurchConnect(config, "PUT", path, ownerEmail, {
    name: contact.name,
    role: contact.title,
    email: contact.email,
    phone: contact.phone
  });
  if (!result.ok) return { ok: false, message: failure(result.status, result.json) };
  return { ok: true, message: `Saved ${contact.name}.`, contactId: contact.id };
}

export async function logChurchVisit(ownerEmail: string, raw: Partial<VisitInput>): Promise<SaveResult> {
  const config = await ccConfig();
  if (!config) return { ok: false, message: savingOffMessage() };
  const visit = cleanVisitInput(raw);
  if (typeof visit === "string") return { ok: false, message: visit };
  if (visit.leadId || !visit.churchId) return { ok: false, message: "Visits can only be logged on a ChurchConnect church." };
  const label = visit.kind === "visit" ? "Visit" : "Drop-off";
  const path = `/api/church-crm/leads/${visit.churchId}/activities`;
  const description = [
    label,
    visit.contact ? `met ${visit.contact.name}` : "",
    visit.leftItem ? `left ${visit.leftItem}` : ""
  ].filter(Boolean).join(", ");
  const result = await callChurchConnect(config, "POST", path, ownerEmail, {
    type: visit.kind,
    description,
    occurred_at: visit.day,
    contact: visit.contact,
    left_item: visit.leftItem,
    outcome_code: visit.outcomeCode,
    outcome: visit.outcomeNote,
    next_step: visit.nextStep,
    next_action_date: visit.nextDate,
    source: "owner_desk",
    client_ref: visit.clientRef
  });
  if (!result.ok) return { ok: false, message: failure(result.status, result.json) };
  const duplicate = result.json?.duplicate === true;
  if (visit.outcomeCode === "do_not_contact") {
    const listed = await addChurchToDoNotContact(visit.churchId);
    if (!listed) {
      return { ok: false, message: `${label} saved and the church is marked lost, but the do-not-contact list couldn't be updated. Try saving again.` };
    }
  }
  return { ok: true, duplicate, message: duplicate ? `${label} was already saved.` : `${label} saved.` };
}

// ── Do-not-contact list (shared database) ──────────────────────────────────

type LplConfig = { url: string; serviceKey: string };

function lplConfig(): LplConfig | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}

const CHURCH_REACH_FIELDS = ["email", "primary_email", "pastor_email", "office_email", "secretary_email", "customer_email", "phone", "phone_office", "phone_cell", "pastor_phone", "secretary_phone", "website", "domain"];

export type SuppressionRow = { email?: string; domain?: string; phone?: string };

/** Every way to reach this church, normalized the way the desk matches them. */
export function suppressionRowsFor(church: Record<string, unknown>): SuppressionRow[] {
  const emails = new Set<string>();
  const domains = new Set<string>();
  const phones = new Set<string>();
  const staff = Array.isArray(church.staff_contacts) ? (church.staff_contacts as Record<string, unknown>[]) : [];
  for (const field of ["email", "primary_email", "pastor_email", "office_email", "secretary_email", "customer_email"]) {
    const email = normEmail(church[field]);
    if (email) emails.add(email);
  }
  for (const contact of staff) {
    const email = normEmail(contact?.email);
    if (email) emails.add(email);
    const phone = normPhone(contact?.phone);
    if (phone) phones.add(phone);
  }
  for (const field of ["phone", "phone_office", "phone_cell", "pastor_phone", "secretary_phone"]) {
    const phone = normPhone(church[field]);
    if (phone) phones.add(phone);
  }
  for (const value of [church.website, church.domain]) {
    const domain = normDomain(value);
    if (domain) domains.add(domain);
  }
  // Domains come only from the website: an email's domain is often a shared provider
  // (gmail.com, bellsouth.net…), and blocking it would block strangers.
  return [
    ...[...emails].map((email) => ({ email })),
    ...[...domains].map((domain) => ({ domain })),
    ...[...phones].map((phone) => ({ phone }))
  ];
}

async function addChurchToDoNotContact(churchId: string): Promise<boolean> {
  const config = lplConfig();
  if (!config) return false;
  const headers = { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` };
  try {
    const select = [...CHURCH_REACH_FIELDS.map((field) => `${field}:doc->>${field}`), "staff_contacts:doc->staff_contacts"].join(",");
    const read = await fetch(`${config.url}/rest/v1/cc_churches?id=eq.${churchId}&select=${select}&limit=1`, { method: "GET", headers, cache: "no-store" });
    if (!read.ok) return false;
    const [church] = ((await read.json()) as Record<string, unknown>[]) ?? [];
    if (!church) return false;
    return await claimSuppressions(config, suppressionRowsFor(church), deskSuppressionSource(churchId));
  } catch {
    return false;
  }
}

/**
 * Put rows on the shared do-not-contact list as one desk claim, through the database's
 * outreach_suppress() (the only writer of that table from this desk). An address already on
 * the list keeps its row and real reason; this desk only adds its claim to it.
 */
async function claimSuppressions(config: LplConfig, rows: SuppressionRow[], claim: string): Promise<boolean> {
  for (const row of rows) {
    const response = await fetch(`${config.url}/rest/v1/rpc/outreach_suppress`, {
      method: "POST",
      headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: row.email ?? null, p_domain: row.domain ?? null, p_phone: row.phone ?? null, p_reason: "do_not_contact", p_source: claim }),
      cache: "no-store"
    });
    if (!response.ok) return false;
  }
  return true;
}

/** Remove one desk claim everywhere (outreach_release). Rows go only when no claim and no real reason is left. */
async function releaseClaim(config: LplConfig, claim: string): Promise<{ released: number; deleted: number; remaining: number } | null> {
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/outreach_release`, {
      method: "POST",
      headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_claim: claim }),
      cache: "no-store"
    });
    if (!response.ok) return null;
    const [row] = ((await response.json()) as Array<{ released?: number; deleted?: number; remaining?: number }>) ?? [];
    if (!row || typeof row.remaining !== "number") return null;
    return { released: Number(row.released) || 0, deleted: Number(row.deleted) || 0, remaining: row.remaining };
  } catch {
    return null;
  }
}

// ── Remove a contact, undo a do-not-contact ────────────────────────────────

/** Rows this desk adds to the do-not-contact list carry the church id, so an undo removes only those. */
export function deskSuppressionSource(churchId: string): string {
  return `crm_visit:${churchId}`;
}

export async function removeChurchContact(ownerEmail: string, churchId: string, contactId: string): Promise<SaveResult> {
  const config = await ccConfig();
  if (!config) return { ok: false, message: savingOffMessage() };
  if (!UUID_RE.test(churchId)) return { ok: false, message: "Contacts can only be removed on a ChurchConnect church." };
  if (!CONTACT_ID_RE.test(contactId)) return { ok: false, message: "That contact can't be removed. Reload the page and try again." };
  const result = await callChurchConnect(config, "DELETE", `/api/church-crm/leads/${churchId}/contacts/${contactId}`, ownerEmail);
  if (!result.ok) return { ok: false, message: failure(result.status, result.json) };
  return { ok: true, message: "Contact removed." };
}

/** The church's name and every way to reach it, read from the shared database. */
async function readChurchReach(config: LplConfig, churchId: string): Promise<{ name: string; rows: SuppressionRow[] } | null> {
  try {
    const select = ["name:doc->>name", "church_name:doc->>church_name", ...CHURCH_REACH_FIELDS.map((field) => `${field}:doc->>${field}`), "staff_contacts:doc->staff_contacts"].join(",");
    const read = await fetch(`${config.url}/rest/v1/cc_churches?id=eq.${churchId}&select=${select}&limit=1`, {
      method: "GET",
      headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` },
      cache: "no-store"
    });
    if (!read.ok) return null;
    const [church] = ((await read.json()) as Record<string, unknown>[]) ?? [];
    if (!church) return null;
    return { name: text(church.name, 160) || text(church.church_name, 160) || "This church", rows: suppressionRowsFor(church) };
  } catch {
    return null;
  }
}

/** ChurchConnect's own reason a church stays stopped, in plain words. */
export function churchStopReason(name: string, reason: unknown): string {
  return String(reason ?? "") === "email_unsubscribe" ? `${name} unsubscribed by email` : `${name} was stopped in ChurchConnect for another reason`;
}

export async function undoChurchDoNotContact(ownerEmail: string, churchId: string): Promise<SaveResult> {
  const config = await ccConfig();
  const lpl = lplConfig();
  if (!config || !lpl) return { ok: false, message: savingOffMessage() };
  if (!UUID_RE.test(churchId)) return { ok: false, message: "Only a ChurchConnect church can be undone here." };
  // 0. Every way to reach the church, read first: if it can't be read, nothing is changed and Undo stays.
  const reach = await readChurchReach(lpl, churchId);
  if (!reach) return { ok: false, message: "The church couldn't be read, so it stays stopped. Nothing was changed — try Undo again." };
  const name = reach.name;
  // 1. Remove only this desk's claim on the shared list (read back: none left). Retryable.
  const released = await releaseClaim(lpl, deskSuppressionSource(churchId));
  if (!released || released.remaining !== 0) {
    return { ok: false, message: "The do-not-contact list couldn't be cleared. Nothing else was changed — try again." };
  }
  // 2. Still on the shared list another way (its email, phone or website, any source)? Checked before
  // ChurchConnect is touched, so a failed check leaves the desk stop (and the Undo button) in place.
  const still = await existingSuppressions(lpl, reach.rows);
  if (still === null) {
    return { ok: false, message: `The do-not-contact list couldn't be checked, so ${name} stays stopped. Try Undo again in a minute.` };
  }
  // 3. ChurchConnect removes only the desk's claim and keeps the church stopped for any other reason.
  const result = await callChurchConnect(config, "POST", `/api/church-crm/leads/${churchId}/do-not-contact/undo`, ownerEmail, {});
  if (!result.ok) {
    // The desk's claim is still on the church in ChurchConnect, so it stays stopped and Undo stays available.
    return { ok: false, message: "ChurchConnect didn't confirm the undo, so this church stays stopped. Try Undo again." };
  }
  if (result.json?.still_stopped === true) {
    return { ok: true, warn: true, message: `Still blocked. ${churchStopReason(name, result.json?.reason)}, so it stays blocked. Don't contact it.` };
  }
  if (still.length) {
    return { ok: true, warn: true, message: `Still on the do-not-contact list. ${stillListedReason(name, still.map((row) => row.reason ?? ""))}, so it stays blocked. Don't contact it.` };
  }
  return { ok: true, message: "Undone. You can contact this church again." };
}

// ── Add or edit an org (church → ChurchConnect, business → op_leads) ───────

export type OrgInput = {
  kind: string;
  confirmBusiness?: boolean;
  name: string;
  city: string;
  state: string;
  website: string;
  phone: string;
  email: string;
  offers: string[];
  /** The owner looked at the possible matches and says this is a different org. */
  confirmNew?: boolean;
  /** Business edit: the row's updated_at when the form was opened (stale-save check). */
  version?: string;
};

export type CleanOrg = {
  kind: OrgKind;
  name: string;
  city: string;
  state: string;
  website: string;
  phone: string;
  email: string;
  offers: string[];
  confirmNew: boolean;
};

export type OrgMatch = {
  kind: OrgKind;
  id: string;
  name: string;
  town: string;
  /** Plain words: "same name and town", "same website", "same phone", "same email". */
  why: string[];
  /** Same name and town: never added twice, even when the owner says it's different. */
  hard: boolean;
};

export type OrgSaveResult =
  | { ok: true; message: string; kind: OrgKind; id: string }
  | { ok: false; message: string; matches?: OrgMatch[] };

function cleanWebsite(value: unknown): string | null {
  const raw = text(value, 300);
  if (!raw) return "";
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return /^https?:\/\/[^\s/]+\.[^\s/]+/i.test(url) ? url : null;
}

export function cleanOrgInput(input: Partial<OrgInput>, editing: OrgKind | null = null): CleanOrg | string {
  const name = text(input.name, 160);
  if (!name) return "Add the name.";
  // On edit the kind stays what it is; on add, "Not sure" means church.
  const resolved = editing ? { kind: editing } : resolveOrgKind(input.kind, name, input.confirmBusiness === true);
  if ("error" in resolved) return resolved.error;
  const city = text(input.city, 80);
  if (!city) return "Add the town, so we can check it isn't already here.";
  const website = cleanWebsite(input.website);
  if (website === null) return "That website doesn't look right.";
  const rawEmail = text(input.email, 200);
  const email = normEmail(rawEmail);
  if (rawEmail && !email) return "That email doesn't look right.";
  const phone = text(input.phone, 40);
  if (phone && phone.replace(/\D/g, "").length < 7) return "That phone number looks too short.";
  const offers = resolved.kind === "church" ? cleanChurchOfferIds(input.offers) : cleanBusinessOfferIds(input.offers);
  return {
    kind: resolved.kind,
    name,
    city,
    state: text(input.state, 40).toUpperCase(),
    website,
    phone,
    email,
    offers,
    confirmNew: input.confirmNew === true
  };
}

/** PostgREST ilike pattern for a phone in any format: 7705550100 → *770*555*0100* */
export function phoneLike(phone: string): string {
  const digits = normPhone(phone);
  if (!digits) return "";
  return `*${digits.slice(0, 3)}*${digits.slice(3, 6)}*${digits.slice(6)}*`;
}

/** ilike pattern for a name: words kept, punctuation becomes a wildcard. */
export function nameLike(name: string): string {
  const words = normName(name).split(" ").filter(Boolean);
  return words.length ? words.join("*") : "";
}

const pgValue = (value: string) => encodeURIComponent(value.replace(/[,()"]/g, " "));

type MatchRow = Record<string, unknown> & { id?: unknown };

/**
 * Look before adding: churches and business leads with the same name + town,
 * website, phone, or email. Returns null when the check could not run (then
 * nothing is saved).
 */
export async function findOrgMatches(org: Pick<CleanOrg, "name" | "city" | "website" | "phone" | "email">, exclude: { kind: OrgKind; id: string } | null = null): Promise<OrgMatch[] | null> {
  const config = lplConfig();
  if (!config) return null;
  const headers = { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` };
  const domain = normDomain(org.website) || (org.email ? domainFromEmail(org.email) : "");
  const phone = phoneLike(org.phone);
  const nameKey = normName(org.name);
  const cityKey = normName(org.city);
  const like = nameLike(org.name);

  const churchSelect = "select=id,name:doc->>name,church_name:doc->>church_name,city:doc->>city,state:doc->>state,website:doc->>website,domain:doc->>domain,phone:doc->>phone,phone_office:doc->>phone_office,pastor_phone:doc->>pastor_phone,email:doc->>email,pastor_email:doc->>pastor_email,office_email:doc->>office_email,active:doc->>active,merged_into:doc->>merged_into,deleted_at:doc->>deleted_at";
  const leadSelect = "select=id,business_name,city,state,website_url,phone,email,status";
  const queries: Array<{ table: "cc_churches" | "op_leads"; query: string }> = [];
  if (like) {
    queries.push({ table: "cc_churches", query: `${churchSelect}&doc->>name=ilike.*${pgValue(like)}*&doc->>city=ilike.${pgValue(org.city)}&limit=10` });
    queries.push({ table: "op_leads", query: `${leadSelect}&business_name=ilike.*${pgValue(like)}*&city=ilike.${pgValue(org.city)}&limit=10` });
  }
  if (domain) {
    const d = `*${pgValue(domain)}*`;
    queries.push({ table: "cc_churches", query: `${churchSelect}&or=(doc->>website.ilike.${d},doc->>domain.ilike.${d})&limit=10` });
    queries.push({ table: "op_leads", query: `${leadSelect}&website_url=ilike.${d}&limit=10` });
  }
  if (phone) {
    const p = pgValue(phone);
    queries.push({ table: "cc_churches", query: `${churchSelect}&or=(doc->>phone.ilike.${p},doc->>phone_office.ilike.${p},doc->>pastor_phone.ilike.${p})&limit=10` });
    queries.push({ table: "op_leads", query: `${leadSelect}&phone=ilike.${p}&limit=10` });
  }
  if (org.email) {
    const e = pgValue(org.email);
    queries.push({ table: "cc_churches", query: `${churchSelect}&or=(doc->>email.eq.${e},doc->>pastor_email.eq.${e},doc->>office_email.eq.${e})&limit=10` });
    queries.push({ table: "op_leads", query: `${leadSelect}&email=eq.${e}&limit=10` });
  }

  try {
    const results = await Promise.all(
      queries.map(async ({ table, query }) => {
        const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, { method: "GET", headers, cache: "no-store" });
        if (!response.ok) throw new Error("match lookup failed");
        return { table, rows: (await response.json()) as MatchRow[] };
      })
    );
    const found = new Map<string, OrgMatch>();
    for (const { table, rows } of results) {
      for (const row of rows) {
        const kind: OrgKind = table === "cc_churches" ? "church" : "business";
        const id = String(row.id ?? "");
        if (!id || (exclude && exclude.kind === kind && exclude.id === id)) continue;
        if (kind === "church" && (String(row.active) === "false" || row.merged_into || row.deleted_at)) continue;
        const name = String((kind === "church" ? row.name || row.church_name : row.business_name) ?? "");
        const city = String(row.city ?? "");
        const why: string[] = [];
        const sameName = normName(name) === nameKey && normName(city) === cityKey;
        if (sameName) why.push("same name and town");
        else if (like && normName(city) === cityKey && normName(name).includes(nameKey)) why.push("similar name, same town");
        const websites = kind === "church" ? [row.website, row.domain] : [row.website_url];
        if (domain && websites.some((value) => normDomain(value) === domain)) why.push("same website");
        const phones = kind === "church" ? [row.phone, row.phone_office, row.pastor_phone] : [row.phone];
        if (phone && phones.some((value) => normPhone(value) === normPhone(org.phone))) why.push("same phone");
        const emails = kind === "church" ? [row.email, row.pastor_email, row.office_email] : [row.email];
        if (org.email && emails.some((value) => normEmail(value) === org.email)) why.push("same email");
        if (!why.length) continue; // a loose ilike hit that isn't really the same
        const key = `${kind}:${id}`;
        const prior = found.get(key);
        const town = [city, String(row.state ?? "")].filter(Boolean).join(", ");
        found.set(key, {
          kind,
          id,
          name: name || (kind === "church" ? "Church" : "Business"),
          town,
          why: [...new Set([...(prior?.why ?? []), ...why])],
          hard: Boolean(prior?.hard) || sameName
        });
      }
    }
    return [...found.values()].sort((a, b) => Number(b.hard) - Number(a.hard) || b.why.length - a.why.length).slice(0, 8);
  } catch {
    return null;
  }
}

/** op_leads.slug: kebab, at most 80, unique (a short suffix is added on a clash). */
export function leadSlug(name: string, city: string, suffix = ""): string {
  const base = normName(`${name} ${city}`).replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "business";
  const tail = suffix ? `-${suffix}` : "";
  return `${base.slice(0, 80 - tail.length).replace(/-$/, "")}${tail}`;
}

function matchBlock(org: CleanOrg, matches: OrgMatch[] | null): OrgSaveResult | null {
  if (matches === null) return { ok: false, message: "Couldn't check whether it's already here, so nothing was saved. Try again." };
  if (!matches.length) return null;
  if (matches.some((match) => match.hard)) {
    return { ok: false, matches, message: `${org.name} in ${org.city} is already here. Open it instead.` };
  }
  if (!org.confirmNew) {
    return { ok: false, matches, message: "This might already be here. Open the match, or say it's a different one." };
  }
  return null;
}

export async function createOrg(ownerEmail: string, raw: Partial<OrgInput>): Promise<OrgSaveResult> {
  const org = cleanOrgInput(raw);
  if (typeof org === "string") return { ok: false, message: org };
  const cc = org.kind === "church" ? await ccConfig() : null;
  if (org.kind === "church" && !cc) return { ok: false, message: savingOffMessage() };
  if (org.kind === "business" && !lplConfig()) return { ok: false, message: savingOffMessage() };

  const blocked = matchBlock(org, await findOrgMatches(org));
  if (blocked) return blocked;

  if (org.kind === "church") {
    const result = await callChurchConnect(cc as CcConfig, "POST", "/api/church-crm/leads", ownerEmail, {
      church_name: org.name,
      city: org.city,
      state: org.state,
      website: org.website,
      contact_phone: org.phone,
      contact_email: org.email,
      crm_offers: org.offers
    });
    if (!result.ok) return { ok: false, message: failure(result.status, result.json) };
    const existing = typeof result.json?.existing_id === "string" ? result.json.existing_id : "";
    if (result.json?.success === false && existing) {
      return {
        ok: false,
        message: `${org.name} in ${org.city} is already in ChurchConnect. Open it instead.`,
        matches: [{ kind: "church", id: existing, name: org.name, town: [org.city, org.state].filter(Boolean).join(", "), why: ["same name and town"], hard: true }]
      };
    }
    const id = typeof result.json?.church_id === "string" ? result.json.church_id : "";
    if (!UUID_RE.test(id)) return { ok: false, message: "ChurchConnect didn't say it saved. Reload before trying again." };
    return { ok: true, kind: "church", id, message: `Added ${org.name}. It stays hidden from the public directory until it's real.` };
  }
  return insertBusinessLead(org);
}

async function insertBusinessLead(org: CleanOrg): Promise<OrgSaveResult> {
  const config = lplConfig();
  if (!config) return { ok: false, message: savingOffMessage() };
  const headers = { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const suffix = attempt === 0 ? "" : crypto.randomUUID().slice(0, 4);
    try {
      const response = await fetch(`${config.url}/rest/v1/op_leads?select=id`, {
        method: "POST",
        headers,
        cache: "no-store",
        body: JSON.stringify({
          slug: leadSlug(org.name, org.city, suffix),
          business_name: org.name,
          kind: "shop",
          city: org.city || null,
          state: org.state || null,
          phone: org.phone || null,
          email: org.email || null,
          website_url: org.website || null,
          // Not scored yet: "refresh" is the mildest "has a site" value; "none" when there is no site.
          site_status: org.website ? "refresh" : "none",
          status: "new",
          send_invite: false,
          source: "appengine_crm",
          services: org.offers,
          signals: { services: org.offers, added_from: "owner_desk", site_scored: false }
        })
      });
      if (response.status === 409) continue; // slug clash: try a suffix
      if (!response.ok) return { ok: false, message: "The business couldn't be saved. Nothing was saved — try again." };
      const [row] = ((await response.json()) as Array<{ id?: string }>) ?? [];
      if (!row?.id) return { ok: false, message: "The business didn't come back saved. Reload before trying again." };
      return { ok: true, kind: "business", id: row.id, message: `Added ${org.name} as a business lead.` };
    } catch {
      return { ok: false, message: "The database didn't answer. Nothing was saved — try again in a minute." };
    }
  }
  return { ok: false, message: "Couldn't find a free short name for this business. Change the name a little and try again." };
}

/** The church's current email (normalized), or null when it can't be read. */
async function currentChurchEmail(churchId: string): Promise<string | null> {
  const config = lplConfig();
  if (!config) return null;
  try {
    const response = await fetch(`${config.url}/rest/v1/cc_churches?id=eq.${churchId}&select=email:doc->>email&limit=1`, {
      method: "GET",
      headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` },
      cache: "no-store"
    });
    if (!response.ok) return null;
    const [row] = ((await response.json()) as Array<{ email?: string | null }>) ?? [];
    return row ? normEmail(row.email) : null;
  } catch {
    return null;
  }
}

export async function editOrg(ownerEmail: string, kind: OrgKind, id: string, raw: Partial<OrgInput>): Promise<OrgSaveResult> {
  if (!UUID_RE.test(id)) return { ok: false, message: "That org can't be edited here. Reload the page." };
  const org = cleanOrgInput(raw, kind);
  if (typeof org === "string") return { ok: false, message: org };
  const cc = kind === "church" ? await ccConfig() : null;
  if (kind === "church" && !cc) return { ok: false, message: savingOffMessage() };
  if (kind === "business" && !lplConfig()) return { ok: false, message: savingOffMessage() };

  const blocked = matchBlock(org, await findOrgMatches(org, { kind, id }));
  if (blocked) return blocked;

  if (kind === "church") {
    const body: Record<string, unknown> = {
      church_name: org.name,
      city: org.city,
      state: org.state,
      website: org.website,
      contact_phone: org.phone,
      crm_offers: org.offers
    };
    // The church email is sent only when it actually changed (and ChurchConnect never
    // copies a desk edit into the login/billing email). Unknown current value = don't send.
    const current = await currentChurchEmail(id);
    if (current !== null && current !== org.email) body.contact_email = org.email;
    const result = await callChurchConnect(cc as CcConfig, "PATCH", `/api/church-crm/leads/${id}`, ownerEmail, body);
    if (!result.ok) return { ok: false, message: failure(result.status, result.json) };
    return { ok: true, kind, id, message: `Saved ${org.name}.` };
  }

  const config = lplConfig() as LplConfig;
  const headers = { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` };
  const STALE = "Someone else changed this business since you opened it. Reload, check it, and save again.";
  try {
    const read = await fetch(`${config.url}/rest/v1/op_leads?id=eq.${id}&select=signals,services,updated_at&limit=1`, { method: "GET", headers, cache: "no-store" });
    if (!read.ok) return { ok: false, message: "The business couldn't be read. Nothing was saved." };
    const [row] = ((await read.json()) as Array<{ signals?: Record<string, unknown>; services?: unknown; updated_at?: string | null }>) ?? [];
    if (!row) return { ok: false, message: "That business isn't there any more." };
    // Stale-save check: the form carries the updated_at it was opened with.
    const version = text(raw.version, 64);
    if (version && row.updated_at && version !== row.updated_at) return { ok: false, message: STALE };
    const services = mergeBusinessServices(row.services, org.offers);
    const prevSignals = row.signals && typeof row.signals === "object" ? row.signals : {};
    const signals = { ...prevSignals, services: mergeBusinessServices(prevSignals.services, org.offers) };
    // Guarded on the updated_at we just read, so a save that lands in between isn't overwritten.
    const guard = row.updated_at ? `&updated_at=eq.${encodeURIComponent(row.updated_at)}` : "";
    const response = await fetch(`${config.url}/rest/v1/op_leads?id=eq.${id}${guard}&select=id`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
      cache: "no-store",
      body: JSON.stringify({
        business_name: org.name,
        city: org.city || null,
        state: org.state || null,
        phone: org.phone || null,
        email: org.email || null,
        website_url: org.website || null,
        services,
        signals,
        updated_at: new Date().toISOString()
      })
    });
    if (!response.ok) return { ok: false, message: "The business couldn't be saved. Nothing was saved — try again." };
    const saved = (await response.json()) as unknown[];
    if (!Array.isArray(saved) || saved.length !== 1) return { ok: false, message: STALE };
    return { ok: true, kind, id, message: `Saved ${org.name}.` };
  } catch {
    return { ok: false, message: "The database didn't answer. Nothing was saved — try again in a minute." };
  }
}

/**
 * The apps picked on the form replace only the apps the form shows. Anything
 * else already on the row (a hidden or older service) is kept.
 */
export function mergeBusinessServices(current: unknown, picked: string[]): string[] {
  const shown = new Set<string>(BUSINESS_OFFER_IDS);
  const kept = (Array.isArray(current) ? current : []).map((value) => String(value ?? "").trim()).filter((value) => value && !shown.has(value));
  return [...new Set([...kept, ...picked])];
}

// ── Business leads: contacts, visits and drop-offs, do-not-contact ─────────
// The same forms as a church; the saves go straight to the shared database
// (op_leads.contacts, op_lead_activities), which only this desk writes.

type LeadRow = {
  id: string;
  business_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website_url?: string | null;
  status?: string | null;
  signals?: Record<string, unknown> | null;
  contacts?: unknown;
  updated_at?: string | null;
};

function lplHeaders(config: LplConfig): Record<string, string> {
  return { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}` };
}

async function readLead(config: LplConfig, leadId: string): Promise<LeadRow | null | "error"> {
  try {
    const response = await fetch(`${config.url}/rest/v1/op_leads?id=eq.${leadId}&select=id,business_name,email,phone,website_url,status,signals,contacts,updated_at&limit=1`, {
      method: "GET",
      headers: lplHeaders(config),
      cache: "no-store"
    });
    if (!response.ok) return "error";
    const [row] = ((await response.json()) as LeadRow[]) ?? [];
    return row ?? null;
  } catch {
    return "error";
  }
}

/**
 * Change one lead only if nobody else changed it since we read it (updated_at
 * must still match). Returns false when the row moved or the write failed.
 */
async function patchLeadIfUnchanged(config: LplConfig, lead: LeadRow, patch: Record<string, unknown>): Promise<boolean> {
  try {
    const guard = lead.updated_at ? `&updated_at=eq.${encodeURIComponent(lead.updated_at)}` : "";
    const response = await fetch(`${config.url}/rest/v1/op_leads?id=eq.${lead.id}${guard}&select=id`, {
      method: "PATCH",
      headers: { ...lplHeaders(config), "Content-Type": "application/json", Prefer: "return=representation" },
      cache: "no-store",
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
    });
    if (!response.ok) return false;
    const rows = (await response.json()) as unknown[];
    return Array.isArray(rows) && rows.length === 1;
  } catch {
    return false;
  }
}

type StoredContact = { id: string; name: string; role: string; email: string; phone: string };

/** op_leads.contacts in the same shape as ChurchConnect staff_contacts. */
export function leadContacts(value: unknown): StoredContact[] {
  const list = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  return list
    .filter((item) => item && typeof item === "object" && text(item.name, 120))
    .map((item) => ({
      id: text(item.id, 64),
      name: text(item.name, 120),
      role: text(item.role ?? item.title, 80),
      email: normEmail(item.email),
      phone: text(item.phone, 40)
    }));
}

const LEAD_CONTACT_LIMIT = 25;
const BUSY = "Someone else just changed this business. Reload and try again.";

export async function saveBusinessContact(_ownerEmail: string, leadId: string, raw: Partial<ContactInput>): Promise<SaveResult> {
  const config = lplConfig();
  if (!config) return { ok: false, message: savingOffMessage() };
  if (!UUID_RE.test(leadId)) return { ok: false, message: "Contacts can only be saved on a business lead." };
  const contact = cleanContactInput(raw);
  if (typeof contact === "string") return { ok: false, message: contact };
  const lead = await readLead(config, leadId);
  if (lead === "error") return { ok: false, message: "The business couldn't be read. Nothing was saved." };
  if (!lead) return { ok: false, message: "That business isn't there any more." };
  const contacts = leadContacts(lead.contacts);
  const entry: StoredContact = { id: contact.id, name: contact.name, role: contact.title, email: contact.email, phone: contact.phone };
  const at = contacts.findIndex((item) => item.id === contact.id);
  if (at >= 0) contacts[at] = entry;
  else if (contacts.length >= LEAD_CONTACT_LIMIT) return { ok: false, message: `A business can have up to ${LEAD_CONTACT_LIMIT} contacts.` };
  else contacts.push(entry);
  if (!(await patchLeadIfUnchanged(config, lead, { contacts }))) return { ok: false, message: BUSY };
  return { ok: true, message: `Saved ${contact.name}.`, contactId: contact.id };
}

export async function removeBusinessContact(_ownerEmail: string, leadId: string, contactId: string): Promise<SaveResult> {
  const config = lplConfig();
  if (!config) return { ok: false, message: savingOffMessage() };
  if (!UUID_RE.test(leadId)) return { ok: false, message: "Contacts can only be removed on a business lead." };
  if (!CONTACT_ID_RE.test(contactId)) return { ok: false, message: "That contact can't be removed. Reload the page and try again." };
  const lead = await readLead(config, leadId);
  if (lead === "error") return { ok: false, message: "The business couldn't be read. Nothing was removed." };
  if (!lead) return { ok: false, message: "That business isn't there any more." };
  const contacts = leadContacts(lead.contacts);
  const kept = contacts.filter((item) => item.id !== contactId);
  if (kept.length === contacts.length) return { ok: true, message: "Contact removed." };
  if (!(await patchLeadIfUnchanged(config, lead, { contacts: kept }))) return { ok: false, message: BUSY };
  return { ok: true, message: "Contact removed." };
}

/** Do-not-contact rows this desk adds for a business carry its id, so an undo removes only those. */
export function leadSuppressionSource(leadId: string): string {
  return `crm_visit:op_lead:${leadId}`;
}

/** Every way to reach this business, normalized the way the desk matches them. */
export function leadSuppressionRows(lead: LeadRow): SuppressionRow[] {
  return suppressionRowsFor({
    email: lead.email,
    phone: lead.phone,
    website: lead.website_url,
    staff_contacts: leadContacts(lead.contacts)
  });
}

/** A day typed on the form, stored as 16:00 UTC (noon Eastern in summer, 11 AM in winter) so the reader shows the same calendar day. */
export function leadDayStamp(day: string): string {
  return `${day}T16:00:00.000Z`;
}

export async function logBusinessVisit(ownerEmail: string, raw: Partial<VisitInput>): Promise<SaveResult> {
  const config = lplConfig();
  if (!config) return { ok: false, message: savingOffMessage() };
  const visit = cleanVisitInput(raw);
  if (typeof visit === "string") return { ok: false, message: visit };
  if (!visit.leadId) return { ok: false, message: "Visits can only be logged on a church or business lead on this desk." };
  const label = visit.kind === "visit" ? "Visit" : "Drop-off";
  const lead = await readLead(config, visit.leadId);
  if (lead === "error") return { ok: false, message: "The business couldn't be read. Nothing was saved." };
  if (!lead) return { ok: false, message: "That business isn't there any more." };
  let duplicate = false;
  try {
    // client_ref is unique: a double tap or a retry returns nothing new instead of a second row.
    const response = await fetch(`${config.url}/rest/v1/op_lead_activities?on_conflict=client_ref&select=id`, {
      method: "POST",
      headers: { ...lplHeaders(config), "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" },
      cache: "no-store",
      body: JSON.stringify({
        lead_id: visit.leadId,
        type: visit.kind,
        occurred_at: leadDayStamp(visit.day),
        contact: visit.contact,
        left_item: visit.leftItem || null,
        outcome_code: visit.outcomeCode || null,
        outcome: visit.outcomeNote || null,
        next_step: visit.nextStep || null,
        next_action_date: visit.nextDate || null,
        created_by: ownerEmail,
        client_ref: visit.clientRef,
        source: "appengine_crm"
      })
    });
    if (!response.ok) return { ok: false, message: `The ${label.toLowerCase()} couldn't be saved. Nothing was saved — try again.` };
    const rows = (await response.json()) as unknown[];
    duplicate = Array.isArray(rows) && rows.length === 0;
  } catch {
    return { ok: false, message: "The database didn't answer. Nothing was saved — try again in a minute." };
  }
  if (visit.outcomeCode === "do_not_contact") {
    const listed = await addLeadToDoNotContact(config, lead);
    if (!listed) {
      return { ok: false, message: `${label} saved, but the business couldn't be put on the do-not-contact list. Try saving again.` };
    }
  }
  return { ok: true, duplicate, message: duplicate ? `${label} was already saved.` : `${label} saved.` };
}

/** A PostgREST filter value in double quotes (commas, dots and parens inside stay literal). */
function pgQuoted(value: string): string {
  return `"${value.replace(/[\\"]/g, (char) => `\\${char}`)}"`;
}

/**
 * Rows already on the shared do-not-contact list that match any of these (any source).
 * The query is case-insensitive and may over-match; callers compare exactly with sameSuppression.
 */
async function existingSuppressions(config: LplConfig, rows: SuppressionRow[]): Promise<Array<SuppressionRow & { reason?: string; source?: string }> | null> {
  const ors: string[] = [];
  for (const row of rows) {
    if (row.email) ors.push(`email.ilike.${pgQuoted(row.email)}`);
    if (row.domain) ors.push(`domain.ilike.${pgQuoted(row.domain)}`);
    if (row.phone) ors.push(`phone.eq.${pgQuoted(row.phone)}`);
  }
  if (!ors.length) return [];
  try {
    const filter = encodeURIComponent(`(${ors.join(",")})`);
    const response = await fetch(`${config.url}/rest/v1/outreach_suppressions?or=${filter}&select=email,domain,phone,reason,source&limit=500`, {
      method: "GET",
      headers: lplHeaders(config),
      cache: "no-store"
    });
    if (!response.ok) return null;
    const found = (await response.json()) as Array<SuppressionRow & { reason?: string; source?: string }>;
    if (!Array.isArray(found)) return null;
    return found.filter((hit) => rows.some((row) => sameSuppression(row, hit)));
  } catch {
    return null;
  }
}

function sameSuppression(a: SuppressionRow, b: SuppressionRow): boolean {
  if (a.email) return normEmail(b.email) === a.email;
  if (a.domain) return normDomain(b.domain) === a.domain;
  if (a.phone) return normPhone(b.phone) === a.phone;
  return false;
}

/** Why a business is still blocked after an undo, leading with the name: opted out, bounced, or another reason. */
export function stillListedReason(name: string, reasons: string[]): string {
  const set = new Set(reasons.map((reason) => String(reason || "").toLowerCase()));
  if (set.has("opt_out") || set.has("complaint")) return `${name} opted out themselves`;
  if (set.has("bounce")) return `${name}'s email bounced`;
  return `${name} is on the list for another reason`;
}

async function addLeadToDoNotContact(config: LplConfig, lead: LeadRow): Promise<boolean> {
  try {
    // One claim per address through outreach_suppress(): a row already on the list (any source)
    // keeps its real reason; this desk only adds its claim, so repeats never add rows.
    if (!(await claimSuppressions(config, leadSuppressionRows(lead), leadSuppressionSource(lead.id)))) return false;
    const signals = { ...(lead.signals && typeof lead.signals === "object" ? lead.signals : {}) };
    // Already marked from this desk (a repeat): keep the status it had before the first time.
    if (lead.status === "suppressed" && signals.dnc_source === "crm_visit") return true;
    // Always mark it, even when it was already suppressed some other way, so the claim above can
    // be undone. Undo puts back exactly this status ("suppressed" stays suppressed).
    signals.dnc_source = "crm_visit";
    signals.dnc_prev_status = lead.status || "new";
    return await patchLeadIfUnchanged(config, lead, { status: "suppressed", signals });
  } catch {
    return false;
  }
}

export async function undoBusinessDoNotContact(_ownerEmail: string, leadId: string): Promise<SaveResult> {
  const config = lplConfig();
  if (!config) return { ok: false, message: savingOffMessage() };
  if (!UUID_RE.test(leadId)) return { ok: false, message: "Only a business lead can be undone here." };
  const lead = await readLead(config, leadId);
  if (lead === "error") return { ok: false, message: "The business couldn't be read. Nothing was changed." };
  if (!lead) return { ok: false, message: "That business isn't there any more." };
  const signals = { ...(lead.signals && typeof lead.signals === "object" ? lead.signals : {}) };
  // Only a do-not-contact this desk set can be undone here.
  if (signals.dnc_source !== "crm_visit") return { ok: false, message: "This business wasn't marked do-not-contact from this desk." };
  const prevRaw = typeof signals.dnc_prev_status === "string" ? signals.dnc_prev_status : "new";
  const name = text(lead.business_name, 160) || "This business";
  // 1. Remove only this desk's claim (read back: none left). Safe to repeat.
  const released = await releaseClaim(config, leadSuppressionSource(leadId));
  if (!released || released.remaining !== 0) return { ok: false, message: "The do-not-contact list couldn't be cleared. Nothing else was changed — try again." };
  // 2. Never reopen a business still on the list another way: its email, phone or website, any source.
  const own: SuppressionRow[] = [
    ...(normEmail(lead.email) ? [{ email: normEmail(lead.email) }] : []),
    ...(normPhone(lead.phone) ? [{ phone: normPhone(lead.phone) }] : []),
    ...(normDomain(lead.website_url) ? [{ domain: normDomain(lead.website_url) }] : [])
  ];
  const still = await existingSuppressions(config, own);
  // Can't tell: change nothing, so the desk mark (and the Undo button) stay and Undo can be tried again.
  if (still === null) return { ok: false, message: `The do-not-contact list couldn't be checked, so ${name} stays blocked. Try Undo again in a minute.` };
  const cleared = { ...signals };
  delete cleared.dnc_source;
  delete cleared.dnc_prev_status;
  const elsewhere = still.length > 0;
  const status = elsewhere || prevRaw === "suppressed" ? "suppressed" : prevRaw;
  if (!(await patchLeadIfUnchanged(config, lead, { status, signals: cleared }))) {
    return { ok: false, message: "The business couldn't be updated. Reload and undo again." };
  }
  if (elsewhere) {
    return { ok: true, warn: true, message: `Still on the do-not-contact list. ${stillListedReason(name, still.map((row) => row.reason ?? ""))}, so it stays blocked. Don't contact it.` };
  }
  if (status === "suppressed") {
    // Only the status was set before this desk's stop; nothing is on the list.
    return { ok: true, warn: true, message: `Still blocked. ${name} was already marked do-not-contact before this, so it stays blocked. Don't contact it.` };
  }
  return { ok: true, message: "Undone. You can contact this business again." };
}
