// Server read of the ChurchConnect directory for /crm.
// One keyset page of cc_churches. No offset. No writes. Nothing is sent.

import { readChurchSignals } from "./tech-director-core.ts";
import {
  DIRECTORY_PAGE_SIZE,
  TIER_WALK,
  churchLeadTagPath,
  decodeDirectoryCursor,
  directoryContactTagFilter,
  directoryContactTagFilterActive,
  directoryRpcArgs,
  directoryRowMatches,
  directoryTagChurchPath,
  encodeDirectoryCursor,
  directoryRowFromRecord,
  pageDirectoryRaw,
  type DirectoryCursor,
  type DirectoryQuery,
  type DirectoryRow,
  type ProviderReportRow,
  type TierWalk
} from "./crm-directory-core.ts";
import type { CrmCard, CrmChurchSignal, CrmContact } from "./lpl-crm-core.ts";
import { PROVIDER_TYPE_LABEL, normEmail, withOutreachLog, type ProviderType } from "./lpl-crm-core.ts";
import { businessNode } from "./lpl-crm.ts";

export type DirectoryPage = {
  configured: boolean;
  ok: boolean;
  rows: DirectoryRow[];
  nextCursor: string;
};

export type ChurchHistoryItem = {
  id: string;
  at: string;
  kind: string;
  what: string;
};

export type ChurchDetail = {
  row: DirectoryRow;
  card: CrmCard;
  history: ChurchHistoryItem[];
  website: string;
  phone: string;
  email: string;
};

type Config = { url: string; key: string };

function config(): Config | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!url || !key) return null;
  return { url, key };
}

