// Match a technical-director CSV to churches already on file, and merge the
// contact into that church's staff_contacts. No new churches. No sends.
import { createHash } from "node:crypto";
import { avlRelationshipIsSet, cleanAvlProjectStatus, isAllowedChurchStatus, normName, serviceProvidersFromDoc, serviceProvidersToDoc, storedServiceProvider, suppressionDomain, SERVICE_PROVIDER_IDS, type ServiceProvider, type ServiceProviderId } from "./lpl-crm-core.ts";
import {
  OTHER_SERVICES_OFFERS,
  SIGNAL_STAFF,
  TECHNICAL_DIRECTOR_TAG,
  avlTierForLeadClass,
  churchSignalKey,
  cleanRoleTags,
  existingColumnYes,
  httpUrl,
  leadClassRank,
  parseJevAvlFit,
  parseJevProjectStage,
  parseLeadClass,
  parsePublishedContact,
  parseSignalScore,
  parseSignalTypes,
  signalTagsForTypes,
  stateCode,
  type AvlTier,
  type JevProjectStage,
  type LeadClass,
  type SignalType
} from "./tech-director-core.ts";

/** Northridge Christian, Milledgeville GA. Existing AVL relationship even when the CSV existing column is blank. */
export const NORTHRIDGE_MILLEDGEVILLE_ID = "fb3d153f-dac5-49fc-ad9f-2f594d4dcc24";

/** Prod cc_churches is about 151k. Keyset pages of 1000 need more than 151 pages. Offset page 81 times out. */
export const CHURCH_READ_PAGE = 1000;
export const CHURCH_READ_MAX_PAGES = 220;

export const CHURCH_PROFILE_PATCH_KEYS = [
  "crm_status",
  "lead_class",
  "jev_avl_fit",
  "jev_project_stage",
  "crm_offers",
  "service_providers"
] as const;

/** PostgREST page by id, not offset. lastId blank is the first page. */
export function churchPageQuery(select: string, lastId: string, limit = CHURCH_READ_PAGE): string {
  const after = lastId ? `&id=gt.${encodeURIComponent(lastId)}` : "";
  return `cc_churches?select=${select}&order=id.asc&limit=${limit}${after}`;
}

export const TECH_DIRECTOR_CSV_COLUMNS = [
  "church",
  "church_id",
  "city",
  "state",
  "website",
  "staff_page_url",
  "name",
  "title",
  "contact",
  "signal_types",
  "evidence_quote",
  "source_url",
  "signal_date",
  "score"
] as const;
export const TECH_DIRECTOR_CSV_REQUIRED = [
  "church",
  "city",
  "website",
  "staff_page_url",
  "name",
  "title",
  "contact",
  "signal_types",
  "evidence_quote",
  "source_url",
  "signal_date",
  "score"
] as const;

export type TechDirectorCsvRow = {
  church: string;
  church_id: string;
  city: string;
  state: string;
  website: string;
  staff_page_url: string;
  name: string;
  title: string;
  contact: string;
  signal_types: string;
  evidence_quote: string;
  source_url: string;
  signal_date: string;
  score: string;
  lead_class: string;
  existing: string;
  jev_avl_fit: string;
  jev_project_stage: string;
  line: number;
};

export type DirectoryChurch = {
  id: string;
  name: string;
  churchName: string;
  city: string;
  state: string;
  website: string;
  domain: string;
  /** Already on the CRM desk (pipeline). A directory-only church is not written unless --add-to-crm. */
  inCrm: boolean;
  /** Pipeline status already stored. Blank when the church is directory-only. */
  crmStatus?: string;
  /** Set when the owner field is already yes or no. An import does not replace it. */
  avlExistingRelationship?: boolean;
  /** none or avl_already_engaged when already stored. Blank means unset. */
  avlProjectStatus?: string;
  /** True when service_providers.av.provider_type is already stored, including unknown. */
  avProviderSet?: boolean;
  /** Stored lead class. Blank means an import may set it. A re-run does not replace a value. */
  leadClass?: string;
  /** Stored fit as text, including "0". Blank means an import may set it. */
  jevAvlFitText?: string;
  /** Stored project stage. Blank means an import may set it. */
  jevProjectStage?: string;
  /** Apps already picked. Empty means Other services may set the church list. */
  offers?: string[];
  contacts: Array<{ name: string }>;
  signals?: Array<{
    tag: string;
    evidenceQuote?: string;
    evidence_quote?: string;
    sourceUrl?: string;
    source_url?: string;
    signalDate?: string;
    signal_date?: string;
  }>;
};

export type StaffContactWrite = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  tags: string[];
  source_url: string;
};

export type ChurchSignalWrite = {
  id: string;
  tag: string;
  evidence_quote: string;
  source_url: string;
  signal_date: string;
  score: number;
  signal_types: SignalType[];
};

export type UnmatchedTechDirector = { row: TechDirectorCsvRow; reason: string };

export type StateImportCounts = {
  matched: number;
  inCrm: number;
  directoryOnly: number;
  newContacts: number;
  duplicatesSkipped: number;
  newSignals: number;
  signalDuplicatesSkipped: number;
  signalsUpdated: number;
  flagged: number;
  unmatched: number;
};

export type ImportPlan = {
  matched: number;
  inCrm: number;
  directoryOnly: number;
  newContacts: number;
  duplicatesSkipped: number;
  newSignals: number;
  signalDuplicatesSkipped: number;
  signalsUpdated: number;
  unmatched: UnmatchedTechDirector[];
  flagged: UnmatchedTechDirector[];
  directoryOnlyRows: UnmatchedTechDirector[];
  byState: Record<string, StateImportCounts>;
  additions: Array<{ churchId: string; contact: StaffContactWrite }>;
  signalAdditions: Array<{ churchId: string; signal: ChurchSignalWrite }>;
  /** Same tag, quote, and source already stored, with a later signal date. */
  signalUpdates: Array<{ churchId: string; signal: ChurchSignalWrite }>;
  /** Churches whose doc should gain a status, lead class, fit, or offers. */
  profiles: ChurchProfileWrite[];
  /** Directory churches whose fields this plan will store. The desk already lists them. */
  addedToCrm: number;
  /** Unique matched churches by state and tier. */
  byStateTier: Record<string, TierImportCounts>;
};

export type TierImportCounts = {
  churches: number;
  top: number;
  second: number;
  otherServices: number;
  staffOnly: number;
  existingTalks: number;
};

export type ChurchProfileWrite = {
  churchId: string;
  /** Set only when this import should change the pipeline status. Existing AVL work does not. */
  crmStatus?: string;
  leadClass?: LeadClass;
  jevAvlFit?: number | null;
  jevProjectStage?: JevProjectStage | "";
  /** Set only for Other services when the church has no offers yet. */
  crmOffers?: string[];
  /** Set only when AV does not already have a provider, and the old relationship fields are still blank. */
  serviceProviders?: Partial<Record<ServiceProviderId, ServiceProvider>>;
  tier: AvlTier | "";
  existingTalks: boolean;
};

