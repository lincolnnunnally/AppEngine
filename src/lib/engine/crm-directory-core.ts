// Church directory list for /crm. Pure query building and row shaping.
// The desk reads cc_churches itself. It does not copy churches into another table.
// One page is a keyset (id, or a sort key plus id). There is no offset.

import {
  AVL_PROJECT_STATUS_LABEL,
  BUILDING_STAGE_LABEL,
  CRM_CHURCH_STATUSES,
  churchHoldsAvlWork,
  churchIsOnChurchConnect,
  cleanAvlProjectStatus,
  cleanBuildingStage,
  parseOpeningService,
  parseProviderService,
  parseProviderTypeFilter,
  parseServiceOpportunityFilter,
  serviceOpportunitiesFromDoc,
  serviceProvidersFromDoc,
  truthyFlag,
  PROVIDER_TYPE_LABEL,
  SERVICE_PROVIDER_IDS,
  type AvlProjectStatus,
  type BuildingStage,
  type ServiceOpportunities,
  type ServiceProviders
} from "./lpl-crm-core.ts";
import { AVL_TIER_LABEL, avlTierForLeadClass, stateCode, stateStoredForms, type AvlTier } from "./tech-director-core.ts";

export const DIRECTORY_PAGE_SIZE = 40;

export const DIRECTORY_SORTS = ["id", "name", "tier", "fit", "contact"] as const;
export type DirectorySort = (typeof DIRECTORY_SORTS)[number];

export const TIER_WALK = ["top", "second", "staff_only", "other_services", "unset"] as const;
export type TierWalk = (typeof TIER_WALK)[number];

const TIER_LEAD_CLASS: Record<Exclude<TierWalk, "unset">, string> = {
  top: "campaign_planning",
  second: "under_construction",
  staff_only: "staff_only",
  other_services: "other_services"
};

export const CRM_STATUS_LABEL: Record<string, string> = {
  "": "Not contacted",
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  demo_scheduled: "Demo scheduled",
  proposal_sent: "Proposal sent",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost"
};

export type DirectoryQuery = {
  q: string;
  state: string;
  county: string;
  status: string;
  tier: AvlTier | "";
  staff: boolean;
  fitMin: number | null;
  /** Contact tag fit:<slug>. Not jev_avl_fit. Comma means every listed fit tag. */
  campaignFit: string;
  /** Contact tag size:<slug>. Comma means any listed size band. */
  sizeBand: string;
  /** Contact tag verify:<slug>. Comma means any listed status. */
  verifyStatus: string;
  contacted: "" | "never" | "since" | "before";
  contactedOn: string;
  stage: BuildingStage | "";
  /** "website:possible" and the other owner opportunity filters. Empty means any. */
  opportunity: string;
  /** "av:vendor" and the other provider-type filters. Empty means any. */
  provider: string;
  /** Vendor name on any service, for example Messenger AVL. Owner desk only. */
  vendor: string;
  /** Service whose provider is a vendor or someone else. */
  servedByOther: string;
  /** Opportunity service that is possible or interested. With vendor, this is vendor X with an opening in Z. */
  opening: string;
  sort: DirectorySort;
  dir: "asc" | "desc";
  cursor: string;
};

export type DirectoryCursor = {
  sort: DirectorySort;
  dir: "asc" | "desc";
  id: string;
  value: string;
  tier: TierWalk | "";
  nulls: boolean;
};

export type DirectoryRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  statusLabel: string;
  crmStatus: string;
  tier: AvlTier | "";
  tierLabel: string;
  jevAvlFit: number | null;
  jevProjectStage: string;
  /** Tags on staff contacts, including verify:, fit:, size:, role:, and src:. */
  contactTags: string[];
  lastContact: string;
  hasStaff: boolean;
  /** Worked with them on a past project. Owner only. Not a pipeline status. */
  avlExistingRelationship: boolean;
  avlExistingRelationshipNote: string;
  avlProjectStatus: AvlProjectStatus | "";
  buildingStage: BuildingStage | "";
  buildingStageRecordedAt: string;
  /** Owner-only. Stored status, or the pre-fill from lead class and ChurchConnect. */
  opportunities: ServiceOpportunities;
  /** Owner-only. Who serves each service. Vendor names stay on this desk. */
  providers: ServiceProviders;
  /** Existing relationship, AVL already engaged, or AV served by us, a vendor, or someone else. */
  existingAvlTalks: boolean;
};

export type ProviderReportRow = {
  service: string;
  providerType: string;
  providerTypeLabel: string;
  vendorName: string;
  churches: number;
};

