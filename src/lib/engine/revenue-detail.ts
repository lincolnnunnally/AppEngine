// Drill-down money: which Stripe account, which service, which charge.
// Reads every Stripe secret the desk can actually reach. Accounts we know
// exist but cannot read stay listed as unread — never $0.
import { stripeGet } from "@/lib/engine/stripe";
import { resolveEnvForApp } from "@/lib/engine/env-vault";
import {
  classifyCharge,
  groupRevenueStreams,
  serviceLabel,
  type RevenueStream,
  type RevenueStreamId,
  type StripeChargeHint
} from "@/lib/engine/revenue-streams";

export type StripeAccountRow = {
  sourceId: string;
  label: string;
  livesAt: string;
  state: "ok" | "denied" | "error" | "no_key";
  message?: string;
  accountId?: string;
  accountName?: string;
  livemode?: boolean;
  keyHint?: string;
  available?: number;
  pending?: number;
  revenue30d?: number;
  charges30d?: number;
};

export type RevenueChargeRow = {
  id: string;
  created: number;
  amount: number;
  currency: string;
  service: string;
  streamId: RevenueStreamId;
  streamLabel: string;
  streamSlug: string | null;
  accountSourceId: string;
  accountLabel: string;
  accountId?: string;
  email?: string;
  last4?: string;
  paymentIntent?: string;
};

export type ServiceRollup = {
  service: string;
  streamId: RevenueStreamId;
  streamLabel: string;
  streamSlug: string | null;
  accountSourceId: string;
  accountLabel: string;
  revenue30d: number;
  charges30d: number;
};

export type RevenueDetail = {
  accounts: StripeAccountRow[];
  services: ServiceRollup[];
  charges: RevenueChargeRow[];
  streams: RevenueStream[];
  revenue30d: number;
  charges30d: number;
  truncated: boolean;
  otherCurrencies: string[];
};

type RawCharge = StripeChargeHint & {
  id?: string;
  created?: number;
  receipt_email?: string | null;
  billing_details?: { email?: string | null } | null;
  payment_method_details?: { card?: { last4?: string | null } | null } | null;
  payment_intent?: string | { id?: string } | null;
};

const KNOWN_SLOTS: Array<{ sourceId: string; label: string; livesAt: string; slug: string; keys: string[] }> = [
  { sourceId: "desk-env", label: "Desk environment", livesAt: "Vercel app-engine · STRIPE_SECRET_KEY", slug: "", keys: ["STRIPE_SECRET_KEY"] },
  { sourceId: "vault-shared", label: "Vault — shared", livesAt: "Owner vault, every app", slug: "", keys: ["STRIPE_SECRET_KEY"] },
  { sourceId: "vault-toner", label: "Vault — Toner", livesAt: "Owner vault · toner-management", slug: "toner-management", keys: ["STRIPE_SECRET_KEY", "STRIPE_API_KEY"] },
  { sourceId: "vault-laser", label: "Vault — Laser", livesAt: "Owner vault · laser-engrave-market (live key is often on Render)", slug: "laser-engrave-market", keys: ["STRIPE_API_KEY", "STRIPE_SECRET_KEY"] },
  { sourceId: "vault-churchconnect", label: "Vault — ChurchConnect", livesAt: "Owner vault · churchconnect", slug: "churchconnect", keys: ["STRIPE_SECRET_KEY"] },
  { sourceId: "vault-easypeazy", label: "Vault — EasyPeazy", livesAt: "Owner vault · easy-peasy-website", slug: "easy-peasy-website", keys: ["STRIPE_SECRET_KEY", "STRIPE_API_KEY"] },
  { sourceId: "vault-knd", label: "Vault — Kids Need Dads", livesAt: "Owner vault (live key is often on Supabase)", slug: "kids-need-dads", keys: ["STRIPE_SECRET_KEY"] },
  { sourceId: "vault-uug", label: "Vault — United Under God", livesAt: "Owner vault · united-under-god", slug: "united-under-god", keys: ["STRIPE_SECRET_KEY"] },
  { sourceId: "vault-awd", label: "Vault — AI Website Design", livesAt: "Owner vault · ai-website-design", slug: "ai-website-design", keys: ["STRIPE_SECRET_KEY"] },
  { sourceId: "vault-furfriend", label: "Vault — FurFriend", livesAt: "Owner vault · furfriend", slug: "furfriend", keys: ["STRIPE_SECRET_KEY"] }
];

