// LPL Group Buy — the ecosystem's shared collective-purchasing client.
//
// Canonical source. Copy this file into any community app (KND, ChurchConnect,
// Neighborly, Barefoot, Live On Mission…) to let its members join a group order.
//
// Zero dependencies, SSR-safe, framework-agnostic on purpose: the ecosystem runs
// Next 15/16, Vite, and CRA, and all three must talk to the same hub.
//
// TWO HALVES, AND THE SPLIT MATTERS:
//
//   browseCampaigns / getCampaign   — public reads. Safe in a browser. No token.
//   placeOrder / getMyOrder / cancel — member writes. Require the app's token,
//                                      so they MUST run on the app's server.
//
// Placing an order asserts "I am user X in app Y". Only your server knows that
// truthfully, so only your server may hold the token. Shipping GROUP_BUY_TOKEN
// to a browser would let anyone order as anyone.

const DEFAULT_HUB = "https://appengine.unitedundergod.org";

export type GroupBuyConfig = {
  /** Which app is calling. Must match the app your token was issued for. */
  app: string;
  /** Hub base URL. Defaults to the AppEngine cockpit. */
  hub?: string;
  /** Server-side only. Never expose this to a browser bundle. */
  token?: string;
};

export type CampaignSummary = {
  slug: string;
  title: string;
  description: string | null;
  status: string;
  purchase_mode: "org_use" | "member_benefit";
  fulfillment: "drop_ship_member" | "ship_to_group" | "pickup";
  closes_at: string | null;
  currency: string;
  min_units: number;
  committed_units: number;
  units_remaining: number;
  member_count: number;
  percent_to_threshold: number;
  threshold_met: boolean;
  savings_cents: number;
  current_tier_label: string | null;
};

export type CampaignItem = {
  sku: string;
  name: string;
  description: string | null;
  image_url: string | null;
  unit: string;
  list_price_cents: number;
  unit_price_cents: number;
  max_qty_per_member: number | null;
};

export type CampaignDetail = {
  campaign: CampaignSummary & { tax_note: string; member_pays_shipping: boolean; opens_at: string | null };
  group: { slug: string; name: string; kind: string } | null;
  vendor: { slug: string; name: string; kind: string; lead_time_days: number | null } | null;
  progress: {
    committed_units: number;
    units_remaining: number;
    member_count: number;
    percent_to_threshold: number;
    threshold_met: boolean;
    savings_cents: number;
    current_tier_label: string | null;
  } | null;
  items: CampaignItem[];
  tiers: Array<{ label: string; min_units: number; unit_price_cents: number | null; discount_bps: number }>;
};

export type ShipTo = {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  phone?: string;
};

export type PlacedOrder = {
  id: string;
  status: string;
  unit_count: number;
  subtotal_cents: number;
  list_subtotal_cents: number;
  total_cents: number;
  savings_cents: number;
};

export class GroupBuyError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GroupBuyError";
    this.status = status;
  }
}

function hubUrl(config: GroupBuyConfig, path: string) {
  const base = (config.hub || DEFAULT_HUB).replace(/\/$/, "");
  return `${base}/api/group-buy${path}`;
}

async function call<T>(url: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };

  if (init.token) {
    headers.authorization = `Bearer ${init.token}`;
  }

  const response = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    cache: "no-store"
  });

  const text = await response.text();
  let body: Record<string, unknown> = {};

  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new GroupBuyError(`Group Buy hub returned a non-JSON response (${response.status}).`, response.status);
  }

  if (!response.ok || body.ok === false) {
    throw new GroupBuyError(String(body.message || `Group Buy hub rejected the request (${response.status}).`), response.status);
  }

  return body as T;
}

// ---------------------------------------------------------------- public reads

/** Open group orders. Safe to call from a browser — no token, no PII. */
export async function browseCampaigns(
  config: GroupBuyConfig,
  options: { groupSlug?: string; scopeToApp?: boolean } = {}
): Promise<CampaignSummary[]> {
  const params = new URLSearchParams();

  if (options.groupSlug) {
    params.set("group", options.groupSlug);
  }

  // Off by default: most campaigns are worth showing across the whole network,
  // which is the entire point of pooling several communities' demand.
  if (options.scopeToApp) {
    params.set("app", config.app);
  }

  const query = params.toString();
  const body = await call<{ campaigns: CampaignSummary[] }>(
    hubUrl(config, `/public/campaigns${query ? `?${query}` : ""}`)
  );

  return body.campaigns;
}