export type DirectoryRpcArgs = {
  p_q: string;
  p_state: string;
  p_county: string;
  p_status: string;
  p_lead_class: string;
  p_staff: boolean;
  p_fit_min: number | null;
  p_contacted: string;
  p_contacted_on: string;
  p_building_stage: string;
  p_opportunity: string;
  p_provider: string;
  p_vendor: string;
  p_other_service: string;
  p_opening: string;
  p_sort: string;
  p_dir: "asc" | "desc";
  p_cursor_id: string;
  p_cursor_value: string;
  p_limit: number;
};

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());

export function directoryStatusLabel(crmStatus: unknown): string {
  const raw = text(crmStatus);
  if (!raw) return "Not contacted";
  return CRM_STATUS_LABEL[raw] || CRM_STATUS_LABEL[raw.toLowerCase()] || raw;
}

export function buildingStageLabel(stage: unknown): string {
  const clean = cleanBuildingStage(stage);
  return clean ? BUILDING_STAGE_LABEL[clean] : "None";
}

export function avlProjectStatusLabel(status: unknown): string {
  const clean = cleanAvlProjectStatus(status);
  return clean ? AVL_PROJECT_STATUS_LABEL[clean] : "None";
}

export function emptyDirectoryQuery(): DirectoryQuery {
  return {
    q: "",
    state: "",
    county: "",
    status: "",
    tier: "",
    staff: false,
    fitMin: null,
    campaignFit: "",
    sizeBand: "",
    verifyStatus: "",
    contacted: "",
    contactedOn: "",
    stage: "",
    opportunity: "",
    provider: "",
    vendor: "",
    servedByOther: "",
    opening: "",
    sort: "id",
    dir: "asc",
    cursor: ""
  };
}

export function directoryQueryFromParams(params: Record<string, string | string[] | undefined>): DirectoryQuery {
  const one = (key: string) => {
    const value = params[key];
    const raw = Array.isArray(value) ? value[0] : value;
    return text(raw).slice(0, 80);
  };
  const sort = one("sort");
  const dir = one("dir");
  const tier = one("tier");
  const contacted = one("contacted");
  const fit = one("fit");
  const fitNum = fit === "" ? null : Number(fit);
  const day = one("on");
  return {
    q: one("q"),
    state: stateCode(one("state")) || one("state").slice(0, 2).toUpperCase(),
    county: one("county"),
    status: one("status"),
    tier: tier === "top" || tier === "second" || tier === "other_services" || tier === "staff_only" ? tier : "",
    staff: one("staff") === "1",
    fitMin: fitNum !== null && Number.isFinite(fitNum) && fitNum >= 0 && fitNum <= 4 ? fitNum : null,
    campaignFit: one("campaign_fit"),
    sizeBand: one("size"),
    verifyStatus: one("verify"),
    contacted: contacted === "never" || contacted === "since" || contacted === "before" ? contacted : "",
    contactedOn: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "",
    stage: cleanBuildingStage(one("stage")),
    opportunity: (() => {
      const parsed = parseServiceOpportunityFilter(one("opp"));
      return parsed ? `${parsed.service}:${parsed.status}` : "";
    })(),
    provider: (() => {
      const parsed = parseProviderTypeFilter(one("provider"));
      return parsed ? `${parsed.service}:${parsed.providerType}` : "";
    })(),
    vendor: text(Array.isArray(params.vendor) ? params.vendor[0] : params.vendor).slice(0, 200),
    servedByOther: parseProviderService(one("other")),
    opening: parseOpeningService(one("opening")),
    sort: (DIRECTORY_SORTS as readonly string[]).includes(sort) ? (sort as DirectorySort) : "id",
    dir: dir === "desc" ? "desc" : "asc",
    cursor: one("cursor").slice(0, 500)
  };
}

export function encodeDirectoryCursor(cursor: DirectoryCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeDirectoryCursor(raw: string): DirectoryCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<DirectoryCursor>;
    const sort = text(parsed.sort);
    const dir = text(parsed.dir);
    const id = text(parsed.id);
    const tier = text(parsed.tier);
    if (!(DIRECTORY_SORTS as readonly string[]).includes(sort)) return null;
    if (dir !== "asc" && dir !== "desc") return null;
    if (!id || id.length > 80 || /[\s&]/.test(id)) return null;
    if (tier && !(TIER_WALK as readonly string[]).includes(tier)) return null;
    return {
      sort: sort as DirectorySort,
      dir,
      id,
      value: text(parsed.value).slice(0, 80),
      tier: (tier || "") as TierWalk | "",
      nulls: parsed.nulls === true
    };
  } catch {
    return null;
  }
}