function keyHint(secret: string): string {
  const trimmed = secret.trim();
  const tail = trimmed.slice(-4);
  const mode = trimmed.includes("_test_") ? "test" : trimmed.includes("_live_") ? "live" : "key";
  return `${mode} …${tail}`;
}

function usableSecret(value?: string): string {
  const trimmed = (value || "").trim();
  return /^(sk|rk)_/.test(trimmed) ? trimmed : "";
}

async function collectSecrets(ownerEmail: string | null): Promise<Array<{ sourceId: string; label: string; livesAt: string; secret: string }>> {
  const found: Array<{ sourceId: string; label: string; livesAt: string; secret: string }> = [];
  const desk = usableSecret(process.env.STRIPE_SECRET_KEY);
  if (desk) {
    found.push({ sourceId: "desk-env", label: "Desk environment", livesAt: "Vercel app-engine · STRIPE_SECRET_KEY", secret: desk });
  }
  if (!ownerEmail) return found;

  const shared = await resolveEnvForApp(ownerEmail, "").catch(() => ({} as Record<string, string>));
  const sharedSecret = usableSecret(shared.STRIPE_SECRET_KEY || shared.STRIPE_API_KEY);
  if (sharedSecret) {
    found.push({
      sourceId: "vault-shared",
      label: "Vault — shared",
      livesAt: "Owner vault, every app",
      secret: sharedSecret
    });
  }

  for (const slot of KNOWN_SLOTS) {
    if (!slot.slug) continue;
    const env = await resolveEnvForApp(ownerEmail, slot.slug).catch(() => ({} as Record<string, string>));
    let secret = "";
    for (const name of slot.keys) {
      secret = usableSecret(env[name]);
      if (secret) break;
    }
    if (secret) found.push({ sourceId: slot.sourceId, label: slot.label, livesAt: slot.livesAt, secret });
  }
  return found;
}

