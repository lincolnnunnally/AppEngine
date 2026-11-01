// Load builders and church architects onto op_leads.
// kind is field. Every ready row gets fit:avl_referral.
// role:builder, role:architect, role:design_build, or role:capital_campaign_consultant.
// verify: is stored when the file has one. do_not_use is skipped.
//
// Reuses the church-lead slug, contact merge, compare-and-swap, and
// op_lead_activities pattern. The slug prefix is ar-, so a church-lead is not reused.
// church_projects is kept on the lead. No church is created. Nothing is sent.
//
// Talk-now signals (avl_talk_now_signals_*.csv) stay on the church importer
// (scripts/import-tech-directors.ts). That dry-run waits until after
// Non-SE, wave3, wave4, and Large. It is not this file.
//
// Dry run (counts only, no writes). This is the command for the Searcher file:
//   node --experimental-strip-types scripts/import-avl-referrals.ts --dry-run /workspace/church-data/nationwide-contacts-20261031/verified/builders_architects_avl_referrals_20261101.csv
//
// Apply is refused on production unless --allow-production, IMPORT_ALLOW_PROD,
// and --yes are all set. Do not apply from an agent. LIVE apply stays after
// Non-SE, then wave3, then wave4, then Large.
//   IMPORT_ALLOW_PROD=uqhqulrqcygsmmzdzemx node --experimental-strip-types scripts/import-avl-referrals.ts --apply --allow-production --yes path/to/builders_architects_avl_referrals_YYYYMMDD.csv

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { AVL_REFERRAL_KIND, avlReferralActivity, formatAvlReferralSummary, planAvlReferralImport } from "../src/lib/engine/avl-referral.ts";
import { decideProductionWrite, mergeChurchSignalContacts, productionWriteBanner, type ProductionWriteDecision } from "../src/lib/engine/tech-director.ts";

loadEnvFile(".env.local");
loadEnvFile(".env");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const apply = args.includes("--apply");
const allowProduction = args.includes("--allow-production");
const confirmYes = args.includes("--yes");
const file = args.filter((arg) => !arg.startsWith("--"))[0];

if (dryRun === apply || !file) {
  console.error(`Usage:
  node --experimental-strip-types scripts/import-avl-referrals.ts --dry-run <builders.csv>
  node --experimental-strip-types scripts/import-avl-referrals.ts --apply <builders.csv>

Columns are read by header name: org_name (or firm), contact_name, title, role (or type),
email, phone, website, city, state, zip, church_projects, source_url, verify_status, lead_class.
--dry-run prints counts and writes nothing.
--apply stores op_leads.kind=field and an op_lead_activities note. It does not create a church and does not send email.
Production also needs --allow-production, IMPORT_ALLOW_PROD set to the project ref, and --yes.
LIVE apply waits until Non-SE, wave3, wave4, and Large have finished.`);
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

const planned = planAvlReferralImport(csvText);
if (!planned.ok) {
  console.error(planned.message);
  process.exit(1);
}
const summary = formatAvlReferralSummary(planned.plan);
console.log(summary);

if (!apply) {
  console.log("dry run: nothing was written");
  process.exit(0);
}

if (!planned.plan.leads) {
  console.log("nothing ready to import. nothing was written.");
  process.exit(0);
}

const config = databaseConfig();
if (!config) {
  console.error("No shared database is configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const productionGuard: ProductionWriteDecision = decideProductionWrite({
  url: config.url,
  vercelEnv: process.env.VERCEL_ENV,
  allowProduction,
  importAllowProd: process.env.IMPORT_ALLOW_PROD
});
if (!productionGuard.allow) {
  console.error(productionGuard.message);
  process.exit(1);
}
if (productionGuard.production) {
  console.log(productionWriteBanner(productionGuard.projectRef, summary));
  const confirmed = await confirmProductionWrite(confirmYes);
  if (!confirmed) process.exit(1);
}

let created = 0;
let merged = 0;
let already = 0;
for (const body of planned.plan.bodies) {
  if (body.kind !== AVL_REFERRAL_KIND || body.send_invite !== false) {
    console.error("Refusing to write a row that is not a field referral. Nothing further was written.");
    process.exit(1);
  }
  const saved = await writeReferralLead(config, body);
  if (saved === "exists") {
    already += 1;
    continue;
  }
  if (saved === "merged") {
    merged += 1;
    continue;
  }
  if (saved === "error") {
    console.error(`Could not save a referral lead. Stopped after ${created} new leads. Re-running is safe.`);
    process.exit(1);
  }
  created += 1;
}
console.log(`avl referrals stored: ${created} new, ${merged} merged, ${already} already there`);
console.log("nothing is sent");

function databaseConfig(): { url: string; key: string } | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!url || !key) return null;
  return { url, key };
}

async function confirmProductionWrite(yes: boolean): Promise<boolean> {
  if (yes) return true;
  if (!process.stdin.isTTY) {
    console.error("Refusing to write: production needs --yes when there is no prompt. Nothing was written.");
    return false;
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await prompt.question("Type yes to write to production: ")).trim().toLowerCase();
    if (answer === "yes") return true;
    console.error("Refusing to write: production was not confirmed. Nothing was written.");
    return false;
  } finally {
    prompt.close();
  }
}

async function writeReferralLead(config: { url: string; key: string }, body: Record<string, unknown>): Promise<"ok" | "merged" | "exists" | "error"> {
  const slug = encodeURIComponent(String(body.slug ?? ""));
  let leadId = "";
  let outcome: "ok" | "merged" | "exists" = "ok";
  let settled = false;
  for (let attempt = 0; attempt < 3 && !settled; attempt += 1) {
    const existing = await rest(config, `op_leads?slug=eq.${slug}&select=id,contacts,updated_at&limit=1`);
    if (!existing.ok) return "error";
    const rows = (await existing.json()) as Array<{ id?: string; contacts?: unknown; updated_at?: string | null }>;
    if (Array.isArray(rows) && rows.length > 0) {
      leadId = String(rows[0].id ?? "");
      if (!leadId) return "error";
      const mergedContacts = mergeChurchSignalContacts(rows[0].contacts, body.contacts);
      if (mergedContacts.added === 0 && mergedContacts.tagsUpdated === 0) {
        outcome = "exists";
        settled = true;
        break;
      }
      const version = rows[0].updated_at ? String(rows[0].updated_at) : "";
      const guard = version ? `&updated_at=eq.${encodeURIComponent(version)}` : "&updated_at=is.null";
      const response = await rest(config, `op_leads?id=eq.${encodeURIComponent(leadId)}${guard}&select=id`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ contacts: mergedContacts.contacts, updated_at: new Date().toISOString() })
      });
      if (!response.ok) return "error";
      const saved = (await response.json()) as unknown[];
      if (!Array.isArray(saved) || saved.length !== 1) continue;
      outcome = "merged";
      settled = true;
      break;
    }
    const response = await rest(config, "op_leads?select=id", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
    if (response.status === 409) return "exists";
    if (!response.ok) return "error";
    const saved = (await response.json()) as Array<{ id?: string }>;
    leadId = String(saved?.[0]?.id ?? "");
    if (!leadId) return "error";
    outcome = "ok";
    settled = true;
  }
  if (!settled || !leadId) return "error";
  const logged = await rest(config, "op_lead_activities?on_conflict=client_ref&select=id", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(avlReferralActivity(leadId, body))
  });
  if (!logged.ok && logged.status !== 409) return "error";
  return outcome;
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