function leadClassFor(query: DirectoryQuery, tierWalk: TierWalk | ""): string {
  if (tierWalk === "unset") return "unset";
  if (tierWalk) return TIER_LEAD_CLASS[tierWalk];
  if (query.tier) return TIER_LEAD_CLASS[query.tier];
  return "";
}

/**
 * Arguments for crm_directory_page. State is a two-letter code. The SQL
 * function matches "Georgia" and "GA" on that code. Sort and cursor use one
 * expression each (name, numeric fit, or last contact). There is no offset
 * and no or() keyset.
 */
export function directoryRpcArgs(
  query: DirectoryQuery,
  cursor: DirectoryCursor | null,
  limit: number,
  tierWalk: TierWalk | "" = ""
): DirectoryRpcArgs {
  const sort = query.sort;
  const dir = query.dir === "desc" ? "desc" : "asc";
  const edge = cursor && cursor.sort === sort && cursor.dir === dir ? cursor : null;
  const statusOk =
    query.status === "not_contacted" ||
    (CRM_CHURCH_STATUSES as readonly string[]).some((status) => status.toLowerCase() === query.status.toLowerCase());
  const stage = cleanBuildingStage(query.stage);
  return {
    p_q: query.q.trim().slice(0, 80),
    p_state: /^[A-Z]{2}$/.test(query.state) ? query.state : "",
    p_county: query.county.trim().slice(0, 80),
    p_status: query.status && statusOk ? query.status : "",
    p_lead_class: leadClassFor(query, tierWalk),
    p_staff: query.staff,
    p_fit_min: query.fitMin,
    p_contacted: query.contacted,
    p_contacted_on: query.contactedOn,
    p_building_stage: stage,
    p_opportunity: parseServiceOpportunityFilter(query.opportunity) ? query.opportunity : "",
    p_provider: parseProviderTypeFilter(query.provider) ? query.provider : "",
    p_vendor: query.vendor.trim().slice(0, 200),
    p_other_service: parseProviderService(query.servedByOther),
    p_opening: parseOpeningService(query.opening),
    p_sort: sort === "tier" ? "id" : sort,
    p_dir: sort === "tier" ? "asc" : dir,
    p_cursor_id: edge?.id ?? "",
    p_cursor_value: edge?.value ?? "",
    p_limit: Math.min(Math.max(limit, 1), 100)
  };
}

export function directoryRowFromRecord(row: Record<string, unknown>): DirectoryRow | null {
  const id = text(row.id);
  if (!id || text(row.merged_into) || text(row.deleted_at)) return null;
  const leadClass = text(row.lead_class);
  const tier = avlTierForLeadClass(leadClass);
  const fitRaw = text(row.jev_avl_fit);
  const fitNum = fitRaw === "" ? null : Number(fitRaw);
  const fit = fitNum !== null && Number.isFinite(fitNum) && fitNum >= 0 && fitNum <= 4 ? fitNum : null;
  const staff = Array.isArray(row.staff_contacts) ? row.staff_contacts.filter((item) => item && typeof item === "object") : [];
  const contactTags = staff.flatMap((item) => {
    const tags = (item as { tags?: unknown }).tags;
    if (!Array.isArray(tags)) return [];
    return tags.map((tag) => text(tag)).filter(Boolean);
  });
  const hasStaff = staff.length > 0 || Boolean(text(row.pastor_name) || text(row.contact_name) || text(row.secretary_name));
  const invited = text(row.last_invited_at);
  const contacted = text(row.last_contact_at);
  const lastContact = [invited, contacted].filter(Boolean).sort().at(-1) || "";
  const crmStatus = text(row.crm_status);
  const relationship = truthyFlag(row.avl_existing_relationship);
  const project = cleanAvlProjectStatus(row.avl_project_status);
  const stage = cleanBuildingStage(row.building_stage);
  const hasStaffFromRpc = row.has_staff === true || row.has_staff === "true";
  return {
    id,
    name: text(row.name) || text(row.church_name) || "Church",
    city: text(row.city),
    state: text(row.state),
    zip: text(row.zip_code),
    county: text(row.county) || text(row.region),
    statusLabel: directoryStatusLabel(crmStatus),
    crmStatus,
    tier,
    tierLabel: tier ? AVL_TIER_LABEL[tier] : "",
    jevAvlFit: fit,
    jevProjectStage: text(row.jev_project_stage),
    contactTags,
    lastContact,
    hasStaff: hasStaffFromRpc || hasStaff,
    avlExistingRelationship: relationship,
    avlExistingRelationshipNote: text(row.avl_existing_relationship_note).slice(0, 500),
    avlProjectStatus: project,
    buildingStage: stage,
    buildingStageRecordedAt: /^\d{4}-\d{2}-\d{2}/.test(text(row.building_stage_recorded_at)) ? text(row.building_stage_recorded_at).slice(0, 10) : "",
    opportunities: serviceOpportunitiesFromDoc(parseOpportunities(row.service_opportunities), {
      leadClass,
      onChurchConnect: churchIsOnChurchConnect(row)
    }),
    providers: serviceProvidersFromDoc(parseOpportunities(row.service_providers)),
    existingAvlTalks: churchHoldsAvlWork({
      avl_existing_relationship: relationship,
      avl_project_status: project,
      service_providers: parseOpportunities(row.service_providers)
    })
  };
}

