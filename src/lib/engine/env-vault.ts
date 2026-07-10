// Per-user environment vault: one place where a user (Lincoln included) stores the
// API keys their apps need. Shared values apply to every app they build; a per-app
// scope overrides the shared value for that one app. Values are AES-256-GCM
// encrypted at rest and NEVER returned by any API — write-only, like /integrations.
// At deploy time resolveEnvForApp() merges vault values into the generated app's
// Vercel env (engine-provisioned keys always win), so apps just read process.env.
//
// Relationship to Codex's shared-environment-source-standard.md: same shape
// (shared source + app profile + required keys), one layer up — that standard
// composes .env files for ecosystem repos from a local private file; this vault is
// the in-product feature for every signed-in user's generated apps. SERVER ONLY.
import crypto from "node:crypto";
import { getDatabase } from "@/lib/db/client";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";

function hasDatabase(): boolean {
  return Boolean(getConfiguredDatabaseUrl());
}

// Keys the engine provisions per app — the vault must never override these.
const RESERVED_KEYS = new Set(["DATABASE_URL", "AUTH_SECRET"]);
const KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;

// The catalog shown to users: what each standard key does, WHERE to find it, and
// whether it is usually UNIVERSAL (one value shared by every app — set it once) or
// PER-APP (each app has its own). `scope` is guidance for the UI, not a rule — any
// key can be saved shared or scoped to one app. Custom keys are allowed too.
// `engineRuntime` marks keys the ENGINE ITSELF reads from its own process.env
// (Render client, AI workers, DNS adapter) — when the OWNER saves one of these
// universally, the vault write also mirrors it into We Succeed's own hosting env
// so entering it once genuinely powers everything.
export type KnownKeyScope = "universal" | "per_app";
export type KnownKey = { key: string; usedFor: string; whereToFind: string; scope: KnownKeyScope; engineRuntime?: boolean };

export const KNOWN_KEYS: readonly KnownKey[] = [
  // ── Universal — the same value across your apps, so set it once ──────────────
  { key: "ANTHROPIC_API_KEY", scope: "universal", engineRuntime: true, usedFor: "AI features (Claude) in your apps", whereToFind: "console.anthropic.com → API Keys" },
  { key: "OPENAI_API_KEY", scope: "universal", engineRuntime: true, usedFor: "AI features (OpenAI) in your apps", whereToFind: "platform.openai.com → API keys" },
  { key: "RESEND_API_KEY", scope: "universal", usedFor: "Sending email from your apps", whereToFind: "resend.com → API Keys → Create API Key" },
  { key: "SENDER_EMAIL", scope: "universal", usedFor: "The address your apps' email comes from", whereToFind: "A sender you verified in Resend (Domains)" },
  { key: "RENDER_API_KEY", scope: "universal", engineRuntime: true, usedFor: "Programmatic control of your Render services (ONE key per Render account covers every service in it)", whereToFind: "dashboard.render.com → Account Settings → API Keys → Create API Key" },
  { key: "CLOUDFLARE_API_TOKEN", scope: "universal", engineRuntime: true, usedFor: "DNS management for all your domains — attach domains to apps, mail records, email forwarding (one token covers every domain in the account)", whereToFind: "dash.cloudflare.com → My Profile → API Tokens → Create Custom Token (Zone:Edit, DNS:Edit, Zone Settings:Edit, Email Routing:Edit; All zones from account)" },
  { key: "SUPABASE_DB_URL", scope: "universal", usedFor: "Direct database connection for app backends (EasyPeazy, snip.show) — full access, keep secret", whereToFind: "supabase.com → your project → Connect (top of page) → Connection String → URI (use the Session pooler one; includes your database password)" },
  { key: "NEXT_PUBLIC_SUPABASE_URL", scope: "universal", usedFor: "Your Supabase project's URL (safe in the browser)", whereToFind: "supabase.com → your project → Project Settings → API → Project URL" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", scope: "universal", usedFor: "Supabase public (anon) key for the browser", whereToFind: "Same page → Project API keys → anon public" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", scope: "universal", usedFor: "Supabase server key — full access, keep secret", whereToFind: "Same page → Project API keys → service_role (secret)" },
  { key: "VITE_SUPABASE_URL", scope: "universal", usedFor: "Supabase project URL for Vite apps (same value, Vite's variable name)", whereToFind: "Same Supabase Project URL as above" },
  { key: "VITE_SUPABASE_ANON_KEY", scope: "universal", usedFor: "Supabase anon key for Vite apps (same value, Vite's variable name)", whereToFind: "Same anon public key as above" },
  // ── Per-app — usually different for each app ─────────────────────────────────
  { key: "STRIPE_SECRET_KEY", scope: "universal", usedFor: "Server-side payments — ONE Stripe account, one key, shared by every app (money goes to YOUR Stripe). For card-on-file the restricted key needs these permissions turned ON: Customers (write), SetupIntents (write), PaymentIntents (write).", whereToFind: "dashboard.stripe.com → Developers → API keys → reveal Secret key (or Edit your restricted key to enable Customers/SetupIntents/PaymentIntents write)" },
  { key: "STRIPE_PUBLISHABLE_KEY", scope: "universal", usedFor: "Browser-side key (safe to expose) — needed for on-page card forms like save-a-card. Same ONE Stripe account as the secret key.", whereToFind: "dashboard.stripe.com → Developers → API keys → Publishable key (starts pk_live_…)" },
  { key: "STRIPE_WEBHOOK_SECRET", scope: "per_app", usedFor: "Confirming Stripe events securely — this ONE is per-app (each app's own webhook endpoint has its own signing secret)", whereToFind: "dashboard.stripe.com → Developers → Webhooks → your app's endpoint → Signing secret" }
];

