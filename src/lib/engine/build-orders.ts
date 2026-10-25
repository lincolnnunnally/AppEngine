// Flat-rate build orders (C3): the customer pays the quoted pack price once, and
// that payment builds exactly that pack. The order is the contract between the
// two — priced HERE from the feature checklist (never from a price or module list
// the browser sends), paid through Stripe Checkout, marked paid only by the
// signed webhook when Stripe's amount matches, and claimed by exactly one build.
//
//   pending  → order created, Checkout session open
//   paid     → webhook confirmed the money (amount = price)
//   building → a build job was started for it (job_id); the job tracks the rest
//   build_failed → every automatic attempt failed; the owner is alerted and can
//                  rebuild. Owner policy (2026-10-25): a failed paid build is
//                  redone and the customer is never charged again for it.
//
// Off unless APP_ENGINE_FLAT_CHECKOUT_ENABLED=true AND Stripe AND the engine
// database are configured. Separate from the prepaid-credits model (billing.ts):
// a paid order's build is never metered again.
import crypto from "node:crypto";
import { getDatabase } from "@/lib/db/client";
import { generatedAppDatabaseConfigured } from "@/lib/engine/database-setup";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";
import { estimateBuild } from "@/lib/engine/pricing/estimate";
import { stripeConfigured } from "@/lib/engine/stripe";

export type BuildOrderStatus = "pending" | "paid" | "building" | "build_failed";

// Builds a paid order gets without the owner stepping in (first try + one redo).
export const MAX_AUTOMATIC_BUILD_ATTEMPTS = 2;

export type BuildOrder = {
  id: string;
  userEmail: string;
  idea: string;
  name: string | null;
  featureIds: string[];
  moduleSlugs: string[];
  lineLabels: string[];
  themeId: string | null;
  brand: { accentColor?: string; logoUrl?: string };
  priceCents: number;
  currency: "usd";
  status: BuildOrderStatus;
  stripeSessionId: string | null;
  jobId: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string | null;
  paidAt: string | null;
};

export function flatCheckoutEnabled() {
  return process.env.APP_ENGINE_FLAT_CHECKOUT_ENABLED === "true" && stripeConfigured() && Boolean(getConfiguredDatabaseUrl());
}

// Money gate: never take a payment we can't fulfil. A built app with no database
// can't be signed in to (C5), so checkout refuses until one can be provisioned.
export function flatCheckoutReadiness(): { ok: boolean; message?: string } {
  if (!flatCheckoutEnabled()) return { ok: false, message: "Checkout isn't on yet." };
  if (!generatedAppDatabaseConfigured()) {
    return { ok: false, message: "We can't take payments for new apps right now — please check back soon." };
  }
  return { ok: true };
}

export type PricedPack = { priceCents: number; moduleSlugs: string[]; featureIds: string[]; lineLabels: string[] };

// The ONLY place an order's price and modules come from: the same estimator the
// customer saw, fed the feature ids they ticked and the need they described.
export function priceBuildPack(idea: string, featureIds: string[]): PricedPack | { error: string } {
  const estimate = estimateBuild({ needText: idea, featureIds: featureIds.length ? featureIds : undefined });
  if (!estimate.ok) return { error: estimate.message };
  if (estimate.missingModules.length) return { error: "Part of this pack isn't available to build yet." };
  return {
    priceCents: estimate.priceCents,
    moduleSlugs: estimate.moduleSlugs,
    featureIds: estimate.features.filter((feature) => feature.selected).map((feature) => feature.id),
    lineLabels: estimate.lines.map((line) => line.label)
  };
}

const memory = new Map<string, BuildOrder>();

function useDb() {
  return Boolean(getConfiguredDatabaseUrl());
}