function parseOpportunities(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export function directorySortName(row: Record<string, unknown>): string {
  if (row.sort_name !== undefined && row.sort_name !== null) return text(row.sort_name);
  return text(row.name) || text(row.church_name);
}

export function directorySortFit(row: Record<string, unknown>): number {
  if (row.sort_fit !== undefined && row.sort_fit !== null && row.sort_fit !== "") {
    const fit = Number(row.sort_fit);
    if (Number.isFinite(fit)) return fit;
  }
  const raw = text(row.jev_avl_fit);
  const fit = raw === "" ? null : Number(raw);
  return fit !== null && Number.isFinite(fit) && fit >= 0 && fit <= 4 ? fit : -1;
}

export function directorySortContact(row: Record<string, unknown>): string {
  if (row.sort_contact !== undefined && row.sort_contact !== null) return text(row.sort_contact);
  return [text(row.last_invited_at), text(row.last_contact_at)].filter(Boolean).sort().at(-1) || "";
}

export function tierWalkFromLeadClass(leadClass: string): TierWalk {
  if (leadClass === "campaign_planning") return "top";
  if (leadClass === "under_construction") return "second";
  if (leadClass === "staff_only") return "staff_only";
  if (leadClass === "other_services") return "other_services";
  return "unset";
}

/** First 40 raw rows are this page. The cursor is the last raw id, even when that row is merged or deleted. */
export function pageDirectoryRaw(raw: Record<string, unknown>[], query: DirectoryQuery): { rows: DirectoryRow[]; next: DirectoryCursor | null } {
  const window = raw.slice(0, DIRECTORY_PAGE_SIZE);
  const more = raw.length > DIRECTORY_PAGE_SIZE;
  const rows = window.map((item) => directoryRowFromRecord(item)).filter((row): row is DirectoryRow => Boolean(row));
  const last = window[window.length - 1];
  if (!more || !last || !text(last.id)) return { rows, next: null };
  return { rows, next: cursorFromRaw(query, last, query.sort === "tier" ? tierWalkFromLeadClass(text(last.lead_class)) : "") };
}

export function cursorFromRaw(query: DirectoryQuery, raw: Record<string, unknown>, tier: TierWalk | ""): DirectoryCursor {
  const value = query.sort === "name" ? directorySortName(raw) : query.sort === "fit" ? String(directorySortFit(raw)) : query.sort === "contact" ? directorySortContact(raw) : "";
  return { sort: query.sort, dir: query.dir, id: text(raw.id), value, tier, nulls: false };
}

/** Cursor for the next page. Prefer cursorFromRaw so merged rows still advance the keyset. */
export function nextDirectoryCursor(query: DirectoryQuery, last: DirectoryRow, tierWalk: TierWalk | ""): DirectoryCursor {
  const value = query.sort === "name" ? last.name : query.sort === "fit" ? (last.jevAvlFit === null ? "-1" : String(last.jevAvlFit)) : query.sort === "contact" ? last.lastContact : "";
  return {
    sort: query.sort,
    dir: query.dir,
    id: last.id,
    value,
    tier: tierWalk,
    nulls: false
  };
}

export function directoryHref(query: DirectoryQuery, cursor = "", preview = ""): string {
  const params = new URLSearchParams();
  if (preview) params.set("preview", preview);
  if (query.q) params.set("q", query.q);
  if (query.state) params.set("state", query.state);
  if (query.county) params.set("county", query.county);
  if (query.status) params.set("status", query.status);
  if (query.tier) params.set("tier", query.tier);
  if (query.staff) params.set("staff", "1");
  if (query.fitMin !== null) params.set("fit", String(query.fitMin));
  if (query.campaignFit) params.set("campaign_fit", query.campaignFit);
  if (query.sizeBand) params.set("size", query.sizeBand);
  if (query.verifyStatus) params.set("verify", query.verifyStatus);
  if (query.contacted) params.set("contacted", query.contacted);
  if (query.contactedOn) params.set("on", query.contactedOn);
  if (query.stage) params.set("stage", query.stage);
  if (query.opportunity) params.set("opp", query.opportunity);
  if (query.provider) params.set("provider", query.provider);
  if (query.vendor) params.set("vendor", query.vendor);
  if (query.servedByOther) params.set("other", query.servedByOther);
  if (query.opening) params.set("opening", query.opening);
  if (query.sort !== "id") params.set("sort", query.sort);
  if (query.dir !== "asc") params.set("dir", query.dir);
  if (cursor) params.set("cursor", cursor);
  const text = params.toString();
  return text ? `/crm?${text}` : "/crm";
}

/** Same filters as the live list, for the dev preview fixture. The live list uses SQL, except contact tags. */
export function filterDirectoryRows(rows: DirectoryRow[], query: DirectoryQuery): DirectoryRow[] {
  const next = rows.filter((row) => directoryRowMatches(row, query));
  if (query.sort === "id") return next;
  const dir = query.dir === "desc" ? -1 : 1;
  const tierRank = (tier: string) => {
    const at = (TIER_WALK as readonly string[]).indexOf(tier);
    return at < 0 ? TIER_WALK.length : at;
  };
  return [...next].sort((a, b) => {
    let cmp = 0;
    if (query.sort === "name") cmp = a.name.localeCompare(b.name);
    else if (query.sort === "tier") cmp = tierRank(a.tier) - tierRank(b.tier);
    else if (query.sort === "fit") cmp = (a.jevAvlFit ?? -1) - (b.jevAvlFit ?? -1);
    else cmp = a.lastContact.localeCompare(b.lastContact);
    if (cmp === 0) cmp = a.id.localeCompare(b.id);
    return cmp * dir;
  });
}

export function directoryRowMatches(row: DirectoryRow, query: DirectoryQuery): boolean {
  const q = directorySearchText(query.q).toLowerCase();
  const digits = q.replace(/\D/g, "");
  const zipExact = digits.length === 5 || digits.length === 9 ? digits : "";
  if (q) {
    const hay = `${row.name} ${row.city}`.toLowerCase();
    const zipHit = zipExact !== "" && row.zip.replace(/\D/g, "") === zipExact;
    if (!hay.includes(q) && !zipHit) return false;
  }
  if (!contactTagsMatch(row.contactTags, directoryContactTagFilter(query))) return false;
  if (query.state) {
    const want = stateCode(query.state) || query.state.toUpperCase();
    const have = stateCode(row.state) || row.state.toUpperCase();
    if (have !== want) return false;
  }
  if (query.county && row.county.toLowerCase() !== query.county.toLowerCase()) return false;
  if (query.status === "not_contacted" && row.crmStatus) return false;
  if (query.status && query.status !== "not_contacted" && row.crmStatus.toLowerCase() !== query.status.toLowerCase()) return false;
  if (query.tier && row.tier !== query.tier) return false;
  if (query.staff && !row.hasStaff) return false;
  if (query.fitMin !== null && (row.jevAvlFit === null || row.jevAvlFit < query.fitMin)) return false;
  if (query.contacted === "never" && row.lastContact) return false;
  if (query.stage === "none" && row.buildingStage && row.buildingStage !== "none") return false;
  if (query.stage && query.stage !== "none" && row.buildingStage !== query.stage) return false;
  const opportunity = parseServiceOpportunityFilter(query.opportunity);
  if (opportunity && row.opportunities[opportunity.service].status !== opportunity.status) return false;
  const provider = parseProviderTypeFilter(query.provider);
  if (provider && row.providers[provider.service].providerType !== provider.providerType) return false;
  if (query.vendor) {
    const needle = query.vendor.trim().toLowerCase();
    const hit = SERVICE_PROVIDER_IDS.some((service) => row.providers[service].providerType === "vendor" && row.providers[service].vendorName.toLowerCase() === needle);
    if (!hit) return false;
  }
  if (query.servedByOther) {
    const service = parseProviderService(query.servedByOther);
    const type = service ? row.providers[service].providerType : "";
    if (type !== "vendor" && type !== "other") return false;
  }
  if (query.opening) {
    const service = parseOpeningService(query.opening);
    const status = service ? row.opportunities[service].status : "";
    if (status !== "possible" && status !== "interested") return false;
  }
  if ((query.contacted === "since" || query.contacted === "before") && query.contactedOn) {
    const day = row.lastContact.slice(0, 10);
    if (!day) return false;
    if (query.contacted === "since" && day < query.contactedOn) return false;
    if (query.contacted === "before" && day >= query.contactedOn) return false;
  }
  return true;
}

const TAG_PREFIX = /^(fit|size|verify|role|src|prio):([a-z0-9_-]+)$/i;

function tagSlug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "").slice(0, 48);
}