async function readAccount(secret: string, sourceId: string, label: string, livesAt: string): Promise<{
  account: StripeAccountRow;
  charges: RawCharge[];
  truncated: boolean;
  otherCurrencies: string[];
}> {
  const hint = keyHint(secret);
  try {
    const identity = await stripeGet<{
      id?: string;
      email?: string;
      livemode?: boolean;
      business_profile?: { name?: string | null } | null;
      settings?: { dashboard?: { display_name?: string | null } | null } | null;
    }>("/v1/account", secret);
    const balance = await stripeGet<{
      available?: Array<{ amount: number; currency: string }>;
      pending?: Array<{ amount: number; currency: string }>;
    }>("/v1/balance", secret);
    const since = Math.floor(Date.now() / 1000) - 30 * 86_400;
    const all: RawCharge[] = [];
    let startingAfter = "";
    let truncated = false;
    for (let page = 0; page < 5; page += 1) {
      const pageData = await stripeGet<{ data?: RawCharge[]; has_more?: boolean }>(
        `/v1/charges?limit=100&created[gte]=${since}${startingAfter ? `&starting_after=${startingAfter}` : ""}`,
        secret
      );
      const batch = pageData.data ?? [];
      all.push(...batch);
      truncated = Boolean(pageData.has_more);
      startingAfter = batch.length ? batch[batch.length - 1].id || "" : "";
      if (!pageData.has_more || !startingAfter) break;
    }
    const good = all.filter((charge) => charge.paid && !charge.refunded);
    const usd = good.filter((charge) => (charge.currency ?? "usd").toLowerCase() === "usd");
    const usdOnly = (entries?: Array<{ amount: number; currency: string }>) =>
      (entries ?? []).filter((entry) => entry.currency?.toLowerCase() === "usd").reduce((sum, entry) => sum + entry.amount, 0);
    const accountName =
      identity.settings?.dashboard?.display_name ||
      identity.business_profile?.name ||
      identity.email ||
      identity.id ||
      label;
    return {
      account: {
        sourceId,
        label,
        livesAt,
        state: "ok",
        accountId: identity.id,
        accountName,
        livemode: identity.livemode,
        keyHint: hint,
        available: usdOnly(balance.available),
        pending: usdOnly(balance.pending),
        revenue30d: usd.reduce((sum, charge) => sum + charge.amount, 0),
        charges30d: usd.length
      },
      charges: usd,
      truncated,
      otherCurrencies: [
        ...new Set(good.map((charge) => (charge.currency ?? "usd").toUpperCase()).filter((cur) => cur !== "USD"))
      ]
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe didn't answer.";
    const denied = /permission|not.*allowed|restricted/i.test(message);
    return {
      account: {
        sourceId,
        label,
        livesAt,
        state: denied ? "denied" : "error",
        message,
        keyHint: hint
      },
      charges: [],
      truncated: false,
      otherCurrencies: []
    };
  }
}

export async function loadRevenueDetail(ownerEmail: string | null): Promise<RevenueDetail> {
  const secrets = await collectSecrets(ownerEmail);
  const accounts: StripeAccountRow[] = [];
  const charges: RevenueChargeRow[] = [];
  const serviceMap = new Map<string, ServiceRollup>();
  const allHints: StripeChargeHint[] = [];
  let truncated = false;
  const otherCurrencies = new Set<string>();
  const seenAccounts = new Set<string>();

  for (const source of secrets) {
    const read = await readAccount(source.secret, source.sourceId, source.label, source.livesAt);
    const accountKey = read.account.accountId || `${source.sourceId}:${source.secret.slice(-8)}`;
    if (seenAccounts.has(accountKey) && read.account.state === "ok") {
      continue;
    }
    seenAccounts.add(accountKey);
    accounts.push(read.account);
    if (read.truncated) truncated = true;
    for (const currency of read.otherCurrencies) otherCurrencies.add(currency);
    if (read.account.state !== "ok") continue;

    for (const charge of read.charges) {
      allHints.push(charge);
      const classified = classifyCharge(charge);
      const service = serviceLabel(charge);
      const intent =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id || undefined;
      const row: RevenueChargeRow = {
        id: charge.id || `${source.sourceId}-${charge.created}-${charge.amount}`,
        created: charge.created || 0,
        amount: charge.amount,
        currency: (charge.currency || "usd").toUpperCase(),
        service,
        streamId: classified.id,
        streamLabel: classified.label,
        streamSlug: classified.slug,
        accountSourceId: source.sourceId,
        accountLabel: read.account.accountName || source.label,
        accountId: read.account.accountId,
        email: charge.receipt_email || charge.billing_details?.email || undefined,
        last4: charge.payment_method_details?.card?.last4 || undefined,
        paymentIntent: intent
      };
      charges.push(row);
      const serviceKey = `${row.accountSourceId}::${row.streamId}::${row.service}`;
      const existing = serviceMap.get(serviceKey);
      if (existing) {
        existing.revenue30d += row.amount;
        existing.charges30d += 1;
      } else {
        serviceMap.set(serviceKey, {
          service: row.service,
          streamId: row.streamId,
          streamLabel: row.streamLabel,
          streamSlug: row.streamSlug,
          accountSourceId: row.accountSourceId,
          accountLabel: row.accountLabel,
          revenue30d: row.amount,
          charges30d: 1
        });
      }
    }
  }

  const foundIds = new Set(accounts.map((account) => account.sourceId));
  for (const slot of KNOWN_SLOTS) {
    if (foundIds.has(slot.sourceId) || slot.sourceId === "desk-env" || slot.sourceId === "vault-shared") continue;
    accounts.push({
      sourceId: slot.sourceId,
      label: slot.label,
      livesAt: slot.livesAt,
      state: "no_key"
    });
  }

  if (!secrets.length) {
    accounts.unshift({
      sourceId: "desk-env",
      label: "Desk environment",
      livesAt: "Vercel app-engine · STRIPE_SECRET_KEY",
      state: "no_key"
    });
  }

  charges.sort((a, b) => b.created - a.created);
  const services = [...serviceMap.values()].sort((a, b) => b.revenue30d - a.revenue30d || a.service.localeCompare(b.service));

  return {
    accounts,
    services,
    charges,
    streams: groupRevenueStreams(allHints),
    revenue30d: charges.reduce((sum, charge) => sum + charge.amount, 0),
    charges30d: charges.length,
    truncated,
    otherCurrencies: [...otherCurrencies]
  };
}

export function stripePaymentUrl(charge: RevenueChargeRow): string | null {
  if (!charge.paymentIntent && !charge.id.startsWith("ch_")) return null;
  const path = charge.paymentIntent ? `payments/${charge.paymentIntent}` : `charges/${charge.id}`;
  return `https://dashboard.stripe.com/${path}`;
}
