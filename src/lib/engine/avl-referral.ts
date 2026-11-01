// Builders and church architects → existing op_leads rows.
// kind is field. Tags carry fit:avl_referral. No new table, no new church, no send.
import { createHash } from "node:crypto";
import { normName } from "./lpl-crm-core.ts";
import { cleanImportContactTags, httpUrl, parsePublishedContact, stateCode } from "./tech-director-core.ts";
import { mergeChurchSignalContacts, parseCsv } from "./tech-director.ts";

/** op_leads.kind for an AVL referral firm. Already allowed. Not a church-lead. */
export const AVL_REFERRAL_KIND = "field";

export const AVL_REFERRAL_FIT_TAG = "fit:avl_referral";
export const AVL_REFERRAL_SOURCE_TAG = "src:avl_referral_20261101";

const ORG_HEADERS = ["org_name", "organization_name", "firm_name", "firm", "business_name", "organization", "company", "name"] as const;
const CONTACT_HEADERS = ["contact_name", "person_name", "key_people"] as const;
const TITLE_HEADERS = ["title", "key_people_titles"] as const;
const ROLE_HEADERS = ["role", "type", "types", "firm_type", "org_type", "role_type"] as const;
const EMAIL_HEADERS = ["email", "public_email"] as const;
const PHONE_HEADERS = ["phone", "public_phone"] as const;
const WEBSITE_HEADERS = ["website", "website_url", "url"] as const;
const CITY_HEADERS = ["city", "hq_city"] as const;
const STATE_HEADERS = ["state", "hq_state"] as const;
const ZIP_HEADERS = ["zip", "zip_code", "postal_code"] as const;
const PROJECT_HEADERS = ["church_projects", "notable_recent_church_projects", "notable_church_projects"] as const;
const SOURCE_HEADERS = ["source_url", "source"] as const;
const VERIFY_HEADERS = ["verify_status", "verify"] as const;
const LEAD_CLASS_HEADERS = ["lead_class"] as const;
const AV_HEADERS = ["av_inhouse_or_partner", "in_house_avl", "avl_note"] as const;
const HQ_HEADERS = ["hq_city_state"] as const;
const PUBLIC_CONTACT_HEADERS = ["public_phone_email"] as const;

const ROLE_TAG_BY_SLUG: Record<string, string> = {
  builder: "role:builder",
  architect: "role:architect",
  design_build: "role:design_build",
  designbuild: "role:design_build",
  capital_campaign_consultant: "role:capital_campaign_consultant",
  capital_campaign: "role:capital_campaign_consultant"
};

const IN_HOUSE_WATCH = [
  { label: "Domus Studio", test: /domus\s*studio|domusstudio/i },
  { label: "Paragon 360", test: /paragon\s*360/i }
] as const;

export type AvlReferralRow = {
  org: string;
  contactName: string;
  title: string;
  roleRaw: string;
  email: string;
  phone: string;
  website: string;
  city: string;
  state: string;
  zip: string;
  churchProjects: string;
  sourceUrl: string;
  verifyStatus: string;
  leadClass: string;
  avNote: string;
  line: number;
};

export type AvlReferralPlan = {
  headers: string[];
  inputRows: number;
  ready: number;
  leads: number;
  skippedNoOrg: number;
  skippedDoNotUse: number;
  missingWebsite: number;
  missingPhone: number;
  missingEmail: number;
  churchProjectRows: number;
  churchesInvented: 0;
  leadClassAvlReferral: number;
  roles: Record<string, number>;
  unmappedRoles: number;
  unmappedRoleLabels: string[];
  roleColumn: boolean;
  inHouseAvl: string[];
  bodies: Array<Record<string, unknown>>;
};

