// Shared Stripe money read for the owner business desk and /reports.
// Real charges only. Streams are labeled only when the charge names an app.
import { stripeGet } from "@/lib/engine/stripe";
import { resolveEnvForApp } from "@/lib/engine/env-vault";
import { groupRevenueStreams, type RevenueStream } from "@/lib/engine/revenue-streams";

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

export async function loadStripeSummary(ownerEmail: string | null): Promise<StripeSummary> {
  let key = process.env.STRIPE_SECRET_KEY?.trim() || "";
  if (!key && ownerEmail) {
    const vaultEnv = await resolveEnvForApp(ownerEmail, "").catch(() => ({} as Record<string, string>));
    key = vaultEnv.STRIPE_SECRET_KEY || "";
  }
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

export function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
