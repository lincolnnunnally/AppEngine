// Church directory list for /crm. Pure query building and row shaping.
// The desk reads cc_churches itself. It does not copy churches into another table.
// One page is a keyset (id, or a sort key plus id). There is no offset.

import { CRM_CHURCH_STATUSES, EXISTING_AVL_TALKS_STATUS, isExistingAvlTalksStatus } from "./lpl-crm-core.ts";
import { AVL_TIER_LABEL, avlTierForLeadClass, stateCode, type AvlTier } from "./tech-director-core.ts";

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

const STATE_NAME: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming"
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
  lost: "Lost",
  [EXISTING_AVL_TALKS_STATUS]: EXISTING_AVL_TALKS_STATUS
};

export type DirectoryQuery = {
  q: string;
  state: string;
  county: string;
  status: string;
  tier: AvlTier | "";
  staff: boolean;
  fitMin: number | null;
  contacted: "" | "never" | "since" | "before";
  contactedOn: string;
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
  lastContact: string;
  hasStaff: boolean;
  existingAvlTalks: boolean;
};

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());

export function directoryStatusLabel(crmStatus: unknown): string {
  const raw = text(crmStatus);
  if (!raw) return "Not contacted";
  return CRM_STATUS_LABEL[raw] || CRM_STATUS_LABEL[raw.toLowerCase()] || raw;
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
    contacted: "",
    contactedOn: "",
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
    contacted: contacted === "never" || contacted === "since" || contacted === "before" ? contacted : "",
    contactedOn: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "",
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

/** Quote a PostgREST value that contains a dot, comma, or parenthesis. */
function filterValue(value: string): string {
  if (value === "" || /[.,():"]/.test(value)) return `"${value.replace(/"/g, "")}"`;
  return encodeURIComponent(value);
}

function likeValue(value: string): string {
  const cleaned = value.replace(/[*,().]/g, " ").replace(/\s+/g, " ").trim();
  return `*${encodeURIComponent(cleaned)}*`;
}

const LIST_FIELDS = [
  "name",
  "church_name",
  "city",
  "state",
  "zip_code",
  "county",
  "region",
  "crm_status",
  "lead_class",
  "jev_avl_fit",
  "jev_project_stage",
  "last_invited_at",
  "last_contact_at",
  "pastor_name",
  "contact_name",
  "secretary_name"
];

export const DIRECTORY_SELECT = `select=id,${LIST_FIELDS.map((field) => `${field}:doc->>${field}`).join(",")},merged_into:doc->>merged_into,deleted_at:doc->>deleted_at,staff_contacts:doc->staff_contacts`;

/**
 * One PostgREST page. `tierWalk` is set while sorting by tier, one bucket at a time.
 * `nulls` continues a name, fit, or last-contact sort into the blank values.
 * The default (sort id, no cursor) is `order=id.asc` and uses the primary key.
 */
export function directoryRestQuery(
  query: DirectoryQuery,
  cursor: DirectoryCursor | null,
  limit: number,
  tierWalk: TierWalk | "" = ""
): string {
  const orGroups: string[] = [];
  const parts: string[] = [DIRECTORY_SELECT];

  const q = query.q.trim();
  if (q) {
    const zip = q.replace(/\D/g, "");
    const zipExact = zip.length === 5 || zip.length === 9 ? `doc->>zip_code.eq.${zip}` : "";
    orGroups.push(`or(doc->>name.ilike.${likeValue(q)},doc->>church_name.ilike.${likeValue(q)},doc->>city.ilike.${likeValue(q)}${zipExact ? `,${zipExact}` : ""})`);
  }
  if (query.state && /^[A-Z]{2}$/.test(query.state)) {
    const name = STATE_NAME[query.state];
    orGroups.push(name ? `or(doc->>state.eq.${query.state},doc->>state.ilike.${encodeURIComponent(name)})` : `or(doc->>state.eq.${query.state})`);
  }
  if (query.county) {
    const county = filterValue(query.county);
    orGroups.push(`or(doc->>county.ilike.${county},doc->>region.ilike.${county})`);
  }
  if (query.status === "not_contacted") orGroups.push("or(doc->>crm_status.is.null,doc->>crm_status.eq.)");
  else if (query.status && (CRM_CHURCH_STATUSES as readonly string[]).some((status) => status.toLowerCase() === query.status.toLowerCase())) {
    parts.push(`doc->>crm_status=eq.${filterValue(query.status)}`);
  }
  if (tierWalk === "unset") orGroups.push("or(doc->>lead_class.is.null,doc->>lead_class.eq.)");
  else if (tierWalk) parts.push(`doc->>lead_class=eq.${TIER_LEAD_CLASS[tierWalk]}`);
  else if (query.tier) parts.push(`doc->>lead_class=eq.${TIER_LEAD_CLASS[query.tier]}`);
  if (query.staff) {
    orGroups.push(
      "or(and(doc->staff_contacts.not.is.null,doc->staff_contacts.neq.[]),doc->>pastor_name.not.eq.,doc->>contact_name.not.eq.,doc->>secretary_name.not.eq.)"
    );
  }
  if (query.fitMin !== null) parts.push(`doc->>jev_avl_fit=gte.${query.fitMin}`);
  if (query.contacted === "never") {
    orGroups.push("or(doc->>last_invited_at.is.null,doc->>last_invited_at.eq.)");
    orGroups.push("or(doc->>last_contact_at.is.null,doc->>last_contact_at.eq.)");
  } else if ((query.contacted === "since" || query.contacted === "before") && query.contactedOn) {
    const op = query.contacted === "since" ? "gte" : "lt";
    orGroups.push(`or(doc->>last_invited_at.${op}.${query.contactedOn},doc->>last_contact_at.${op}.${query.contactedOn})`);
  }

  const sort = query.sort;
  const dir = query.dir === "desc" ? "desc" : "asc";
  const edge = cursor && cursor.sort === sort && cursor.dir === dir ? cursor : null;
  if (sort === "id") {
    const cmp = dir === "asc" ? "gt" : "lt";
    if (edge?.id) parts.push(`id=${cmp}.${encodeURIComponent(edge.id)}`);
    parts.push(`order=id.${dir}`);
  } else if (sort === "tier") {
    if (edge?.id) parts.push(`id=gt.${encodeURIComponent(edge.id)}`);
    parts.push("order=id.asc");
  } else if (edge?.nulls) {
    const column = sort === "name" ? "name" : sort === "fit" ? "jev_avl_fit" : "last_invited_at";
    orGroups.push(`or(doc->>${column}.is.null,doc->>${column}.eq.)`);
    parts.push(`id=gt.${encodeURIComponent(edge.id)}`);
    parts.push("order=id.asc");
  } else {
    const column = sort === "name" ? "name" : sort === "fit" ? "jev_avl_fit" : "last_invited_at";
    const nulls = "nullslast";
    parts.push(`order=doc->>${column}.${dir}.${nulls},id.asc`);
    if (edge) {
      const cmp = dir === "asc" ? "gt" : "lt";
      orGroups.push(
        `or(doc->>${column}.${cmp}.${filterValue(edge.value)},and(doc->>${column}.eq.${filterValue(edge.value)},id.gt.${encodeURIComponent(edge.id)}))`
      );
    }
  }

  if (orGroups.length === 1) parts.push(`or=(${orGroups[0].slice(3, -1)})`);
  else if (orGroups.length > 1) parts.push(`and=(${orGroups.join(",")})`);
  parts.push(`limit=${Math.min(Math.max(limit, 1), 100)}`);
  return parts.join("&");
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
  const hasStaff = staff.length > 0 || Boolean(text(row.pastor_name) || text(row.contact_name) || text(row.secretary_name));
  const invited = text(row.last_invited_at);
  const contacted = text(row.last_contact_at);
  const lastContact = [invited, contacted].filter(Boolean).sort().at(-1) || "";
  const crmStatus = text(row.crm_status);
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
    lastContact,
    hasStaff,
    existingAvlTalks: isExistingAvlTalksStatus(crmStatus)
  };
}

/** Cursor for the next page from the last row returned, before the extra lookahead row is dropped. */
export function nextDirectoryCursor(query: DirectoryQuery, last: DirectoryRow, tierWalk: TierWalk | ""): DirectoryCursor {
  const value = query.sort === "name" ? last.name : query.sort === "fit" ? (last.jevAvlFit === null ? "" : String(last.jevAvlFit)) : query.sort === "contact" ? last.lastContact : "";
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
  if (query.contacted) params.set("contacted", query.contacted);
  if (query.contactedOn) params.set("on", query.contactedOn);
  if (query.sort !== "id") params.set("sort", query.sort);
  if (query.dir !== "asc") params.set("dir", query.dir);
  if (cursor) params.set("cursor", cursor);
  const text = params.toString();
  return text ? `/crm?${text}` : "/crm";
}

/** Same filters as the live list, for the dev preview fixture. The live list uses SQL. */
export function filterDirectoryRows(rows: DirectoryRow[], query: DirectoryQuery): DirectoryRow[] {
  const q = query.q.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const zipExact = digits.length === 5 || digits.length === 9 ? digits : "";
  const next = rows.filter((row) => {
    if (q) {
      const hay = `${row.name} ${row.city}`.toLowerCase();
      const zipHit = zipExact !== "" && row.zip.replace(/\D/g, "") === zipExact;
      if (!hay.includes(q) && !zipHit) return false;
    }
    if (query.state && row.state.toUpperCase() !== query.state) return false;
    if (query.county && row.county.toLowerCase() !== query.county.toLowerCase()) return false;
    if (query.status === "not_contacted" && row.crmStatus) return false;
    if (query.status && query.status !== "not_contacted" && row.crmStatus.toLowerCase() !== query.status.toLowerCase()) return false;
    if (query.tier && row.tier !== query.tier) return false;
    if (query.staff && !row.hasStaff) return false;
    if (query.fitMin !== null && (row.jevAvlFit === null || row.jevAvlFit < query.fitMin)) return false;
    if (query.contacted === "never" && row.lastContact) return false;
    if ((query.contacted === "since" || query.contacted === "before") && query.contactedOn) {
      const day = row.lastContact.slice(0, 10);
      if (!day) return false;
      if (query.contacted === "since" && day < query.contactedOn) return false;
      if (query.contacted === "before" && day >= query.contactedOn) return false;
    }
    return true;
  });
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

export function directoryPreviewRows(): DirectoryRow[] {
  return [
    {
      id: "fb3d153f-dac5-49fc-ad9f-2f594d4dcc24",
      name: "Northridge Christian",
      city: "Milledgeville",
      state: "GA",
      zip: "31061",
      county: "Baldwin",
      statusLabel: EXISTING_AVL_TALKS_STATUS,
      crmStatus: EXISTING_AVL_TALKS_STATUS,
      tier: "staff_only",
      tierLabel: AVL_TIER_LABEL.staff_only,
      jevAvlFit: 1,
      jevProjectStage: "none",
      lastContact: "2026-09-12",
      hasStaff: true,
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
      existingAvlTalks: false
    }
  ];
}
