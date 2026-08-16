// Stripe Connect for Group Buy — vendors onboard as Express accounts on the
// United Under God platform, members pay once, we keep campaign.commission_bps,
// the vendor receives the rest.
//
// Destination charges (application_fee + transfer_data.destination). No Stripe
// Product catalog is required — Checkout is given a dollar amount from our
// campaign items.

import { DASHBOARD_ORIGIN } from "@/lib/auth/hosts";
import { stripeConfigured, stripeGet, stripeRequest } from "@/lib/engine/stripe";
import { GroupBuyDbError, insertRow, selectOne, updateOne } from "./db";
import type { Campaign, Order, Vendor } from "./types";

const NOTE_OPEN = "<!--gb-stripe:";
const NOTE_CLOSE = "-->";

export type VendorPayout = {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
};

export function stripeConnectConfigured() {
  return stripeConfigured();
}

export function readVendorPayout(vendor: Vendor): VendorPayout {
  if (vendor.stripe_account_id) {
    return {
      accountId: vendor.stripe_account_id,
      chargesEnabled: vendor.stripe_charges_enabled === true,
      payoutsEnabled: vendor.stripe_payouts_enabled === true,
      detailsSubmitted: vendor.stripe_details_submitted === true
    };
  }

  return parseNoteMarker(vendor.notes);
}

export function vendorCanReceivePayouts(vendor: Vendor) {
  const payout = readVendorPayout(vendor);
  return Boolean(payout.accountId && payout.payoutsEnabled);
}

export function commissionCents(subtotalCents: number, commissionBps: number) {
  if (subtotalCents <= 0 || commissionBps <= 0) {
    return 0;
  }

  return Math.round((subtotalCents * commissionBps) / 10000);
}

type StripeAccount = {
  id: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
};

type CheckoutSession = {
  id: string;
  url?: string | null;
  payment_status?: string;
  client_reference_id?: string | null;
  payment_intent?: string | { id?: string } | null;
  metadata?: Record<string, string>;
};

async function noteEvent(input: {
  campaign_id?: string;
  order_id?: string;
  kind: string;
  actor?: string;
  payload?: Record<string, unknown>;
}) {
  try {
    await insertRow("gb_events", {
      campaign_id: input.campaign_id || null,
      order_id: input.order_id || null,
      kind: input.kind,
      actor: input.actor || null,
      payload: input.payload || {}
    });
  } catch {
    // Audit must never block a charge or an onboarding link.
  }
}

function parseNoteMarker(notes: string | null | undefined): VendorPayout {
  const empty: VendorPayout = {
    accountId: null,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false
  };

  if (!notes || !notes.includes(NOTE_OPEN)) {
    return empty;
  }

  const start = notes.indexOf(NOTE_OPEN) + NOTE_OPEN.length;
  const end = notes.indexOf(NOTE_CLOSE, start);

  if (end < 0) {
    return empty;
  }

  try {
    const parsed = JSON.parse(notes.slice(start, end)) as {
      account_id?: string;
      charges_enabled?: boolean;
      payouts_enabled?: boolean;
      details_submitted?: boolean;
    };

    return {
      accountId: parsed.account_id || null,
      chargesEnabled: parsed.charges_enabled === true,
      payoutsEnabled: parsed.payouts_enabled === true,
      detailsSubmitted: parsed.details_submitted === true
    };
  } catch {
    return empty;
  }
}

function writeNoteMarker(notes: string | null | undefined, payout: VendorPayout) {
  const stripped = (notes || "").replace(new RegExp(`${NOTE_OPEN}[\\s\\S]*?${NOTE_CLOSE}`, "g"), "").trim();
  const marker = `${NOTE_OPEN}${JSON.stringify({
    account_id: payout.accountId,
    charges_enabled: payout.chargesEnabled,
    payouts_enabled: payout.payoutsEnabled,
    details_submitted: payout.detailsSubmitted
  })}${NOTE_CLOSE}`;

  return stripped ? `${stripped}\n\n${marker}` : marker;
}

