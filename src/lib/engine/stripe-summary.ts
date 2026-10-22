// Shared Stripe money read for the owner business desk and /reports.
// Real charges only. Streams are labeled only when the charge names an app.
import { stripeGet } from "@/lib/engine/stripe";
import { resolveEnvForApp } from "@/lib/engine/env-vault";
import { groupRevenueStreams, type RevenueStream } from "@/lib/engine/revenue-streams";
import {
  summarizeSubscriptions,
  type RecurringFold,
  type StripeSubscription
} from "@/lib/engine/recurring-revenue-core";

export type { RevenueStream };

export type StripeSummary =
  | {
      state: "ok";
      available: number;
      pending: number;
      currency: string;
      charges30d: number;
      revenue30d: number;
      truncated: boolean;
      otherCurrencies: string[];
      streams: RevenueStream[];
    }
  | { state: "no_key" }
  | { state: "denied"; message: string }
  | { state: "error"; message: string };

// One key path for every Stripe read on the owner desk: the env key, else the
// owner's vault. "" means no key is reachable.
async function resolveStripeKey(ownerEmail: string | null): Promise<string> {
  const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
  if (key || !ownerEmail) return key;
  const vaultEnv = await resolveEnvForApp(ownerEmail, "").catch(() => ({} as Record<string, string>));
  return vaultEnv.STRIPE_SECRET_KEY || "";
}

export async function loadStripeSummary(ownerEmail: string | null): Promise<StripeSummary> {
  const key = await resolveStripeKey(ownerEmail);
  if (!key) return { state: "no_key" };
  try {
    const balance = await stripeGet<{
      available?: Array<{ amount: number; currency: string }>;
      pending?: Array<{ amount: number; currency: string }>;
    }>("/v1/balance", key);
    const since = Math.floor(Date.now() / 1000) - 30 * 86_400;
    type Charge = {
      id?: string;
      amount: number;
      currency?: string;
      refunded?: boolean;
      paid?: boolean;
      description?: string | null;
      statement_descriptor?: string | null;
      statement_descriptor_suffix?: string | null;
      metadata?: Record<string, string> | null;
    };
    const all: Charge[] = [];
    let startingAfter = "";
    let truncated = false;
    for (let page = 0; page < 5; page += 1) {
      const charges = await stripeGet<{ data?: Charge[]; has_more?: boolean }>(
        `/v1/charges?limit=100&created[gte]=${since}${startingAfter ? `&starting_after=${startingAfter}` : ""}`,
        key
      );
      const batch = charges.data ?? [];
      all.push(...batch);
      truncated = Boolean(charges.has_more);
      startingAfter = batch.length ? batch[batch.length - 1].id || "" : "";
      if (!charges.has_more || !startingAfter) break;
    }
    const good = all.filter((charge) => charge.paid && !charge.refunded);
    const usd = good.filter((charge) => (charge.currency ?? "usd").toLowerCase() === "usd");
    const otherCurrencies = [
      ...new Set(good.map((charge) => (charge.currency ?? "usd").toUpperCase()).filter((cur) => cur !== "USD"))
    ];
    const usdOnly = (entries?: Array<{ amount: number; currency: string }>) =>
      (entries ?? []).filter((entry) => entry.currency?.toLowerCase() === "usd").reduce((sum, entry) => sum + entry.amount, 0);
    return {
      state: "ok",
      available: usdOnly(balance.available),
      pending: usdOnly(balance.pending),
      currency: "USD",
      charges30d: usd.length,
      revenue30d: usd.reduce((sum, charge) => sum + charge.amount, 0),
      truncated,
      otherCurrencies,
      streams: groupRevenueStreams(usd)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe didn't answer.";
    if (/permission|not.*allowed|restricted/i.test(message)) {
      return { state: "denied", message };
    }
    return { state: "error", message };
  }
}

export type RecurringSummary =
  | ({ state: "ok"; truncated: boolean } & RecurringFold)
  | { state: "no_key" }
  | { state: "denied"; message: string }
  | { state: "error"; message: string };

// Paying customers + monthly recurring revenue from ACTIVE subscriptions.
// Stripe here is LIVE: this is GET-only — it never creates or changes anything.
// Product names come from a second read because Stripe caps expansion depth
// (data.items.data.price.product is one level too deep for a list call).
export async function loadRecurringSummary(ownerEmail: string | null): Promise<RecurringSummary> {
  const key = await resolveStripeKey(ownerEmail);
  if (!key) return { state: "no_key" };
  try {
    const all: StripeSubscription[] = [];
    let startingAfter = "";
    let truncated = false;
    for (let page = 0; page < 10; page += 1) {
      const list = await stripeGet<{ data?: StripeSubscription[]; has_more?: boolean }>(
        `/v1/subscriptions?status=active&limit=100${startingAfter ? `&starting_after=${startingAfter}` : ""}`,
        key
      );
      const batch = list.data ?? [];
      all.push(...batch);
      truncated = Boolean(list.has_more);
      startingAfter = batch.length ? batch[batch.length - 1].id || "" : "";
      if (!list.has_more || !startingAfter) break;
    }

    const productIds = [
      ...new Set(
        all.flatMap((sub) =>
          (sub.items?.data ?? []).map((item) => {
            const product = item.price?.product;
            return typeof product === "string" ? product : product?.id || "";
          })
        )
      )
    ].filter(Boolean);
    const productNames: Record<string, string> = {};
    for (let i = 0; i < productIds.length; i += 100) {
      const chunk = productIds.slice(i, i + 100);
      const query = chunk.map((id) => `ids[]=${encodeURIComponent(id)}`).join("&");
      const products = await stripeGet<{ data?: Array<{ id: string; name?: string | null }> }>(
        `/v1/products?limit=100&${query}`,
        key
      ).catch(() => ({ data: [] as Array<{ id: string; name?: string | null }> }));
      for (const product of products.data ?? []) {
        if (product.name) productNames[product.id] = product.name;
      }
    }

    return { state: "ok", truncated, ...summarizeSubscriptions(all, productNames) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe didn't answer.";
    if (/permission|not.*allowed|restricted/i.test(message)) {
      return { state: "denied", message };
    }
    return { state: "error", message };
  }
}

export function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
