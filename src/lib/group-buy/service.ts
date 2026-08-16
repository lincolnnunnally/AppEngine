// Group Buy service — the whole lifecycle of a pooled purchase.
//
//   draft → open → (members order) → threshold_met → locked → ordered → shipped → closed
//
// Two rules drive most of this file:
//
//  1. Prices come from the server, never the caller. A member posts SKUs and
//     quantities; every cent is looked up from gb_campaign_items.
//  2. A member is never charged more than the price they saw. Tiers only improve
//     with volume, so repricing at lock can lower a member's price, never raise it.

import {
  GroupBuyDbError,
  deleteRows,
  insertRow,
  insertRows,
  selectOne,
  selectRows,
  updateOne,
  updateRows,
  upsertRow
} from "./db";
import { vendorCanReceivePayouts } from "./connect";
import { buildManifest, taxNoteFor } from "./manifest";
import type {
  BuyingGroup,
  Campaign,
  CampaignItem,
  CampaignProgress,
  CampaignTier,
  DropShipManifest,
  ManifestDestination,
  Member,
  Order,
  OrderItem,
  PurchaseOrder,
  ShipTo,
  Vendor
} from "./types";

const ORDERABLE_STATUSES = new Set(["confirmed", "fulfilled"]);

// ---------------------------------------------------------------- vendors

export async function listVendors(options: { dropShipOnly?: boolean; status?: string } = {}) {
  const filters = ["select=*", "order=kind.asc,name.asc"];

  if (options.dropShipOnly) {
    filters.push("ships_to_member_addresses=is.true");
  }

  if (options.status) {
    filters.push(`status=eq.${encodeURIComponent(options.status)}`);
  }

  return selectRows<Vendor>("gb_vendors", filters.join("&"));
}

export async function getVendorBySlug(slug: string) {
  return selectOne<Vendor>("gb_vendors", `select=*&slug=eq.${encodeURIComponent(slug)}`);
}

// ---------------------------------------------------------------- groups

export async function listGroups() {
  return selectRows<BuyingGroup>("gb_groups", "select=*&order=name.asc");
}

export async function getGroupBySlug(slug: string) {
  return selectOne<BuyingGroup>("gb_groups", `select=*&slug=eq.${encodeURIComponent(slug)}`);
}

// A satellite app calls this the first time one of its orgs joins the network.
export async function ensureGroup(input: {
  slug: string;
  name: string;
  kind?: BuyingGroup["kind"];
  app_slug?: string;
  org_ref?: string;
  region?: string;
}) {
  const existing = await getGroupBySlug(input.slug);

  if (existing) {
    return existing;
  }

  return insertRow<BuyingGroup>("gb_groups", {
    slug: input.slug,
    name: input.name,
    kind: input.kind || "other",
    app_slug: input.app_slug || null,
    org_ref: input.org_ref || null,
    region: input.region || null
  });
}

// ---------------------------------------------------------------- members
//
// Apps in this ecosystem do not share one auth system (GoTrue uuid in most,
// a custom JWT in ChurchConnect), so a member is identified by the pair
// (app_slug, external_user_id) — never by email, which changes and collides.

export async function ensureMember(input: {
  group_id: string;
  app_slug: string;
  external_user_id: string;
  email?: string | null;
  display_name?: string | null;
}) {
  return upsertRow<Member>(
    "gb_members",
    {
      group_id: input.group_id,
      app_slug: input.app_slug,
      external_user_id: input.external_user_id,
      email: input.email || null,
      display_name: input.display_name || null
    },
    "group_id,app_slug,external_user_id"
  );
}

// ---------------------------------------------------------------- campaigns

export async function getCampaignBySlug(slug: string) {
  return selectOne<Campaign>("gb_campaigns", `select=*&slug=eq.${encodeURIComponent(slug)}`);
}

export async function getProgress(campaignId: string) {
  return selectOne<CampaignProgress>(
    "gb_campaign_progress",
    `select=*&campaign_id=eq.${encodeURIComponent(campaignId)}`
  );
}

export async function listCampaignItems(campaignId: string) {
  return selectRows<CampaignItem>(
    "gb_campaign_items",
    `select=*&campaign_id=eq.${encodeURIComponent(campaignId)}&is_active=is.true&order=sort_order.asc,name.asc`
  );
}

