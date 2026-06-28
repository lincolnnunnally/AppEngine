// Prepaid-credit billing for app builds. Model (exactly the OpenAI model): the
// user loads credits (a $ amount) via Stripe; each build runs to completion, then
// deducts its REAL measured cost + a margin (default 30%) from their balance; a
// build is only blocked from STARTING if the balance is below a small floor — it
// never stops a build mid-way. Token cost comes from the metering (llm-usage).
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
  marginMultiplier: number;
  minBuildStartCents: number;
  freeStarterCents: number;
  currency: "usd";
  packsCents: number[];
};

export function getBillingConfig(): BillingConfig {
  // Margin is a multiplier on our actual cost: 1.30 = cost + 30% profit.
  const margin = Number(process.env.APP_ENGINE_BILLING_MARGIN);
  return {
    enabled: process.env.APP_ENGINE_BILLING_ENABLED === "true",
    marginMultiplier: Number.isFinite(margin) && margin >= 1 ? margin : 1.3,
    // A build can't be priced until it finishes, so we require this small floor
    // balance to START one (covers a typical build); the real cost is deducted after.
    minBuildStartCents: Math.max(1, Math.round(dollarsEnv("APP_ENGINE_BILLING_MIN_BUILD_START_USD", 0.5) * 100)),
    freeStarterCents: Math.max(0, Math.round(dollarsEnv("APP_ENGINE_BILLING_FREE_STARTER_USD", 1) * 100)),
    currency: "usd",
    packsCents: [500, 2000, 5000]
  };
}

// Price a build = our actual measured cost (cents) + margin. Rounded up, min 1c.
export function priceForBuildCents(actualCostCents: number): number {
  const { marginMultiplier } = getBillingConfig();
  return Math.max(1, Math.ceil(Math.max(0, actualCostCents) * marginMultiplier));
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

export type AffordResult = { ok: boolean; balanceCents: number; minBuildStartCents: number; reason?: string };

export async function canAffordBuild(userKey: string): Promise<AffordResult> {
  const { minBuildStartCents } = getBillingConfig();
  const balanceCents = await getBalanceCents(userKey);
  if (balanceCents >= minBuildStartCents) {
    return { ok: true, balanceCents, minBuildStartCents };
  }
  return { ok: false, balanceCents, minBuildStartCents, reason: "Add credits to start a build." };
}

// Charges a build's REAL cost + margin after it completes (never mid-build).
// actualCostCents comes from the metering. Idempotent per build reference, so a
// retry never double-charges.
export async function chargeForBuild(userKey: string, buildReference: string, actualCostCents: number): Promise<number> {
  const price = priceForBuildCents(actualCostCents);
  return applyLedger(userKey, -Math.abs(price), "build", `build:${buildReference}`, `App build (cost ${Math.round(actualCostCents)}c + margin)`);
}

// One-time free starter credit per user (the freemium hook). Idempotent.
export async function grantFreeStarterIfNew(userKey: string): Promise<void> {
  const { freeStarterCents } = getBillingConfig();
  if (freeStarterCents <= 0) return;
  await applyLedger(userKey, freeStarterCents, "free_starter", `free_starter:${userKey}`, "Welcome credit");
}