async function rest(cfg: Config, path: string): Promise<unknown[] | null> {
  try {
    const response = await fetch(`${cfg.url}/rest/v1/${path}`, {
      method: "GET",
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, "accept-profile": "public" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return null;
    const data = (await response.json()) as unknown;
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function tiersToWalk(query: DirectoryQuery, cursor: DirectoryCursor | null): TierWalk[] {
  const order = query.dir === "desc" ? [...TIER_WALK].reverse() : [...TIER_WALK];
  if (query.tier) {
    const only = order.filter((tier) => tier === query.tier);
    return only.length ? only : order.filter((tier) => tier === "unset");
  }
  if (cursor?.tier && order.includes(cursor.tier)) return order.slice(order.indexOf(cursor.tier));
  return order;
}

export async function loadDirectoryPage(query: DirectoryQuery): Promise<DirectoryPage> {
  const cfg = config();
  if (!cfg) return { configured: false, ok: false, rows: [], nextCursor: "" };
  if (directoryContactTagFilterActive(directoryContactTagFilter(query))) return loadTaggedDirectoryPage(cfg, query);
  const cursor = decodeDirectoryCursor(query.cursor);
  const want = DIRECTORY_PAGE_SIZE + 1;
  const raw: Record<string, unknown>[] = [];

  if (query.sort !== "tier") {
    const rows = await readRaw(cfg, query, cursor, want, "");
    if (!rows) return { configured: true, ok: false, rows: [], nextCursor: "" };
    raw.push(...rows);
  } else {
    let remaining = want;
    let started = false;
    for (const tier of tiersToWalk(query, cursor)) {
      const edge = !started && cursor?.tier === tier ? cursor : null;
      started = true;
      const batch = await readRaw(cfg, query, edge, remaining, tier);
      if (!batch) return { configured: true, ok: false, rows: [], nextCursor: "" };
      raw.push(...batch);
      remaining = want - raw.length;
      if (remaining <= 0) break;
    }
  }

  const page = pageDirectoryRaw(raw, query);
  return { configured: true, ok: true, rows: page.rows, nextCursor: page.next ? encodeDirectoryCursor(page.next) : "" };
}

const TAG_BATCH = 80;
const TAG_BATCHES = 8;

/** Contact-tag pages read cc_churches directly. crm_directory_page has no tag argument, and this adds none. */
async function loadTaggedDirectoryPage(cfg: Config, query: DirectoryQuery): Promise<DirectoryPage> {
  const cursor = decodeDirectoryCursor(query.cursor);
  let after = cursor?.id ?? "";
  const matches: DirectoryRow[] = [];
  let exhausted = false;
  for (let batch = 0; batch < TAG_BATCHES && matches.length <= DIRECTORY_PAGE_SIZE; batch += 1) {
    const path = directoryTagChurchPath(query, after, TAG_BATCH);
    if (!path) return { configured: true, ok: false, rows: [], nextCursor: "" };
    const rows = await rest(cfg, path);
    if (!rows) return { configured: true, ok: false, rows: [], nextCursor: "" };
    if (!rows.length) {
      exhausted = true;
      break;
    }
    for (const item of rows) {
      const row = directoryRowFromRecord(item as Record<string, unknown>);
      if (row && directoryRowMatches(row, query)) matches.push(row);
    }
    const last = String((rows[rows.length - 1] as { id?: unknown }).id ?? "");
    if (!last || last === after) {
      exhausted = true;
      break;
    }
    after = last;
    if (rows.length < TAG_BATCH) {
      exhausted = true;
      break;
    }
  }
  const pageRows = matches.slice(0, DIRECTORY_PAGE_SIZE);
  const more = matches.length > DIRECTORY_PAGE_SIZE || !exhausted;
  const edge = matches.length > DIRECTORY_PAGE_SIZE ? pageRows[pageRows.length - 1]?.id : after;
  const nextCursor = more && edge ? encodeDirectoryCursor({ sort: "id", dir: "asc", id: edge, value: "", tier: "", nulls: false }) : "";
  return { configured: true, ok: true, rows: pageRows, nextCursor };
}

/** Unmatched nationwide rows live on church-leads. This finds the ones whose contact tags match. Nothing is sent. */
export async function loadTaggedChurchLeadCards(query: DirectoryQuery): Promise<CrmCard[]> {
  const path = churchLeadTagPath(query, DIRECTORY_PAGE_SIZE);
  if (!path) return [];
  const cfg = config();
  if (!cfg) return [];
  const rows = await rest(cfg, path);
  if (!rows) return [];
  const cards: CrmCard[] = [];
  for (const item of rows) {
    const card = cardFromChurchLead(item as Record<string, unknown>);
    if (card) cards.push(card);
  }
  return cards;
}

function cardFromChurchLead(row: Record<string, unknown>): CrmCard | null {
  const node = businessNode(row);
  if (!node?.leadId || !node.leadQueue) return null;
  return withOutreachLog({
    key: node.id,
    name: node.name,
    town: node.town,
    state: node.state,
    kinds: ["org"],
    apps: ["business"],
    matchedBy: [],
    recordCount: 1,
    touches: node.touches,
    lastOutreach: null,
    lastTouch: null,
    repeat: { level: null, text: "" },
    stops: [],
    possibleMatches: [],
    tokens: [],
    events: [],
    locations: [],
    nextActionDate: null,
    nextActionMovedFrom: null,
    nextAction: "",
    nextStep: "",
    followUpReasons: [],
    recordPaths: {},
    churchId: null,
    leadId: node.leadId,
    leadQueue: true,
    contacts: node.contacts ?? [],
    deskDoNotContact: false,
    org: node.org ?? null,
    signals: node.signals,
    crmStatus: node.crmStatus
  });
}

async function readRaw(cfg: Config, query: DirectoryQuery, cursor: DirectoryCursor | null, limit: number, tier: TierWalk | ""): Promise<Record<string, unknown>[] | null> {
  try {
    const response = await fetch(`${cfg.url}/rest/v1/rpc/crm_directory_page`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        "accept-profile": "public",
        "content-profile": "public"
      },
      cache: "no-store",
      body: JSON.stringify(directoryRpcArgs(query, cursor, limit, tier)),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return null;
    const data = (await response.json()) as unknown;
    return Array.isArray(data) ? (data as Record<string, unknown>[]) : null;
  } catch {
    return null;
  }
}

const DETAIL_FIELDS = [
  "name", "church_name", "city", "state", "zip_code", "county", "region", "website", "phone", "email",
  "crm_status", "lead_class", "jev_avl_fit", "jev_project_stage", "last_invited_at", "last_contact_at",
  "avl_existing_relationship", "avl_existing_relationship_note", "avl_project_status", "building_stage", "building_stage_recorded_at",
  "is_customer", "signed_up", "invite_status",
  "pastor_name", "pastor_email", "pastor_phone", "secretary_name", "secretary_title", "contact_name", "contact_role",
  "crm_next_action", "crm_next_action_date", "do_not_contact", "do_not_contact_desk_claim"
];

export type ProviderReportLoad = { ok: boolean; rows: ProviderReportRow[] };

/** Owner desk only. Vendor names in this report are not part of any ChurchConnect public payload. */
export async function loadProviderReport(): Promise<ProviderReportLoad> {
  const cfg = config();
  if (!cfg) return { ok: true, rows: [] };
  try {
    const response = await fetch(`${cfg.url}/rest/v1/rpc/crm_service_provider_report`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        "accept-profile": "public",
        "content-profile": "public"
      },
      cache: "no-store",
      body: "{}",
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) return { ok: false, rows: [] };
    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) return { ok: false, rows: [] };
    return { ok: true, rows: data.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      const service = String(row.service ?? "");
      const providerType = String(row.provider_type ?? "");
      if (!service || !(providerType in PROVIDER_TYPE_LABEL)) return [];
      const vendorName = providerType === "vendor" ? String(row.vendor_name ?? "").trim() : "";
      return [{
        service,
        providerType,
        providerTypeLabel: PROVIDER_TYPE_LABEL[providerType as ProviderType],
        vendorName,
        churches: Number(row.churches) || 0
      }];
    }) };
  } catch {
    return { ok: false, rows: [] };
  }
}