export async function listCampaignTiers(campaignId: string) {
  return selectRows<CampaignTier>(
    "gb_campaign_tiers",
    `select=*&campaign_id=eq.${encodeURIComponent(campaignId)}&order=min_units.asc,min_subtotal_cents.asc`
  );
}

// Campaigns a given member-facing app should show. Either scoped to one group
// or, for cross-community campaigns, every open campaign in the network.
export async function listOpenCampaigns(options: { groupSlug?: string; appSlug?: string } = {}) {
  const filters = ["select=*", "status=in.(open,threshold_met)", "order=closes_at.asc.nullslast"];

  if (options.groupSlug) {
    const group = await getGroupBySlug(options.groupSlug);

    if (!group) {
      return [];
    }

    filters.push(`group_id=eq.${group.id}`);
  }

  if (options.appSlug) {
    filters.push(`app_slug=eq.${encodeURIComponent(options.appSlug)}`);
  }

  const campaigns = await selectRows<Campaign>("gb_campaigns", filters.join("&"));

  if (campaigns.length === 0) {
    return [];
  }

  const ids = campaigns.map((c) => c.id).join(",");
  const progress = await selectRows<CampaignProgress>(
    "gb_campaign_progress",
    `select=*&campaign_id=in.(${ids})`
  );
  const byId = new Map(progress.map((p) => [p.campaign_id, p]));

  return campaigns.map((campaign) => ({ campaign, progress: byId.get(campaign.id) || null }));
}

export async function getCampaignDetail(slug: string) {
  const campaign = await getCampaignBySlug(slug);

  if (!campaign) {
    return null;
  }

  const [progress, items, tiers, vendor, group] = await Promise.all([
    getProgress(campaign.id),
    listCampaignItems(campaign.id),
    listCampaignTiers(campaign.id),
    selectOne<Vendor>("gb_vendors", `select=*&id=eq.${campaign.vendor_id}`),
    selectOne<BuyingGroup>("gb_groups", `select=*&id=eq.${campaign.group_id}`)
  ]);

  return { campaign, progress, items, tiers, vendor, group, tax_note: taxNoteFor(campaign) };
}

// Every campaign in the network, with progress attached — the cockpit view.
export async function listAllCampaigns() {
  const campaigns = await selectRows<Campaign>("gb_campaigns", "select=*&order=created_at.desc");

  if (campaigns.length === 0) {
    return [];
  }

  const [progress, vendors, groups] = await Promise.all([
    selectRows<CampaignProgress>("gb_campaign_progress", "select=*"),
    selectRows<Vendor>("gb_vendors", "select=id,slug,name"),
    selectRows<BuyingGroup>("gb_groups", "select=id,slug,name,kind")
  ]);

  const progressById = new Map(progress.map((p) => [p.campaign_id, p]));
  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  const groupById = new Map(groups.map((g) => [g.id, g]));

  return campaigns.map((campaign) => ({
    campaign,
    progress: progressById.get(campaign.id) || null,
    vendor: vendorById.get(campaign.vendor_id) || null,
    group: groupById.get(campaign.group_id) || null
  }));
}

export type CreateCampaignInput = {
  groupSlug: string;
  vendorSlug: string;
  slug: string;
  title: string;
  description?: string | null;
  purchaseMode?: Campaign["purchase_mode"];
  fulfillment?: Campaign["fulfillment"];
  minUnits?: number;
  minSubtotalCents?: number;
  closesAt?: string | null;
  commissionBps?: number;
  appSlug?: string | null;
  createdBy?: string | null;
  open?: boolean;
  tiers?: Array<{ label: string; min_units: number; unit_price_cents?: number | null; discount_bps?: number }>;
  items?: Array<{
    sku: string;
    name: string;
    description?: string | null;
    image_url?: string | null;
    unit?: string;
    list_price_cents: number;
    unit_price_cents: number;
    max_qty_per_member?: number | null;
  }>;
};

