import { authenticateApp, corsJson, corsPreflight, groupBuyErrorResponse } from "@/lib/group-buy/http";
import { isGroupBuyConfigured } from "@/lib/group-buy/db";
import { cancelOrder, getMemberOrder, placeOrder } from "@/lib/group-buy/service";
import type { ShipTo } from "@/lib/group-buy/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Member order writes. The calling app authenticates with its own token and may
// only act for its own members — a KND token cannot place a ChurchConnect order.
// Satellite apps call this from their server, never from a browser.

function readShipTo(raw: unknown): ShipTo | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const str = (key: string) => {
    const value = source[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };

  return {
    name: str("name"),
    line1: str("line1"),
    line2: str("line2"),
    city: str("city"),
    state: str("state"),
    postal_code: str("postal_code"),
    country: str("country") || "US",
    phone: str("phone")
  };
}

export async function POST(request: Request) {
  if (!isGroupBuyConfigured()) {
    return corsJson({ ok: false, message: "Group Buy storage is not configured." }, 503);
  }

  const caller = await authenticateApp(request);

  if (!caller) {
    return corsJson({ ok: false, message: "A valid app token is required to place member orders." }, 401);
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return corsJson({ ok: false, message: "Expected a JSON body." }, 400);
  }

  const campaignSlug = String(body.campaign || body.campaign_slug || "").trim();
  const externalUserId = String(body.user_id || body.external_user_id || "").trim();

  if (!campaignSlug || !externalUserId) {
    return corsJson({ ok: false, message: "campaign and user_id are both required." }, 400);
  }

  // The token decides which app this is. A caller-supplied app_slug is only
  // honoured when it matches, so a stolen claim gets nothing.
  const claimedApp = String(body.app || body.app_slug || caller.appSlug).trim();

  if (claimedApp !== caller.appSlug) {
    return corsJson(
      { ok: false, message: `This token may only place orders for "${caller.appSlug}".` },
      403
    );
  }

  const action = String(body.action || "place");

  try {
    if (action === "cancel") {
      const order = await cancelOrder(campaignSlug, caller.appSlug, externalUserId);
      return corsJson({ ok: true, order: { id: order.id, status: order.status } });
    }

    const items = Array.isArray(body.items)
      ? (body.items as Array<Record<string, unknown>>).map((line) => ({
          sku: String(line.sku || ""),
          qty: Number(line.qty ?? line.quantity ?? 0)
        }))
      : [];

    const result = await placeOrder({
      campaignSlug,
      appSlug: caller.appSlug,
      externalUserId,
      email: typeof body.email === "string" ? body.email : null,
      displayName: typeof body.display_name === "string" ? body.display_name : null,
      items,
      shipTo: readShipTo(body.ship_to),
      notes: typeof body.notes === "string" ? body.notes : null,
      confirm: body.confirm !== false
    });

    return corsJson({
      ok: true,
      order: {
        id: result.order.id,
        status: result.order.status,
        unit_count: result.order.unit_count,
        subtotal_cents: result.order.subtotal_cents,
        list_subtotal_cents: result.order.list_subtotal_cents,
        total_cents: result.order.total_cents,
        savings_cents: Math.max(0, result.order.list_subtotal_cents - result.order.subtotal_cents)
      },
      needs_shipping_address: result.needs_shipping_address,
      checkout_required: result.checkout_required,
      tax_note: result.tax_note,
      progress: result.progress
        ? {
            committed_units: result.progress.committed_units,
            units_remaining: result.progress.units_remaining,
            member_count: result.progress.member_count,
            percent_to_threshold: result.progress.percent_to_threshold,
            threshold_met: result.progress.threshold_met,
            current_tier_label: result.progress.current_tier_label
          }
        : null
    });
  } catch (error) {
    return groupBuyErrorResponse(error);
  }
}

// A member reading back their own order. Token-gated for the same reason as the
// write: the response contains that member's shipping address.
export async function GET(request: Request) {
  if (!isGroupBuyConfigured()) {
    return corsJson({ ok: false, message: "Group Buy storage is not configured." }, 503);
  }

  const caller = await authenticateApp(request);

  if (!caller) {
    return corsJson({ ok: false, message: "A valid app token is required." }, 401);
  }

  const url = new URL(request.url);
  const campaignSlug = url.searchParams.get("campaign") || "";
  const externalUserId = url.searchParams.get("user_id") || "";

  if (!campaignSlug || !externalUserId) {
    return corsJson({ ok: false, message: "campaign and user_id are both required." }, 400);
  }

  try {
    const found = await getMemberOrder(campaignSlug, caller.appSlug, externalUserId);

    if (!found) {
      return corsJson({ ok: true, order: null, items: [] });
    }

    return corsJson({
      ok: true,
      order: {
        id: found.order.id,
        status: found.order.status,
        unit_count: found.order.unit_count,
        subtotal_cents: found.order.subtotal_cents,
        total_cents: found.order.total_cents,
        ship_to: found.order.ship_to,
        tracking_number: found.order.tracking_number,
        carrier: found.order.carrier
      },
      items: found.items.map((item) => ({
        sku: item.sku,
        name: item.name,
        qty: item.qty,
        unit_price_cents: item.unit_price_cents,
        line_total_cents: item.line_total_cents
      }))
    });
  } catch (error) {
    return groupBuyErrorResponse(error);
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