export async function loadChurchDetail(id: string): Promise<ChurchDetail | null | "unconfigured" | "unread"> {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return null;
  const cfg = config();
  if (!cfg) return "unconfigured";
  const select = `select=id,${DETAIL_FIELDS.map((field) => `${field}:doc->>${field}`).join(",")},staff_contacts:doc->staff_contacts,crm_signals:doc->crm_signals,crm_offers:doc->crm_offers,service_opportunities:doc->service_opportunities,service_providers:doc->service_providers`;
  const rows = await rest(cfg, `cc_churches?id=eq.${encodeURIComponent(id)}&${select}&limit=1`);
  if (!rows) return "unread";
  const raw = rows[0] as Record<string, unknown> | undefined;
  if (!raw) return null;
  const row = directoryRowFromRecord(raw);
  if (!row) return null;
  const [activities, emails] = await Promise.all([
    rest(
      cfg,
      `cc_church_crm_activities?select=id,type:doc->>type,activity_type:doc->>activity_type,description:doc->>description,occurred_at:doc->>occurred_at,created_at:doc->>created_at,outcome:doc->>outcome,next_step:doc->>next_step&doc->>church_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=200`
    ),
    rest(
      cfg,
      `cc_email_log?select=id,subject:doc->>subject,status:doc->>status,created_at&doc->>church_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=100`
    )
  ]);
  const history = historyFrom(activities ?? [], emails ?? []);
  return {
    row,
    card: cardFrom(raw, row),
    history,
    website: text(raw.website),
    phone: text(raw.phone),
    email: normEmail(raw.email)
  };
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function historyFrom(activities: unknown[], emails: unknown[]): ChurchHistoryItem[] {
  const items: ChurchHistoryItem[] = [];
  for (const item of activities) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const kind = text(row.activity_type) || text(row.type) || "note";
    const what = [text(row.description), text(row.outcome), text(row.next_step)].filter(Boolean).join(" · ");
    items.push({ id: text(row.id) || `act-${items.length}`, at: text(row.occurred_at) || text(row.created_at), kind, what: what || kind });
  }
  for (const item of emails) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const subject = text(row.subject) || "Email";
    const status = text(row.status);
    items.push({ id: text(row.id) || `mail-${items.length}`, at: text(row.created_at), kind: "email", what: status ? `${subject} (${status})` : subject });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

function cardFrom(raw: Record<string, unknown>, row: DirectoryRow): CrmCard {
  const id = row.id;
  const contacts: CrmContact[] = [];
  const staff = Array.isArray(raw.staff_contacts) ? (raw.staff_contacts as Record<string, unknown>[]) : [];
  for (const item of staff) {
    const name = text(item.name);
    if (!name) continue;
    contacts.push({
      id: text(item.id) || `sc-${contacts.length}`,
      name,
      title: text(item.role || item.title),
      email: normEmail(item.email),
      phone: text(item.phone),
      source: "saved",
      tags: Array.isArray(item.tags) ? item.tags.map((tag) => text(tag)).filter(Boolean) : [],
      sourceUrl: text(item.source_url),
      status: "new"
    });
  }
  if (text(raw.pastor_name) && !contacts.some((contact) => contact.name.toLowerCase() === text(raw.pastor_name).toLowerCase())) {
    contacts.push({
      id: `cc-pastor-${id}`.slice(0, 64),
      name: text(raw.pastor_name),
      title: "Pastor",
      email: normEmail(raw.pastor_email),
      phone: text(raw.pastor_phone),
      source: "pastor"
    });
  }
  const signals: CrmChurchSignal[] = readChurchSignals(raw.crm_signals);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  return {
    key: `dir:${id}`,
    name: row.name,
    town: [row.city, row.state].filter(Boolean).join(", "),
    state: row.state,
    kinds: ["org"],
    apps: ["churchconnect"],
    matchedBy: [],
    recordCount: 1,
    touches: [],
    lastOutreach: null,
    lastTouch: null,
    repeat: { level: null, text: "" },
    stops: [],
    possibleMatches: [],
    tokens: [],
    events: [],
    locations: [],
    nextActionDate: text(raw.crm_next_action_date) || null,
    nextActionMovedFrom: null,
    nextAction: text(raw.crm_next_action),
    nextStep: text(raw.crm_next_action),
    followUpReasons: [],
    recordPaths: uuid ? { churchconnect: `/super-admin#crm/lead/${id}` } : {},
    churchId: uuid ? id : null,
    leadId: null,
    contacts,
    deskDoNotContact: text(raw.do_not_contact_desk_claim).toLowerCase() === "true",
    org: uuid
      ? {
          kind: "church",
          id,
          name: row.name,
          city: row.city,
          state: row.state,
          website: text(raw.website),
          phone: text(raw.phone),
          email: normEmail(raw.email),
          offers: Array.isArray(raw.crm_offers) ? raw.crm_offers.map((offer) => text(offer)).filter(Boolean) : []
        }
      : null,
    signals,
    crmStatus: row.crmStatus,
    leadClass: text(raw.lead_class),
    avlTier: row.tier,
    jevAvlFit: row.jevAvlFit,
    jevProjectStage: row.jevProjectStage,
    avlExistingRelationship: row.avlExistingRelationship,
    avlExistingRelationshipNote: row.avlExistingRelationshipNote,
    avlProjectStatus: row.avlProjectStatus,
    buildingStage: row.buildingStage,
    buildingStageRecordedAt: row.buildingStageRecordedAt,
    existingAvlTalks: row.existingAvlTalks
  };
}