export async function createCampaign(input: CreateCampaignInput) {
  const [group, vendor] = await Promise.all([
    getGroupBySlug(input.groupSlug),
    getVendorBySlug(input.vendorSlug)
  ]);

  if (!group) {
    throw new GroupBuyDbError(`No buying group with slug "${input.groupSlug}".`, 404);
  }

  if (!vendor) {
    throw new GroupBuyDbError(`No vendor with slug "${input.vendorSlug}".`, 404);
  }

  const fulfillment = input.fulfillment || "drop_ship_member";
  const purchaseMode = input.purchaseMode || "member_benefit";

  // Fail here with a sentence rather than letting the DB constraint fire, so the
  // cockpit can say what to change.
  if (fulfillment === "drop_ship_member" && !vendor.ships_to_member_addresses) {
    throw new GroupBuyDbError(
      `${vendor.name} is not recorded as shipping to individual member addresses. ` +
        "Use ship_to_group or pickup, or update the vendor once you've confirmed drop-ship with them.",
      409
    );
  }

  const campaign = await insertRow<Campaign>("gb_campaigns", {
    group_id: group.id,
    vendor_id: vendor.id,
    slug: input.slug,
    title: input.title,
    description: input.description || null,
    purchase_mode: purchaseMode,
    fulfillment,
    status: input.open ? "open" : "draft",
    opens_at: input.open ? new Date().toISOString() : null,
    closes_at: input.closesAt || null,
    min_units: input.minUnits ?? 0,
    min_subtotal_cents: input.minSubtotalCents ?? 0,
    commission_bps: input.commissionBps ?? 0,
    app_slug: input.appSlug || null,
    created_by: input.createdBy || null
  });

  if (input.tiers?.length) {
    await insertRows(
      "gb_campaign_tiers",
      input.tiers.map((tier, index) => ({
        campaign_id: campaign.id,
        label: tier.label,
        min_units: tier.min_units,
        unit_price_cents: tier.unit_price_cents ?? null,
        discount_bps: tier.discount_bps ?? 0,
        sort_order: index
      }))
    );
  }

  if (input.items?.length) {
    await insertRows(
      "gb_campaign_items",
      input.items.map((item, index) => ({
        campaign_id: campaign.id,
        sku: item.sku,
        name: item.name,
        description: item.description || null,
        image_url: item.image_url || null,
        unit: item.unit || "each",
        list_price_cents: item.list_price_cents,
        unit_price_cents: item.unit_price_cents,
        max_qty_per_member: item.max_qty_per_member ?? null,
        sort_order: index
      }))
    );
  }

  await recordEvent({
    campaign_id: campaign.id,
    kind: "campaign.created",
    actor: input.createdBy || "cockpit",
    payload: { slug: campaign.slug, vendor: vendor.slug, group: group.slug }
  });

  return campaign;
}

export async function setCampaignStatus(campaignId: string, status: Campaign["status"], actor: string) {
  const campaign = await updateOne<Campaign>("gb_campaigns", `id=eq.${campaignId}`, {
    status,
    ...(status === "open" ? { opens_at: new Date().toISOString() } : {})
  });

  await recordEvent({ campaign_id: campaignId, kind: `campaign.${status}`, actor, payload: {} });

  return campaign;
}

// ---------------------------------------------------------------- pricing

// The best tier the group has actually earned. Tiers are sorted ascending, so
// the last one whose thresholds are cleared wins.
export function resolveTier(tiers: CampaignTier[], units: number, subtotalCents: number): CampaignTier | null {
  let winner: CampaignTier | null = null;

  for (const tier of tiers) {
    if (units >= tier.min_units && subtotalCents >= tier.min_subtotal_cents) {
      winner = tier;
    }
  }

  return winner;
}

export function priceForTier(baseUnitPriceCents: number, tier: CampaignTier | null): number {
  if (!tier) {
    return baseUnitPriceCents;
  }

  if (tier.unit_price_cents !== null && tier.unit_price_cents !== undefined) {
    return tier.unit_price_cents;
  }

  if (tier.discount_bps > 0) {
    return Math.round(baseUnitPriceCents * (1 - tier.discount_bps / 10000));
  }

  return baseUnitPriceCents;
}

// ---------------------------------------------------------------- orders

export type OrderLineInput = { sku: string; qty: number };