let tableReady: Promise<void> | null = null;
async function ensureTable(sql: ReturnType<typeof getDatabase>): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS app_build_orders (
          id text PRIMARY KEY,
          user_email text NOT NULL,
          idea text NOT NULL,
          name text,
          feature_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
          module_slugs jsonb NOT NULL DEFAULT '[]'::jsonb,
          line_labels jsonb NOT NULL DEFAULT '[]'::jsonb,
          theme_id text,
          brand jsonb NOT NULL DEFAULT '{}'::jsonb,
          price_cents integer NOT NULL CHECK (price_cents > 0),
          currency text NOT NULL DEFAULT 'usd',
          status text NOT NULL DEFAULT 'pending',
          stripe_session_id text UNIQUE,
          stripe_payment_intent text,
          job_id text,
          created_at timestamptz NOT NULL DEFAULT now(),
          paid_at timestamptz,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS app_build_orders_user_idx ON app_build_orders (user_email, created_at DESC)`;
      await sql`ALTER TABLE app_build_orders ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE app_build_orders ADD COLUMN IF NOT EXISTS last_error text`;
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function rowToOrder(row: Record<string, unknown>): BuildOrder {
  const brand = row.brand && typeof row.brand === "object" ? (row.brand as BuildOrder["brand"]) : {};
  return {
    id: String(row.id),
    userEmail: String(row.user_email),
    idea: String(row.idea ?? ""),
    name: (row.name as string) ?? null,
    featureIds: list(row.feature_ids),
    moduleSlugs: list(row.module_slugs),
    lineLabels: list(row.line_labels),
    themeId: (row.theme_id as string) ?? null,
    brand,
    priceCents: Number(row.price_cents),
    currency: "usd",
    status: (row.status as BuildOrderStatus) ?? "pending",
    stripeSessionId: (row.stripe_session_id as string) ?? null,
    jobId: (row.job_id as string) ?? null,
    attempts: Number(row.attempts ?? 0),
    lastError: (row.last_error as string) ?? null,
    createdAt: toIso(row.created_at),
    paidAt: toIso(row.paid_at)
  };
}

export async function createBuildOrder(
  userEmail: string,
  input: { idea: string; name?: string; themeId?: string; brand?: BuildOrder["brand"] },
  pack: PricedPack
): Promise<BuildOrder> {
  const order: BuildOrder = {
    id: `ord_${crypto.randomBytes(10).toString("hex")}`,
    userEmail,
    idea: input.idea,
    name: input.name || null,
    featureIds: pack.featureIds,
    moduleSlugs: pack.moduleSlugs,
    lineLabels: pack.lineLabels,
    themeId: input.themeId || null,
    brand: input.brand || {},
    priceCents: pack.priceCents,
    currency: "usd",
    status: "pending",
    stripeSessionId: null,
    jobId: null,
    attempts: 0,
    lastError: null,
    createdAt: new Date().toISOString(),
    paidAt: null
  };

  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    await sql`
      insert into app_build_orders (id, user_email, idea, name, feature_ids, module_slugs, line_labels, theme_id, brand, price_cents)
      values (${order.id}, ${userEmail}, ${order.idea}, ${order.name}, ${JSON.stringify(order.featureIds)}::jsonb,
        ${JSON.stringify(order.moduleSlugs)}::jsonb, ${JSON.stringify(order.lineLabels)}::jsonb, ${order.themeId},
        ${JSON.stringify(order.brand)}::jsonb, ${order.priceCents})
    `;
  } else {
    memory.set(order.id, order);
  }
  return order;
}

export async function getBuildOrder(id: string): Promise<BuildOrder | null> {
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    const rows = (await sql`select * from app_build_orders where id = ${id} limit 1`) as Array<Record<string, unknown>>;
    return rows.length ? rowToOrder(rows[0]) : null;
  }
  return memory.get(id) ?? null;
}

export async function setBuildOrderSession(id: string, sessionId: string): Promise<void> {
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    await sql`update app_build_orders set stripe_session_id = ${sessionId}, updated_at = now() where id = ${id} and status = 'pending'`;
    return;
  }
  const order = memory.get(id);
  if (order && order.status === "pending") memory.set(id, { ...order, stripeSessionId: sessionId });
}

export type MarkPaidResult =
  | { ok: true; order: BuildOrder; firstTime: boolean }
  | { ok: false; reason: "not_found" | "amount_mismatch" | "session_mismatch" };

// Called only from the signed Stripe webhook. Paid exactly once: a retried event
// finds the order already paid and reports firstTime=false. The amount Stripe
// charged must equal the order's price — anything else is refused, not built.
export async function markBuildOrderPaid(input: {
  orderId: string;
  sessionId: string;
  amountCents: number;
  paymentIntent?: string | null;
}): Promise<MarkPaidResult> {
  const order = await getBuildOrder(input.orderId);
  if (!order) return { ok: false, reason: "not_found" };
  if (order.stripeSessionId && order.stripeSessionId !== input.sessionId) return { ok: false, reason: "session_mismatch" };
  if (order.priceCents !== input.amountCents) return { ok: false, reason: "amount_mismatch" };
  if (order.status !== "pending") return { ok: true, order, firstTime: false };

  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    const rows = (await sql`
      update app_build_orders
      set status = 'paid', paid_at = now(), stripe_session_id = ${input.sessionId},
          stripe_payment_intent = ${input.paymentIntent ?? null}, updated_at = now()
      where id = ${input.orderId} and status = 'pending' and price_cents = ${input.amountCents}
      returning *
    `) as Array<Record<string, unknown>>;
    if (rows.length) return { ok: true, order: rowToOrder(rows[0]), firstTime: true };
    const current = await getBuildOrder(input.orderId);
    return current ? { ok: true, order: current, firstTime: false } : { ok: false, reason: "not_found" };
  }
  const paid: BuildOrder = { ...order, status: "paid", paidAt: new Date().toISOString(), stripeSessionId: input.sessionId };
  memory.set(order.id, paid);
  return { ok: true, order: paid, firstTime: true };
}

// One paid order, one build: only the caller that moves it paid → building gets
// the order back; a duplicate (webhook retry, double click) gets null.
export async function claimPaidOrderForBuild(orderId: string, jobId: string): Promise<BuildOrder | null> {
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    const rows = (await sql`
      update app_build_orders set status = 'building', job_id = ${jobId}, attempts = 1, updated_at = now()
      where id = ${orderId} and status = 'paid'
      returning *
    `) as Array<Record<string, unknown>>;
    return rows.length ? rowToOrder(rows[0]) : null;
  }
  const order = memory.get(orderId);
  if (!order || order.status !== "paid") return null;
  const claimed: BuildOrder = { ...order, status: "building", jobId, attempts: 1 };
  memory.set(orderId, claimed);
  return claimed;
}

// Swap a failed build for a fresh one — only if the order still points at that
// failed job (two pollers can't both start a redo) and it has attempts left.
export async function claimOrderRebuild(
  orderId: string,
  failedJobId: string,
  newJobId: string,
  maxAttempts: number
): Promise<BuildOrder | null> {
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    const rows = (await sql`
      update app_build_orders
      set status = 'building', job_id = ${newJobId}, attempts = attempts + 1, last_error = null, updated_at = now()
      where id = ${orderId} and job_id = ${failedJobId} and status in ('building', 'build_failed') and attempts < ${maxAttempts}
      returning *
    `) as Array<Record<string, unknown>>;
    return rows.length ? rowToOrder(rows[0]) : null;
  }
  const order = memory.get(orderId);
  if (!order || order.jobId !== failedJobId || !["building", "build_failed"].includes(order.status) || order.attempts >= maxAttempts) return null;
  const claimed: BuildOrder = { ...order, status: "building", jobId: newJobId, attempts: order.attempts + 1, lastError: null };
  memory.set(orderId, claimed);
  return claimed;
}

export async function markOrderBuildFailed(orderId: string, failedJobId: string, error: string | null): Promise<void> {
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    await sql`
      update app_build_orders set status = 'build_failed', last_error = ${error}, updated_at = now()
      where id = ${orderId} and job_id = ${failedJobId} and status = 'building'
    `;
    return;
  }
  const order = memory.get(orderId);
  if (order && order.jobId === failedJobId && order.status === "building") memory.set(orderId, { ...order, status: "build_failed", lastError: error });
}

// Paid orders whose builds all failed — the owner's attention queue.
export async function listOrdersNeedingRebuild(limit = 50): Promise<BuildOrder[]> {
  if (useDb()) {
    const sql = getDatabase();
    await ensureTable(sql);
    const rows = (await sql`
      select * from app_build_orders where status = 'build_failed' order by updated_at desc limit ${limit}
    `) as Array<Record<string, unknown>>;
    return rows.map(rowToOrder);
  }
  return [...memory.values()].filter((order) => order.status === "build_failed").slice(0, limit);
}