async function persistVendorPayout(vendor: Vendor, payout: VendorPayout): Promise<Vendor> {
  try {
    return await updateOne<Vendor>("gb_vendors", `id=eq.${vendor.id}`, {
      stripe_account_id: payout.accountId,
      stripe_charges_enabled: payout.chargesEnabled,
      stripe_payouts_enabled: payout.payoutsEnabled,
      stripe_details_submitted: payout.detailsSubmitted
    });
  } catch (error) {
    const detail = error instanceof GroupBuyDbError ? `${error.message} ${error.detail || ""}` : String(error);

    if (!/42703|PGRST204|does not exist|could not find/i.test(detail)) {
      throw error;
    }

    return updateOne<Vendor>("gb_vendors", `id=eq.${vendor.id}`, {
      notes: writeNoteMarker(vendor.notes, payout)
    });
  }
}

export async function refreshVendorPayout(vendor: Vendor): Promise<{ vendor: Vendor; payout: VendorPayout }> {
  const current = readVendorPayout(vendor);

  if (!current.accountId || !stripeConnectConfigured()) {
    return { vendor, payout: current };
  }

  const account = await stripeGet<StripeAccount>(`/v1/accounts/${encodeURIComponent(current.accountId)}`);
  const next: VendorPayout = {
    accountId: account.id,
    chargesEnabled: account.charges_enabled === true,
    payoutsEnabled: account.payouts_enabled === true,
    detailsSubmitted: account.details_submitted === true
  };

  const unchanged =
    next.accountId === current.accountId &&
    next.chargesEnabled === current.chargesEnabled &&
    next.payoutsEnabled === current.payoutsEnabled &&
    next.detailsSubmitted === current.detailsSubmitted;

  if (unchanged) {
    return { vendor, payout: current };
  }

  const saved = await persistVendorPayout(vendor, next);
  return { vendor: saved, payout: next };
}

export async function startVendorOnboarding(vendorId: string, actor: string) {
  if (!stripeConnectConfigured()) {
    throw new GroupBuyDbError(
      "United Under God's Stripe key is not on this app (STRIPE_SECRET_KEY). Connect cannot create a vendor payout account until that key is the verified UUG account.",
      503
    );
  }

  const vendor = await selectOne<Vendor>("gb_vendors", `select=*&id=eq.${vendorId}`);

  if (!vendor) {
    throw new GroupBuyDbError("Vendor not found.", 404);
  }

  let payout = readVendorPayout(vendor);

  if (!payout.accountId) {
    const created = await stripeRequest<StripeAccount>("/v1/accounts", {
      type: "express",
      country: "US",
      email: vendor.contact_email || undefined,
      "capabilities[transfers][requested]": true,
      "capabilities[card_payments][requested]": true,
      "business_profile[name]": vendor.name,
      "business_profile[product_description]": `Group-buy catalog vendor on United Under God (${vendor.slug}).`,
      "metadata[gb_vendor_id]": vendor.id,
      "metadata[gb_vendor_slug]": vendor.slug,
      "metadata[app_slug]": "united-under-god",
      "metadata[stream]": "group-buy"
    });

    payout = {
      accountId: created.id,
      chargesEnabled: created.charges_enabled === true,
      payoutsEnabled: created.payouts_enabled === true,
      detailsSubmitted: created.details_submitted === true
    };

    await persistVendorPayout(vendor, payout);
    await noteEvent({
      kind: "vendor.stripe_account_created",
      actor,
      payload: { vendor_id: vendor.id, stripe_account_id: created.id }
    });
  }

  const origin = DASHBOARD_ORIGIN;
  const link = await stripeRequest<{ url?: string }>("/v1/account_links", {
    account: payout.accountId,
    refresh_url: `${origin}/buying-group?connect=refresh&vendor=${vendor.id}`,
    return_url: `${origin}/buying-group?connect=done&vendor=${vendor.id}`,
    type: "account_onboarding"
  });

  if (!link.url) {
    throw new GroupBuyDbError("Stripe did not return an onboarding link.", 502);
  }

  return { url: link.url, payout };
}