export type PlaceOrderInput = {
  campaignSlug: string;
  appSlug: string;
  externalUserId: string;
  email?: string | null;
  displayName?: string | null;
  items: OrderLineInput[];
  shipTo?: ShipTo | null;
  notes?: string | null;
  confirm?: boolean;
};

export function shipToIsComplete(shipTo: ShipTo | null | undefined): boolean {
  return Boolean(shipTo && shipTo.line1 && shipTo.city && shipTo.postal_code);
}

export async function placeOrder(input: PlaceOrderInput) {
  const campaign = await getCampaignBySlug(input.campaignSlug);

  if (!campaign) {
    throw new GroupBuyDbError(`No campaign with slug "${input.campaignSlug}".`, 404);
  }

  if (campaign.status !== "open" && campaign.status !== "threshold_met") {
    throw new GroupBuyDbError(`Campaign "${campaign.slug}" is ${campaign.status} and is not taking orders.`, 409);
  }

  const cleanItems = (input.items || [])
    .map((line) => ({ sku: String(line.sku || "").trim(), qty: Math.floor(Number(line.qty) || 0) }))
    .filter((line) => line.sku && line.qty > 0);

  if (cleanItems.length === 0) {
    throw new GroupBuyDbError("An order needs at least one item with a quantity above zero.", 400);
  }

  const [items, tiers, progress, group] = await Promise.all([
    listCampaignItems(campaign.id),
    listCampaignTiers(campaign.id),
    getProgress(campaign.id),
    selectOne<BuyingGroup>("gb_groups", `select=*&id=eq.${campaign.group_id}`)
  ]);

  if (!group) {
    throw new GroupBuyDbError("This campaign's buying group is missing.", 500);
  }

  const bySku = new Map(items.map((item) => [item.sku, item]));
  const tier = resolveTier(tiers, progress?.committed_units || 0, progress?.committed_subtotal_cents || 0);

  // Prices are resolved here, from the catalog — never taken from the request.
  const lines = cleanItems.map((line) => {
    const item = bySku.get(line.sku);

    if (!item) {
      throw new GroupBuyDbError(`"${line.sku}" is not an item in this campaign.`, 400);
    }

    if (item.max_qty_per_member !== null && line.qty > item.max_qty_per_member) {
      throw new GroupBuyDbError(
        `${item.name} is limited to ${item.max_qty_per_member} per member (asked for ${line.qty}).`,
        400
      );
    }

    return {
      campaign_item_id: item.id,
      sku: item.sku,
      name: item.name,
      qty: line.qty,
      unit_price_cents: priceForTier(item.unit_price_cents, tier),
      list_price_cents: item.list_price_cents
    };
  });

  const member = await ensureMember({
    group_id: group.id,
    app_slug: input.appSlug,
    external_user_id: input.externalUserId,
    email: input.email,
    display_name: input.displayName
  });

  const vendor = await selectOne<Vendor>("gb_vendors", `select=*&id=eq.${campaign.vendor_id}`);
  const checkoutRequired = Boolean(vendor && vendorCanReceivePayouts(vendor));

  const shipTo = input.shipTo || null;
  const wantsConfirm = input.confirm !== false;
  const canConfirm =
    campaign.fulfillment !== "drop_ship_member" || shipToIsComplete(shipTo);
  // A Connect-ready vendor means the member pays first. Confirmed-but-unpaid
  // would count toward the threshold with no money behind it.
  const status: Order["status"] = wantsConfirm && canConfirm && !checkoutRequired ? "confirmed" : "pending";

  const existing = await selectOne<Order>(
    "gb_orders",
    `select=*&campaign_id=eq.${campaign.id}&member_id=eq.${member.id}&status=neq.cancelled`
  );

  let order: Order;

  if (existing) {
    order = await updateOne<Order>("gb_orders", `id=eq.${existing.id}`, {
      status,
      ship_to: shipTo || existing.ship_to,
      notes: input.notes ?? existing.notes,
      confirmed_at: status === "confirmed" ? existing.confirmed_at || new Date().toISOString() : null
    });

    await deleteRows("gb_order_items", `order_id=eq.${existing.id}`);
  } else {
    order = await insertRow<Order>("gb_orders", {
      campaign_id: campaign.id,
      member_id: member.id,
      status,
      ship_to: shipTo || {},
      notes: input.notes || null,
      confirmed_at: status === "confirmed" ? new Date().toISOString() : null
    });
  }

  await insertRows<OrderItem>(
    "gb_order_items",
    lines.map((line) => ({ ...line, order_id: order.id }))
  );

  // Totals are recomputed by a DB trigger off the line items, so re-read.
  const saved = await selectOne<Order>("gb_orders", `select=*&id=eq.${order.id}`);
  const freshProgress = await getProgress(campaign.id);

  await recordEvent({
    campaign_id: campaign.id,
    order_id: order.id,
    kind: existing ? "order.updated" : "order.placed",
    actor: `${input.appSlug}:${input.externalUserId}`,
    payload: { status, unit_count: saved?.unit_count ?? 0, subtotal_cents: saved?.subtotal_cents ?? 0 }
  });

  await syncThresholdStatus(campaign, freshProgress);

  return {
    order: saved || order,
    progress: freshProgress,
    needs_shipping_address: campaign.fulfillment === "drop_ship_member" && !shipToIsComplete(shipTo),
    checkout_required: checkoutRequired && (saved || order).payment_status !== "paid",
    tax_note: taxNoteFor(campaign)
  };
}