/** One campaign's buy sheet. Safe in a browser. */
export async function getCampaign(config: GroupBuyConfig, slug: string): Promise<CampaignDetail> {
  return call<CampaignDetail>(hubUrl(config, `/public/campaigns/${encodeURIComponent(slug)}`));
}

// ---------------------------------------------------------------- member writes
//
// Server-side only. Every one of these needs config.token.

function requireToken(config: GroupBuyConfig): string {
  if (!config.token) {
    throw new GroupBuyError(
      "Group Buy member actions need the app token, so they must run on your server — never in a browser bundle.",
      401
    );
  }

  return config.token;
}

export type PlaceOrderInput = {
  campaign: string;
  /** Your app's own user id. Never an email — ids are stable, emails are not. */
  userId: string;
  items: Array<{ sku: string; qty: number }>;
  shipTo?: ShipTo;
  email?: string;
  displayName?: string;
  notes?: string;
  /** false leaves the order as a cart that doesn't count toward the threshold. */
  confirm?: boolean;
};

export async function placeOrder(
  config: GroupBuyConfig,
  input: PlaceOrderInput
): Promise<{
  order: PlacedOrder;
  needs_shipping_address: boolean;
  tax_note: string;
  progress: CampaignSummary | null;
}> {
  return call(hubUrl(config, "/public/orders"), {
    method: "POST",
    token: requireToken(config),
    body: JSON.stringify({
      app: config.app,
      campaign: input.campaign,
      user_id: input.userId,
      items: input.items,
      ship_to: input.shipTo,
      email: input.email,
      display_name: input.displayName,
      notes: input.notes,
      confirm: input.confirm !== false
    })
  });
}

export async function getMyOrder(config: GroupBuyConfig, campaign: string, userId: string) {
  const params = new URLSearchParams({ campaign, user_id: userId });

  return call<{
    order: (PlacedOrder & { ship_to: ShipTo; tracking_number: string | null; carrier: string | null }) | null;
    items: Array<{ sku: string; name: string; qty: number; unit_price_cents: number; line_total_cents: number }>;
  }>(hubUrl(config, `/public/orders?${params.toString()}`), { token: requireToken(config) });
}

export async function cancelMyOrder(config: GroupBuyConfig, campaign: string, userId: string) {
  return call<{ order: { id: string; status: string } }>(hubUrl(config, "/public/orders"), {
    method: "POST",
    token: requireToken(config),
    body: JSON.stringify({ app: config.app, action: "cancel", campaign, user_id: userId })
  });
}

// ---------------------------------------------------------------- presentation

export function formatMoney(cents: number, currency = "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

/**
 * The one line a member needs to decide whether to join. Says what is true right
 * now, never a projection — "you'd save $12" before a threshold is met is a
 * promise the group hasn't earned.
 */
export function progressLine(campaign: CampaignSummary): string {
  if (campaign.threshold_met) {
    return `Unlocked${campaign.current_tier_label ? ` — ${campaign.current_tier_label}` : ""}. ${campaign.member_count} neighbors in.`;
  }

  const need = campaign.units_remaining;

  return `${need} more ${need === 1 ? "unit" : "units"} unlocks the group price. ${campaign.member_count} ${
    campaign.member_count === 1 ? "member has" : "members have"
  } joined.`;
}

/**
 * What a member must be told before they pay, in plain words. Rendering the buy
 * sheet without this is how a group accidentally implies its tax exemption
 * covers a member's personal purchase.
 */
export function disclosureFor(detail: CampaignDetail): string[] {
  const notes: string[] = [detail.campaign.tax_note];

  if (detail.campaign.fulfillment === "drop_ship_member") {
    notes.push("Your order ships directly to your address from the supplier — not to the group.");
  } else if (detail.campaign.fulfillment === "pickup") {
    notes.push("This order is picked up in person; it is not shipped to you.");
  }

  if (!detail.campaign.threshold_met) {
    notes.push("If the group doesn't reach the minimum, this order is cancelled and you are not charged.");
  }

  if (detail.campaign.member_pays_shipping) {
    notes.push("Shipping is charged on your order.");
  }

  return notes;
}