function pushTag(list: string[], prefix: string, raw: string) {
  for (const part of raw.split(/[,|;]/)) {
    const slug = tagSlug(part);
    if (!slug) continue;
    const tag = `${prefix}:${slug}`;
    if (!list.includes(tag)) list.push(tag);
  }
}

export type DirectoryContactTagFilter = {
  /** Every fit: tag must be on the church. */
  fit: string[];
  /** At least one size: tag, when this list is not empty. */
  size: string[];
  /** At least one verify: tag, when this list is not empty. */
  verify: string[];
  /** Every other contact tag (role, src, prio) must be present. */
  other: string[];
};

export function directoryContactTagFilter(query: Pick<DirectoryQuery, "q" | "campaignFit" | "sizeBand" | "verifyStatus">): DirectoryContactTagFilter {
  const filter: DirectoryContactTagFilter = { fit: [], size: [], verify: [], other: [] };
  pushTag(filter.fit, "fit", query.campaignFit);
  pushTag(filter.size, "size", query.sizeBand);
  pushTag(filter.verify, "verify", query.verifyStatus);
  for (const token of query.q.split(/\s+/)) {
    const match = TAG_PREFIX.exec(token.trim());
    if (!match) continue;
    const prefix = match[1].toLowerCase();
    if (prefix === "fit") pushTag(filter.fit, "fit", match[2]);
    else if (prefix === "size") pushTag(filter.size, "size", match[2]);
    else if (prefix === "verify") pushTag(filter.verify, "verify", match[2]);
    else pushTag(filter.other, prefix, match[2]);
  }
  return filter;
}

