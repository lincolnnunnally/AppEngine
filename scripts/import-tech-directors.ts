// Import church signals onto churches already on file.
//
// Matches each CSV row to an existing church: normalized website domain first,
// then name and city. Never creates a church. A staff row adds the person
// (same name at that church is skipped). A campaign or renovation row stores
// the evidence on the church and does not create a person. Churches in the
// ChurchConnect directory that are not already on the CRM are counted and
// reported, not written. Writes only with --apply, and refuses production.
//
// Columns: church, city, state (optional), website, staff_page_url, name, title,
// contact, signal_types, evidence_quote, source_url, signal_date, score
// signal_types is staff, campaign, renovation, or several joined with |
//
// Dry run (counts only, no writes):
//   node --experimental-strip-types scripts/import-tech-directors.ts --dry-run scripts/fixtures/tech-directors.csv
//
// Apply (not against production):
//   node --experimental-strip-types scripts/import-tech-directors.ts --apply path/to/file.csv
//
// Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY),
// including values in .env.local. Reads and writes cc_churches.doc.staff_contacts
// and cc_churches.doc.crm_signals.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  addChurchSignals,
  addStaffContacts,
  churchIsInCrm,
  directoryOnlyReportCsv,
  formatImportCounts,
  parseTechDirectorCsv,
  planTechDirectorImport,
  TECH_DIRECTOR_CSV_COLUMNS,
  unmatchedReportCsv,
  type ChurchSignalWrite,
  type DirectoryChurch,
  type StaffContactWrite
} from "../src/lib/engine/tech-director.ts";
import { readChurchSignals } from "../src/lib/engine/tech-director-core.ts";

const PROD_REFS = ["uqhqulrqcygsmmzdzemx"];
const PAGE = 1000;
const MAX_PAGES = 40;

loadEnvFile(".env.local");
loadEnvFile(".env");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const apply = args.includes("--apply");
const reportFlag = args.indexOf("--report");
const reportPath = reportFlag >= 0 ? args[reportFlag + 1] : "";
const file = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--report")[0];

if (dryRun === apply || !file || (reportFlag >= 0 && !reportPath)) {
  console.error(`Usage:
  node --experimental-strip-types scripts/import-tech-directors.ts --dry-run <file.csv>
  node --experimental-strip-types scripts/import-tech-directors.ts --apply <file.csv>

Columns: ${TECH_DIRECTOR_CSV_COLUMNS.join(", ")}
state may be omitted. signal_types is staff, campaign, renovation, or several joined with |.
--dry-run prints counts by state and writes nothing to the database.
It also counts rows that match a ChurchConnect church that is not on the CRM.
--apply writes only churches already on the CRM. It does not create churches.
Optional: --report <unmatched.csv>`);
  process.exit(1);
}

const config = databaseConfig();
if (!config) {
  console.error("No shared database is configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (apply && isProduction(config.url)) {
  console.error("Refusing to write: this is the production database. Nothing was written.");
  process.exit(1);
}

const csvPath = resolve(file);
let csvText = "";
try {
  csvText = readFileSync(csvPath, "utf8");
} catch {
  console.error(`Could not read ${csvPath}.`);
  process.exit(1);
}
const parsed = parseTechDirectorCsv(csvText);
if (!parsed.ok) {
  console.error(parsed.message);
  process.exit(1);
}

const churches = await readChurches(config);
const plan = planTechDirectorImport(parsed.rows, churches);
console.log(formatImportCounts(plan));
const unmatchedPath = plan.unmatched.length ? resolve(reportPath || csvPath.replace(/\.csv$/i, "") + "-unmatched.csv") : "";
if (unmatchedPath) {
  writeFileSync(unmatchedPath, unmatchedReportCsv(plan.unmatched));
  console.log(`unmatched report: ${unmatchedPath}`);
} else {
  console.log("unmatched report: none");
}
const directoryPath = plan.directoryOnlyRows.length ? resolve(csvPath.replace(/\.csv$/i, "") + "-directory-only.csv") : "";
if (directoryPath) {
  writeFileSync(directoryPath, directoryOnlyReportCsv(plan.directoryOnlyRows));
  console.log(`directory only report: ${directoryPath}`);
} else {
  console.log("directory only report: none");
}

if (!apply) {
  console.log("dry run: no churches were written");
  process.exit(0);
}

const contactsByChurch = new Map<string, StaffContactWrite[]>();
for (const addition of plan.additions) {
  const list = contactsByChurch.get(addition.churchId) ?? [];
  list.push(addition.contact);
  contactsByChurch.set(addition.churchId, list);
}
const signalsByChurch = new Map<string, ChurchSignalWrite[]>();
for (const addition of plan.signalAdditions) {
  const list = signalsByChurch.get(addition.churchId) ?? [];
  list.push(addition.signal);
  signalsByChurch.set(addition.churchId, list);
}
const churchIds = new Set([...contactsByChurch.keys(), ...signalsByChurch.keys()]);

let wrote = 0;
let contactsWritten = 0;
let signalsWritten = 0;
for (const churchId of churchIds) {
  const doc = await readDoc(config, churchId);
  if (!doc) {
    console.error(`Could not read church ${churchId}. Stopped after writing ${wrote} churches.`);
    process.exit(1);
  }
  const mergedContacts = addStaffContacts(doc.staff_contacts, contactsByChurch.get(churchId) ?? []);
  const mergedSignals = addChurchSignals(doc.crm_signals, signalsByChurch.get(churchId) ?? []);
  if (!mergedContacts.added && !mergedSignals.added) continue;
  const next = { ...doc, staff_contacts: mergedContacts.staff, crm_signals: mergedSignals.signals };
  const ok = await writeDoc(config, churchId, next);
  if (!ok) {
    console.error(`Could not update church ${churchId}. Stopped after writing ${wrote} churches.`);
    process.exit(1);
  }
  wrote += 1;
  contactsWritten += mergedContacts.added;
  signalsWritten += mergedSignals.added;
}
console.log(`applied: ${wrote} churches updated, ${contactsWritten} new contacts, ${signalsWritten} new signals`);

function databaseConfig(): { url: string; key: string } | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!url || !key) return null;
  return { url, key };
}

