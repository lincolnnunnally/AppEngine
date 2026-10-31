// Verified nationwide church contacts → the tech-director importer columns.
// Tags only. No new churches, no attendance field, no sends.

import { TECHNICAL_DIRECTOR_TAG, parseLeadClass } from "./tech-director-core.ts";
import { parseCsv } from "./tech-director.ts";

export const NATIONWIDE_SOURCE_TAG = "src:nationwide-20261031";
export const NATIONWIDE_SIGNAL_DATE = "2026-10-31";

export const NATIONWIDE_IMPORTER_COLUMNS = [
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
  "score",
  "lead_class",
  "contact_tags"
] as const;

export type NationwideSkipCounts = {
  doNotUse: number;
  notReady: number;
  skipFit: number;
  noChurch: number;
};

export type NationwideAdaptResult = {
  ok: true;
  csv: string;
  inputRows: number;
  readyRows: number;
  skipped: NationwideSkipCounts;
};

const text = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

function slug(value: unknown): string {
  return text(value)
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function parts(value: unknown): string[] {
  return text(value)
    .split(/[;,|]/)
    .map((part) => slug(part))
    .filter(Boolean);
}

/** staff, campaign, or renovation from the file. Anything else, including a blank, is staff. */
export function importerSignalTypes(value: unknown): string {
  const kept = parts(value).filter((part) => part === "staff" || part === "campaign" || part === "renovation");
  return kept.length ? [...new Set(kept)].join("|") : "staff";
}

function scoreFor(confidence: unknown): string {
  const raw = text(confidence).toLowerCase();
  if (raw === "high") return "5";
  if (raw === "medium") return "3";
  if (raw === "low") return "1";
  return "1";
}

/** A person name when the file has one. An office inbox still needs a stable name so the tags have a contact. */
export function importerContactName(row: { contact_name?: unknown; title?: unknown; role?: unknown; email?: unknown }): string {
  const person = text(row.contact_name);
  if (person) return person;
  const title = text(row.title);
  if (title) return title;
  const role = text(row.role);
  if (role && role.toLowerCase() !== "office") return role.slice(0, 120);
  const email = text(row.email);
  if (email) return `Office ${email}`.slice(0, 120);
  return "Office";
}

function contactCell(email: unknown, phone: unknown): string {
  const mail = text(email);
  const tel = text(phone);
  if (mail && tel) return `${mail} | ${tel}`;
  return mail || tel;
}

function leadClassCell(value: unknown): string {
  const parsed = parseLeadClass(value);
  return parsed.ok ? parsed.leadClass : "";
}

/**
 * verify:, fit:, size:, role:, and the nationwide source. No attendance.
 * strict_av (and an email role of tech_director) also keeps the Technical director tag.
 * risky, likely, emailable_result=not_run, and shared_email=yes are tags, not skips.
 * A campaign list uses verify=verified (or verified,likely). Nothing here sends mail.
 */
export function importerContactTags(row: {
  verify_status?: unknown;
  campaign_fit?: unknown;
  size_band?: unknown;
  role_class?: unknown;
  email_role?: unknown;
}): string[] {
  const tags: string[] = [];
  const verify = slug(row.verify_status);
  if (verify) tags.push(`verify:${verify}`);
  for (const part of parts(row.campaign_fit)) {
    if (part === "skip") continue;
    const tag = `fit:${part}`;
    if (!tags.includes(tag)) tags.push(tag);
  }
  const size = slug(row.size_band);
  if (size) tags.push(`size:${size}`);
  const role = slug(row.role_class) || slug(row.email_role);
  if (role) tags.push(`role:${role}`);
  tags.push(NATIONWIDE_SOURCE_TAG);
  if (slug(row.role_class) === "strict_av" || slug(row.email_role) === "tech_director") tags.unshift(TECHNICAL_DIRECTOR_TAG);
  return tags;
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

type VerifiedRow = Record<string, string>;

function parseVerifiedCsv(text: string): { ok: true; rows: VerifiedRow[] } | { ok: false; message: string } {
  const table = parseCsv(text);
  if (!table.length) return { ok: false, message: "The verified CSV needs a header row." };
  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const required = ["church_name", "verify_status", "directory_ready", "campaign_fit"];
  const missing = required.filter((column) => !header.includes(column));
  if (missing.length) return { ok: false, message: `The verified CSV is missing ${missing.join(", ")}.` };
  const index = new Map(header.map((name, at) => [name, at]));
  const rows: VerifiedRow[] = [];
  for (let i = 1; i < table.length; i += 1) {
    const record = table[i];
    if (record.every((value) => !String(value ?? "").trim())) continue;
    const row: VerifiedRow = {};
    for (const [name, at] of index) row[name] = String(record[at] ?? "").trim();
    rows.push(row);
  }
  return { ok: true, rows };
}

function shouldSkip(row: VerifiedRow, skipped: NationwideSkipCounts): boolean {
  if (!text(row.church_name)) {
    skipped.noChurch += 1;
    return true;
  }
  if (slug(row.verify_status) === "do_not_use") {
    skipped.doNotUse += 1;
    return true;
  }
  if (text(row.directory_ready).toLowerCase() !== "yes") {
    skipped.notReady += 1;
    return true;
  }
  if (parts(row.campaign_fit).includes("skip") || slug(row.campaign_fit) === "skip") {
    skipped.skipFit += 1;
    return true;
  }
  return false;
}

/**
 * Rewrite a verified nationwide CSV into tech-director importer columns.
 * Skips do_not_use, directory_ready other than yes, and campaign_fit skip.
 * estimated_size is not copied. Size is the size: tag only.
 */
export function adaptVerifiedNationwideCsv(source: string): NationwideAdaptResult | { ok: false; message: string } {
  const parsed = parseVerifiedCsv(source);
  if (!parsed.ok) return parsed;
  const skipped: NationwideSkipCounts = { doNotUse: 0, notReady: 0, skipFit: 0, noChurch: 0 };
  const lines = [NATIONWIDE_IMPORTER_COLUMNS.join(",")];
  for (const row of parsed.rows) {
    if (shouldSkip(row, skipped)) continue;
    const values = [
      text(row.church_name),
      text(row.church_id),
      text(row.city),
      text(row.state),
      text(row.website_url),
      text(row.source_url),
      importerContactName(row),
      text(row.title) || text(row.role),
      contactCell(row.email, row.phone),
      importerSignalTypes(row.signal_types),
      "",
      text(row.source_url),
      NATIONWIDE_SIGNAL_DATE,
      scoreFor(row.confidence),
      leadClassCell(row.lead_class),
      importerContactTags(row).join("|")
    ];
    lines.push(values.map(csvCell).join(","));
  }
  return {
    ok: true,
    csv: `${lines.join("\n")}\n`,
    inputRows: parsed.rows.length,
    readyRows: lines.length - 1,
    skipped
  };
}

const VALUE_FLAGS = new Set(["--report", "--skip-file", "--jev", "--flagged-file", "--out"]);

/** Args for import-tech-directors. The verified file is replaced by the converted CSV. --out stays here. */
export function nationwideChildArgs(args: readonly string[], convertedPath: string): string[] {
  const out: string[] = [];
  let sawFile = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? "";
    if (arg === "--out") {
      i += 1;
      continue;
    }
    if (VALUE_FLAGS.has(arg)) {
      out.push(arg);
      const value = args[i + 1];
      if (value !== undefined) out.push(value);
      i += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      out.push(arg);
      continue;
    }
    if (!sawFile) {
      sawFile = true;
      out.push(convertedPath);
    }
  }
  if (!sawFile) out.push(convertedPath);
  return out;
}