export type JevFitRow = {
  churchId: string;
  jevAvlFit: number | null;
  jevProjectStage: JevProjectStage | "";
};

export type ImportPlanOptions = {
  /** Accepted so older commands still parse. The directory is the CRM, so this no longer gates a write. */
  addToCrm?: boolean;
  jevByChurchId?: ReadonlyMap<string, JevFitRow>;
};

/** Pipeline fields that already put a ChurchConnect church on the CRM desk. */
export function churchIsInCrm(row: {
  crmStatus?: unknown;
  crmNextActionDate?: unknown;
  lastInvitedAt?: unknown;
  inviteStatus?: unknown;
  siteSlug?: unknown;
  websiteOfferStatus?: unknown;
  isCustomer?: unknown;
  signedUp?: unknown;
}): boolean {
  const present = (value: unknown) => String(value ?? "").trim() !== "";
  if (present(row.crmStatus) || present(row.crmNextActionDate) || present(row.lastInvitedAt)) return true;
  if (present(row.siteSlug) || present(row.websiteOfferStatus)) return true;
  const invite = String(row.inviteStatus ?? "").trim().toLowerCase();
  if (invite === "sent" || invite === "accepted" || invite === "failed") return true;
  const flag = (value: unknown) => value === true || String(value ?? "").trim().toLowerCase() === "true";
  return flag(row.isCustomer) || flag(row.signedUp);
}

export function normPersonName(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stateKey(value: string): string {
  return stateCode(value).toLowerCase();
}

function cityKey(value: string): string {
  return normName(String(value ?? "").split(",")[0] ?? "");
}

function statesOk(csvState: string, churchState: string): boolean {
  const want = stateKey(csvState);
  const have = stateKey(churchState);
  if (!want || !have) return true;
  return want === have;
}

export function techDirectorContactId(churchId: string, name: string): string {
  const digest = createHash("sha1").update(`${churchId}|${normPersonName(name)}`, "utf8").digest("hex").slice(0, 12);
  return `td-${digest}`;
}

/**
 * Parse CSV text by header name, not column order. `state` and `church_id` may
 * be omitted. Other known columns are required. Unknown columns, including
 * builder_name, builder_role, and builder_url, are ignored.
 */
export function parseTechDirectorCsv(text: string): { ok: true; rows: TechDirectorCsvRow[] } | { ok: false; message: string } {
  const table = parseCsv(text);
  if (!table.length) return { ok: false, message: `The CSV needs a header row: ${TECH_DIRECTOR_CSV_COLUMNS.join(", ")}.` };
  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const missing = TECH_DIRECTOR_CSV_REQUIRED.filter((column) => !header.includes(column));
  if (missing.length) {
    return { ok: false, message: `The CSV is missing ${missing.join(", ")}. Expected columns: ${TECH_DIRECTOR_CSV_COLUMNS.join(", ")}.` };
  }
  const index = new Map(header.map((name, at) => [name, at]));
  const cell = (row: string[], name: string) => {
    const at = index.get(name);
    return at === undefined ? "" : String(row[at] ?? "").trim();
  };
  const rows: TechDirectorCsvRow[] = [];
  for (let i = 1; i < table.length; i += 1) {
    const record = table[i];
    if (record.every((value) => !String(value ?? "").trim())) continue;
    rows.push({
      church: cell(record, "church"),
      church_id: cell(record, "church_id"),
      city: cell(record, "city"),
      state: cell(record, "state"),
      website: cell(record, "website"),
      staff_page_url: cell(record, "staff_page_url"),
      name: cell(record, "name"),
      title: cell(record, "title"),
      contact: cell(record, "contact"),
      signal_types: cell(record, "signal_types"),
      evidence_quote: cell(record, "evidence_quote"),
      source_url: cell(record, "source_url"),
      signal_date: cell(record, "signal_date"),
      score: cell(record, "score"),
      lead_class: cell(record, "lead_class"),
      existing: cell(record, "existing"),
      jev_avl_fit: cell(record, "jev_avl_fit"),
      jev_project_stage: cell(record, "jev_project_stage"),
      line: i + 1
    });
  }
  return { ok: true, rows };
}

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i += 1) {
    const char = src[i];
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
          continue;
        }
        inQuotes = false;
        continue;
      }
      cell += char;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * Name key for matching. A trailing "Church" is dropped, and St. / St is read
 * as Saint. "First Baptist Church" and "St. John" agree with "First Baptist"
 * and "Saint John".
 */
export function churchMatchName(value: unknown): string {
  const name = normName(value).replace(/\bst\b/g, "saint").replace(/\s+/g, " ").trim();
  return name.replace(/ church$/, "").trim();
}

function sameChurchName(church: DirectoryChurch, row: TechDirectorCsvRow): boolean {
  const want = churchMatchName(row.church);
  if (!want) return false;
  return [churchMatchName(church.name), churchMatchName(church.churchName)].filter(Boolean).includes(want);
}

function byNameCity(pool: DirectoryChurch[], row: TechDirectorCsvRow): DirectoryChurch[] {
  const city = cityKey(row.city);
  if (!churchMatchName(row.church) || !city) return [];
  return pool.filter((church) => sameChurchName(church, row) && cityKey(church.city) === city && statesOk(row.state, church.state));
}

/** True when the website is only a host: no path, query, or hash. A trailing slash still counts as bare. */
export function bareHostWebsite(value: unknown): boolean {
  const text = String(value ?? "").trim();
  if (!text) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (url.search || url.hash) return false;
    return url.pathname.replace(/\/+$/, "") === "";
  } catch {
    return false;
  }
}

/**
 * A domain hit is not enough. The normalized name has to agree, or the city,
 * the state, and a bare-host website (no path) all have to agree. State is
 * always checked. A path such as elca.org/find/bethel does not agree on city alone.
 */
function domainAgrees(church: DirectoryChurch, row: TechDirectorCsvRow): boolean {
  if (!statesOk(row.state, church.state)) return false;
  if (sameChurchName(church, row)) return true;
  const city = cityKey(row.city);
  const want = stateKey(row.state);
  const have = stateKey(church.state);
  // City and a bare host still need a state on both sides. A blank state does not agree.
  if (!want || !have || want !== have) return false;
  return Boolean(city) && city === cityKey(church.city) && bareHostWebsite(row.website);
}

/** A church id attaches only when the normalized name and the state also agree. */
function churchIdAgrees(church: DirectoryChurch, row: TechDirectorCsvRow): boolean {
  return statesOk(row.state, church.state) && sameChurchName(church, row);
}

export type DirectoryMatch = { church: DirectoryChurch } | { reason: string; flagged?: boolean };