function isProduction(url: string): boolean {
  if (process.env.VERCEL_ENV === "production") return true;
  return PROD_REFS.some((ref) => url.includes(ref));
}

async function readChurches(config: { url: string; key: string }): Promise<DirectoryChurch[]> {
  const select = [
    "id",
    "name:doc->>name",
    "church_name:doc->>church_name",
    "city:doc->>city",
    "state:doc->>state",
    "website:doc->>website",
    "domain:doc->>domain",
    "crm_status:doc->>crm_status",
    "crm_next_action_date:doc->>crm_next_action_date",
    "last_invited_at:doc->>last_invited_at",
    "invite_status:doc->>invite_status",
    "site_slug:doc->>site_slug",
    "website_offer_status:doc->>website_offer_status",
    "is_customer:doc->>is_customer",
    "signed_up:doc->>signed_up",
    "staff_contacts:doc->staff_contacts",
    "crm_signals:doc->crm_signals"
  ].join(",");
  const churches: DirectoryChurch[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await rest(config, `cc_churches?select=${select}&order=id&limit=${PAGE}&offset=${page * PAGE}`);
    if (!response.ok) {
      console.error("Churches could not be read. Nothing was written.");
      process.exit(1);
    }
    const rows = (await response.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(rows)) {
      console.error("Churches could not be read. Nothing was written.");
      process.exit(1);
    }
    for (const row of rows) {
      const staff = Array.isArray(row.staff_contacts) ? row.staff_contacts : [];
      churches.push({
        id: String(row.id ?? ""),
        name: String(row.name ?? ""),
        churchName: String(row.church_name ?? ""),
        city: String(row.city ?? ""),
        state: String(row.state ?? ""),
        website: String(row.website ?? ""),
        domain: String(row.domain ?? ""),
        inCrm: churchIsInCrm({
          crmStatus: row.crm_status,
          crmNextActionDate: row.crm_next_action_date,
          lastInvitedAt: row.last_invited_at,
          inviteStatus: row.invite_status,
          siteSlug: row.site_slug,
          websiteOfferStatus: row.website_offer_status,
          isCustomer: row.is_customer,
          signedUp: row.signed_up
        }),
        signals: readChurchSignals(row.crm_signals),
        contacts: staff
          .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
          .map((item) => ({ name: String(item.name ?? "") }))
      });
    }
    if (rows.length < PAGE) return churches.filter((church) => church.id);
    if (page === MAX_PAGES - 1) {
      console.error("The church list did not finish reading. Nothing was written.");
      process.exit(1);
    }
  }
  return churches;
}

async function readDoc(config: { url: string; key: string }, churchId: string): Promise<Record<string, unknown> | null> {
  const response = await rest(config, `cc_churches?id=eq.${encodeURIComponent(churchId)}&select=doc&limit=1`);
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<{ doc?: Record<string, unknown> }>;
  const doc = rows?.[0]?.doc;
  return doc && typeof doc === "object" ? doc : null;
}

async function writeDoc(config: { url: string; key: string }, churchId: string, doc: Record<string, unknown>): Promise<boolean> {
  const response = await rest(config, `cc_churches?id=eq.${encodeURIComponent(churchId)}&select=id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ doc })
  });
  if (!response.ok) return false;
  const rows = (await response.json()) as unknown[];
  return Array.isArray(rows) && rows.length === 1;
}

async function rest(config: { url: string; key: string }, query: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${config.url}/rest/v1/${query}`, {
    ...init,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "accept-profile": "public",
      ...(init.headers ?? {})
    }
  });
}

function loadEnvFile(name: string) {
  try {
    const text = readFileSync(resolve(name), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key]) continue;
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[key] = value;
    }
  } catch {
    // Optional file.
  }
}