export async function getMemberOrder(campaignSlug: string, appSlug: string, externalUserId: string) {
  const campaign = await getCampaignBySlug(campaignSlug);

  if (!campaign) {
    return null;
  }

  const member = await selectOne<Member>(
    "gb_members",
    `select=*&group_id=eq.${campaign.group_id}&app_slug=eq.${encodeURIComponent(appSlug)}` +
      `&external_user_id=eq.${encodeURIComponent(externalUserId)}`
  );

  if (!member) {
    return null;
  }

  const order = await selectOne<Order>(
    "gb_orders",
    `select=*&campaign_id=eq.${campaign.id}&member_id=eq.${member.id}&status=neq.cancelled`
  );

  if (!order) {
    return null;
  }

  const items = await selectRows<OrderItem>("gb_order_items", `select=*&order_id=eq.${order.id}`);

  return { order, items };
}

export async function cancelOrder(campaignSlug: string, appSlug: string, externalUserId: string) {
  const found = await getMemberOrder(campaignSlug, appSlug, externalUserId);

  if (!found) {
    throw new GroupBuyDbError("No open order to cancel.", 404);
  }

  const campaign = await getCampaignBySlug(campaignSlug);

  if (campaign && !["open", "threshold_met"].includes(campaign.status)) {
    throw new GroupBuyDbError(
      `This campaign is ${campaign.status} — the order is already with the vendor and can't be cancelled here.`,
      409
    );
  }

  const order = await updateOne<Order>("gb_orders", `id=eq.${found.order.id}`, {
    status: "cancelled",
    cancelled_at: new Date().toISOString()
  });

  await recordEvent({
    campaign_id: order.campaign_id,
    order_id: order.id,
    kind: "order.cancelled",
    actor: `${appSlug}:${externalUserId}`,
    payload: {}
  });

  return order;
}

// ---------------------------------------------------------------- lifecycle

// Reflect threshold crossings in the campaign row so satellite apps can filter
// on status alone without recomputing the view.
async function syncThresholdStatus(campaign: Campaign, progress: CampaignProgress | null) {
  if (!progress) {
    return;
  }

  const next =
    progress.threshold_met && campaign.status === "open"
      ? "threshold_met"
      : !progress.threshold_met && campaign.status === "threshold_met"
        ? "open"
        : null;

  if (!next) {
    return;
  }

  await updateRows("gb_campaigns", `id=eq.${campaign.id}`, { status: next });

  await recordEvent({
    campaign_id: campaign.id,
    kind: next === "threshold_met" ? "campaign.threshold_met" : "campaign.threshold_lost",
    actor: "system",
    payload: {
      committed_units: progress.committed_units,
      min_units: campaign.min_units
    }
  });
}