export function directoryContactTagFilterActive(filter: DirectoryContactTagFilter): boolean {
  return filter.fit.length + filter.size.length + filter.verify.length + filter.other.length > 0;
}

/** Words in q that are not contact-tag tokens. Tag tokens are a filter of their own. */
export function directorySearchText(q: string): string {
  return q
    .split(/\s+/)
    .filter((token) => !TAG_PREFIX.test(token.trim()))
    .join(" ")
    .trim();
}

export function contactTagsMatch(tags: readonly string[], filter: DirectoryContactTagFilter): boolean {
  if (!directoryContactTagFilterActive(filter)) return true;
  const have = new Set(tags.map((tag) => tag.toLowerCase()));
  if (filter.fit.some((tag) => !have.has(tag))) return false;
  if (filter.size.length && !filter.size.some((tag) => have.has(tag))) return false;
  if (filter.verify.length && !filter.verify.some((tag) => have.has(tag))) return false;
  if (filter.other.some((tag) => !have.has(tag))) return false;
  return true;
}

export function cardMatchesContactTagFilter(
  card: { contacts?: Array<{ tags?: readonly string[] | null }> },
  filter: DirectoryContactTagFilter
): boolean {
  if (!directoryContactTagFilterActive(filter)) return true;
  const tags = (card.contacts ?? []).flatMap((contact) => contact.tags ?? []);
  return contactTagsMatch(tags, filter);
}

const DIRECTORY_TAG_SELECT = [
  "id",
  "name:doc->>name",
  "church_name:doc->>church_name",
  "city:doc->>city",
  "state:doc->>state",
  "zip_code:doc->>zip_code",
  "county:doc->>county",
  "region:doc->>region",
  "crm_status:doc->>crm_status",
  "lead_class:doc->>lead_class",
  "jev_avl_fit:doc->>jev_avl_fit",
  "jev_project_stage:doc->>jev_project_stage",
  "last_invited_at:doc->>last_invited_at",
  "last_contact_at:doc->>last_contact_at",
  "pastor_name:doc->>pastor_name",
  "contact_name:doc->>contact_name",
  "secretary_name:doc->>secretary_name",
  "merged_into:doc->>merged_into",
  "deleted_at:doc->>deleted_at",
  "avl_existing_relationship:doc->>avl_existing_relationship",
  "avl_existing_relationship_note:doc->>avl_existing_relationship_note",
  "avl_project_status:doc->>avl_project_status",
  "building_stage:doc->>building_stage",
  "building_stage_recorded_at:doc->>building_stage_recorded_at",
  "is_customer:doc->>is_customer",
  "signed_up:doc->>signed_up",
  "invite_status:doc->>invite_status",
  "staff_contacts:doc->staff_contacts",
  "service_opportunities:doc->service_opportunities",
  "service_providers:doc->service_providers"
].join(",");