function clip(value: string, limit: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function headerKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Blank, and the Searcher "not found" / "not stated" placeholders. */
export function referralBlank(value: unknown): string {
  const raw = clip(String(value ?? ""), 500);
  if (!raw) return "";
  if (/^(n\/a|na|none|unknown|not found|not stated|not reviewed|-+)$/i.test(raw)) return "";
  if (/^not found\b/i.test(raw)) return "";
  if (/^not stated\b/i.test(raw)) return "";
  return raw;
}

function pick(index: Map<string, number>, record: string[], names: readonly string[]): string {
  for (const name of names) {
    const at = index.get(name);
    if (at === undefined) continue;
    const value = referralBlank(record[at]);
    if (value) return value;
  }
  return "";
}

/**
 * builder, architect, design-build, and capital_campaign_consultant.
 * Other words stay off the role tag. fit:avl_referral is added separately.
 */
export function referralRoleTags(value: unknown): string[] {
  const tags: string[] = [];
  for (const part of String(value ?? "").split(/[/|,;+()]+/)) {
    const slug = part
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    const tag = ROLE_TAG_BY_SLUG[slug];
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

/** Domus Studio and Paragon 360 only. A label for the dry-run. No provider row is created. */
export function inHouseAvlLabel(input: { org: string; website: string; avNote: string }): string {
  const hay = `${input.org} ${input.website} ${input.avNote}`;
  return IN_HOUSE_WATCH.filter((item) => item.test.test(hay))
    .map((item) => item.label)
    .join(", ");
}

function verifyTag(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  if (!slug || slug === "not_found" || slug === "unknown" || slug === "none" || slug === "na" || slug === "n_a") return "";
  if (slug === "do_not_use") return "";
  const tag = `verify:${slug}`;
  return cleanImportContactTags([tag])[0] ?? "";
}

export function referralContactTags(row: Pick<AvlReferralRow, "roleRaw" | "verifyStatus">): string[] {
  const tags = [AVL_REFERRAL_FIT_TAG, ...referralRoleTags(row.roleRaw)];
  const verify = verifyTag(row.verifyStatus);
  if (verify) tags.push(verify);
  tags.push(AVL_REFERRAL_SOURCE_TAG);
  return cleanImportContactTags(tags);
}

/**
 * Stable op_leads slug from the normalized firm, city, and state.
 * Same digest shape as a church-lead slug. The ar- prefix keeps the two apart.
 */
export function avlReferralSlug(org: string, city: string, state: string): string {
  const name = normName(org);
  const cityKey = normName((city.split(",")[0] ?? "").trim());
  const stateKey = stateCode(state).toLowerCase();
  const digest = createHash("sha1").update([name, cityKey, stateKey].join("|"), "utf8").digest("hex").slice(0, 10);
  const base = name.replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "avl-referral";
  return `ar-${base}-${digest}`.slice(0, 80);
}

function contactName(row: Pick<AvlReferralRow, "org" | "contactName" | "title" | "roleRaw">): string {
  if (row.contactName) return clip(row.contactName, 120);
  if (row.title) return clip(row.title, 120);
  const role = referralRoleTags(row.roleRaw)[0];
  if (role) return clip(role.slice("role:".length).replace(/_/g, " "), 120);
  return "Office";
}

function splitHq(value: string): { city: string; state: string } {
  const raw = referralBlank(value);
  if (!raw) return { city: "", state: "" };
  const comma = raw.lastIndexOf(",");
  if (comma < 0) return { city: raw, state: "" };
  return { city: referralBlank(raw.slice(0, comma)), state: referralBlank(raw.slice(comma + 1)) };
}

function publicLabel(value: string): string {
  return clip(value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ""), 80);
}

/** One firm row as an op_leads insert. kind is field. send_invite stays false. */
export function avlReferralLeadBody(row: AvlReferralRow): Record<string, unknown> {
  const tags = referralContactTags(row);
  const published = parsePublishedContact([row.email, row.phone].filter(Boolean).join(" | "));
  const email = parsePublishedContact(row.email).email || published.email;
  const phone = parsePublishedContact(row.phone).phone || published.phone;
  const website = httpUrl(row.website);
  const personName = contactName(row);
  const title = clip(row.title, 80) || clip(referralRoleTags(row.roleRaw)[0]?.slice("role:".length).replace(/_/g, " ") ?? "", 80);
  const projects = clip(row.churchProjects, 500);
  const inHouse = inHouseAvlLabel(row);
  const person = {
    id: `ar-${createHash("sha1").update(`${normName(row.org)}|${personName.toLowerCase()}`, "utf8").digest("hex").slice(0, 12)}`,
    name: personName,
    role: title,
    email,
    phone,
    tags,
    ...(httpUrl(row.sourceUrl) ? { source_url: httpUrl(row.sourceUrl) } : {}),
    status: "new"
  };
  return {
    slug: avlReferralSlug(row.org, row.city, row.state),
    business_name: clip(row.org, 160) || "AVL referral",
    kind: AVL_REFERRAL_KIND,
    city: clip(row.city, 80) || null,
    state: clip(stateCode(row.state) || row.state, 40) || null,
    phone: phone || null,
    email: email || null,
    website_url: website || null,
    site_status: website ? "refresh" : "none",
    status: "new",
    send_invite: false,
    source: "avl_referral_import",
    services: referralRoleTags(row.roleRaw).map((tag) => tag.slice("role:".length)),
    contacts: [person],
    signals: {
      kind: "avl-referral",
      tag: AVL_REFERRAL_FIT_TAG,
      tags,
      evidence_quote: projects,
      church_projects: projects,
      source_url: httpUrl(row.sourceUrl),
      zip: clip(row.zip, 20),
      lead_class: clip(row.leadClass, 80),
      ...(inHouse ? { in_house_avl: "possible", in_house_note: "possible in-house AVL" } : {})
    }
  };
}

/** One import log row. client_ref is stable for the same slug, person, and project note. */
export function avlReferralActivity(leadId: string, body: { slug?: unknown; contacts?: unknown; signals?: unknown }): Record<string, unknown> {
  const contacts = Array.isArray(body.contacts) ? body.contacts : [];
  const person = contacts.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
  const signals = body.signals && typeof body.signals === "object" ? (body.signals as Record<string, unknown>) : {};
  const quote = String(signals.church_projects ?? signals.evidence_quote ?? "");
  const who = person ? String(person.name ?? "") : "";
  const clientRef = `ar${createHash("sha1").update(`${String(body.slug ?? "")}|${who}|${quote}`, "utf8").digest("hex")}`.slice(0, 40);
  return {
    lead_id: leadId,
    type: "note",
    occurred_at: new Date().toISOString(),
    contact: person ? { id: person.id ?? "", name: person.name ?? "", title: person.role ?? "" } : null,
    outcome: "Imported as an AVL referral",
    source: "avl_referral_import",
    client_ref: clientRef,
    created_by: "avl_referral_import"
  };
}

function rowFromRecord(index: Map<string, number>, record: string[], line: number): AvlReferralRow {
  const hq = splitHq(pick(index, record, HQ_HEADERS));
  const combined = pick(index, record, PUBLIC_CONTACT_HEADERS);
  const combinedContact = parsePublishedContact(combined);
  const email = pick(index, record, EMAIL_HEADERS) || combinedContact.email;
  const phone = pick(index, record, PHONE_HEADERS) || combinedContact.phone;
  return {
    org: pick(index, record, ORG_HEADERS),
    contactName: pick(index, record, CONTACT_HEADERS),
    title: pick(index, record, TITLE_HEADERS),
    roleRaw: pick(index, record, ROLE_HEADERS),
    email: referralBlank(email),
    phone: referralBlank(phone),
    website: pick(index, record, WEBSITE_HEADERS),
    city: pick(index, record, CITY_HEADERS) || hq.city,
    state: pick(index, record, STATE_HEADERS) || hq.state,
    zip: pick(index, record, ZIP_HEADERS),
    churchProjects: pick(index, record, PROJECT_HEADERS),
    sourceUrl: pick(index, record, SOURCE_HEADERS),
    verifyStatus: pick(index, record, VERIFY_HEADERS),
    leadClass: pick(index, record, LEAD_CLASS_HEADERS),
    avNote: pick(index, record, AV_HEADERS),
    line
  };
}

function rememberBody(bodies: Map<string, Record<string, unknown>>, row: AvlReferralRow) {
  const body = avlReferralLeadBody(row);
  const slug = String(body.slug ?? "");
  const existing = bodies.get(slug);
  if (!existing) {
    bodies.set(slug, body);
    return;
  }
  const merged = mergeChurchSignalContacts(existing.contacts, body.contacts);
  existing.contacts = merged.contacts;
  for (const key of ["phone", "email", "website_url"] as const) {
    if (!existing[key] && body[key]) existing[key] = body[key];
  }
  const signals = existing.signals && typeof existing.signals === "object" ? (existing.signals as Record<string, unknown>) : {};
  const incoming = body.signals && typeof body.signals === "object" ? (body.signals as Record<string, unknown>) : {};
  const projects = [signals.church_projects, incoming.church_projects].map((item) => clip(String(item ?? ""), 500)).filter(Boolean);
  if (projects.length) {
    signals.church_projects = [...new Set(projects)].join("; ").slice(0, 500);
    signals.evidence_quote = signals.church_projects;
  }
  signals.tags = cleanImportContactTags([...(Array.isArray(signals.tags) ? signals.tags : []), ...(Array.isArray(incoming.tags) ? incoming.tags : [])]);
  if (!signals.in_house_avl && incoming.in_house_avl) {
    signals.in_house_avl = incoming.in_house_avl;
    signals.in_house_note = incoming.in_house_note;
  }
  existing.signals = signals;
  const services = [...new Set([...(Array.isArray(existing.services) ? existing.services : []), ...(Array.isArray(body.services) ? body.services : [])].map((item) => String(item)))];
  existing.services = services;
}

/**
 * Shape a Searcher CSV into field leads. Header names are flexible.
 * verify_status=do_not_use is skipped. A row with no org name is skipped.
 * church_projects stays on the lead. This does not create a church.
 */
export function planAvlReferralImport(text: string): { ok: true; plan: AvlReferralPlan } | { ok: false; message: string } {
  const table = parseCsv(text);
  if (!table.length) return { ok: false, message: "The CSV needs a header row with org_name." };
  const header = table[0].map((cell) => headerKey(cell));
  const index = new Map(header.map((name, at) => [name, at]));
  if (!ORG_HEADERS.some((name) => index.has(name))) {
    return {
      ok: false,
      message: `The CSV needs an org column (org_name, firm, or business_name). Headers: ${header.filter(Boolean).join(", ")}`
    };
  }
  const plan: AvlReferralPlan = {
    headers: header.filter(Boolean),
    inputRows: 0,
    ready: 0,
    leads: 0,
    skippedNoOrg: 0,
    skippedDoNotUse: 0,
    missingWebsite: 0,
    missingPhone: 0,
    missingEmail: 0,
    churchProjectRows: 0,
    churchesInvented: 0,
    leadClassAvlReferral: 0,
    roles: {},
    unmappedRoles: 0,
    unmappedRoleLabels: [],
    roleColumn: ROLE_HEADERS.some((name) => index.has(name)),
    inHouseAvl: [],
    bodies: []
  };
  const bodies = new Map<string, Record<string, unknown>>();
  const inHouse = new Set<string>();
  const unmapped = new Set<string>();
  for (let i = 1; i < table.length; i += 1) {
    const record = table[i];
    if (record.every((value) => !String(value ?? "").trim())) continue;
    plan.inputRows += 1;
    const verifyCell = VERIFY_HEADERS.map((name) => {
      const at = index.get(name);
      return at === undefined ? "" : String(record[at] ?? "").trim().toLowerCase();
    }).find(Boolean);
    if (verifyCell && verifyCell.replace(/[\s-]+/g, "_") === "do_not_use") {
      plan.skippedDoNotUse += 1;
      continue;
    }
    const row = rowFromRecord(index, record, i + 1);
    if (!row.org) {
      plan.skippedNoOrg += 1;
      continue;
    }
    plan.ready += 1;
    if (!httpUrl(row.website)) plan.missingWebsite += 1;
    if (!parsePublishedContact(row.phone).phone) plan.missingPhone += 1;
    if (!parsePublishedContact(row.email).email) plan.missingEmail += 1;
    if (row.churchProjects) plan.churchProjectRows += 1;
    if (headerKey(row.leadClass) === "avl_referral") plan.leadClassAvlReferral += 1;
    const roles = referralRoleTags(row.roleRaw);
    if (!roles.length) {
      plan.unmappedRoles += 1;
      const label = publicLabel(row.roleRaw);
      if (label) unmapped.add(label);
    }
    for (const tag of roles) plan.roles[tag] = (plan.roles[tag] ?? 0) + 1;
    const house = inHouseAvlLabel(row);
    if (house) inHouse.add(publicLabel(row.org) || house);
    rememberBody(bodies, row);
  }
  plan.bodies = [...bodies.values()];
  plan.leads = plan.bodies.length;
  plan.inHouseAvl = [...inHouse].sort();
  plan.unmappedRoleLabels = [...unmapped].sort().slice(0, 8);
  return { ok: true, plan };
}

/** Counts only. Org names appear only for the in-house AVL watch. No addresses. */
export function formatAvlReferralSummary(plan: AvlReferralPlan): string {
  const roles = Object.keys(plan.roles).sort();
  const roleLine = roles.length ? roles.map((tag) => `${tag} ${plan.roles[tag]}`).join(", ") : "none";
  const lines = [
    `avl referrals: ${plan.inputRows} in, ${plan.ready} ready, ${plan.leads} leads`,
    `skipped no org: ${plan.skippedNoOrg}`,
    `skipped do_not_use: ${plan.skippedDoNotUse}`,
    "kind: field",
    `${AVL_REFERRAL_FIT_TAG} on every ready row`,
    `role column: ${plan.roleColumn ? "yes" : "missing"}`,
    `roles: ${roleLine}`,
    `unmapped role: ${plan.unmappedRoles}`,
    ...(plan.unmappedRoleLabels.length ? [`unmapped role labels: ${plan.unmappedRoleLabels.join(", ")}`] : []),
    `missing website: ${plan.missingWebsite}`,
    `missing phone: ${plan.missingPhone}`,
    `missing email: ${plan.missingEmail}`,
    `church project notes: ${plan.churchProjectRows}`,
    "churches invented: 0",
    "church writes: 0",
    `lead_class avl_referral: ${plan.leadClassAvlReferral}`,
    `possible in-house AVL (not invented): ${plan.inHouseAvl.length ? plan.inHouseAvl.join(", ") : "none"}`,
    `headers: ${plan.headers.join(", ")}`,
    "nothing is sent"
  ];
  return lines.join("\n");
}