// Repricing at lock: everyone gets the tier the whole group earned. Guarded so
// it can only ever lower what a member already agreed to pay.
export async function repriceCampaignToFinalTier(campaignId: string) {
  const [tiers, progress] = await Promise.all([listCampaignTiers(campaignId), getProgress(campaignId)]);

  if (!progress) {
    return { repriced: 0, tier: null as CampaignTier | null };
  }

  const tier = resolveTier(tiers, progress.committed_units, progress.committed_subtotal_cents);

  if (!tier) {
    return { repriced: 0, tier: null };
  }

  const orders = await selectRows<Order>(
    "gb_orders",
    `select=id&campaign_id=eq.${campaignId}&status=in.(confirmed,fulfilled)`
  );

  if (orders.length === 0) {
    return { repriced: 0, tier };
  }

  const orderIds = orders.map((o) => o.id).join(",");
  const items = await selectRows<OrderItem & { campaign_item_id: string | null }>(
    "gb_order_items",
    `select=*&order_id=in.(${orderIds})`
  );

  const campaignItems = await listCampaignItems(campaignId);
  const baseBySku = new Map(campaignItems.map((item) => [item.sku, item.unit_price_cents]));

  let repriced = 0;

  for (const item of items) {
    const base = baseBySku.get(item.sku) ?? item.unit_price_cents;
    const tierPrice = priceForTier(base, tier);
    // Never above the price the member already saw and agreed to.
    const finalPrice = Math.min(item.unit_price_cents, tierPrice);

    if (finalPrice !== item.unit_price_cents) {
      await updateRows("gb_order_items", `id=eq.${item.id}`, { unit_price_cents: finalPrice });
      repriced += 1;
    }
  }

  return { repriced, tier };
}

export async function lockCampaign(campaignId: string, actor: string) {
  const campaign = await selectOne<Campaign>("gb_campaigns", `select=*&id=eq.${campaignId}`);

  if (!campaign) {
    throw new GroupBuyDbError("Campaign not found.", 404);
  }

  const progress = await getProgress(campaignId);

  if (!progress?.threshold_met) {
    throw new GroupBuyDbError(
      `Threshold not met — ${progress?.committed_units ?? 0} of ${campaign.min_units} units committed. ` +
        "Locking now would commit the group to a price it hasn't earned.",
      409
    );
  }

  const { repriced, tier } = await repriceCampaignToFinalTier(campaignId);

  // gb_guard_campaign_lock re-checks the threshold in the database.
  const locked = await updateOne<Campaign>("gb_campaigns", `id=eq.${campaignId}`, {
    status: "locked",
    locked_at: new Date().toISOString()
  });

  await recordEvent({
    campaign_id: campaignId,
    kind: "campaign.locked",
    actor,
    payload: { repriced_lines: repriced, tier: tier?.label ?? null, units: progress.committed_units }
  });

  return { campaign: locked, repriced, tier };
}

// ---------------------------------------------------------------- purchase order

function poNumberFor(group: BuyingGroup, campaign: Campaign) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = campaign.id.slice(0, 6).toUpperCase();
  return `GB-${group.slug.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 10)}-${stamp}-${suffix}`;
}