/**
 * church_id when that column is filled. The id has to agree on the normalized
 * name and the state, or the row is flagged and does not fall through. Otherwise
 * a website domain that is not a shared host (suppressionDomain drops umc.org,
 * ag.org, jw.org, and the rest) matches only when the normalized name agrees,
 * or the city, the state, and a bare host (no path) all agree. The city path
 * requires a state on both sides. A shared host is not a domain match. Name
 * and city are the fallback.
 */
export function matchDirectoryChurch(row: TechDirectorCsvRow, churches: DirectoryChurch[]): DirectoryMatch {
  const churchId = String(row.church_id ?? "").trim();
  if (churchId) {
    const found = churches.find((church) => church.id === churchId);
    if (!found) return { reason: "No church on file has that church id." };
    if (!churchIdAgrees(found, row)) return { reason: "The church id is on file, but the name or state does not agree.", flagged: true };
    return { church: found };
  }
  const domain = suppressionDomain(row.website);
  if (domain) {
    const byDomain = churches.filter((church) => suppressionDomain(church.website) === domain || suppressionDomain(church.domain) === domain);
    if (byDomain.length === 1) {
      if (domainAgrees(byDomain[0], row)) return { church: byDomain[0] };
      return { reason: "The website matches one church, but the name does not agree, and the city, state, and bare website do not agree." };
    }
    if (byDomain.length > 1) {
      const named = byNameCity(byDomain, row);
      if (named.length === 1) return { church: named[0] };
      if (named.length > 1) return { reason: "More than one church has that website, name, and city." };
      return { reason: "Several churches share that website, and the name and city do not pick one." };
    }
  }
  if (!churchMatchName(row.church) || !cityKey(row.city)) return { reason: "No website match, and the church name or city is missing." };
  const named = byNameCity(churches, row);
  if (named.length === 1) return { church: named[0] };
  if (named.length > 1) return { reason: "More than one church has that name and city." };
  return { reason: "No church on file matches this row." };
}

/** True when the incoming signal date is later than the one already stored. A blank incoming date is not newer. */
export function evidenceIsNewer(incoming: string, stored: string): boolean {
  const next = signalTime(incoming);
  if (next === null) return false;
  const previous = signalTime(stored);
  if (previous === null) return true;
  return next > previous;
}

function signalTime(value: string): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

function storedSignalDate(signal: NonNullable<DirectoryChurch["signals"]>[number]): string {
  if (typeof signal.signalDate === "string") return signal.signalDate;
  return String(signal.signal_date ?? "");
}

function emptyStateCounts(): StateImportCounts {
  return {
    matched: 0,
    inCrm: 0,
    directoryOnly: 0,
    newContacts: 0,
    duplicatesSkipped: 0,
    newSignals: 0,
    signalDuplicatesSkipped: 0,
    signalsUpdated: 0,
    flagged: 0,
    unmatched: 0
  };
}

function stateBucket(plan: ImportPlan, state: string): StateImportCounts {
  const key = stateCode(state) || "(none)";
  const bucket = plan.byState[key] ?? emptyStateCounts();
  plan.byState[key] = bucket;
  return bucket;
}