function ilikeTag(column: string, tag: string): string {
  return `${column}.ilike.${encodeURIComponent(`*${tag}*`)}`;
}

function tagClauses(filter: DirectoryContactTagFilter, column: string): string[] {
  const clauses = [...filter.fit, ...filter.other].map((tag) => ilikeTag(column, tag));
  if (filter.size.length === 1) clauses.push(ilikeTag(column, filter.size[0]));
  else if (filter.size.length > 1) clauses.push(`or(${filter.size.map((tag) => ilikeTag(column, tag)).join(",")})`);
  if (filter.verify.length === 1) clauses.push(ilikeTag(column, filter.verify[0]));
  else if (filter.verify.length > 1) clauses.push(`or(${filter.verify.map((tag) => ilikeTag(column, tag)).join(",")})`);
  return clauses;
}

/**
 * PostgREST read of cc_churches whose staff contact tags match.
 * Null when the page should keep using crm_directory_page. No new column.
 */
export function directoryTagChurchPath(query: DirectoryQuery, afterId: string, limit: number): string | null {
  const filter = directoryContactTagFilter(query);
  if (!directoryContactTagFilterActive(filter)) return null;
  const clauses = tagClauses(filter, "doc->>staff_contacts");
  const forms = stateStoredForms(query.state);
  if (forms.length) clauses.push(`or(${forms.map((form) => `doc->>state.ilike.${encodeURIComponent(form)}`).join(",")})`);
  if (query.tier && TIER_LEAD_CLASS[query.tier]) clauses.push(`doc->>lead_class.eq.${TIER_LEAD_CLASS[query.tier]}`);
  const limitText = String(Math.min(Math.max(limit, 1), 100));
  const after = /^[A-Za-z0-9_-]{1,80}$/.test(afterId) ? `&id=gt.${afterId}` : "";
  return `cc_churches?select=${DIRECTORY_TAG_SELECT}&and=(${clauses.join(",")})&order=id.asc&limit=${limitText}${after}`;
}

/** Church-lead rows whose contacts carry the same tags. Empty when there is no tag filter. */
export function churchLeadTagPath(query: DirectoryQuery, limit: number): string | null {
  const filter = directoryContactTagFilter(query);
  if (!directoryContactTagFilterActive(filter)) return null;
  const clauses = tagClauses(filter, "contacts");
  const limitText = String(Math.min(Math.max(limit, 1), 40));
  return `op_leads?select=id,business_name,city,state,phone,email,website_url,status,signals,services,contacts,created_at,updated_at&kind=eq.church-lead&and=(${clauses.join(",")})&order=updated_at.desc&limit=${limitText}`;
}

