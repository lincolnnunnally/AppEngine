// CRM saving — SERVER ONLY. The owner logs a church visit or drop-off and
// saves church contacts from the desk. Every save goes through ChurchConnect's
// own CRM routes, so ChurchConnect stays the one writer of its records:
//   POST /api/church-crm/leads/{church}/activities
//   PUT  /api/church-crm/leads/{church}/contacts/{contact}
// Each call carries a pass that lives at most 2 minutes and is bound to that
// one method and exact path. The only direct write here is the shared
// do-not-contact list, when a visit ends with "asked not to be contacted".
// Nothing here logs a body, a contact detail, or the pass. Nothing is sent to
// anyone.
import { mintHs256Jwt } from "@/lib/engine/admin-door-handoff";
import { resolveCrmSecret } from "@/lib/engine/crm-pass-secret";
import { domainFromEmail, normDomain, normEmail, normPhone } from "@/lib/engine/lpl-crm-core";

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

export type SaveResult = { ok: true; message: string; duplicate?: boolean; contactId?: string } | { ok: false; message: string };

export type ContactInput = { id: string; name: string; title: string; email: string; phone: string };

export type VisitInput = {
  churchId: string;
  kind: VisitKind;
  day: string;
  contact: { id: string; name: string; title: string } | null;
  leftItem: string;
  outcomeCode: OutcomeCode | "";
  outcomeNote: string;
  nextStep: string;
  nextDate: string;
  clientRef: string;
};

type CcConfig = { base: string; secret: string };

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
export function mintCrmPass(secret: string, method: "POST" | "PUT", path: string, ownerEmail: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
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
  const churchId = text(input.churchId, 64);
  if (!UUID_RE.test(churchId)) return "Visits can only be logged on a ChurchConnect church.";
  const kind = VISIT_KINDS.includes(input.kind as VisitKind) ? (input.kind as VisitKind) : null;
  if (!kind) return "Pick visit or drop-off.";
  const day = text(input.day, 10);
  if (!validDay(day)) return "Pick the day you went.";
  const clientRef = text(input.clientRef, 64);
  if (!REF_RE.test(clientRef)) return "Reload the page and try again.";
  const outcomeCode = OUTCOME_CODES.includes(input.outcomeCode as OutcomeCode) ? (input.outcomeCode as OutcomeCode) : "";
  const nextStep = outcomeCode === "do_not_contact" ? "" : text(input.nextStep, 200);
  const nextDate = outcomeCode === "do_not_contact" ? "" : text(input.nextDate, 10);
  if (nextDate && !validDay(nextDate)) return "Pick a real day for the next step.";
  if (nextDate && !nextStep) return "Say what the next step is.";
  const contact = input.contact && text(input.contact.name, 120)
    ? { id: text(input.contact.id, 64), name: text(input.contact.name, 120), title: text(input.contact.title, 80) }
    : null;
  return {
    churchId,
    kind,
    day,
    contact,
    leftItem: text(input.leftItem, 200),
    outcomeCode,
    outcomeNote: text(input.outcomeNote, 300),
    nextStep,
    nextDate,
    clientRef
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

async function callChurchConnect(config: CcConfig, method: "POST" | "PUT", path: string, ownerEmail: string, body: unknown): Promise<{ ok: boolean; status: number; json: Record<string, unknown> | null }> {
  try {
    const response = await fetch(`${config.base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Engine-Pass": mintCrmPass(config.secret, method, path, ownerEmail),
        ...previewBypassHeader()
      },
      body: JSON.stringify(body),
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
  for (const email of emails) {
    const domain = domainFromEmail(email);
    if (domain) domains.add(domain);
  }
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
    const rows = suppressionRowsFor(church);
    for (const row of rows) {
      // One row per address: an address already on the list answers 409, which is fine.
      const insert = await fetch(`${config.url}/rest/v1/outreach_suppressions`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ ...row, brand: "all", reason: "do_not_contact", source: "crm_visit" }),
        cache: "no-store"
      });
      if (!insert.ok && insert.status !== 409) return false;
    }
    return true;
  } catch {
    return false;
  }
}
