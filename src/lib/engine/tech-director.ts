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

/** Parse CSV text. `state` and `church_id` may be omitted. Other columns are required. */
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

function sameChurchName(church: DirectoryChurch, row: TechDirectorCsvRow): boolean {
  const want = normName(row.church);
  if (!want) return false;
  return [normName(church.name), normName(church.churchName)].filter(Boolean).includes(want);
}

function byNameCity(pool: DirectoryChurch[], row: TechDirectorCsvRow): DirectoryChurch[] {
  const city = cityKey(row.city);
  if (!normName(row.church) || !city) return [];
  return pool.filter((church) => sameChurchName(church, row) && cityKey(church.city) === city && statesOk(row.state, church.state));
}

/** A domain hit is not enough. The normalized name or the city has to agree too. */
function domainAgrees(church: DirectoryChurch, row: TechDirectorCsvRow): boolean {
  if (sameChurchName(church, row)) return true;
  const city = cityKey(row.city);
  return Boolean(city) && city === cityKey(church.city);
}

/**
 * church_id when that column is filled. Otherwise a website domain that is not
 * a shared host (suppressionDomain drops umc.org, ag.org, jw.org, and the
 * rest) and that also agrees on the normalized name or the city. A shared host
 * is not a domain match. Name and city are the fallback.
 */
export function matchDirectoryChurch(row: TechDirectorCsvRow, churches: DirectoryChurch[]): { church: DirectoryChurch } | { reason: string } {
  const churchId = String(row.church_id ?? "").trim();
  if (churchId) {
    const found = churches.find((church) => church.id === churchId);
    if (found) return { church: found };
    return { reason: "No church on file has that church id." };
  }
  const domain = suppressionDomain(row.website);
  if (domain) {
    const byDomain = churches.filter((church) => suppressionDomain(church.website) === domain || suppressionDomain(church.domain) === domain);
    if (byDomain.length === 1) {
      if (domainAgrees(byDomain[0], row)) return { church: byDomain[0] };
      return { reason: "The website matches one church, but the name and city do not agree." };
    }
    if (byDomain.length > 1) {
      const named = byNameCity(byDomain, row);
      if (named.length === 1) return { church: named[0] };
      if (named.length > 1) return { reason: "More than one church has that website, name, and city." };
      return { reason: "Several churches share that website, and the name and city do not pick one." };
    }
  }
  if (!normName(row.church) || !cityKey(row.city)) return { reason: "No website match, and the church name or city is missing." };
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

export function planTechDirectorImport(rows: TechDirectorCsvRow[], churches: DirectoryChurch[]): ImportPlan {
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
    directoryOnlyRows: [],
    byState: {},
    additions: [],
    signalAdditions: [],
    signalUpdates: []
  };
  for (const row of rows) {
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
      plan.unmatched.push({ row, reason: match.reason });
      stateBucket(plan, row.state).unmatched += 1;
      continue;
    }
    const church = match.church;
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
    `unmatched: ${plan.unmatched.length}`,
    "by state:"
  ];
  for (const state of Object.keys(plan.byState).sort()) {
    const row = plan.byState[state];
    lines.push(
      `  ${state}: matched ${row.matched}, in CRM ${row.inCrm}, directory only ${row.directoryOnly}, new contacts ${row.newContacts}, duplicates skipped ${row.duplicatesSkipped}, new signals ${row.newSignals}, signal duplicates skipped ${row.signalDuplicatesSkipped}, signals updated ${row.signalsUpdated}, unmatched ${row.unmatched}`
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