export function directoryPreviewRows(): DirectoryRow[] {
  const rows: Array<Omit<DirectoryRow, "opportunities" | "providers" | "contactTags">> = [
    {
      id: "fb3d153f-dac5-49fc-ad9f-2f594d4dcc24",
      name: "Northridge Christian",
      city: "Milledgeville",
      state: "GA",
      zip: "31061",
      county: "Baldwin",
      statusLabel: "Not contacted",
      crmStatus: "",
      tier: "staff_only",
      tierLabel: AVL_TIER_LABEL.staff_only,
      jevAvlFit: 1,
      jevProjectStage: "none",
      lastContact: "2026-09-12",
      hasStaff: true,
      avlExistingRelationship: true,
      avlExistingRelationshipNote: "Worked with them on a past project.",
      avlProjectStatus: "avl_already_engaged",
      buildingStage: "",
      buildingStageRecordedAt: "",
      existingAvlTalks: true
    },
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Grace Planning Church",
      city: "Atlanta",
      state: "GA",
      zip: "30309",
      county: "Fulton",
      statusLabel: "Not contacted",
      crmStatus: "",
      tier: "top",
      tierLabel: AVL_TIER_LABEL.top,
      jevAvlFit: 3.5,
      jevProjectStage: "planning-campaign",
      lastContact: "",
      hasStaff: true,
      avlExistingRelationship: false,
      avlExistingRelationshipNote: "",
      avlProjectStatus: "none",
      buildingStage: "exploring",
      buildingStageRecordedAt: "2026-03-01",
      existingAvlTalks: false
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Build Chapel",
      city: "Macon",
      state: "GA",
      zip: "31201",
      county: "Bibb",
      statusLabel: "Not contacted",
      crmStatus: "",
      tier: "second",
      tierLabel: AVL_TIER_LABEL.second,
      jevAvlFit: 2.5,
      jevProjectStage: "under-construction",
      lastContact: "",
      hasStaff: true,
      avlExistingRelationship: false,
      avlExistingRelationshipNote: "",
      avlProjectStatus: "none",
      buildingStage: "under_construction",
      buildingStageRecordedAt: "2026-02-01",
      existingAvlTalks: false
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "River Services Church",
      city: "Augusta",
      state: "GA",
      zip: "30901",
      county: "Richmond",
      statusLabel: "Not contacted",
      crmStatus: "",
      tier: "other_services",
      tierLabel: AVL_TIER_LABEL.other_services,
      jevAvlFit: 0.5,
      jevProjectStage: "recently-completed",
      lastContact: "",
      hasStaff: false,
      avlExistingRelationship: false,
      avlExistingRelationshipNote: "",
      avlProjectStatus: "none",
      buildingStage: "recently_completed",
      buildingStageRecordedAt: "2025-11-01",
      existingAvlTalks: false
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      name: "The Fountain Church",
      city: "Atlanta",
      state: "GA",
      zip: "30318",
      county: "Fulton",
      statusLabel: "Not contacted",
      crmStatus: "",
      tier: "second",
      tierLabel: AVL_TIER_LABEL.second,
      jevAvlFit: 2,
      jevProjectStage: "under-construction",
      lastContact: "",
      hasStaff: true,
      avlExistingRelationship: false,
      avlExistingRelationshipNote: "",
      avlProjectStatus: "none",
      buildingStage: "design",
      buildingStageRecordedAt: "2026-01-15",
      existingAvlTalks: false
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      name: "The Fountain Church",
      city: "Jacksonville",
      state: "FL",
      zip: "32202",
      county: "Duval",
      statusLabel: "Not contacted",
      crmStatus: "",
      tier: "top",
      tierLabel: AVL_TIER_LABEL.top,
      jevAvlFit: 3,
      jevProjectStage: "planning-campaign",
      lastContact: "",
      hasStaff: true,
      avlExistingRelationship: false,
      avlExistingRelationshipNote: "",
      avlProjectStatus: "none",
      buildingStage: "campaign_planning",
      buildingStageRecordedAt: "2026-04-01",
      existingAvlTalks: false
    }
  ];
  const leadClass = (tier: string) =>
    tier === "top" ? "campaign_planning" : tier === "second" ? "under_construction" : tier === "other_services" ? "other_services" : tier === "staff_only" ? "staff_only" : "";
  return rows.map((row) => ({
    ...row,
    contactTags: [],
    opportunities: serviceOpportunitiesFromDoc(
      row.id === "fb3d153f-dac5-49fc-ad9f-2f594d4dcc24"
        ? { website: { status: "interested", note: "No public site", updated_at: "2026-09-01" } }
        : null,
      { leadClass: leadClass(row.tier), onChurchConnect: false }
    ),
    providers: serviceProvidersFromDoc(
      row.id === "fb3d153f-dac5-49fc-ad9f-2f594d4dcc24"
        ? {
            av: {
              provider_type: "vendor",
              vendor_name: "Messenger AVL",
              other_name: "",
              note: "AVL is already engaged on the current project",
              learned_from: "",
              learned_at: ""
            }
          }
        : null
    )
  }));
}

/** Owner-only counts. A blank unknown on a preview row is not a recorded provider. */
export function providerReportFromRows(rows: DirectoryRow[]): ProviderReportRow[] {
  const counts = new Map<string, ProviderReportRow>();
  for (const row of rows) {
    for (const service of SERVICE_PROVIDER_IDS) {
      const item = row.providers[service];
      const recorded = item.providerType !== "unknown" || Boolean(item.vendorName || item.otherName || item.note || item.learnedFrom || item.learnedAt);
      if (!recorded) continue;
      const vendorName = item.providerType === "vendor" ? item.vendorName : "";
      const key = `${service}\n${item.providerType}\n${vendorName.toLowerCase()}`;
      const current = counts.get(key);
      if (current) current.churches += 1;
      else counts.set(key, { service, providerType: item.providerType, providerTypeLabel: PROVIDER_TYPE_LABEL[item.providerType], vendorName, churches: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => a.service.localeCompare(b.service) || a.providerType.localeCompare(b.providerType) || b.churches - a.churches);
}
