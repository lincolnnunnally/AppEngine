// Prepaid-credit billing for app builds. Model (matches the OpenAI mental model):
// the user loads credits (a $ amount) via Stripe; each build charges a flat price
// from their balance; builds are blocked when the balance runs out. A flat price
// works because the per-run spend guard bounds a build's cost, so we can price it
// predictably above (measured cost + margin).
//
// SERVER ONLY. Money lives in the real Postgres DB (balance in integer cents to
// avoid float drift); the ledger's UNIQUE reference makes credits/charges
// idempotent (a Stripe webhook or a retried build can't double-apply).
//
// Everything here is DORMANT until APP_ENGINE_BILLING_ENABLED=true AND Stripe +
// a database are configured. With billing off, builds are never charged or blocked.
import { getDatabase } from "@/lib/db/client";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";

function dollarsEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export type BillingConfig = {
  enabled: boolean;
  pricePerBuildCents: number;
  freeStarterCents: number;
  currency: "usd";
  packsCents: number[];
};

export function getBillingConfig(): BillingConfig {
  return {
    enabled: process.env.APP_ENGINE_BILLING_ENABLED === "true",
    pricePerBuildCents: Math.max(0, Math.round(dollarsEnv("APP_ENGINE_BILLING_PRICE_PER_BUILD_USD", 1) * 100)),
    freeStarterCents: Math.max(0, Math.round(dollarsEnv("APP_ENGINE_BILLING_FREE_STARTER_USD", 1) * 100)),
    currency: "usd",
    packsCents: [500, 2000, 5000]
  };
}

export function hasStripe() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// Billing is only enforced when explicitly enabled AND fully configured.
export function isBillingEnabled() {
  return getBillingConfig().enabled && Boolean(getConfiguredDatabaseUrl()) && hasStripe();
}

export function normalizeUserKey(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

type Sql = ReturnType<typeof getDatabase>;

let schemaReady: Promise<void> | null = null;

async function ensureSchema(sql: Sql): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS app_credit_accounts (
          user_key text PRIMARY KEY,
          balance_cents bigint NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS app_credit_ledger (
          id bigserial PRIMARY KEY,
          user_key text NOT NULL,
          delta_cents bigint NOT NULL,
          kind text NOT NULL,
          reference text UNIQUE,
          note text,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function getBalanceCents(userKey: string): Promise<number> {
  const sql = getDatabase();
  await ensureSchema(sql);
  const rows = (await sql`SELECT balance_cents FROM app_credit_accounts WHERE user_key = ${userKey} LIMIT 1`) as Array<{
    balance_cents: number | string;
  }>;
  return rows.length ? Number(rows[0].balance_cents) : 0;
}

// Adds (or removes, with a negative delta) credits idempotently. The ledger's
// UNIQUE reference means the same Stripe event / build id is only ever applied
// once. Returns the resulting balance. A single statement => atomic in Postgres.
async function applyLedger(
  userKey: string,
  deltaCents: number,
  kind: string,
  reference: string,
  note: string
): Promise<number> {
  const sql = getDatabase();
  await ensureSchema(sql);
  const rows = (await sql`
    WITH inserted AS (
      INSERT INTO app_credit_ledger (user_key, delta_cents, kind, reference, note)
      VALUES (${userKey}, ${deltaCents}, ${kind}, ${reference}, ${note})
      ON CONFLICT (reference) DO NOTHING
      RETURNING delta_cents
    )
    INSERT INTO app_credit_accounts (user_key, balance_cents)
    VALUES (${userKey}, COALESCE((SELECT delta_cents FROM inserted), 0))
    ON CONFLICT (user_key) DO UPDATE
      SET balance_cents = app_credit_accounts.balance_cents + COALESCE((SELECT delta_cents FROM inserted), 0),
          updated_at = now()
    RETURNING balance_cents
  `) as Array<{ balance_cents: number | string }>;
  return rows.length ? Number(rows[0].balance_cents) : 0;
}

export async function creditAccount(userKey: string, amountCents: number, reference: string, note = ""): Promise<number> {
  return applyLedger(userKey, Math.abs(Math.round(amountCents)), "credit", reference, note);
}

export type AffordResult = { ok: boolean; balanceCents: number; priceCents: number; reason?: string };

export async function canAffordBuild(userKey: string): Promise<AffordResult> {
  const { pricePerBuildCents } = getBillingConfig();
  const balanceCents = await getBalanceCents(userKey);
  if (balanceCents >= pricePerBuildCents) {
    return { ok: true, balanceCents, priceCents: pricePerBuildCents };
  }
  return { ok: false, balanceCents, priceCents: pricePerBuildCents, reason: "Not enough credits for a build." };
}

// Charges the flat per-build price. Idempotent per build reference. Returns the
// new balance, or null if the build had already been charged.
export async function chargeForBuild(userKey: string, buildReference: string): Promise<number> {
  const { pricePerBuildCents } = getBillingConfig();
  return applyLedger(userKey, -Math.abs(pricePerBuildCents), "build", `build:${buildReference}`, "App build");
}

// One-time free starter credit per user (the freemium hook). Idempotent.
export async function grantFreeStarterIfNew(userKey: string): Promise<void> {
  const { freeStarterCents } = getBillingConfig();
  if (freeStarterCents <= 0) return;
  await applyLedger(userKey, freeStarterCents, "free_starter", `free_starter:${userKey}`, "Welcome credit");
}
