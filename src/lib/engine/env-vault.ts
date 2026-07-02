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

// The catalog shown to users: what each standard key does and WHERE to find it.
// Custom keys are allowed too — this list is guidance, not a restriction.
export const KNOWN_KEYS = [
  { key: "RESEND_API_KEY", usedFor: "Sending email from your app", whereToFind: "resend.com → API Keys → Create API Key" },
  { key: "SENDER_EMAIL", usedFor: "The address your app's email comes from", whereToFind: "A sender you verified in Resend (Domains)" },
  { key: "STRIPE_SECRET_KEY", usedFor: "Taking payments in your app (money goes to YOUR Stripe)", whereToFind: "dashboard.stripe.com → Developers → API keys → Secret key" },
  { key: "STRIPE_WEBHOOK_SECRET", usedFor: "Confirming Stripe payments securely", whereToFind: "dashboard.stripe.com → Developers → Webhooks → Signing secret" },
  { key: "OPENAI_API_KEY", usedFor: "AI features inside your app", whereToFind: "platform.openai.com → API keys" },
  { key: "ANTHROPIC_API_KEY", usedFor: "AI features inside your app (Claude)", whereToFind: "console.anthropic.com → API Keys" }
] as const;

export type VaultEntry = { key: string; appScope: string; updatedAt: string | null };

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

export async function setVaultVar(userEmail: string, key: string, value: string, appScope = ""): Promise<{ ok: boolean; message?: string }> {
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
  return { ok: true };
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