export async function startOrderCheckout(input: {
  order: Order;
  campaign: Campaign;
  vendor: Vendor;
  successUrl: string;
  cancelUrl: string;
}) {
  if (!stripeConnectConfigured()) {
    throw new GroupBuyDbError("Stripe is not configured on this app.", 503);
  }

  const refreshed = await refreshVendorPayout(input.vendor);
  const payout = refreshed.payout;

  if (!payout.accountId || !payout.payoutsEnabled) {
    throw new GroupBuyDbError(
      `${input.vendor.name} has not finished Stripe payout setup, so this order cannot be charged yet.`,
      409
    );
  }

  const amount = input.order.total_cents || input.order.subtotal_cents;

  if (amount <= 0) {
    throw new GroupBuyDbError("This order has no amount to charge.", 409);
  }

  const fee = commissionCents(amount, input.campaign.commission_bps);

  if (fee >= amount) {
    throw new GroupBuyDbError(
      `The campaign commission (${input.campaign.commission_bps} bps) is as large as the order. That would leave the vendor nothing.`,
      409
    );
  }

  const session = await stripeRequest<CheckoutSession>("/v1/checkout/sessions", {
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.order.id,
    metadata: {
      stream: "group-buy",
      app_slug: "united-under-god",
      order_id: input.order.id,
      campaign_id: input.campaign.id,
      vendor_id: input.vendor.id
    },
    payment_intent_data: {
      application_fee_amount: fee,
      transfer_data: { destination: payout.accountId },
      description: `${input.campaign.title} · ${input.vendor.name}`,
      metadata: {
        stream: "group-buy",
        app_slug: "united-under-god",
        order_id: input.order.id,
        campaign_id: input.campaign.id,
        vendor_id: input.vendor.id
      }
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: input.campaign.currency || "usd",
          unit_amount: amount,
          product_data: {
            name: input.campaign.title,
            description:
              fee > 0
                ? `Includes United Under God's ${((input.campaign.commission_bps || 0) / 100).toFixed(2)}% group-buy fee.`
                : input.vendor.name
          }
        }
      }
    ]
  });

  if (!session.url) {
    throw new GroupBuyDbError("Stripe did not return a checkout URL.", 502);
  }

  await updateOne<Order>("gb_orders", `id=eq.${input.order.id}`, {
    payment_ref: session.id,
    payment_status: "unpaid"
  });

  await noteEvent({
    campaign_id: input.campaign.id,
    order_id: input.order.id,
    kind: "order.checkout_started",
    payload: { session_id: session.id, amount_cents: amount, fee_cents: fee }
  });

  return { url: session.url, sessionId: session.id, amountCents: amount, feeCents: fee };
}

export async function markOrderPaidFromCheckout(sessionId: string) {
  const session = await stripeGet<CheckoutSession>(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);

  if (session.payment_status !== "paid") {
    return { paid: false as const, order: null };
  }

  const orderId = session.metadata?.order_id || session.client_reference_id;

  if (!orderId) {
    throw new GroupBuyDbError("Checkout session is missing its order id.", 400);
  }

  const order = await selectOne<Order>("gb_orders", `select=*&id=eq.${orderId}`);

  if (!order) {
    throw new GroupBuyDbError("Checkout completed for an order we do not have.", 404);
  }

  if (order.payment_status === "paid" && order.status === "confirmed") {
    return { paid: true as const, order };
  }

  const intent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || session.id;

  const saved = await updateOne<Order>("gb_orders", `id=eq.${order.id}`, {
    status: "confirmed",
    payment_status: "paid",
    payment_ref: intent,
    confirmed_at: order.confirmed_at || new Date().toISOString()
  });

  await noteEvent({
    campaign_id: saved.campaign_id,
    order_id: saved.id,
    kind: "order.paid",
    payload: { session_id: session.id, payment_ref: intent }
  });

  return { paid: true as const, order: saved };
}