function clip(value: string, limit: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

export function churchSignalId(churchId: string, tag: string, quote: string, sourceUrl: string): string {
  const digest = createHash("sha1").update(`${churchId}|${churchSignalKey({ tag, evidenceQuote: quote, sourceUrl })}`, "utf8").digest("hex").slice(0, 12);
  return `sig-${digest}`;
}

export type ImportFlag = { churchId: string; name: string; website: string; reason: string };

/** Rows that must not be written. A skip file can add more. */
export const DEFAULT_IMPORT_FLAGS: ImportFlag[] = [
  { churchId: "", name: "Archdiocese of Atlanta", website: "", reason: "Archdiocese of Atlanta office is not a church." },
  {
    churchId: "",
    name: "Cristo Para Todas Las Naciones",
    website: "shallowford.org",
    reason: "Cristo Para Todas Las Naciones does not match shallowford.org."
  }
];

/** A skip file is a headerless name list, or a CSV with church_id, church, website, and reason. */
export function parseImportSkipFile(text: string): { ok: true; flags: ImportFlag[] } | { ok: false; message: string } {
  const table = parseCsv(text).filter((record) => record.some((value) => String(value ?? "").trim()) && !String(record[0] ?? "").trim().startsWith("#"));
  if (!table.length) return { ok: true, flags: [] };
  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const named = header.includes("church_id") || header.includes("church") || header.includes("name");
  if (!named) {
    return {
      ok: true,
      flags: table
        .map((record) => record.join(",").trim())
        .filter(Boolean)
        .map((name) => ({ churchId: "", name, website: "", reason: "On the skip list." }))
    };
  }
  const index = new Map(header.map((name, at) => [name, at]));
  const cell = (record: string[], name: string) => {
    const at = index.get(name);
    return at === undefined ? "" : String(record[at] ?? "").trim();
  };
  const flags: ImportFlag[] = [];
  for (let i = 1; i < table.length; i += 1) {
    const record = table[i];
    const churchId = cell(record, "church_id");
    const name = cell(record, "church") || cell(record, "name");
    const website = cell(record, "website");
    if (!churchId && !name) continue;
    flags.push({ churchId, name, website, reason: cell(record, "reason") || "On the skip list." });
  }
  return { ok: true, flags };
}

/** Blank when the row is not flagged. A website on the rule must also appear on the row. */
export function importFlagReason(row: TechDirectorCsvRow, flags: readonly ImportFlag[], matchedChurchId = ""): string {
  for (const flag of flags) {
    const idHit = Boolean(flag.churchId) && (row.church_id.trim() === flag.churchId || matchedChurchId === flag.churchId);
    const nameHit = Boolean(flag.name) && normName(row.church).includes(normName(flag.name));
    if (!idHit && !nameHit) continue;
    if (flag.website && !row.website.toLowerCase().includes(flag.website.toLowerCase())) continue;
    return flag.reason || "On the skip list.";
  }
  return "";
}

export function planTechDirectorImport(
  rows: TechDirectorCsvRow[],
  churches: DirectoryChurch[],
  extraFlags: readonly ImportFlag[] = [],
  options: ImportPlanOptions = {}
): ImportPlan {
  const namesByChurch = new Map<string, Set<string>>();
  const signalDates = new Map<string, Map<string, string>>();
  for (const church of churches) {
    namesByChurch.set(church.id, new Set(church.contacts.map((contact) => normPersonName(contact.name)).filter(Boolean)));
    const dates = new Map<string, string>();
    for (const signal of church.signals ?? []) {
      const key = churchSignalKey(signal);
      const date = storedSignalDate(signal);
      const previous = dates.get(key);
      if (previous === undefined || evidenceIsNewer(date, previous)) dates.set(key, date);
    }
    signalDates.set(church.id, dates);
  }
  const pendingSignals = new Map<string, ChurchSignalWrite>();
  const plan: ImportPlan = {
    matched: 0,
    inCrm: 0,
    directoryOnly: 0,
    newContacts: 0,
    duplicatesSkipped: 0,
    newSignals: 0,
    signalDuplicatesSkipped: 0,
    signalsUpdated: 0,
    unmatched: [],
    flagged: [],
    directoryOnlyRows: [],
    byState: {},
    additions: [],
    signalAdditions: [],
    signalUpdates: [],
    profiles: [],
    addedToCrm: 0,
    byStateTier: {}
  };
  void options.addToCrm;
  const churchById = new Map(churches.map((church) => [church.id, church]));
  const tracked = new Map<string, TrackedChurch>();
  const addedIds = new Set<string>();
  const flags = [...DEFAULT_IMPORT_FLAGS, ...extraFlags];
  for (const row of rows) {
    const flagged = importFlagReason(row, flags);
    if (flagged) {
      plan.flagged.push({ row, reason: flagged });
      stateBucket(plan, row.state).flagged += 1;
      continue;
    }
    const types = parseSignalTypes(row.signal_types);
    if (!types.ok) {
      plan.unmatched.push({ row, reason: types.message });
      stateBucket(plan, row.state).unmatched += 1;
      continue;
    }
    const score = parseSignalScore(row.score);
    if (score === null) {
      plan.unmatched.push({ row, reason: "The score is not a number." });
      stateBucket(plan, row.state).unmatched += 1;
      continue;
    }
    const lead = parseLeadClass(row.lead_class);
    if (!lead.ok) {
      plan.flagged.push({ row, reason: lead.message });
      stateBucket(plan, row.state).flagged += 1;
      continue;
    }
    const fit = parseJevAvlFit(row.jev_avl_fit);
    if (!fit.ok) {
      plan.flagged.push({ row, reason: fit.message });
      stateBucket(plan, row.state).flagged += 1;
      continue;
    }
    const stage = parseJevProjectStage(row.jev_project_stage);
    if (!stage.ok) {
      plan.flagged.push({ row, reason: stage.message });
      stateBucket(plan, row.state).flagged += 1;
      continue;
    }
    const match = matchDirectoryChurch(row, churches);
    if (!("church" in match)) {
      if (match.flagged) {
        plan.flagged.push({ row, reason: match.reason });
        stateBucket(plan, row.state).flagged += 1;
      } else {
        plan.unmatched.push({ row, reason: match.reason });
        stateBucket(plan, row.state).unmatched += 1;
      }
      continue;
    }
    const church = match.church;
    const flaggedMatch = importFlagReason(row, flags, church.id);
    if (flaggedMatch) {
      plan.flagged.push({ row, reason: flaggedMatch });
      stateBucket(plan, row.state).flagged += 1;
      continue;
    }
    const bucket = stateBucket(plan, church.state);
    plan.matched += 1;
    bucket.matched += 1;
    noteTrackedChurch(tracked, church, {
      leadClass: lead.leadClass,
      fit: fit.fit,
      stage: stage.stage,
      existing: existingColumnYes(row.existing) || church.id === NORTHRIDGE_MILLEDGEVILLE_ID || row.church_id === NORTHRIDGE_MILLEDGEVILLE_ID
    });
    if (!church.inCrm) {
      plan.directoryOnly += 1;
      bucket.directoryOnly += 1;
      // The desk reads the directory. These churches already exist. Store the
      // fields on the church. Do not set a status just so the row appears.
      if (!addedIds.has(church.id)) {
        addedIds.add(church.id);
        plan.addedToCrm += 1;
      }
    } else {
      plan.inCrm += 1;
      bucket.inCrm += 1;
    }
    if (types.types.includes("staff") && normPersonName(row.name)) {
      const names = namesByChurch.get(church.id) ?? new Set<string>();
      namesByChurch.set(church.id, names);
      const key = normPersonName(row.name);
      if (names.has(key)) {
        plan.duplicatesSkipped += 1;
        bucket.duplicatesSkipped += 1;
      } else {
        names.add(key);
        const published = parsePublishedContact(row.contact);
        plan.additions.push({
          churchId: church.id,
          contact: {
            id: techDirectorContactId(church.id, row.name),
            name: clip(row.name, 120),
            role: clip(row.title, 80),
            email: published.email,
            phone: published.phone,
            tags: cleanRoleTags([TECHNICAL_DIRECTOR_TAG]),
            source_url: httpUrl(row.staff_page_url)
          }
        });
        plan.newContacts += 1;
        bucket.newContacts += 1;
      }
    }
    const quote = clip(row.evidence_quote, 500);
    const source = httpUrl(row.source_url);
    const date = clip(row.signal_date, 40);
    const known = signalDates.get(church.id) ?? new Map<string, string>();
    signalDates.set(church.id, known);
    for (const tag of signalTagsForTypes(types.types)) {
      const signalKey = churchSignalKey({ tag, evidenceQuote: quote, sourceUrl: source });
      const signal: ChurchSignalWrite = {
        id: churchSignalId(church.id, tag, quote, source),
        tag,
        evidence_quote: quote,
        source_url: source,
        signal_date: date,
        score,
        signal_types: types.types.filter((type) => (tag === SIGNAL_STAFF ? type === "staff" : type !== "staff"))
      };
      const pendingKey = `${church.id}|${signalKey}`;
      if (known.has(signalKey)) {
        const stored = known.get(signalKey) ?? "";
        if (evidenceIsNewer(date, stored)) {
          known.set(signalKey, date);
          const queued = pendingSignals.get(pendingKey);
          if (queued) {
            queued.score = score;
            queued.signal_date = date;
          } else {
            plan.signalUpdates.push({ churchId: church.id, signal });
            plan.signalsUpdated += 1;
            bucket.signalsUpdated += 1;
          }
        } else {
          plan.signalDuplicatesSkipped += 1;
          bucket.signalDuplicatesSkipped += 1;
        }
        continue;
      }
      known.set(signalKey, date);
      pendingSignals.set(pendingKey, signal);
      plan.signalAdditions.push({ churchId: church.id, signal });
      plan.newSignals += 1;
      bucket.newSignals += 1;
    }
  }
  applyJevFile(tracked, options.jevByChurchId);
  plan.byStateTier = tierCounts(tracked);
  plan.profiles = profilesFromTracked(tracked, churchById);
  return plan;
}

type TrackedChurch = {
  state: string;
  leadClass: LeadClass | "";
  fit: number | null;
  stage: JevProjectStage | "";
  existing: boolean;
};

function noteTrackedChurch(
  tracked: Map<string, TrackedChurch>,
  church: DirectoryChurch,
  row: { leadClass: LeadClass | ""; fit: number | null; stage: JevProjectStage | ""; existing: boolean }
) {
  const current = tracked.get(church.id) ?? {
    state: stateCode(church.state) || "(none)",
    leadClass: "" as LeadClass | "",
    fit: null,
    stage: "" as JevProjectStage | "",
    existing: false
  };
  if (leadClassRank(row.leadClass) > leadClassRank(current.leadClass)) current.leadClass = row.leadClass;
  if (typeof row.fit === "number" && (current.fit === null || row.fit > current.fit)) current.fit = row.fit;
  if (row.stage && !current.stage) current.stage = row.stage;
  if (row.existing) current.existing = true;
  tracked.set(church.id, current);
}

function applyJevFile(tracked: Map<string, TrackedChurch>, jevByChurchId: ReadonlyMap<string, JevFitRow> | undefined) {
  if (!jevByChurchId) return;
  for (const [churchId, jev] of jevByChurchId) {
    const current = tracked.get(churchId);
    if (!current) continue;
    if (typeof jev.jevAvlFit === "number") current.fit = jev.jevAvlFit;
    if (jev.jevProjectStage) current.stage = jev.jevProjectStage;
  }
}

function emptyTierCounts(): TierImportCounts {
  return { churches: 0, top: 0, second: 0, otherServices: 0, staffOnly: 0, existingTalks: 0 };
}

function tierCounts(tracked: Map<string, TrackedChurch>): Record<string, TierImportCounts> {
  const out: Record<string, TierImportCounts> = {};
  for (const item of tracked.values()) {
    const bucket = out[item.state] ?? emptyTierCounts();
    bucket.churches += 1;
    const tier = avlTierForLeadClass(item.leadClass);
    if (tier === "top") bucket.top += 1;
    else if (tier === "second") bucket.second += 1;
    else if (tier === "other_services") bucket.otherServices += 1;
    else if (tier === "staff_only") bucket.staffOnly += 1;
    if (item.existing) bucket.existingTalks += 1;
    out[item.state] = bucket;
  }
  return out;
}

function ownerFieldsToWrite(church: DirectoryChurch, existing: boolean): { serviceProviders?: ChurchProfileWrite["serviceProviders"] } {
  if (!existing) return {};
  if (church.avProviderSet || avlRelationshipIsSet(church.avlExistingRelationship) || cleanAvlProjectStatus(church.avlProjectStatus)) return {};
  const note = "AVL is already engaged on the current project";
  const av: ServiceProvider =
    church.id === NORTHRIDGE_MILLEDGEVILLE_ID
      ? { providerType: "vendor", vendorName: "Messenger AVL", otherName: "", note, learnedFrom: "", learnedAt: "" }
      : { providerType: "us", vendorName: "", otherName: "", note, learnedFrom: "", learnedAt: "" };
  return { serviceProviders: { av } };
}

function textAlreadySet(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

function profilesFromTracked(tracked: Map<string, TrackedChurch>, churchById: Map<string, DirectoryChurch>): ChurchProfileWrite[] {
  const profiles: ChurchProfileWrite[] = [];
  for (const [churchId, item] of tracked) {
    const church = churchById.get(churchId);
    if (!church) continue;
    const tier = avlTierForLeadClass(item.leadClass);
    const owner = ownerFieldsToWrite(church, item.existing);
    const offers = tier === "other_services" && !(church.offers ?? []).length ? [...OTHER_SERVICES_OFFERS] : undefined;
    const leadClass = item.leadClass && !textAlreadySet(church.leadClass) ? item.leadClass : undefined;
    const jevAvlFit = typeof item.fit === "number" && !textAlreadySet(church.jevAvlFitText) ? item.fit : undefined;
    const jevProjectStage = item.stage && !textAlreadySet(church.jevProjectStage) ? item.stage : undefined;
    const hasProfile = Boolean(leadClass || jevAvlFit !== undefined || jevProjectStage || offers || owner.serviceProviders);
    if (!hasProfile) continue;
    profiles.push({
      churchId,
      ...(leadClass ? { leadClass } : {}),
      ...(jevAvlFit !== undefined ? { jevAvlFit } : {}),
      ...(jevProjectStage ? { jevProjectStage } : {}),
      ...(offers ? { crmOffers: offers } : {}),
      ...owner,
      tier,
      existingTalks: item.existing
    });
  }
  return profiles;
}

export function formatImportCounts(plan: ImportPlan): string {
  const lines = [
    `matched: ${plan.matched}`,
    `in CRM: ${plan.inCrm}`,
    `directory only: ${plan.directoryOnly}`,
    `new contacts: ${plan.newContacts}`,
    `duplicates skipped: ${plan.duplicatesSkipped}`,
    `new signals: ${plan.newSignals}`,
    `signal duplicates skipped: ${plan.signalDuplicatesSkipped}`,
    `signals updated: ${plan.signalsUpdated}`,
    `flagged: ${plan.flagged.length}`,
    `unmatched: ${plan.unmatched.length}`,
    `directory churches included: ${plan.addedToCrm}`,
    "by state:"
  ];
  for (const state of Object.keys(plan.byState).sort()) {
    const row = plan.byState[state];
    lines.push(
      `  ${state}: matched ${row.matched}, in CRM ${row.inCrm}, directory only ${row.directoryOnly}, new contacts ${row.newContacts}, duplicates skipped ${row.duplicatesSkipped}, new signals ${row.newSignals}, signal duplicates skipped ${row.signalDuplicatesSkipped}, signals updated ${row.signalsUpdated}, flagged ${row.flagged}, unmatched ${row.unmatched}`
    );
  }
  lines.push("by state and tier:");
  const tiers = plan.byStateTier ?? {};
  const states = Object.keys(tiers).sort();
  if (!states.length) lines.push("  none");
  for (const state of states) {
    const row = tiers[state];
    lines.push(
      `  ${state}: churches ${row.churches}, top ${row.top}, second ${row.second}, other services ${row.otherServices}, staff only ${row.staffOnly}, existing relationship ${row.existingTalks}`
    );
  }
  return lines.join("\n");
}

/** Life Produces Life production Supabase project. Not a key. */
export const PRODUCTION_PROJECT_REF = "uqhqulrqcygsmmzdzemx";

/** Hostname only. A ref buried in the user, path, or query is not a host. */
export function databaseHost(url: string): string {
  try {
    return new URL(url.trim()).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return "";
  }
}

/**
 * Project ref when the host is exactly `<ref>.supabase.co`.
 * A custom domain, a pooler host, and a ref that only appears in the query do not match.
 */
export function supabaseProjectRef(url: string): string {
  const host = databaseHost(url);
  const suffix = ".supabase.co";
  if (!host.endsWith(suffix)) return "";
  const ref = host.slice(0, -suffix.length);
  if (!/^[a-z0-9]+$/.test(ref)) return "";
  return ref;
}

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type ProductionWriteInput = {
  url: string;
  vercelEnv?: string;
  /** True when the CLI was passed --allow-production. */
  allowProduction: boolean;
  /** IMPORT_ALLOW_PROD. It must equal the production project ref. */
  importAllowProd?: string;
};

export type ProductionWriteDecision =
  | { allow: true; production: false; projectRef: string }
  | { allow: true; production: true; projectRef: string }
  | { allow: false; projectRef: string; message: string };

/**
 * Fail closed. --apply may write only to localhost, a known non-production
 * `<ref>.supabase.co` host, or the production project when both
 * --allow-production and IMPORT_ALLOW_PROD equal that project ref.
 * A custom domain, a pooler host, and any other host are refused.
 * VERCEL_ENV=production is allowed only for the production project ref.
 */
export function decideProductionWrite(input: ProductionWriteInput): ProductionWriteDecision {
  const host = databaseHost(input.url);
  const projectRef = supabaseProjectRef(input.url);
  const confirmed = (input.importAllowProd ?? "").trim();
  const optedIn = input.allowProduction && confirmed === PRODUCTION_PROJECT_REF;
  const vercelProduction = input.vercelEnv === "production";
  if (LOCAL_DATABASE_HOSTS.has(host)) {
    if (vercelProduction) {
      return {
        allow: false,
        projectRef: "",
        message: "Refusing to write: VERCEL_ENV=production is not a local database. Nothing was written."
      };
    }
    return { allow: true, production: false, projectRef: "" };
  }
  if (projectRef === PRODUCTION_PROJECT_REF) {
    if (!optedIn) {
      return {
        allow: false,
        projectRef,
        message: "Refusing to write: this is the production database. Nothing was written."
      };
    }
    return { allow: true, production: true, projectRef: PRODUCTION_PROJECT_REF };
  }
  if (projectRef && !vercelProduction) return { allow: true, production: false, projectRef };
  if (projectRef && vercelProduction) {
    return {
      allow: false,
      projectRef,
      message: "Refusing to write: VERCEL_ENV=production does not match this project. Nothing was written."
    };
  }
  return {
    allow: false,
    projectRef: "",
    message: "Refusing to write: the database host is not localhost or a known Supabase project. Nothing was written."
  };
}

/** Shown after the row counts and before the production confirmation. The project ref only, never the key. */
export function productionWriteBanner(projectRef: string, counts: string): string {
  const ref = /^[a-z0-9]+$/.test(projectRef) ? projectRef : "(withheld)";
  return ["PRODUCTION WRITE", `target project ref: ${ref}`, counts.trimEnd()].join("\n");
}

/** Flagged-file identity: church, person, source page, and quote. Other columns can differ. */
export function techDirectorRowKey(row: Pick<TechDirectorCsvRow, "church" | "name" | "source_url" | "evidence_quote">): string {
  return [row.church, row.name, row.source_url, row.evidence_quote].map((value) => value.trim()).join("\u001f");
}

/** Drop input rows that are already listed in the flagged file. */
export function excludeFlaggedTechDirectorRows(
  rows: readonly TechDirectorCsvRow[],
  flagged: readonly TechDirectorCsvRow[]
): { rows: TechDirectorCsvRow[]; skipped: TechDirectorCsvRow[] } {
  const keys = new Set(flagged.map((row) => techDirectorRowKey(row)));
  const kept: TechDirectorCsvRow[] = [];
  const skipped: TechDirectorCsvRow[] = [];
  for (const row of rows) {
    if (keys.has(techDirectorRowKey(row))) skipped.push(row);
    else kept.push(row);
  }
  return { rows: kept, skipped };
}

/** Keep the first copy of each row. Existing review reasons stay ahead of a new plan. */
export function mergeFlaggedTechDirectorRows(
  existing: readonly UnmatchedTechDirector[],
  planned: readonly UnmatchedTechDirector[]
): UnmatchedTechDirector[] {
  const seen = new Set<string>();
  const merged: UnmatchedTechDirector[] = [];
  for (const item of [...existing, ...planned]) {
    const key = techDirectorRowKey(item.row);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

/**
 * The flagged report is the import CSV plus a reason column.
 * A header-only file is an empty skip list.
 */
export function parseFlaggedTechDirectorReport(text: string): { ok: true; entries: UnmatchedTechDirector[] } | { ok: false; message: string } {
  const parsed = parseTechDirectorCsv(text);
  if (!parsed.ok) return parsed;
  const table = parseCsv(text);
  const header = (table[0] ?? []).map((cell) => cell.trim().toLowerCase());
  const reasonAt = header.indexOf("reason");
  const entries: UnmatchedTechDirector[] = [];
  let data = 0;
  for (let i = 1; i < table.length && data < parsed.rows.length; i += 1) {
    const record = table[i];
    if (record.every((value) => !String(value ?? "").trim())) continue;
    const reason = reasonAt >= 0 ? String(record[reasonAt] ?? "").trim() : "";
    entries.push({ row: parsed.rows[data], reason: reason || "Listed in the flagged file." });
    data += 1;
  }
  if (data !== parsed.rows.length) return { ok: false, message: "The flagged file could not be read." };
  return { ok: true, entries };
}

type StaffItem = Record<string, unknown>;

function staffList(staff: unknown): StaffItem[] {
  if (!Array.isArray(staff)) return [];
  return staff.filter((item): item is StaffItem => Boolean(item) && typeof item === "object").map((item) => ({ ...item }));
}

/** Append contacts whose name is not already on the church. Existing objects keep their other keys. */
export function addStaffContacts(staff: unknown, additions: StaffContactWrite[]): { staff: StaffItem[]; added: number; duplicates: number } {
  const next = staffList(staff);
  const names = new Set(next.map((item) => normPersonName(item.name)).filter(Boolean));
  let added = 0;
  let duplicates = 0;
  for (const contact of additions) {
    const key = normPersonName(contact.name);
    if (!key || names.has(key)) {
      duplicates += 1;
      continue;
    }
    names.add(key);
    next.push({ ...contact });
    added += 1;
  }
  return { staff: next, added, duplicates };
}

/**
 * Append church signals that are not already stored. When the same tag, quote,
 * and source are already there and the incoming date is later, update the score
 * and the date and leave every other key on that object alone.
 */
export function addChurchSignals(
  existing: unknown,
  additions: ChurchSignalWrite[],
  updates: ChurchSignalWrite[] = []
): { signals: StaffItem[]; added: number; duplicates: number; updated: number } {
  const next = staffList(existing);
  const indexByKey = new Map<string, number>();
  next.forEach((item, index) => {
    const key = churchSignalKey(item as { tag?: string; evidence_quote?: string; source_url?: string });
    if (key && !indexByKey.has(key)) indexByKey.set(key, index);
  });
  let added = 0;
  let duplicates = 0;
  let updated = 0;
  const applyOne = (signal: ChurchSignalWrite) => {
    const key = churchSignalKey(signal);
    const at = indexByKey.get(key);
    if (at === undefined) {
      indexByKey.set(key, next.length);
      next.push({ ...signal });
      added += 1;
      return;
    }
    const current = next[at];
    const stored = String(current.signal_date ?? current.signalDate ?? "");
    if (!evidenceIsNewer(signal.signal_date, stored)) {
      duplicates += 1;
      return;
    }
    next[at] = { ...current, score: signal.score, signal_date: signal.signal_date };
    updated += 1;
  };
  for (const signal of additions) applyOne(signal);
  for (const signal of updates) applyOne(signal);
  return { signals: next, added, duplicates, updated };
}

/** The keys a server-side doc merge may replace. Other keys stay as they are at update time. */
export function churchDocPatch(doc: Record<string, unknown>, extraKeys: readonly string[] = []): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    staff_contacts: doc.staff_contacts,
    crm_signals: doc.crm_signals,
    updated_at: doc.updated_at
  };
  for (const key of extraKeys) {
    if ((CHURCH_PROFILE_PATCH_KEYS as readonly string[]).includes(key) && Object.prototype.hasOwnProperty.call(doc, key)) patch[key] = doc[key];
  }
  return patch;
}

/** True when every profile key in the patch is already on the church doc. */
export function profilePatchLanded(doc: Record<string, unknown> | null, patch: Record<string, unknown>): boolean {
  if (!doc) return false;
  for (const key of CHURCH_PROFILE_PATCH_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    if (JSON.stringify(doc[key]) !== JSON.stringify(patch[key])) return false;
  }
  return true;
}

export type ChurchDocProfile = {
  crmStatus?: string;
  leadClass?: string;
  jevAvlFit?: number | null;
  jevProjectStage?: string;
  crmOffers?: string[];
  serviceProviders?: Partial<Record<ServiceProviderId, ServiceProvider>>;
};

/** Keys this profile will put on the patch. Blank fields are left alone. */
export function profilePatchKeys(profile: ChurchDocProfile | null | undefined): string[] {
  if (!profile) return [];
  const keys: string[] = [];
  if (profile.crmStatus) keys.push("crm_status");
  if (profile.leadClass) keys.push("lead_class");
  if (typeof profile.jevAvlFit === "number") keys.push("jev_avl_fit");
  if (profile.jevProjectStage) keys.push("jev_project_stage");
  if (profile.crmOffers && profile.crmOffers.length) keys.push("crm_offers");
  if (profile.serviceProviders && Object.keys(profile.serviceProviders).length) keys.push("service_providers");
  return keys;
}

/** Blank, null, and missing are unset. 0 and "0" are set. */
function storedFieldBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

function applyChurchProfile(doc: Record<string, unknown>, profile: ChurchDocProfile | null | undefined): { doc: Record<string, unknown>; changed: boolean; keys: string[] } {
  if (!profile) return { doc, changed: false, keys: [] };
  const next = { ...doc };
  let changed = false;
  const keys: string[] = [];
  const set = (key: string, value: unknown) => {
    if (JSON.stringify(doc[key]) === JSON.stringify(value)) return;
    next[key] = value;
    changed = true;
    keys.push(key);
  };
  if (profile.crmStatus && isAllowedChurchStatus(profile.crmStatus)) set("crm_status", profile.crmStatus);
  if (profile.leadClass && storedFieldBlank(doc.lead_class)) set("lead_class", profile.leadClass);
  if (typeof profile.jevAvlFit === "number" && storedFieldBlank(doc.jev_avl_fit)) set("jev_avl_fit", profile.jevAvlFit);
  if (profile.jevProjectStage && storedFieldBlank(doc.jev_project_stage)) set("jev_project_stage", profile.jevProjectStage);
  if (profile.crmOffers && profile.crmOffers.length) set("crm_offers", profile.crmOffers);
  if (profile.serviceProviders && Object.keys(profile.serviceProviders).length) {
    const current = serviceProvidersFromDoc(doc.service_providers);
    let wrote = false;
    for (const service of SERVICE_PROVIDER_IDS) {
      const incoming = profile.serviceProviders[service];
      if (!incoming || storedServiceProvider(doc.service_providers, service)) continue;
      current[service] = incoming;
      wrote = true;
    }
    if (wrote) set("service_providers", serviceProvidersToDoc(current));
  }
  return { doc: next, changed, keys };
}

/** Copy of the church doc with only staff_contacts, crm_signals, and updated_at changed. */
export function nextChurchDoc(
  doc: Record<string, unknown>,
  contacts: StaffContactWrite[],
  signals: ChurchSignalWrite[],
  updates: ChurchSignalWrite[],
  now: string,
  profile: ChurchDocProfile | null = null
): { doc: Record<string, unknown>; addedContacts: number; addedSignals: number; updatedSignals: number; changed: boolean; patchKeys: string[] } {
  const mergedContacts = addStaffContacts(doc.staff_contacts, contacts);
  const mergedSignals = addChurchSignals(doc.crm_signals, signals, updates);
  const addedContacts = mergedContacts.added;
  const addedSignals = mergedSignals.added;
  const updatedSignals = mergedSignals.updated;
  const profiled = applyChurchProfile(
    {
      ...doc,
      staff_contacts: mergedContacts.staff,
      crm_signals: mergedSignals.signals
    },
    profile
  );
  const patchKeys = profiled.keys;
  if (!addedContacts && !addedSignals && !updatedSignals && !profiled.changed) {
    return { doc, addedContacts: 0, addedSignals: 0, updatedSignals: 0, changed: false, patchKeys: [] };
  }
  return {
    doc: {
      ...profiled.doc,
      staff_contacts: mergedContacts.staff,
      crm_signals: mergedSignals.signals,
      updated_at: now
    },
    addedContacts,
    addedSignals,
    updatedSignals,
    changed: true,
    patchKeys
  };
}

/** Set or clear the role tag and source page on the contact with this id. */
export function stampStaffContact(staff: unknown, meta: { id: string; tags: string[]; sourceUrl: string }): { staff: StaffItem[]; found: boolean } {
  const next = staffList(staff);
  const index = next.findIndex((item) => String(item.id ?? "") === meta.id);
  if (index < 0) return { staff: next, found: false };
  const current = { ...next[index] };
  if (meta.tags.length) current.tags = meta.tags;
  else delete current.tags;
  if (meta.sourceUrl) current.source_url = meta.sourceUrl;
  else delete current.source_url;
  next[index] = current;
  return { staff: next, found: true };
}

/** op_leads.kind for an unmatched church signal. Not a shop. Other lead readers skip this kind. */
export const CHURCH_LEAD_KIND = "church-lead";

/**
 * Stable op_leads slug from the normalized church, city, and state only.
 * A later import of the same church finds this row and merges contacts onto it.
 */
export function churchSignalLeadSlug(row: TechDirectorCsvRow): string {
  const church = churchMatchName(row.church);
  const city = cityKey(row.city);
  const state = stateKey(row.state);
  const digest = createHash("sha1").update([church, city, state].join("|"), "utf8").digest("hex").slice(0, 10);
  const base = church.replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "church-signal";
  return `cs-${base}-${digest}`.slice(0, 80);
}

/** Add people who are not already on the lead, matched by normalized name. Existing rows stay as they are. */
export function mergeChurchSignalContacts(existing: unknown, incoming: unknown): { contacts: StaffItem[]; added: number } {
  const next = staffList(existing);
  const names = new Set(next.map((item) => normPersonName(item.name)).filter(Boolean));
  let added = 0;
  for (const contact of staffList(incoming)) {
    const key = normPersonName(contact.name);
    if (!key || names.has(key)) continue;
    names.add(key);
    next.push(contact);
    added += 1;
  }
  return { contacts: next, added };
}

/**
 * True only when PostgREST returns PGRST202 (the function is not in the schema cache).
 * A plain 404, and a SQL error such as "operator does not exist: text = uuid", are not this.
 */
export function crmPatchRpcMissing(_status: number, detail: string): boolean {
  return detail.toLowerCase().includes("pgrst202");
}

/** Same city and state first, then the same state, then the same city. The rest stay in the order they arrived. */
export function rankAttachChurches<T extends { city: string; state: string }>(rows: readonly T[], lead: { city?: string; state?: string }): T[] {
  const city = cityKey(lead.city ?? "");
  const state = stateKey(lead.state ?? "");
  const tier = (row: T) => {
    const sameCity = Boolean(city) && cityKey(row.city) === city;
    const sameState = Boolean(state) && stateKey(row.state) === state;
    if (sameCity && sameState) return 0;
    if (sameState) return 1;
    if (sameCity) return 2;
    return 3;
  };
  return rows
    .map((row, index) => ({ row, index, tier: tier(row) }))
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .map((item) => item.row);
}

/** One import log row on op_lead_activities. client_ref is stable for the same slug, person, and quote. */
export function churchSignalActivity(leadId: string, body: { slug?: unknown; contacts?: unknown; signals?: unknown }, reason: string): Record<string, unknown> {
  const contacts = Array.isArray(body.contacts) ? body.contacts : [];
  const person = contacts.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
  const signals = body.signals && typeof body.signals === "object" ? (body.signals as Record<string, unknown>) : {};
  const quote = String(signals.evidence_quote ?? "");
  const who = person ? String(person.name ?? "") : "";
  const clientRef = `cs${createHash("sha1").update(`${String(body.slug ?? "")}|${who}|${quote}`, "utf8").digest("hex")}`.slice(0, 40);
  return {
    lead_id: leadId,
    type: "note",
    occurred_at: new Date().toISOString(),
    contact: person ? { id: person.id ?? "", name: person.name ?? "", title: person.role ?? "" } : null,
    outcome: clip(reason, 200) || "Imported as a church signal",
    source: "church_signal_import",
    client_ref: clientRef,
    created_by: "church_signal_import"
  };
}

/**
 * One unmatched row as an op_leads insert. signals.kind is "church-signal".
 * A staff name, when present, is a contact on that lead. No new table.
 */
export function churchSignalLeadBody(row: TechDirectorCsvRow, reason: string): Record<string, unknown> {
  const published = parsePublishedContact(row.contact);
  const types = parseSignalTypes(row.signal_types);
  const tags = types.ok ? signalTagsForTypes(types.types) : [];
  const person = normPersonName(row.name)
    ? {
        id: `lq-${createHash("sha1").update(`${row.church}|${normPersonName(row.name)}`, "utf8").digest("hex").slice(0, 12)}`,
        name: clip(row.name, 120),
        role: clip(row.title, 80),
        email: published.email,
        phone: published.phone,
        ...(types.ok && types.types.includes("staff") ? { tags: cleanRoleTags([TECHNICAL_DIRECTOR_TAG]) } : {}),
        ...(httpUrl(row.staff_page_url || row.source_url) ? { source_url: httpUrl(row.staff_page_url || row.source_url) } : {}),
        status: "new"
      }
    : null;
  return {
    slug: churchSignalLeadSlug(row),
    business_name: clip(row.church, 160) || "Church signal",
    kind: CHURCH_LEAD_KIND,
    city: clip(row.city, 80) || null,
    state: clip(row.state, 40) || null,
    phone: published.phone || null,
    email: published.email || null,
    website_url: httpUrl(row.website) || null,
    site_status: httpUrl(row.website) ? "refresh" : "none",
    status: "new",
    send_invite: false,
    source: "church_signal_import",
    services: [],
    contacts: person ? [person] : [],
    signals: {
      kind: "church-signal",
      tag: tags[0] ?? "",
      evidence_quote: clip(row.evidence_quote, 500),
      source_url: httpUrl(row.source_url),
      signal_date: clip(row.signal_date, 40),
      score: Number(row.score) || 0,
      reason: clip(reason, 200),
      signal_types: clip(row.signal_types, 80)
    }
  };
}

export function unmatchedReportCsv(unmatched: UnmatchedTechDirector[]): string {
  const header = [...TECH_DIRECTOR_CSV_COLUMNS, "reason"];
  const lines = [header.join(",")];
  for (const item of unmatched) {
    lines.push([...TECH_DIRECTOR_CSV_COLUMNS.map((column) => csvCell(item.row[column])), csvCell(item.reason)].join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function directoryOnlyReportCsv(rows: UnmatchedTechDirector[]): string {
  return unmatchedReportCsv(rows);
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * Optional JEV file, joined by church_id. jev_staff_real is ignored.
 * A bad fit or stage on a row is skipped and counted. It does not stop the file.
 */
export function parseJevCsv(text: string): { ok: true; byChurchId: Map<string, JevFitRow>; skipped: number } | { ok: false; message: string } {
  const table = parseCsv(text);
  if (!table.length) return { ok: false, message: "The JEV CSV needs a header row with church_id." };
  const header = table[0].map((cell) => cell.trim().toLowerCase());
  if (!header.includes("church_id")) return { ok: false, message: "The JEV CSV needs a church_id column." };
  const index = new Map(header.map((name, at) => [name, at]));
  const cell = (record: string[], name: string) => {
    const at = index.get(name);
    return at === undefined ? "" : String(record[at] ?? "").trim();
  };
  const byChurchId = new Map<string, JevFitRow>();
  let skipped = 0;
  for (let i = 1; i < table.length; i += 1) {
    const record = table[i];
    if (record.every((value) => !String(value ?? "").trim())) continue;
    const churchId = cell(record, "church_id");
    if (!churchId) {
      skipped += 1;
      continue;
    }
    const fit = parseJevAvlFit(cell(record, "jev_avl_fit"));
    const stage = parseJevProjectStage(cell(record, "jev_project_stage"));
    if (!fit.ok || !stage.ok) {
      skipped += 1;
      continue;
    }
    byChurchId.set(churchId, { churchId, jevAvlFit: fit.fit, jevProjectStage: stage.stage });
  }
  return { ok: true, byChurchId, skipped };
}