export async function generatePurchaseOrder(campaignId: string, actor: string) {
  const campaign = await selectOne<Campaign>("gb_campaigns", `select=*&id=eq.${campaignId}`);

  if (!campaign) {
    throw new GroupBuyDbError("Campaign not found.", 404);
  }

  if (!["locked", "ordered"].includes(campaign.status)) {
    throw new GroupBuyDbError(
      `Campaign is ${campaign.status}. Lock it first — a purchase order is a commitment to the vendor.`,
      409
    );
  }

  const [vendor, group] = await Promise.all([
    selectOne<Vendor>("gb_vendors", `select=*&id=eq.${campaign.vendor_id}`),
    selectOne<BuyingGroup>("gb_groups", `select=*&id=eq.${campaign.group_id}`)
  ]);

  if (!vendor || !group) {
    throw new GroupBuyDbError("Campaign is missing its vendor or group.", 500);
  }

  const orders = await selectRows<Order>(
    "gb_orders",
    `select=*&campaign_id=eq.${campaignId}&status=in.(confirmed,fulfilled)&order=placed_at.asc`
  );

  if (orders.length === 0) {
    throw new GroupBuyDbError("No confirmed orders to send.", 409);
  }

  const orderIds = orders.map((o) => o.id).join(",");
  const [allItems, members] = await Promise.all([
    selectRows<OrderItem>("gb_order_items", `select=*&order_id=in.(${orderIds})`),
    selectRows<Member>("gb_members", `select=*&group_id=eq.${group.id}`)
  ]);

  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const item of allItems) {
    const bucket = itemsByOrder.get(item.order_id) || [];
    bucket.push(item);
    itemsByOrder.set(item.order_id, bucket);
  }

  const memberById = new Map(members.map((m) => [m.id, m]));

  const destinations: ManifestDestination[] = [];
  let listSubtotalCents = 0;

  for (const order of orders) {
    const lines = itemsByOrder.get(order.id) || [];

    if (lines.length === 0) {
      continue;
    }

    const member = memberById.get(order.member_id);
    listSubtotalCents += lines.reduce((sum, l) => sum + l.list_price_cents * l.qty, 0);

    destinations.push({
      order_id: order.id,
      member_ref: member ? `${member.app_slug}:${member.external_user_id}` : order.member_id,
      member_name: member?.display_name || null,
      ship_to: order.ship_to || {},
      lines: lines.map((l) => ({
        sku: l.sku,
        name: l.name,
        qty: l.qty,
        unit_price_cents: l.unit_price_cents
      })),
      unit_count: lines.reduce((sum, l) => sum + l.qty, 0),
      subtotal_cents: lines.reduce((sum, l) => sum + l.unit_price_cents * l.qty, 0)
    });
  }

  const poNumber = campaign.po_number || poNumberFor(group, campaign);
  const manifest = buildManifest({ poNumber, campaign, vendor, group, destinations, listSubtotalCents });

  const account = await selectOne<GroupVendorAccountRow>(
    "gb_group_vendor_accounts",
    `select=id&group_id=eq.${group.id}&vendor_id=eq.${vendor.id}`
  );

  const existing = await selectOne<PurchaseOrder>(
    "gb_purchase_orders",
    `select=*&campaign_id=eq.${campaignId}`
  );

  const values = {
    campaign_id: campaignId,
    vendor_id: vendor.id,
    group_vendor_account_id: account?.id ?? null,
    po_number: poNumber,
    status: "draft" as const,
    total_units: manifest.total_units,
    subtotal_cents: manifest.subtotal_cents,
    list_subtotal_cents: manifest.list_subtotal_cents,
    savings_cents: manifest.savings_cents,
    commission_cents: manifest.commission_cents,
    ship_to_count: manifest.total_destinations,
    tax_exemption_asserted: manifest.tax_exemption_asserted,
    manifest
  };

  const purchaseOrder = existing
    ? await updateOne<PurchaseOrder>("gb_purchase_orders", `id=eq.${existing.id}`, values)
    : await insertRow<PurchaseOrder>("gb_purchase_orders", values);

  if (!campaign.po_number) {
    await updateRows("gb_campaigns", `id=eq.${campaignId}`, { po_number: poNumber });
  }

  await recordEvent({
    campaign_id: campaignId,
    kind: "purchase_order.generated",
    actor,
    payload: {
      po_number: poNumber,
      destinations: manifest.total_destinations,
      cohorts: manifest.cohorts.length,
      units: manifest.total_units
    }
  });

  return { purchaseOrder, manifest };
}

type GroupVendorAccountRow = { id: string };

export async function getPurchaseOrder(campaignId: string) {
  return selectOne<PurchaseOrder>("gb_purchase_orders", `select=*&campaign_id=eq.${campaignId}`);
}

export async function getManifest(campaignId: string): Promise<DropShipManifest | null> {
  const purchaseOrder = await getPurchaseOrder(campaignId);
  return purchaseOrder?.manifest ?? null;
}

// ---------------------------------------------------------------- audit

export async function recordEvent(input: {
  campaign_id?: string | null;
  order_id?: string | null;
  kind: string;
  actor?: string | null;
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
    // The audit trail must never be the reason a member's order fails.
  }
}

export async function listEvents(campaignId: string, limit = 50) {
  return selectRows<{ id: string; kind: string; actor: string | null; payload: Record<string, unknown>; created_at: string }>(
    "gb_events",
    `select=*&campaign_id=eq.${encodeURIComponent(campaignId)}&order=created_at.desc&limit=${limit}`
  );
}
