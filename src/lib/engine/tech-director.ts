// Match a technical-director CSV to churches already on file, and merge the
// contact into that church's staff_contacts. No new churches. No sends.
import { createHash } from "node:crypto";
import { normName, suppressionDomain } from "./lpl-crm-core.ts";
import {
  SIGNAL_STAFF,
  TECHNICAL_DIRECTOR_TAG,
  churchSignalKey,
  cleanRoleTags,
  httpUrl,
  parsePublishedContact,
  parseSignalScore,
  parseSignalTypes,
  signalTagsForTypes,
  stateCode,
  type SignalType
} from "./tech-director-core.ts";

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
  /** Already on the CRM desk (pipeline). A directory-only church is not written. */
  inCrm: boolean;
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

export function planTechDirectorImport(rows: TechDirectorCsvRow[], churches: DirectoryChurch[], extraFlags: readonly ImportFlag[] = []): ImportPlan {
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
    signalUpdates: []
  };
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
    if (!church.inCrm) {
      plan.directoryOnly += 1;
      bucket.directoryOnly += 1;
      plan.directoryOnlyRows.push({ row, reason: "In the ChurchConnect directory, not on the CRM." });
      continue;
    }
    plan.inCrm += 1;
    bucket.inCrm += 1;
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
  return plan;
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
    "by state:"
  ];
  for (const state of Object.keys(plan.byState).sort()) {
    const row = plan.byState[state];
    lines.push(
      `  ${state}: matched ${row.matched}, in CRM ${row.inCrm}, directory only ${row.directoryOnly}, new contacts ${row.newContacts}, duplicates skipped ${row.duplicatesSkipped}, new signals ${row.newSignals}, signal duplicates skipped ${row.signalDuplicatesSkipped}, signals updated ${row.signalsUpdated}, flagged ${row.flagged}, unmatched ${row.unmatched}`
    );
  }
  return lines.join("\n");
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
export function churchDocPatch(doc: Record<string, unknown>): { staff_contacts: unknown; crm_signals: unknown; updated_at: unknown } {
  return {
    staff_contacts: doc.staff_contacts,
    crm_signals: doc.crm_signals,
    updated_at: doc.updated_at
  };
}

/** Copy of the church doc with only staff_contacts, crm_signals, and updated_at changed. */
export function nextChurchDoc(
  doc: Record<string, unknown>,
  contacts: StaffContactWrite[],
  signals: ChurchSignalWrite[],
  updates: ChurchSignalWrite[],
  now: string
): { doc: Record<string, unknown>; addedContacts: number; addedSignals: number; updatedSignals: number; changed: boolean } {
  const mergedContacts = addStaffContacts(doc.staff_contacts, contacts);
  const mergedSignals = addChurchSignals(doc.crm_signals, signals, updates);
  const addedContacts = mergedContacts.added;
  const addedSignals = mergedSignals.added;
  const updatedSignals = mergedSignals.updated;
  if (!addedContacts && !addedSignals && !updatedSignals) {
    return { doc, addedContacts: 0, addedSignals: 0, updatedSignals: 0, changed: false };
  }
  return {
    doc: {
      ...doc,
      staff_contacts: mergedContacts.staff,
      crm_signals: mergedSignals.signals,
      updated_at: now
    },
    addedContacts,
    addedSignals,
    updatedSignals,
    changed: true
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
 * True only when PostgREST says crm_patch_church_doc is not installed.
 * A SQL error, including "operator does not exist: text = uuid", is not this.
 */
export function crmPatchRpcMissing(status: number, detail: string): boolean {
  if (status === 404) return true;
  const text = detail.toLowerCase();
  if (text.includes("pgrst202")) return true;
  return text.includes("could not find the function") && text.includes("schema cache");
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