export type VaultEntry = { key: string; appScope: string; updatedAt: string | null };

// True for keys the engine's own runtime reads from process.env — the owner's
// vault save mirrors these into We Succeed's hosting env (see the env API route).
export function isEngineRuntimeKey(key: string): boolean {
  const clean = key.trim().toUpperCase();
  return KNOWN_KEYS.some((entry) => entry.key === clean && entry.engineRuntime === true);
}

function vaultKey(): Buffer {
  const secret = process.env.APP_ENGINE_VAULT_KEY || process.env.AUTH_SECRET || "app-engine-local-dev-vault";
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", vaultKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

function decrypt(stored: string): string | null {
  try {
    const [iv, tag, data] = stored.split(".");
    const decipher = crypto.createDecipheriv("aes-256-gcm", vaultKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function vaultAvailable(): boolean {
  return hasDatabase();
}

export function isValidVaultKey(key: string): { ok: boolean; message?: string } {
  const clean = key.trim().toUpperCase();
  if (!KEY_PATTERN.test(clean)) {
    return { ok: false, message: "Key names use CAPITALS_AND_UNDERSCORES, like MY_API_KEY." };
  }
  if (RESERVED_KEYS.has(clean)) {
    return { ok: false, message: `${clean} is set up automatically for each app — no need to add it.` };
  }
  return { ok: true };
}

// Format hints for known keys whose real values have a recognizable shape. A
// mismatch WARNS but never blocks the save — the goal is catching obvious
// placeholders (docs dummies like a truncated sk_test_… or "whsec_test_secret")
// at entry time instead of letting them silently break a payments or deploy
// step later. Custom keys are never checked, and the warning text describes the
// expected shape only — it must never include any part of the value.
const KEY_FORMAT_HINTS: Record<string, { pattern: RegExp; minLength?: number; expected: string }> = {
  STRIPE_SECRET_KEY: { pattern: /^(sk|rk)_(live|test)_[A-Za-z0-9]{24,}$/, minLength: 32, expected: "sk_live_… or rk_live_… (restricted keys are real keys too) followed by a long random string" },
  STRIPE_PUBLISHABLE_KEY: { pattern: /^pk_(live|test)_[A-Za-z0-9]{24,}$/, minLength: 32, expected: "pk_live_… or pk_test_… followed by a long random string" },
  STRIPE_WEBHOOK_SECRET: { pattern: /^whsec_[A-Za-z0-9]{24,}$/, expected: "whsec_ followed by a long random string" },
  RENDER_API_KEY: { pattern: /^rnd_/, expected: "a key starting with rnd_" },
  ANTHROPIC_API_KEY: { pattern: /^sk-ant-/, expected: "a key starting with sk-ant-" }
};

// SHA-256 digests of exact values that are famous documentation dummies — they
// PASS the shape checks above (Stripe's docs example is a perfectly-shaped
// sk_test_…) but are never real, so matching one always warns. Stored hashed so
// the literal dummies never appear in source (they trip secret scanners).
const KNOWN_PLACEHOLDER_SHA256 = new Set([
  "2cafc0970149a84f3b9e62eaf169f36f59907a3b3e31f7b82e68c69cd27f7326", // Stripe's canonical docs example secret key
  "7a200eb89adb0904fd5bc5ac4cac4f9528b0ac7bf03cbc2aa1508c26b055776f" // the literal whsec_test_secret
]);

export function checkValueFormat(key: string, value: string): string | null {
  const cleanKey = key.trim().toUpperCase();
  const hint = KEY_FORMAT_HINTS[cleanKey];
  if (!hint) return null;
  const clean = value.trim();
  if (KNOWN_PLACEHOLDER_SHA256.has(crypto.createHash("sha256").update(clean).digest("hex"))) {
    return `The value saved for ${cleanKey} is a well-known documentation example, not a real key. It was saved anyway, but anything that needs this key will fail — copy the real one from your own dashboard.`;
  }
  if (hint.pattern.test(clean) && clean.length >= (hint.minLength ?? 0)) return null;
  return `The value saved for ${cleanKey} doesn't look like a real one — expected ${hint.expected}. It was saved anyway, but if it's a placeholder, anything that needs this key will fail. Double-check where you copied it from.`;
}

let ensured = false;
async function ensureTable() {
  if (ensured || !hasDatabase()) return;
  const sql = getDatabase();
  await sql`
    create table if not exists app_user_env_vars (
      id uuid primary key default gen_random_uuid(),
      user_email text not null,
      key text not null,
      app_scope text not null default '',
      value_encrypted text not null,
      updated_at timestamptz not null default now(),
      unique (user_email, key, app_scope)
    )
  `;
  ensured = true;
}

// Key/scope pairs whose STORED value fails its format hint (see checkValueFormat)
// — powers the "provided, but looks like a placeholder" badge on the key
// checklist, so a docs-dummy Stripe key reads as needing attention instead of
// silently counting as provided. Decrypts server-side; returns names only.
export async function listVaultFormatWarnings(userEmail: string): Promise<Array<{ key: string; appScope: string }>> {
  if (!hasDatabase()) return [];
  await ensureTable();
  const sql = getDatabase();
  const rows = await sql`
    select key, app_scope, value_encrypted from app_user_env_vars
    where user_email = ${userEmail}
  `;
  const flagged: Array<{ key: string; appScope: string }> = [];
  for (const row of rows) {
    const value = decrypt(String(row.value_encrypted));
    if (value !== null && checkValueFormat(String(row.key), value)) {
      flagged.push({ key: String(row.key), appScope: String(row.app_scope || "") });
    }
  }
  return flagged;
}

// List a user's stored keys — names and scopes only, never values.
export async function listVaultEntries(userEmail: string): Promise<VaultEntry[]> {
  if (!hasDatabase()) return [];
  await ensureTable();
  const sql = getDatabase();
  const rows = await sql`
    select key, app_scope, updated_at from app_user_env_vars
    where user_email = ${userEmail}
    order by app_scope asc, key asc
  `;
  return rows.map((row) => ({
    key: String(row.key),
    appScope: String(row.app_scope || ""),
    updatedAt: row.updated_at ? String(row.updated_at) : null
  }));
}

export async function setVaultVar(userEmail: string, key: string, value: string, appScope = ""): Promise<{ ok: boolean; message?: string; warning?: string }> {
  if (!hasDatabase()) return { ok: false, message: "Key storage isn't available yet." };
  const check = isValidVaultKey(key);
  if (!check.ok) return check;
  if (!value.trim()) return { ok: false, message: "Paste the key's value." };
  await ensureTable();
  const sql = getDatabase();
  const cleanKey = key.trim().toUpperCase();
  const scope = appScope.trim().toLowerCase();
  await sql`
    insert into app_user_env_vars (user_email, key, app_scope, value_encrypted, updated_at)
    values (${userEmail}, ${cleanKey}, ${scope}, ${encrypt(value.trim())}, now())
    on conflict (user_email, key, app_scope)
    do update set value_encrypted = excluded.value_encrypted, updated_at = now()
  `;
  const warning = checkValueFormat(cleanKey, value);
  return warning ? { ok: true, warning } : { ok: true };
}

export async function deleteVaultVar(userEmail: string, key: string, appScope = ""): Promise<void> {
  if (!hasDatabase()) return;
  await ensureTable();
  const sql = getDatabase();
  await sql`
    delete from app_user_env_vars
    where user_email = ${userEmail} and key = ${key.trim().toUpperCase()} and app_scope = ${appScope.trim().toLowerCase()}
  `;
}

// Bulk import: parses pasted or uploaded key lists so nobody has to add keys one
// at a time. Accepts .env-style lines (KEY=VALUE, `export` prefix ok) and CSV rows
// (KEY,VALUE[,app-scope]) — which is what Excel and Numbers produce via File →
// Export → CSV. Comments (#) and blank lines are skipped; a `key,value` header row
// is skipped; quoted values are unwrapped; later duplicates win.
export type BulkParseResult = {
  entries: Array<{ key: string; value: string; appScope: string }>;
  skipped: Array<{ line: number; reason: string }>;
};

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

// Splits one CSV line respecting double-quoted fields (enough for exported sheets).
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

export function parseBulkEnvContent(content: string): BulkParseResult {
  const entries = new Map<string, { key: string; value: string; appScope: string }>();
  const skipped: Array<{ line: number; reason: string }> = [];
  const lines = content.replace(/^﻿/, "").split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;

    let key = "";
    let value = "";
    let appScope = "";

    const equalsIndex = line.indexOf("=");
    const commaFirst = line.includes(",") && (equalsIndex === -1 || line.indexOf(",") < equalsIndex);

    if (commaFirst) {
      // CSV row: KEY,VALUE[,scope]
      const fields = splitCsvLine(line);
      key = unquote(fields[0] || "").replace(/^export\s+/i, "");
      value = unquote(fields[1] || "");
      appScope = unquote(fields[2] || "");
      // Skip a header row like "key,value" / "Name,Value".
      if (/^(key|name|variable)$/i.test(key) && /^value$/i.test(value)) return;
    } else if (equalsIndex > 0) {
      // .env line: KEY=VALUE (split on the FIRST = so values may contain =).
      key = line.slice(0, equalsIndex).trim().replace(/^export\s+/i, "");
      value = unquote(line.slice(equalsIndex + 1));
    } else {
      skipped.push({ line: lineNumber, reason: "Not a KEY=VALUE or KEY,VALUE line." });
      return;
    }

    key = key.trim().toUpperCase();
    const check = isValidVaultKey(key);
    if (!check.ok) {
      skipped.push({ line: lineNumber, reason: `${key || "empty key"}: ${check.message}` });
      return;
    }
    if (!value.trim()) {
      skipped.push({ line: lineNumber, reason: `${key}: empty value.` });
      return;
    }
    entries.set(`${key}::${appScope.toLowerCase()}`, { key, value: value.trim(), appScope: appScope.toLowerCase() });
  });

  return { entries: [...entries.values()], skipped };
}

// Stores every parsed entry; returns per-import counts for the UI. Warnings are
// format-hint mismatches (see checkValueFormat) — key names + expected shapes
// only, never values.
export async function importVaultEntries(
  userEmail: string,
  content: string
): Promise<{ ok: boolean; saved: number; skipped: Array<{ line: number; reason: string }>; warnings: string[]; message?: string }> {
  if (!hasDatabase()) return { ok: false, saved: 0, skipped: [], warnings: [], message: "Key storage isn't available yet." };
  const { entries, skipped } = parseBulkEnvContent(content);
  if (!entries.length) {
    return { ok: false, saved: 0, skipped, warnings: [], message: "No usable keys found — expected KEY=VALUE lines or KEY,VALUE rows." };
  }
  let saved = 0;
  const warnings: string[] = [];
  for (const entry of entries) {
    const result = await setVaultVar(userEmail, entry.key, entry.value, entry.appScope);
    if (result.ok) saved += 1;
    if (result.ok && result.warning) warnings.push(result.warning);
  }
  return { ok: true, saved, skipped, warnings };
}

// The deploy-time merge: shared values first, then this app's overrides on top.
// Reserved keys are filtered even if they somehow got stored. Callers spread the
// engine-provisioned env AFTER this, so engine keys always win.
export async function resolveEnvForApp(userEmail: string, appScope: string): Promise<Record<string, string>> {
  if (!hasDatabase()) return {};
  await ensureTable();
  const sql = getDatabase();
  const scope = (appScope || "").trim().toLowerCase();
  const rows = await sql`
    select key, app_scope, value_encrypted from app_user_env_vars
    where user_email = ${userEmail} and (app_scope = '' or app_scope = ${scope})
    order by app_scope asc
  `;
  const env: Record<string, string> = {};
  for (const row of rows) {
    const key = String(row.key);
    if (RESERVED_KEYS.has(key)) continue;
    const value = decrypt(String(row.value_encrypted));
    // Later rows (app scope sorts after '') override shared values.
    if (value !== null) env[key] = value;
  }
  return env;
}
